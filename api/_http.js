// Sdílené pomocné funkce serverových funkcí (soubory s _ Vercel jako
// funkce nenasazuje). Bez Vercel helperů (res.status/json), aby šly funkce
// pustit i ve Vite dev serveru (plugin api-dev ve vite.config.js).
import { POLLS_CLOSE } from '../src/councils.js';

export const USER_AGENT = 'pirati-vysledky-2026/1.0 (zive vysledky KV 2026)';

// Jak dlouho smí CDN odpověď držet (s) podle fáze voleb
export function cdnMaxAge(phase) {
    if (phase === 'pre') return Math.max(10, Math.min(300, Math.round((POLLS_CLOSE - Date.now()) / 1000)));
    if (phase === 'final') return 600;
    return 30;
}

export function send(res, status, body, cacheControl) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', cacheControl);
    res.end(JSON.stringify(body));
}

export function cacheControl(maxAge) {
    return `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}, stale-if-error=900`;
}

export function onlyGet(req, res) {
    if (req.method === 'GET' || req.method === 'HEAD') return true;
    res.setHeader('Allow', 'GET');
    send(res, 405, { error: 'method-not-allowed' }, 'no-store');
    return false;
}
