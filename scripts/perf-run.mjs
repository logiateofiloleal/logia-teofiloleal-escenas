// Perf run for the scroll-driven scenes: loads the site with a COLD cache,
// waits for the preloader, scrolls the whole hero and reports the ?perf=1
// probe (exact vs stand-in draws, see src/lib/perfProbe.ts) plus the first-load
// weight and the time until the preloader leaves.
//
//   node scripts/perf-run.mjs --target prod                 # https://logiateofiloleal.com, no throttling
//   node scripts/perf-run.mjs --target local --throttle     # http://localhost:3111, ~10 Mbps / 40 ms
//   node scripts/perf-run.mjs --target https://deploy-preview-N--site.netlify.app --throttle --warm --runs 3
//
// Options:
//   --target  prod | local | <url>     (default local)
//   --net 10|50                        Network.emulateNetworkConditions: 10 Mbps / 40 ms or 50 Mbps / 30 ms (default: none)
//   --throttle                         alias of --net 10
//   --speed   normal | fast            (default normal: ~9 s end to end; fast: ~3 s)
//   --viewport 1440x900                (default 1440x900; 390x844 with --mobile)
//   --mobile                           mobile emulation (touch, DPR 3, portrait → "mobile" frame tier)
//   --path realistic                   scroll at normal speed (~1100 px/s) between the 4 stations (El Umbral, Los Principios,
//                                      La Memoria, La Puerta), pausing 3 s at each — what a person does. Replaces the
//                                      non-stop scroll (--speed), which stays as a harsher reference.
//   --down-only                        scroll down only (a first-time visitor; the way back re-fetches released scenes)
//   --warm                             visit twice in the SAME browser context: the first visit is cold and fills the
//                                      HTTP cache, the second is warm. The report adds, per visit, how the frame
//                                      requests were served (network / disk cache / 304 revalidation). With an
//                                      `immutable` Cache-Control a warm visit must show 0 network requests for URLs
//                                      the cold visit finished downloading.
//   --runs N                           repeat the whole profile N times (fresh browser context each) and report the
//                                      MEDIAN with (min–max) — a single run is too noisy to compare two builds
//   --json                             print the aggregated result as JSON only
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
const NETS = { 10: { latency: 40, mbps: 10 }, 50: { latency: 30, mbps: 50 } };
const netKey = opt('net', opt('throttle', false) ? '10' : 'none');
if (netKey !== 'none' && !NETS[netKey]) throw new Error(`--net must be 10 or 50 (got ${netKey})`);
const net = netKey === 'none' ? null : NETS[netKey];
const throttle = Boolean(net);
const realistic = opt('path', 'continuous') === 'realistic';
const PAUSE_MS = 3000;
const speed = opt('speed', 'normal');
const mobile = Boolean(opt('mobile', false));
const [vw, vh] = String(opt('viewport', mobile ? '390x844' : '1440x900')).split('x').map(Number);
const asJson = Boolean(opt('json', false));
const downOnly = Boolean(opt('down-only', false));
const warm = Boolean(opt('warm', false));
const runs = Math.max(1, Number(opt('runs', 1)) || 1);
const SCROLL_MS = speed === 'fast' ? 3000 : 9000;

const browser = await chromium.launch();

