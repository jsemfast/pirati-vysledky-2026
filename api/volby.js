// Vercel serverless function: živé výsledky KV 2026 pro zastupitelstva
// ze src/councils.js — GET /api/volby?z=<kód zastupitelstva>.
//
// Funkce je tenká sdílená vrstva nad volby.gov.cz: stahuje pár souborů
// (podmíněně přes ETag, okrsky jen nové) a odpověď vrací s Cache-Control
// s-maxage, takže prohlížeče obslouží CDN Vercelu a funkce se spustí nejvýš
// jednou za 5 s za každé zastupitelstvo — bez ohledu na počet diváků. Stav
// (ETagy, okrsky) drží v paměti instance; studený start jen jednou dotáhne
// už sečtené okrsky (na ty se čeká max. 3 s, zbytek doběhne na pozadí).
import { createKvFeed } from '../src/volby/feed.js';
import { councilByZastup } from '../src/councils.js';
import { USER_AGENT, onlyGet, send, sendSnapshot } from './_http.js';

const feeds = new Map(); // zastup -> feed (sdílený v rámci instance)

function feedFor(council) {
    if (!feeds.has(council.zastup)) {
        feeds.set(council.zastup, createKvFeed({
            council,
            conditional: true,
            minIntervalMs: 10e3,
            headers: { 'User-Agent': USER_AGENT },
        }));
    }
    return feeds.get(council.zastup);
}

export default async function handler(req, res) {
    if (!onlyGet(req, res)) return undefined;
    // Jen zastupitelstva z konfigurace — proxy nesmí sloužit k tahání
    // libovolných souborů z volby.gov.cz
    const z = new URL(req.url, 'http://localhost').searchParams.get('z');
    const council = councilByZastup(z);
    if (!council) return send(res, 400, { error: 'unknown-council' }, 'public, max-age=0, s-maxage=3600');
    return sendSnapshot(res, feedFor(council));
}
