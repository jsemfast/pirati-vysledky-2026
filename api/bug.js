// Serverless function: nahlášení chyby z aplikace (brouk vpravo dole) →
// GitHub issue. POST /api/bug, tělo JSON:
//   { title, description, pageUrl, browser, device, version,
//     screenshot?: { dataUrl, contentType }, hp_field, elapsed_ms }
//
// Token GitHubu je jen na serveru (env GITHUB_TOKEN — fine-grained token
// s právem Issues: Read and write na repo). Brouk je veřejný, takže před
// zápisem do GitHubu: honeypot, časová past (formulář vyplněný za < 2 s =
// robot), limit 5 hlášení / 15 min / IP.
//
// Screenshot: když platforma dodá úložiště (storeScreenshot — na Cloudflare
// Workers KV, viz cloudflare/worker.js), vloží se do issue jako obrázek;
// jinak (Vercel, lokální dev) se issue založí bez něj.
//
// Env: GITHUB_TOKEN (povinné), GITHUB_REPO (výchozí jsemfast/pirati-vysledky-2026),
//      BUG_REPORT_LABELS (výchozí „bug,z-aplikace").
import { send } from './_http.js';

const DEFAULT_REPO = 'jsemfast/pirati-vysledky-2026';
const DEFAULT_LABELS = 'bug,z-aplikace';
const MAX_BODY_BYTES = 6 * 1024 * 1024;
const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;
const SCREENSHOT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MIN_ELAPSED_MS = 2000;
const RATE_LIMIT = { max: 5, windowMs: 15 * 60e3 };

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Ořízne, zahodí NUL a omezí délku — text uživatele končí v těle issue
const cleanText = (value, max) => String(value ?? '').replace(/\0/g, '').trim().slice(0, max);

// Jen http(s) — do issue se nesmí propašovat javascript: nebo data: odkaz
function safeUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
    } catch {
        return '';
    }
}

const header = (req, name) => {
    const h = req.headers || {};
    const v = typeof h.get === 'function' ? h.get(name) : h[name];
    return Array.isArray(v) ? v[0] : v || '';
};

// Vercel tělo naparsuje sám (req.body), Vite dev / Node ho posílá jako stream
async function readJson(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    let text = typeof req.body === 'string' ? req.body : '';
    if (!text && typeof req[Symbol.asyncIterator] === 'function') {
        let size = 0;
        const chunks = [];
        for await (const chunk of req) {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Hlášení je moc velké.');
            chunks.push(chunk);
        }
        text = Buffer.concat(chunks).toString('utf8');
    }
    if (text.length > MAX_BODY_BYTES * 1.4) throw new HttpError(413, 'Hlášení je moc velké.');
    try {
        return JSON.parse(text || '{}');
    } catch {
        throw new HttpError(400, 'Neplatný požadavek.');
    }
}

function decodeScreenshot(screenshot) {
    const match = /^data:([^;,]+);base64,(.+)$/s.exec(screenshot?.dataUrl || '');
    if (!match) return null;
    const contentType = (screenshot.contentType || match[1] || '').toLowerCase();
    if (!SCREENSHOT_TYPES.includes(contentType)) return null;
    try {
        const binary = atob(match[2]);
        if (!binary.length || binary.length > MAX_SCREENSHOT_BYTES) return null;
        return { bytes: Uint8Array.from(binary, (ch) => ch.charCodeAt(0)), contentType };
    } catch {
        return null;
    }
}

