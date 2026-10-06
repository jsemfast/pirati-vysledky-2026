// Klientská půlka nahlášení chyby (brouk): úprava screenshotu a odeslání na
// /api/bug, které na serveru založí GitHub issue (token GitHubu se do
// prohlížeče nikdy nedostane).
import { APP_VERSION } from '../changelog.js';

// Delší strana screenshotu v px a strop velikosti po zakódování — pod
// limitem serveru (4 MB), ať se přiložený obrázek na druhé straně neztratí
const MAX_SCREENSHOT_EDGE = 1600;
const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024;
const JPEG_QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4];

export class BugReportScreenshotError extends Error {}

export function getBrowserInfo() {
    const ua = navigator.userAgent;
    const ver = (re) => ua.match(re)?.[1] ?? '';
    if (/Firefox\//.test(ua)) return `Firefox ${ver(/Firefox\/(\S+)/)}`.trim();
    if (/Edg\//.test(ua)) return `Edge ${ver(/Edg\/(\S+)/)}`.trim();
    if (/Chrome\//.test(ua)) return `Chrome ${ver(/Chrome\/(\S+)/)}`.trim();
    if (/Safari\//.test(ua)) return `Safari ${ver(/Version\/(\S+)/)}`.trim();
    return 'Neznámý prohlížeč';
}

export function getDeviceInfo() {
    const ua = navigator.userAgent;
    const size = `${window.innerWidth}×${window.innerHeight}`;
    if (/Tablet|iPad/i.test(ua)) return `Tablet (${size})`;
    if (/Mobi|Android/i.test(ua)) return `Mobil (${size})`;
    return `Desktop (${size})`;
}

// Dekódovaná velikost base64 data URL bez dekódování
function dataUrlBytes(dataUrl) {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.floor((base64.length * 3) / 4) - padding;
}

function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new BugReportScreenshotError('Soubor se nepodařilo načíst.'));
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.readAsDataURL(file);
    });
}

function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onerror = () => reject(new BugReportScreenshotError('Tenhle formát obrázku neumíme zpracovat. Zkus PNG nebo JPG.'));
        image.onload = () => resolve(image);
        image.src = dataUrl;
    });
}

// Každý obrázek se převede na JPEG (max. 1600 px, max. 3 MB) — i malé PNG
// umí přetéct limit. Animovaný GIF jen projde kontrolou velikosti.
export async function prepareScreenshot(file) {
    if (file.type === 'image/gif') {
        if (file.size > MAX_SCREENSHOT_BYTES) throw new BugReportScreenshotError('GIF je moc velký (max 3 MB). Přilož radši statický obrázek.');
        return { dataUrl: await readAsDataUrl(file), contentType: file.type };
    }
    const image = await loadImage(await readAsDataUrl(file));
    const scale = Math.min(1, MAX_SCREENSHOT_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new BugReportScreenshotError('Obrázek se nepodařilo zpracovat.');
    // JPEG nemá průhlednost — bez bílého podkladu by průhledná místa zčernala
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of JPEG_QUALITY_STEPS) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrlBytes(dataUrl) <= MAX_SCREENSHOT_BYTES) return { dataUrl, contentType: 'image/jpeg' };
    }
    throw new BugReportScreenshotError('Obrázek je i po zmenšení moc velký. Přilož radši výřez obrazovky.');
}

// Vrací { ok, issueUrl?, issueNumber? }, při chybě hází Error se zprávou ze serveru
export async function submitBugReport({ title, description, screenshot, hp_field, elapsed_ms }) {
    const res = await fetch('/api/bug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            title,
            description,
            pageUrl: window.location.href,
            browser: getBrowserInfo(),
            device: getDeviceInfo(),
            version: APP_VERSION,
            screenshot: screenshot ?? null,
            hp_field,
            elapsed_ms,
        }),
    });
    let data = null;
    try {
        data = await res.json();
    } catch {
        /* např. HTML chybová stránka */
    }
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'Hlášení se nepodařilo odeslat. Zkus to prosím znovu.');
    return data;
}
