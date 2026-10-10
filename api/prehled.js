// Vercel serverless function: přehled všech pražských zastupitelstev —
// GET /api/prehled. Za každé zastupitelstvo stav sčítání a výsledek Pirátů
// (src/volby/overview.js). Stejně jako /api/volby: podmíněné dotazy na
// volby.gov.cz (ETag, většinou 304), odpověď sdílená přes CDN (s-maxage),
// takže funkce běží nejvýš jednou za 5 s bez ohledu na počet diváků.
import { COUNCILS } from '../src/councils.js';
import { createOverviewFeed } from '../src/volby/overview.js';
import { USER_AGENT, onlyGet, sendSnapshot } from './_http.js';

let feed = null;

export default async function handler(req, res) {
    if (!onlyGet(req, res)) return undefined;
    feed ||= createOverviewFeed({
        councils: COUNCILS,
        conditional: true,
        minIntervalMs: 10e3,
        concurrency: 12,
        // co nestihne, doběhne na pozadí a přibude v další odpovědi; víc než
        // 10 s by se blížilo časovému limitu prohlížeče (15 s)
        waitMs: 10e3,
        headers: { 'User-Agent': USER_AGENT },
    });
    return sendSnapshot(res, feed);
}