// One profile run = a fresh context (empty HTTP cache). Without --warm the cache
// is also disabled, so the way back up re-downloads released scenes (worst
// case); with --warm it is enabled and shared by both visits.
async function runProfile() {
  const ctx = await browser.newContext(
    mobile
      ? { viewport: { width: vw, height: vh }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
      : { viewport: { width: vw, height: vh } },
  );
  const seenFrameUrls = new Set();   // /frames/ URLs requested by earlier visits
  let unfinishedBefore = new Set();  // …of which the previous visit never saw finish (still in flight when it ended)

  async function visit(label) {
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: !warm });
    if (net) {
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: net.latency,
        downloadThroughput: (net.mbps * 1024 * 1024) / 8,
        uploadThroughput: (net.mbps * 1024 * 1024) / 16,
      });
    }

    let bytes = 0;
    const frameUrls = new Map(); // requestId → url, only /frames/
    const how = new Map();       // requestId → 'cache' | '304' | 'network' (first classification wins)
    const finished = new Set();  // requestIds that finished or failed
    cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; finished.add(e.requestId); });
    cdp.on('Network.loadingFailed', (e) => { finished.add(e.requestId); });
    cdp.on('Network.requestWillBeSent', (e) => { if (e.request.url.includes('/frames/')) frameUrls.set(e.requestId, e.request.url); });
    cdp.on('Network.requestServedFromCache', (e) => { if (frameUrls.has(e.requestId) && !how.has(e.requestId)) how.set(e.requestId, 'cache'); });
    cdp.on('Network.responseReceived', (e) => {
      if (!frameUrls.has(e.requestId) || how.has(e.requestId)) return;
      if (e.response.fromDiskCache || e.response.fromPrefetchCache) how.set(e.requestId, 'cache');
      else how.set(e.requestId, e.response.status === 304 ? '304' : 'network');
    });

    const t0 = Date.now();
    await page.goto(`${base}/?perf=1&memdebug=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => document.body.style.overflow === 'hidden', null, { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => document.body.style.overflow !== 'hidden', null, { timeout: 180000 });
    const preloaderMs = Date.now() - t0;
    const bytesAtPreloaderEnd = bytes;
    await page.evaluate(() => window.__perfProbe?.reset());

    // Scroll top → bottom of the hero at constant speed, then back up.
    const result = await page.evaluate(async ([ms, downOnly, realistic, pauseMs]) => {
      const hero = document.documentElement.scrollHeight - innerHeight;
      // `instant`: the page sets scroll-behavior: smooth, which would turn every
      // scrollTo into an animation and the run into a measurement of that.
      const run = (from, to, dur = ms) => new Promise((res) => {
        const t = performance.now();
        (function f(n) {
          const p = Math.min(1, (n - t) / dur);
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
      window.__perfProbe?.mark('scroll-start');
      if (realistic) {
        // Station by station at the same pace as the continuous "normal" run, resting 3 s on each.
        const pxPerMs = hero / ms;
        const stations = (window.__perfProbe?.stations ?? []).slice(0, 4);
        let y = 0;
        for (const target of stations) {
          if (target > y) {
            const dist = target - y;
            await run(y, target, dist / pxPerMs);
            y = target;
          }
          await new Promise((r) => setTimeout(r, pauseMs));
        }
      } else {
        await run(0, hero);
        if (!downOnly) await run(hero, 0);
      }
      await new Promise((r) => setTimeout(r, 500));
      clearInterval(sampler);
      return {
        peakMb,
        probe: window.__perfProbe ? JSON.parse(JSON.stringify(window.__perfProbe.data)) : null,
        timeline: window.__perfProbe ? JSON.parse(JSON.stringify(window.__perfProbe.timeline)) : [],
      };
    }, [SCROLL_MS, downOnly, realistic, PAUSE_MS]);
    await page.close();

    // How the frame requests were served. `repeated*` only counts URLs the
    // previous visit already requested: with `immutable` they must come from the
    // cache. `repeatedInFlight` is the part of those that the previous visit had
    // not finished downloading when it ended — those legitimately go to the network.
    const served = { network: 0, diskCache: 0, revalidated304: 0, repeatedNetwork: 0, repeated304: 0, repeatedInFlight: 0 };
    const unfinished = new Set();
    for (const [id, url] of frameUrls) {
      if (!finished.has(id)) unfinished.add(url);
      const h = how.get(id) ?? 'network';
      const seenBefore = seenFrameUrls.has(url);
      if (h === 'cache') served.diskCache++;
      else if (h === '304') { served.revalidated304++; if (seenBefore) served.repeated304++; }
      else {
        served.network++;
        if (seenBefore) { served.repeatedNetwork++; if (unfinishedBefore.has(url)) served.repeatedInFlight++; }
      }
    }
    for (const url of frameUrls.values()) seenFrameUrls.add(url);
    unfinishedBefore = unfinished;

    const out = {
      visit: label,
      preloaderMs, mbAtPreloaderEnd: +(bytesAtPreloaderEnd / 1048576).toFixed(2),
      mbTotal: +(bytes / 1048576).toFixed(2), frameRequests: frameUrls.size, framesServed: served,
      peakDecodedMb: result.peakMb,
      probeMissing: !result.probe,
      transitions: {},
      timeline: result.timeline,
    };
    for (const [id, t] of Object.entries(result.probe ?? {})) {
      const pct = (n) => +((100 * n) / Math.max(1, t.draws)).toFixed(1);
      out.transitions[id] = {
        draws: t.draws,
        far2Pct: pct(t.far2),      // main metric: stand-in 2+ frames away (distance 1 is not perceptible)
        far5Pct: pct(t.far5),
        fallbackPct: pct(t.fallback),
        noFramePct: pct(t.noFrame), // also counted in far2/far5
        maxDist: t.maxDist,
        // Why the exact frame was missing, for stand-ins 2+ frames away (share of those draws).
        farLevels: t.farLevels ?? [0, 0, 0, 0],
        farPackState: t.farPackState ?? {},
        far2Causes: t.causesFar2 ?? { a: 0, b: 0, c: 0 },
        allCauses: t.causes ?? { a: 0, b: 0, c: 0 },
      };
    }
    return out;
  }

  const visits = [await visit(warm ? 'fría' : 'única')];
  if (warm) visits.push(await visit('caliente'));
  await ctx.close();
  return visits;
}

const all = [];
for (let i = 0; i < runs; i++) {
  all.push(await runProfile());
  if (!asJson && runs > 1) console.error(`run ${i + 1}/${runs} listo`);
}
await browser.close();

// ── Aggregation: median (min–max) over runs ───────────────────────────
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmt = (xs, d = 1) => {
  const r = (n) => +n.toFixed(d);
  return runs === 1 ? `${r(xs[0])}` : `${r(median(xs))} (${r(Math.min(...xs))}–${r(Math.max(...xs))})`;
};
const col = (visitIdx, pick) => all.map((r) => pick(r[visitIdx]));

const summary = { target: base, throttle, speed, mobile, viewport: `${vw}x${vh}`, downOnly, runs, visits: [] };
for (let v = 0; v < all[0].length; v++) {
  const label = all[0][v].visit;
  const ids = Object.keys(all[0][v].transitions);
  const sumCauses = (id, key) => {
    const t = { a: 0, b: 0, c: 0 };
    for (const r of all) for (const k of 'abc') t[k] += r[v].transitions[id]?.[key]?.[k] ?? 0;
    return t;
  };
  summary.visits.push({
    visit: label,
    probeMissing: all[0][v].probeMissing,
    preloaderMs: col(v, (x) => x.preloaderMs),
    mbTotal: col(v, (x) => x.mbTotal),
    peakDecodedMb: col(v, (x) => x.peakDecodedMb),
    frameRequests: col(v, (x) => x.frameRequests),
    served: Object.fromEntries(Object.keys(all[0][v].framesServed).map((k) => [k, col(v, (x) => x.framesServed[k])])),
    transitions: Object.fromEntries(ids.map((id) => [id, {
      far2Pct: col(v, (x) => x.transitions[id]?.far2Pct ?? 0),
      far5Pct: col(v, (x) => x.transitions[id]?.far5Pct ?? 0),
      fallbackPct: col(v, (x) => x.transitions[id]?.fallbackPct ?? 0),
      maxDist: col(v, (x) => x.transitions[id]?.maxDist ?? 0),
      noFramePct: col(v, (x) => x.transitions[id]?.noFramePct ?? 0),
      far2Causes: sumCauses(id, 'far2Causes'),
      allCauses: sumCauses(id, 'allCauses'),
      farLevels: [0, 1, 2, 3].map((l) => all.reduce((n, r) => n + (r[v].transitions[id]?.farLevels?.[l] ?? 0), 0)),
      farPackState: all.reduce((acc, r) => {
        for (const [k, n] of Object.entries(r[v].transitions[id]?.farPackState ?? {})) acc[k] = (acc[k] ?? 0) + n;
        return acc;
      }, {}),
    }])),
    timelines: all.map((r) => r[v].timeline ?? []),
  });
}

if (asJson) {
  console.log(JSON.stringify(summary));
} else {
  console.log(
    `\n${base}  throttle=${throttle}  speed=${speed}${downOnly ? ' down-only' : ''}${mobile ? ' mobile' : ''}  ` +
    `viewport=${vw}x${vh}  runs=${runs}  (mediana (mín–máx))`,
  );
  for (const v of summary.visits) {
    console.log(`\n[${v.visit}]`);
    if (v.probeMissing) console.log('(sin sonda: ese despliegue no incluye ?perf=1, solo se miden bytes y tiempo del preloader)');
    console.log(`preloader ${fmt(v.preloaderMs, 0)} ms · ${fmt(v.mbTotal)} MB totales · pico decodificado ${fmt(v.peakDecodedMb)} MB`);
    const s = v.served;
    console.log(
      `requests de frames ${fmt(v.frameRequests, 0)}: red ${fmt(s.network, 0)} · caché ${fmt(s.diskCache, 0)} · 304 ${fmt(s.revalidated304, 0)}` +
      (v.visit === 'caliente'
        ? ` | ya pedidos antes y aun así a la red: ${fmt(s.repeatedNetwork, 0)} (de ellos en vuelo al cerrar la visita fría: ${fmt(s.repeatedInFlight, 0)}), 304 repetidos: ${fmt(s.repeated304, 0)}`
        : ''),
    );
    for (const [id, t] of Object.entries(v.transitions)) {
      const c = t.far2Causes;
      const tot = c.a + c.b + c.c;
      const share = (n) => (tot ? `${Math.round((100 * n) / tot)}%` : '-');
      console.log(
        `${id}: a ≥2 frames ${fmt(t.far2Pct)}% · a ≥5 ${fmt(t.far5Pct)}% · cualquier stand-in ${fmt(t.fallbackPct)}% · sin ningún frame ${fmt(t.noFramePct)}% · dist máx ${fmt(t.maxDist, 0)}` +
        `  | causa de los ≥2 (suma ${runs} corr.): a(no descargado) ${c.a} ${share(c.a)} · b(sin decodificar) ${c.b} ${share(c.b)} · c(liberado) ${c.c} ${share(c.c)}`,
      );
      if (t.farLevels.some((n) => n > 0)) {
        console.log(
          `    ≥2 por pasada del pack que falta (1/8, 1/4, 1/2, resto): ${t.farLevels.join(' / ')} · estado del pack: ` +
          Object.entries(t.farPackState).map(([k, n]) => `${k} ${n}`).join(', '),
        );
      }
    }
    // Pack timeline of the first scene per run: when each pack started/ended vs the preloader leaving (ms since navigation).
    v.timelines.forEach((tl, i) => {
      const gate = tl.find((e) => e.ev === 'gate-open')?.t;
      const scroll = tl.find((e) => e.ev === 'scroll-start')?.t;
      const t1 = tl.filter((e) => e.id === 't1' && e.ev === 'pack-end').sort((a, b) => a.pack - b.pack);
      const starts = Object.fromEntries(tl.filter((e) => e.id === 't1' && e.ev === 'pack-start').map((e) => [e.pack, e.t]));
      const fmtPack = (e) => `p${e.pack}(1/${[8, 4, 2, 1][e.level]}) ${starts[e.pack] ?? '?'}→${e.t}`;
      console.log(
        `  línea de tiempo t1, corrida ${i + 1}: puerta del preloader @${gate ?? '?'} ms, inicio del scroll @${scroll ?? '?'} ms | packs ` +
        (t1.slice(0, 5).map(fmtPack).join(' · ') || 'ninguno'),
      );
    });
  }
}
