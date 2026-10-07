# Nasazení na Cloudflare Workers

Produkční nasazení aplikace. **Automaticky z GitHub Action**
(`.github/workflows/deploy.yml`) při každém pushi do `main`; ručně
`npm run deploy` v téhle složce. V repu nejsou žádné klíče — `account_id`
není tajný, tokeny jsou v secrets (viz níže).

## Jak to funguje

- **Statika** `../dist` jako Workers static assets (zdarma, bez spuštění
  Workeru). Hlavičky cache v `_headers` (kopíruje se do `dist/` při buildu),
  `/assets/*` navíc immutable.
- **`/praha`, `/praha-*`** → `index.html` (jako rewrite ve `vercel.json`),
  ostatní neexistující cesty 404.
- **`/api/volby`, `/api/prehled`** → `worker.js` → Cache API (per datacentrum,
  TTL = s-maxage z funkce) → při MISS Durable Object `Feed`, který spustí
  **původní** handler z `../api/*.js`. Jeden DO na zastupitelstvo
  (`volby:<kód>`) + `prehled` → stav feedu je globálně jeden, volby.gov.cz
  dostane stejnou zátěž jako z jedné instance Vercelu.
- **`/api/bug`** (brouk) → DO `bug` (jeden globální limit hlášení na IP) →
  `../api/bug.js` → GitHub issue. Screenshoty do KV `HLASENI`, servíruje je
  worker na **`/hlaseni/*`**.

- **Návštěvnost** → Workers Analytics Engine (binding `STATS`, dataset
  `pirati_vysledky_2026`): worker zapíše anonymní bod za každý dotaz
  prohlížeče na `/api/volby`, `/api/prehled` a za načtení stránky (`/`
  a `/<slug>`; kvůli `/` je v `wrangler.jsonc` `run_worker_first: ["/"]`).
  Ukládá jen typ, zastupitelstvo, fázi voleb, mobil/desktop/robot, doménu
  refereru a příznak dema — **žádné IP, cookies ani identifikátory**.
  Prohlížeč se ptá v pevném intervalu (ve skryté záložce vůbec), takže
  počet dotazů × interval ≈ kolik lidí se dívá. Čte se přes SQL API
  (token s oprávněním Account Analytics Read), data drží Cloudflare 3 měsíce.

## Secrets

- `CLOUDFLARE_API_TOKEN` — v GitHubu (Settings → Secrets and variables →
  Actions) pro autodeploy. Token z šablony „Edit Cloudflare Workers".
- `GITHUB_TOKEN` — secret Workeru pro brouka: `npx wrangler secret put
  GITHUB_TOKEN` (fine-grained token, jen repo pirati-vysledky-2026,
  Issues: Read and write).

## Požadavky

- **Workers Paid** ($5/měs.) — Free má 100 k requestů/den a 50 subrequestů
  na invocation (přehled potřebuje 58).
- KV namespace `pirati-vysledky-2026-hlaseni` (binding `HLASENI`, id ve
  `wrangler.jsonc`) — R2 na účtu zapnuté není.
- Vlastní doména volitelná — Cache API funguje i na workers.dev (ověřeno).

Produkce: https://pirati-vysledky-2026.pirati-vysledky-2026-cloudflare.workers.dev

## Příkazy (v této složce)

```bash
npx wrangler login     # jednou
npm run dev            # build + lokálně na :8787 (secret pro dev: .dev.vars)
npm run deploy         # build + nasazení (běžně ho dělá GitHub Action)
npm run tail           # živé logy
```

Ověření cache — druhý dotaz musí vrátit `x-cache: HIT`:

```bash
curl -sI "https://<doména>/api/volby?z=500097" | grep -i x-cache
curl -sI "https://<doména>/api/prehled" | grep -i x-cache
```
