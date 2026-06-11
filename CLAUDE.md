# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (auto-reload on file change)
npm run dev

# Production
npm start
```

No build step, no test suite, no linter. Server runs on `http://localhost:3000` (default) or `PORT` from `.env`.

## Environment setup

Create `.env` in project root before starting — server exits on missing values:

```
ADMIN_USER=<username>
ADMIN_PASS=<password>
PORT=3000
```

`backend/data/aspirantes.json` is auto-created on first start (gitignored).

## Architecture

**Stack**: Vanilla HTML/CSS/JS frontend + Express.js backend. No framework, no bundler.

**Entry points**:
- `index-escenas.html` — primary deliverable: scroll-driven visual experience
- `index.html` — original base page

**Backend** (`backend/server.js`):
- Serves all static files from project root via `express.static`
- Auth: in-memory `Map<token, {creadoEn}>` with `crypto.randomBytes(32)` Bearer tokens
- Data: flat JSON file at `backend/data/aspirantes.json` (read/write on every request)
- No token expiry implemented — sessions live until server restart or explicit logout

**Scroll engine** (`js/escenas.js`):
- 5 scenes in a sticky `#storyHero` element; `progress` (0→1) derived from scroll position relative to hero height
- `updateStoryHero()` drives frame opacity/scale/filter, text copy opacity/position, golden pulse, and nav dots — all via `smoothStep()` easing
- Throttled with `requestAnimationFrame`
- Preloader skip state stored in `sessionStorage` (key: `logiaEscenasPreloaderVisto`)

**API routes** (all under `/api/`):
- `POST /api/login` — public, returns Bearer token
- `POST /api/logout` — protected
- `POST /api/aspirantes` — public form submission; validates age ≥ 18, deduplicates by email and phone
- `GET /api/aspirantes` — protected, returns full list
- `PUT /api/aspirantes/:id/estado` — protected, valid states: `Nuevo | Contactado | En proceso | Aprobado | Rechazado`
- `DELETE /api/aspirantes/:id` — protected

**Pages** (`pages/`): `aspirantes.html` (form), `login.html`, `panel-aspirantes.html` (admin), `teofilo-leal.html` (bio)
