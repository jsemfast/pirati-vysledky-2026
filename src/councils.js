// Konfigurace sledovaných zastupitelstev — JEDINÉ místo s ručně zadaným
// politickým kontextem (kdo jsou Piráti, kdo tvoří současnou koalici,
// zkrácené názvy kandidátek). Všechno ostatní (kandidátky, kandidáti, loga,
// barvy, okrsky, výsledky 2022, předchůdci kandidátek) generuje
// `npm run data` do public/data/<slug>/.
//
// Soubor je čisté JS bez závislostí — importuje ho prohlížeč, serverová
// funkce api/volby.js i skripty v scripts/.

// Komunální volby 9.–10. 10. 2026
export const KV_DATE = 20261009;
export const KV_BASE_URL = `https://volby.gov.cz/appdata/kv2026/${KV_DATE}`;
// Volební místnosti se zavírají v sobotu 10. 10. 2026 ve 14:00
export const POLLS_CLOSE = Date.parse('2026-10-10T14:00:00+02:00');
// Kód Pirátské strany v číselníku volebních stran ČSÚ (CVS)
export const PIRATES_CODE = 720;

/**
 * slug        – adresa stránky (/praha-6)
 * zastup      – kód zastupitelstva (KODZASTUP) v datech ČSÚ
 * okres       – NUTS okresu v datech ČSÚ (Praha = 1100)
 * seats       – počet mandátů 2026 (ověřeno proti volby.gov.cz)
 * precincts   – počet okrsků 2026
 * pirates     – číslo kandidátky, na které kandidují Piráti
 * coalition   – současná koalice (2022–2026) přepočtená na čísla kandidátek
 *               2026; seats2022 = kolik měla mandátů po volbách 2022
 * lists       – zkrácené názvy kandidátek (short = seznamy, tiny = mapa/čipy),
 *               volitelně barva; co tu chybí, vezme se z registru ČSÚ
 *               a programydovoleb.cz
 * photos      – vlastní fotky kandidátů (public/media/<slug>/photos/),
 *               mají přednost před fotkami z programydovoleb.cz
 * map         – mapa okrsků (u Magistrátu zatím vypnutá, viz docs/MAGISTRAT.md)
 * precinctFiles – stahovat okrskové výsledky (1 soubor = 1 okrsek)
 */
