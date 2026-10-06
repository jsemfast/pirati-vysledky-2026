// Vercel serverless function: živé výsledky KV 2026 pro zastupitelstva
// ze src/councils.js — GET /api/volby?z=<kód zastupitelstva>.
//
// Funkce je tenká sdílená vrstva nad volby.gov.cz: stahuje pár souborů
// (podmíněně přes ETag, okrsky jen nové) a odpověď vrací s Cache-Control
// s-maxage, takže prohlížeče obslouží CDN Vercelu a funkce se spustí zhruba
// 2× za minutu za každé zastupitelstvo — bez ohledu na počet diváků. Stav
// (ETagy, okrsky) drží v paměti instance; studený start jen jednou dotáhne
// už sečtené okrsky (na ty se čeká max. 3 s, zbytek doběhne na pozadí).
//
// Nepoužívá Vercel helpery (res.status/json), aby šla stejná funkce pustit
// i ve Vite dev serveru (plugin api-volby-dev ve vite.config.js).
import { createKvFeed } from '../src/volby/feed.js';
import { councilByZastup, POLLS_CLOSE } from '../src/councils.js';

const feeds = new Map(); // zastup -> feed (sdílený v rámci instance)

function feedFor(council) {
    if (!feeds.has(council.zastup)) {
        feeds.set(council.zastup, createKvFeed({
            council,
            conditional: true,
            minIntervalMs: 20e3,
            headers: { 'User-Agent': 'pirati-vysledky-2026/1.0 (zive vysledky KV 2026)' },
        }));
    }
    return feeds.get(council.zastup);
}

// Jak dlouho smí CDN odpověď držet (s) podle fáze voleb
function cdnMaxAge(phase) {
    if (phase === 'pre') return Math.max(10, Math.min(300, Math.round((POLLS_CLOSE - Date.now()) / 1000)));
    if (phase === 'final') return 600;
    return 30;
}

function send(res, status, body, cacheControl) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', cacheControl);
    res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET');
        return send(res, 405, { error: 'method-not-allowed' }, 'no-store');
    }
    // Jen zastupitelstva z konfigurace — proxy nesmí sloužit k tahání
    // libovolných souborů z volby.gov.cz
    const z = new URL(req.url, 'http://localhost').searchParams.get('z');
    const council = councilByZastup(z);
    if (!council) return send(res, 400, { error: 'unknown-council' }, 'public, max-age=0, s-maxage=3600');

    try {
        const { snapshot, stale, error } = await feedFor(council).snapshot();
        const maxAge = stale ? 15 : cdnMaxAge(snapshot.phase);
        return send(
            res,
            200,
            { ...snapshot, source: 'proxy', stale, ...(stale ? { error: String(error?.message || error) } : {}) },
            `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}, stale-if-error=900`,
        );
    } catch (error) {
        // Ještě nic v paměti a volby.gov.cz neodpovídá — klient přepne na
        // přímé čtení (5xx CDN necachuje, stale-if-error výš drží starou verzi)
        return send(res, 502, { error: String(error?.message || error) }, 'no-store');
    }
}
