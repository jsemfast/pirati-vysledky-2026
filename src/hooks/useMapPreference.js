import { useSyncExternalStore } from 'react';

// Mapa okrsků na telefonu: vypnutá, dokud si ji uživatel nezapne.
// Podkladová mapa + knihovny (MapLibre, Leaflet) jsou ~1 MB a další data
// při každém posunu — na mobilu v přetížené síti volební noci je to víc
// než celý zbytek stránky. Volba se pamatuje (localStorage) a přepínač
// v menu i stránka se synchronizují přes událost.
const KEY = 'kv26_map_mobile';
const EVENT = 'kv26-map-preference';

function read() {
    try {
        return localStorage.getItem(KEY) === 'on';
    } catch {
        return false;
    }
}

let current = read();

export function setMapEnabled(on) {
    current = on;
    try {
        localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch {
        /* private mode — platí aspoň do zavření stránky */
    }
    window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback) {
    const onStorage = (e) => {
        if (e.key !== KEY) return;
        current = read();
        callback();
    };
    window.addEventListener(EVENT, callback);
    window.addEventListener('storage', onStorage);
    return () => {
        window.removeEventListener(EVENT, callback);
        window.removeEventListener('storage', onStorage);
    };
}

export function useMapEnabled() {
    return useSyncExternalStore(subscribe, () => current);
}
