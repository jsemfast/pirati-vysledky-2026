import { useSyncExternalStore } from 'react';

// Mobilní rozložení (záložky dole, mapa na celou plochu): úzký displej,
// ale i telefon na šířku — ten má 800+ px, jenže jen ~400 px na výšku a
// desktopová hlavička + boční panel by mu nechaly pár řádků obsahu.
// Stejný dotaz je v src/index.css jako varianta `mobile:` — držet v souladu.
export const MOBILE_QUERY = '(max-width: 767px), (pointer: coarse) and (max-height: 500px)';
const QUERY = MOBILE_QUERY;

function subscribe(callback) {
    const mql = window.matchMedia(QUERY);
    mql.addEventListener('change', callback);
    return () => mql.removeEventListener('change', callback);
}

function getSnapshot() {
    return window.matchMedia(QUERY).matches;
}

export function useIsMobile() {
    return useSyncExternalStore(subscribe, getSnapshot);
}

// Jednorázová detekce pro výchozí stav (defaulty se nemají měnit při resize)
export function isMobileNow() {
    return window.matchMedia(QUERY).matches;
}