// getEnv = env proměnné (čte se při každém dotazu — secret může přibýt
// později), storeScreenshot(bytes, contentType) → cesta na obrázek nebo null
export function createBugHandler({ getEnv = () => globalThis.process?.env || {}, storeScreenshot = null } = {}) {
    const hits = new Map(); // ip -> časy hlášení v okně limitu

    function rateLimited(ip) {
        const now = Date.now();
        const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT.windowMs);
        if (recent.length >= RATE_LIMIT.max) {
            hits.set(ip, recent);
            return true;
        }
        recent.push(now);
        hits.set(ip, recent);
        if (hits.size > 5000) hits.clear(); // pojistka paměti
        return false;
    }

    return async function handler(req, res) {
        if (req.method !== 'POST') {
            res.setHeader('Allow', 'POST');
            return send(res, 405, { error: 'method-not-allowed' }, 'no-store');
        }
        const env = getEnv();
        const token = env.GITHUB_TOKEN;
        const repo = env.GITHUB_REPO || DEFAULT_REPO;
        if (!token) return send(res, 503, { error: 'Nahlašování chyb zatím není nastavené.' }, 'no-store');

        try {
            const body = await readJson(req);
            // Robotům 200, ať se nedozví, že je to chytilo — issue se nezaloží
            if ((body.hp_field && String(body.hp_field).trim()) || (typeof body.elapsed_ms === 'number' && body.elapsed_ms < MIN_ELAPSED_MS)) {
                return send(res, 200, { ok: true }, 'no-store');
            }

            const title = cleanText(body.title, 120);
            const description = cleanText(body.description, 5000);
            if (title.length < 3) throw new HttpError(400, 'Název musí mít alespoň 3 znaky.');
            if (description.length < 10) throw new HttpError(400, 'Popis musí mít alespoň 10 znaků.');

            const ip = header(req, 'cf-connecting-ip') || header(req, 'x-forwarded-for').split(',')[0].trim() || req.socket?.remoteAddress || '?';
            if (rateLimited(ip)) throw new HttpError(429, 'Příliš mnoho hlášení za sebou. Zkus to prosím za chvíli.');

            let screenshotUrl = null;
            const shot = body.screenshot && storeScreenshot ? decodeScreenshot(body.screenshot) : null;
            if (shot) {
                try {
                    const path = await storeScreenshot(shot.bytes, shot.contentType);
                    const host = header(req, 'host');
                    if (path) screenshotUrl = host ? `${header(req, 'x-forwarded-proto') || 'https'}://${host}${path}` : path;
                } catch (err) {
                    console.error('[bug] screenshot se nepodařilo uložit:', err);
                }
            }

            const issueBody = [
                '### Popis',
                description,
                '',
                '### Kontext',
                `- Stránka: ${safeUrl(cleanText(body.pageUrl, 500)) || 'neuvedeno'}`,
                `- Verze aplikace: ${cleanText(body.version, 20) || 'neuvedeno'}`,
                `- Prohlížeč: ${cleanText(body.browser, 100) || 'neuvedeno'}`,
                `- Zařízení: ${cleanText(body.device, 50) || 'neuvedeno'}`,
                `- Čas: ${new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}`,
                '',
                '### Screenshot',
                screenshotUrl ? `![screenshot](${screenshotUrl})` : (body.screenshot ? 'Přiložen, ale nepodařilo se ho uložit' : 'Nepřiložen'),
            ].join('\n');

            const gh = await fetch(`https://api.github.com/repos/${repo}/issues`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'pirati-vysledky-2026-bug-report',
                    'X-GitHub-Api-Version': '2022-11-28',
                },
                body: JSON.stringify({
                    title: `[Bug] ${title}`,
                    body: issueBody,
                    labels: (env.BUG_REPORT_LABELS || DEFAULT_LABELS).split(',').map((l) => l.trim()).filter(Boolean),
                }),
            });
            if (!gh.ok) {
                console.error('[bug] GitHub issue se nepodařilo založit:', gh.status, await gh.text());
                throw new HttpError(502, 'Hlášení se nepodařilo založit. Zkus to prosím znovu.');
            }
            const issue = await gh.json();
            // Issue vzniklo — i bez odkazu potvrdit, jinak by uživatel posílal duplicitu
            return send(res, 200, { ok: true, issueUrl: issue.html_url || null, issueNumber: issue.number ?? null }, 'no-store');
        } catch (err) {
            if (err instanceof HttpError) return send(res, err.status, { error: err.message }, 'no-store');
            console.error('[bug]', err);
            return send(res, 500, { error: 'Hlášení se nepodařilo odeslat. Zkus to prosím znovu.' }, 'no-store');
        }
    };
}

// Vercel / Vite dev: env z process.env, bez úložiště screenshotů
export default createBugHandler();
