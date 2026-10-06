// Aktivní zastupitelstvo stránky (jedna stránka = jedno zastupitelstvo).
// Spojuje ruční konfiguraci (src/councils.js) s vygenerovanými daty
// kandidátek (public/data/<slug>/lists.json) a dává komponentám jednotné
// metadata kandidátek: zkratky, barvy, loga, předchůdce z roku 2022.
import { majorityOf } from '../councils.js';

// Přibližná pozice stran na ose levice–pravice (kódy číselníku ČSÚ) — jen
// pro řazení v půlkruhu zastupitelstva; neznámé strany jdou doprostřed
const AXIS = {
    47: 0.02, // KSČM
    74: 0.04, // Levice
    93: 0.05, // KSČ
    759: 0.08, // ČSSD
    7: 0.1, // SOCDEM
    5: 0.2, // Zelení
    1180: 0.28, // PRAHA SOBĚ
    720: 0.3, // Piráti
    1297: 0.42, // GEN
    166: 0.47, // STAN
    1: 0.55, // KDU-ČSL
    721: 0.58, // TOP 09
    768: 0.62, // ANO
    53: 0.7, // ODS
    716: 0.74, // Soukromníci
    1178: 0.82, // Motoristé
    714: 0.85, // Svobodní
    1004: 0.88, // Patrioti
    1114: 0.94, // SPD
    1227: 0.96, // Trikolora
};

function axisOf(list) {
    const known = (list.slozeni || []).map((c) => AXIS[c]).filter((v) => v !== undefined);
    return known.length ? known.reduce((s, v) => s + v, 0) / known.length : 0.5;
}

// Zkratky kandidátky: ruční z councils.js, jinak z registru ČSÚ. Společná
// kandidátka Pirátů bez ruční poznámky dostane výčet členů („Piráti + Zelení").
export function listLabels(council, l) {
    const o = council.lists?.[l.id] || {};
    const members = (l.members || []).map((m) => (m.code === 80 ? 'nezávislí' : m.short));
    return {
        short: o.short || l.short30,
        tiny: o.tiny || o.short || l.short8 || l.short30,
        note: o.note || (l.id === council.pirates && members.length > 1 ? members.join(' + ') : null),
    };
}

let active = null;

export function setActiveCouncil(council, listsData) {
    const metas = {};
    for (const l of listsData.lists) {
        metas[l.id] = {
            id: l.id,
            ...listLabels(council, l),
            name: l.name,
            color: l.color,
            logos: l.logos || [],
            members: l.members || [],
            web: l.web || null,
            pirates: l.id === council.pirates,
            baseline: l.baseline || null,
            split2022: l.split || null,
        };
    }
    active = {
        ...council,
        majority: majorityOf(council.seats),
        metas,
        order: [...listsData.lists].sort((a, b) => axisOf(a) - axisOf(b)).map((l) => l.id),
        lists2022: listsData.lists2022 || [],
        seatsTotal2022: listsData.seatsTotal2022 || null,
    };
    return active;
}

export const activeCouncil = () => active;

export function partyMeta(id) {
    return active?.metas[id] || {
        id,
        short: `Kandidátka ${id}`,
        tiny: String(id),
        color: '#6B7280',
        logos: [],
        members: [],
        baseline: null,
        split2022: null,
        pirates: false,
    };
}

// Barva kandidátky na černém pozadí (hlavička): Piráti jsou černí → žlutá
export const PIRATE_YELLOW = '#FEC900';
export function colorOnDark(id) {
    const m = partyMeta(id);
    return m.pirates ? PIRATE_YELLOW : m.color;
}
