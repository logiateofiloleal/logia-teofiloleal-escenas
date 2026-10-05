// Perf run for the scroll-driven scenes: loads the site with a COLD cache,
// waits for the preloader, scrolls the whole hero and reports the ?perf=1
// probe (exact vs stand-in draws, see src/lib/perfProbe.ts) plus the first-load
// weight and the time until the preloader leaves.
//
//   node scripts/perf-run.mjs --target prod                 # https://logiateofiloleal.com, no throttling
//   node scripts/perf-run.mjs --target local --throttle     # http://localhost:3111, ~10 Mbps / 40 ms
//   node scripts/perf-run.mjs --target https://deploy-preview-N--site.netlify.app --throttle --warm
//
// Options:
//   --target  prod | local | <url>     (default local)
//   --throttle                         Network.emulateNetworkConditions: 10 Mbps down, 40 ms latency
//   --speed   normal | fast            (default normal: ~9 s end to end; fast: ~3 s)
//   --viewport 1440x900                (default 1440x900; 390x844 with --mobile)
//   --mobile                           mobile emulation (touch, DPR 3, portrait → "mobile" frame tier)
//   --down-only                        scroll down only (a first-time visitor; the way back re-fetches released scenes)
//   --warm                             visit twice in the SAME browser context: the first visit is cold and fills the
//                                      HTTP cache, the second is warm. The report adds, per visit, how the frame
//                                      requests were served (network / disk cache / 304 revalidation). With an
//                                      `immutable` Cache-Control a warm visit must show 0 network requests.
//   --json                             print the raw result as JSON only
//
// Local needs `pnpm build && PORT=3111 pnpm start` running.
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true);
};

const targetArg = opt('target', 'local');
const base =
  targetArg === 'prod' ? 'https://logiateofiloleal.com'
  : targetArg === 'local' ? 'http://localhost:3111'
  : String(targetArg).replace(/\/$/, '');
const throttle = Boolean(opt('throttle', false));
const speed = opt('speed', 'normal');
const mobile = Boolean(opt('mobile', false));
const [vw, vh] = String(opt('viewport', mobile ? '390x844' : '1440x900')).split('x').map(Number);
const asJson = Boolean(opt('json', false));
const downOnly = Boolean(opt('down-only', false));
const warm = Boolean(opt('warm', false));
const SCROLL_MS = speed === 'fast' ? 3000 : 9000;

const browser = await chromium.launch();
// A fresh context = empty HTTP cache. Without --warm the cache is also disabled,
// so the way back up re-downloads released scenes (worst case); with --warm it is
// enabled and shared by both visits.
const ctx = await browser.newContext(
  mobile
    ? { viewport: { width: vw, height: vh }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: vw, height: vh } },
);

const seenFrameUrls = new Set(); // /frames/ URLs requested by earlier visits