export const COUNCILS = [
    {
        slug: 'praha-3',
        name: 'Praha 3',
        title: 'Zastupitelstvo městské části Praha 3',
        zastup: 500097,
        okres: 1100,
        seats: 35,
        precincts: 52,
        pirates: 1,
        coalition: {
            lists: [5, 1, 7],
            label: 'TOP 09 + STAN, Piráti a Zelení',
            seats2022: 19,
            seatsTotal2022: 35,
        },
        lists: {
            1: { short: 'Piráti', tiny: 'Piráti', note: 'Společná kandidátka Pirátů, PRAHA 3 SOBĚ a Edity Janečkové' },
            2: { short: 'ANO', tiny: 'ANO' },
            3: { short: 'Motoristé + Patrioti', tiny: 'Motoristé' },
            4: { short: 'Praha 3 srdcem', tiny: 'P3 srdcem', note: 'KDU-ČSL + GEN' },
            5: { short: 'TOP 09 + STAN', tiny: 'TOP+STAN' },
            6: { short: 'ODS + Soukromníci', tiny: 'ODS' },
            7: { short: 'Zelení', tiny: 'Zelení' },
            8: { short: 'KSČM', tiny: 'KSČM' },
            9: { short: 'SPD + Trikolora', tiny: 'SPD' },
        },
        photos: {
            1: {
                1: 'Edita.webp',
                2: 'Jan.webp',
                3: 'Filip.webp',
                4: 'Denisa.webp',
                5: 'Konradova.webp',
                6: 'Jakub.webp',
                7: 'Musil.webp',
                8: 'Chab.webp',
                9: 'Gargulak.webp',
                10: 'Knoblochova.webp',
            },
        },
        map: true,
        precinctFiles: true,
    },
    {
        slug: 'praha-6',
        name: 'Praha 6',
        title: 'Zastupitelstvo městské části Praha 6',
        zastup: 500178,
        okres: 1100,
        seats: 45,
        precincts: 104,
        pirates: 4,
        coalition: {
            // 2022: ODS + KDU-ČSL, STAN (s podporou Zelených), PRAHA 6 SOBĚ.
            // Letos jdou Zelení s PRAHA SOBĚ — proto kandidátka 6.
            lists: [7, 1, 6],
            label: 'ODS + KDU-ČSL, STAN a PRAHA SOBĚ',
            seats2022: 23,
            seatsTotal2022: 45,
        },
        lists: {
            1: { short: 'STAN', tiny: 'STAN' },
            2: { short: 'GEN', tiny: 'GEN' },
            3: { short: 'KSČM', tiny: 'KSČM' },
            4: { short: 'Piráti', tiny: 'Piráti' },
            5: { short: 'SPD', tiny: 'SPD' },
            6: { short: 'PRAHA 6 SOBĚ', tiny: 'P6 sobě', note: 'PRAHA SOBĚ se Zelenými', color: '#FBDC02' },
            7: { short: 'ODS + KDU-ČSL', tiny: 'ODS+KDU', color: '#2868E6' },
            8: { short: 'ANO', tiny: 'ANO' },
            9: { short: 'TOP 09', tiny: 'TOP 09' },
            10: { short: 'Motoristé + Svobodní', tiny: 'Motoristé' },
            11: { short: 'JSME PRAHA 6', tiny: 'JSME P6' },
        },
        photos: {},
        map: true,
        precinctFiles: true,
    },
    {
        slug: 'praha-11',
        name: 'Praha 11',
        title: 'Zastupitelstvo městské části Praha 11',
        zastup: 547034,
        okres: 1100,
        seats: 35,
        precincts: 62,
        pirates: 6,
        coalition: {
            // 2023–2026: Piráti (starosta), ANO, ODS a klub TOP 09 + STAN
            lists: [6, 10, 5, 2],
            label: 'Piráti, ANO, ODS a TOP 09 + STAN',
            seats2022: 20,
            seatsTotal2022: 35,
        },
        lists: {
            1: { short: 'Motoristé + Svobodní', tiny: 'Motoristé' },
            2: { short: 'TOP 09 + STAN', tiny: 'TOP+STAN' },
            3: { short: 'GEN', tiny: 'GEN' },
            4: { short: 'PRAHA 11 SOBĚ', tiny: 'P11 sobě' },
            5: { short: 'Spolu pro Prahu 11 (ODS)', tiny: 'ODS', color: '#2868E6' },
            6: { short: 'Piráti', tiny: 'Piráti' },
            7: { short: 'Výzva pro Prahu 11', tiny: 'Výzva' },
            8: { short: 'Hnutí pro Prahu 11', tiny: 'HPP 11' },
            9: { short: 'SPD + Trikolora', tiny: 'SPD' },
            10: { short: 'ANO', tiny: 'ANO' },
        },
        photos: {},
        map: true,
        precinctFiles: true,
    },
    {
        // Zastupitelstvo hl. m. Prahy — připravené v „lehkém" režimu: bez mapy
        // a bez okrskových souborů (1 120 okrsků), viz docs/MAGISTRAT.md
        slug: 'praha',
        name: 'Praha',
        title: 'Zastupitelstvo hlavního města Prahy',
        zastup: 554782,
        okres: 1100,
        seats: 65,
        precincts: 1120,
        pirates: 7,
        coalition: {
            // 2023–2026: SPOLU (ODS, TOP 09, KDU-ČSL), Piráti, STAN.
            // KDU-ČSL letos na Magistrátu s ODS + TOP 09 nekandiduje.
            lists: [12, 7, 9],
            label: 'ODS + TOP 09, Piráti a STAN',
            seats2022: 37,
            seatsTotal2022: 65,
        },
        lists: {
            5: { short: 'PRAHA SOBĚ', tiny: 'PS' },
            7: { short: 'Piráti', tiny: 'Piráti' },
            9: { short: 'STAN', tiny: 'STAN' },
            10: { short: 'SPD', tiny: 'SPD' },
            11: { short: 'GEN', tiny: 'GEN' },
            12: { short: 'SPOLU (ODS + TOP 09)', tiny: 'SPOLU', color: '#2FD2D3' },
            14: { short: 'Motoristé', tiny: 'AUTO' },
            20: { short: 'KSČM + KSČ + ČSSD', tiny: 'KSČM' },
            22: { short: 'ANO', tiny: 'ANO' },
        },
        photos: {},
        map: false,
        precinctFiles: false,
        beta: true,
    },
];

export const councilBySlug = (slug) => COUNCILS.find((c) => c.slug === slug) || null;
export const councilByZastup = (zastup) => COUNCILS.find((c) => c.zastup === Number(zastup)) || null;
export const majorityOf = (seats) => Math.floor(seats / 2) + 1;
