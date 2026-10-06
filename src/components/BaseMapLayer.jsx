import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@maplibre/maplibre-gl-leaflet';
import { BASEMAP_STYLE, BASEMAP_ATTRIBUTION, FALLBACK_TILES, FALLBACK_ATTRIBUTION } from '../volby/basemap';

// Worker maplibre servíruje vite plugin p3-maplibre-worker (viz vite.config.js);
// bez explicitní cesty by ho maplibre v produkčním buildu nenašel.
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

// Zjišťuje se jednou za načtení stránky a zkušební kontext se hned uvolní —
// jinak by každé přepnutí mobilní záložky s mapou nechalo viset další
// WebGL kontext a prohlížeč by je časem začal zahazovat.
let webgl2Support = null;
function hasWebGL2() {
    if (webgl2Support !== null) return webgl2Support;
    try {
        const gl = document.createElement('canvas').getContext('webgl2');
        webgl2Support = !!gl;
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
        webgl2Support = false;
    }
    return webgl2Support;
}

// Vektorový podklad (MapLibre) zapojený do Leafletu jako obyčejná vrstva
// v tilePane — všechny GeoJSON vrstvy a pany zůstávají nad ním.
export default function BaseMapLayer() {
    const map = useMap();

    useEffect(() => {
        // Bez WebGL2 (starší telefony, vypnutá akcelerace) MapLibre jen
        // zaloguje chybu a vrstva zůstane rozbitá — pak radši rastr OSM.
        if (!hasWebGL2()) {
            const raster = L.tileLayer(FALLBACK_TILES, {
                attribution: FALLBACK_ATTRIBUTION,
                maxZoom: 19,
            }).addTo(map);
            return () => {
                map.removeLayer(raster);
            };
        }

        const layer = L.maplibreGL({
            style: BASEMAP_STYLE,
            attribution: BASEMAP_ATTRIBUTION,
            interactive: false,
        });
        layer.addTo(map);

        // OpenFreeMap má popisky ve výchozím jazyce (anglicky) — přepneme
        // je na české názvy, tam kde je OSM má.
        const gl = layer.getMaplibreMap();
        const localize = () => {
            for (const l of gl.getStyle().layers) {
                if (l.type !== 'symbol') continue;
                const field = gl.getLayoutProperty(l.id, 'text-field');
                if (!field || !JSON.stringify(field).includes('"name"')) continue;
                gl.setLayoutProperty(l.id, 'text-field', [
                    'coalesce', ['get', 'name:cs'], ['get', 'name'],
                ]);
            }
        };
        if (gl.isStyleLoaded()) localize();
        else gl.once('styledata', localize);

        return () => {
            map.removeLayer(layer);
        };
    }, [map]);

    return null;
}