async function visit(label) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: !warm });
  if (throttle) {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 40,
      downloadThroughput: (10 * 1024 * 1024) / 8,
      uploadThroughput: (5 * 1024 * 1024) / 8,
    });
  }

  let bytes = 0;
  const frameUrls = new Map(); // requestId → url, only /frames/
  const how = new Map();       // requestId → 'cache' | '304' | 'network' (first classification wins)
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });
  cdp.on('Network.requestWillBeSent', (e) => { if (e.request.url.includes('/frames/')) frameUrls.set(e.requestId, e.request.url); });
  cdp.on('Network.requestServedFromCache', (e) => { if (frameUrls.has(e.requestId) && !how.has(e.requestId)) how.set(e.requestId, 'cache'); });
  cdp.on('Network.responseReceived', (e) => {
    if (!frameUrls.has(e.requestId) || how.has(e.requestId)) return;
    if (e.response.fromDiskCache || e.response.fromPrefetchCache) how.set(e.requestId, 'cache');
    else how.set(e.requestId, e.response.status === 304 ? '304' : 'network');
  });

  const t0 = Date.now();
  await page.goto(`${base}/?perf=1&memdebug=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.style.overflow === 'hidden', null, { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => document.body.style.overflow !== 'hidden', null, { timeout: 180000 });
  const preloaderMs = Date.now() - t0;
  const bytesAtPreloaderEnd = bytes;
  await page.evaluate(() => window.__perfProbe?.reset());

  // Scroll top → bottom of the hero at constant speed, then back up.
  const result = await page.evaluate(async ([ms, downOnly]) => {
    const hero = document.documentElement.scrollHeight - innerHeight;
    // `instant`: the page sets scroll-behavior: smooth, which would turn every
    // scrollTo into an animation and the run into a measurement of that.
    const run = (from, to) => new Promise((res) => {
      const t = performance.now();
      (function f(n) {
        const p = Math.min(1, (n - t) / ms);
        scrollTo({ top: from + (to - from) * p, behavior: 'instant' });
        p < 1 ? requestAnimationFrame(f) : res();
      })(t);
    });
    // Peak of the memdebug overlay (decoded frame memory) while scrolling.
    let peakMb = 0;
    const sampler = setInterval(() => {
      const el = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && /live memory/.test(d.textContent));
      const m = el && /memory:\s*([\d.]+)/.exec(el.textContent);
      if (m) peakMb = Math.max(peakMb, +m[1]);
    }, 200);
    await run(0, hero);
    if (!downOnly) await run(hero, 0);
    await new Promise((r) => setTimeout(r, 500));
    clearInterval(sampler);
    return {
      peakMb,
      probe: window.__perfProbe ? JSON.parse(JSON.stringify(window.__perfProbe.data)) : null,
    };
  }, [SCROLL_MS, downOnly]);
  await page.close();

  // How the frame requests were served. `repeated*` only counts URLs the
  // previous visit already downloaded: with `immutable` they must come from the
  // cache — any network hit or 304 there means the header is not applying.
  const served = { network: 0, diskCache: 0, revalidated304: 0, repeatedNetwork: 0, repeated304: 0 };
  for (const [id, url] of frameUrls) {
    const h = how.get(id) ?? 'network';
    const seenBefore = seenFrameUrls.has(url);
    if (h === 'cache') served.diskCache++;
    else if (h === '304') { served.revalidated304++; if (seenBefore) served.repeated304++; }
    else { served.network++; if (seenBefore) served.repeatedNetwork++; }
  }
  for (const url of frameUrls.values()) seenFrameUrls.add(url);

  const out = {
    visit: label,
    target: base, throttle, speed, mobile, viewport: `${vw}x${vh}`,
    preloaderMs, mbAtPreloaderEnd: +(bytesAtPreloaderEnd / 1048576).toFixed(2),
    mbTotal: +(bytes / 1048576).toFixed(2), frameRequests: frameUrls.size, framesServed: served,
    peakDecodedMb: result.peakMb,
    probeMissing: !result.probe,
    transitions: {},
  };
  for (const [id, t] of Object.entries(result.probe ?? {})) {
    const pct = (n) => +((100 * n) / Math.max(1, t.draws)).toFixed(1);
    out.transitions[id] = {
      draws: t.draws,
      far2Pct: pct(t.far2),      // main metric: stand-in 2+ frames away (distance 1 is not perceptible)
      far5Pct: pct(t.far5),
      fallbackPct: pct(t.fallback),
      noFramePct: pct(t.noFrame),
      maxDist: t.maxDist,
      fallbackByLpDecile: t.byLp.map((b) => (b.draws ? Math.round((100 * b.fallback) / b.draws) : null)),
    };
  }
  return out;
}

const results = [await visit(warm ? 'fría' : 'única')];
if (warm) results.push(await visit('caliente'));
await browser.close();

if (asJson) {
  console.log(JSON.stringify(results));
} else {
  for (const out of results) {
    console.log(
      `\n[${out.visit}] ${out.target}  throttle=${out.throttle}  speed=${out.speed}${downOnly ? ' down-only' : ''}` +
      `${out.mobile ? ' mobile' : ''}  viewport=${out.viewport}`,
    );
    if (out.probeMissing) console.log('(sin sonda: ese despliegue no incluye ?perf=1, solo se miden bytes y tiempo del preloader)');
    console.log(
      `preloader: ${out.preloaderMs} ms · ${out.mbAtPreloaderEnd} MB hasta que se va · ${out.mbTotal} MB total · ` +
      `pico decodificado ${out.peakDecodedMb} MB`,
    );
    const s = out.framesServed;
    console.log(
      `frames: ${out.frameRequests} requests → red ${s.network} · caché ${s.diskCache} · 304 ${s.revalidated304}` +
      (out.visit === 'caliente'
        ? `  | ya descargados en la visita fría pero pedidos a la red: ${s.repeatedNetwork}, revalidados (304): ${s.repeated304}`
        : ''),
    );
    for (const [id, t] of Object.entries(out.transitions)) {
      console.log(
        `${id}: draws=${t.draws} a ≥2 frames=${t.far2Pct}% a ≥5=${t.far5Pct}% (cualquier stand-in=${t.fallbackPct}%, sin frame=${t.noFramePct}%) distMax=${t.maxDist}`,
      );
      console.log(`    stand-in % por tramo de lp (0-10%…90-100%): ${t.fallbackByLpDecile.join(' ')}`);
    }
  }
}
