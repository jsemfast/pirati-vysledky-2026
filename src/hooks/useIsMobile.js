import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 767px)';

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
