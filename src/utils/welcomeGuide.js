// Průvodce první návštěvou (components/WelcomeGuide.jsx) — stav sdílí
// s UpdateManagerem, který mezitím neotevírá „Co je nové".
export const GUIDE_KEY = 'kv26_guide_seen';

// Bez localStorage (zablokované úložiště) se průvodce neukáže vůbec — jinak
// by vyskakoval při každém načtení
export function guidePending() {
    try {
        return !localStorage.getItem(GUIDE_KEY);
    } catch {
        return false;
    }
}
