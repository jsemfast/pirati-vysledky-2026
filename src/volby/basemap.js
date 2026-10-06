// Podkladová mapa. CARTO basemaps od srpna 2026 vyžadují API klíč (tiles se
// vrací s vodoznakem „API KEY REQUIRED"), proto jedeme na OpenFreeMap —
// stejný styl Positron, zdarma, bez klíče, vektorově ostré až do zoomu 20.
export const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
export const BASEMAP_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://openfreemap.org/">OpenFreeMap</a>';

// Záloha pro prohlížeče bez WebGL2 (viz BaseMapLayer)
export const FALLBACK_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const FALLBACK_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
