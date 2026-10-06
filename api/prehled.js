// Vercel serverless function: přehled všech pražských zastupitelstev —
// GET /api/prehled. Za každé zastupitelstvo stav sčítání a výsledek Pirátů
// (src/volby/overview.js). Stejně jako /api/volby: podmíněné dotazy na
// volby.gov.cz (ETag, většinou 304), odpověď sdílená přes CDN (s-maxage),
// takže funkce běží zhruba 2× za minutu bez ohledu na počet diváků.
import { COUNCILS } from '../src/councils.js';
import { createOverviewFeed } from '../src/volby/overview.js';
import { USER_AGENT, cacheControl, cdnMaxAge, onlyGet, send } from './_http.js';

let feed = null;

export default async function handler(req, res) {
    if (!onlyGet(req, res)) return undefined;
    feed ||= createOverviewFeed({
        councils: COUNCILS,
        conditional: true,
        minIntervalMs: 20e3,
        concurrency: 8,
        headers: { 'User-Agent': USER_AGENT },
    });
    try {
        const { snapshot, stale, error } = await feed.snapshot();
        const maxAge = stale ? 15 : cdnMaxAge(snapshot.phase);
        return send(
            res,
            200,
            { ...snapshot, source: 'proxy', stale, ...(stale ? { error: String(error?.message || error) } : {}) },
            cacheControl(maxAge),
        );
    } catch (error) {
        return send(res, 502, { error: String(error?.message || error) }, 'no-store');
    }
}
