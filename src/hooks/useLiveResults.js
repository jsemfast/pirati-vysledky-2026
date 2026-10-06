// Živé výsledky KV 2026 s autorefreshem šetrným ke zdrojům:
//  - primárně /api/volby (jedna sdílená, CDN-cachovaná odpověď pro všechny),
//  - když náš server neodpovídá (2× po sobě, nebo hned při prvním načtení),
//    záložně přímo volby.gov.cz (CORS povolen); proxy se zkusí za 3 minuty
//    — jednorázové zaškobrtnutí (studený start) diváky na ČSÚ nepošle,
//  - interval podle fáze: před 14:00 jednou za 10 min (probuzení přesně na
//    uzavření místností), při sčítání 60 s (ČSÚ data stejně cachuje 60 s),
//    po vyhlášení mandátů 15 min; ±15 % jitter, ať se klienti nesešikují,
//  - skrytý panel/tab = žádné dotazy; po návratu dotaz jen když jsou data stará,
//  - chyby = exponenciální backoff 1 → 2 → 4 → 8 → 10 min.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createKvFeed, phaseOf, SNAPSHOT_VERSION } from '../volby/feed.js';
import { POLLS_CLOSE } from '../councils.js';

const INTERVAL = { pre: 10 * 60e3, waiting: 60e3, counting: 60e3, final: 15 * 60e3 };
const DEMO_INTERVAL = 4000;
const MANUAL_GAP_MS = 15e3;
const PROXY_RETRY_MS = 3 * 60e3;
const PROXY_TIMEOUT_MS = 15e3;
const arrivalsKey = (council) => `kv26.arrivals.${council.zastup}`;

const directFeeds = new Map();
function getDirectFeed(council) {
    if (!directFeeds.has(council.zastup)) {
        directFeeds.set(council.zastup, createKvFeed({ council, conditional: false, minIntervalMs: 45e3, concurrency: 4, timeoutMs: 15000 }));
    }
    return directFeeds.get(council.zastup);
}

async function fetchProxy(council) {
    const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(PROXY_TIMEOUT_MS) : undefined;
    // Přesně tahle URL (bez dalších parametrů) — je to klíč CDN cache
    const res = await fetch(`/api/volby?z=${council.zastup}`, { headers: { Accept: 'application/json' }, signal });
    const type = res.headers.get('content-type') || '';
    // Vite dev bez API / výpadek funkce vrátí HTML nebo chybu → záloha
    if (!type.includes('application/json')) throw new Error('proxy-unavailable');
    const body = await res.json();
    if (!res.ok || body?.v !== SNAPSHOT_VERSION) throw new Error(body?.error || `proxy-${res.status}`);
    const { stale, ...snapshot } = body;
    return { snapshot, stale: !!stale };
}

function readArrivals(council) {
    try {
        const raw = JSON.parse(localStorage.getItem(arrivalsKey(council)) || '{}');
        return raw && typeof raw === 'object' ? raw : {};
    } catch {
        return {};
    }
}

function writeArrivals(council, map) {
    try {
        localStorage.setItem(arrivalsKey(council), JSON.stringify(map));
    } catch {
        /* private mode — feed jen v paměti */
    }
}

function delayFor(phase, errors, demo) {
    if (demo) return DEMO_INTERVAL;
    if (errors > 0) return Math.min(60e3 * 2 ** (errors - 1), 10 * 60e3);
    let base = INTERVAL[phase] ?? 60e3;
    if (phase === 'pre') base = Math.min(base, Math.max(15e3, POLLS_CLOSE - Date.now() + 5e3));
    return base * (0.85 + Math.random() * 0.3);
}

// demo = true: čekat na demoFeed (simulace), na síť nesahat
// council = položka z src/councils.js (stránka sleduje jedno zastupitelstvo)
export function useLiveResults({ council, demo = false, demoFeed = null }) {
    const idle = demo && !demoFeed;
    const [snapshot, setSnapshot] = useState(null);
    const [state, setState] = useState({
        status: 'loading', // loading | ok | error
        source: null, // proxy | direct | demo
        stale: false,
        error: null,
        lastSuccess: null,
        nextAt: null,
        fetching: false,
    });
    // okrsek → čas, kdy ho tenhle prohlížeč poprvé viděl sečtený (null = už při otevření)
    const [arrivals, setArrivals] = useState(() => (demo ? {} : readArrivals(council)));
    const [freshIds, setFreshIds] = useState([]);

    const timerRef = useRef(null);
    const errorsRef = useRef(0);
    const lastAttemptRef = useRef(0);
    const proxyDownUntilRef = useRef(0);
    const phaseRef = useRef('pre');
    const prevKeysRef = useRef(null);
    const runRef = useRef(null);
    const inFlightRef = useRef(false);
    const proxyFailsRef = useRef(0);

    const schedule = useCallback((ms) => {
        clearTimeout(timerRef.current);
        if (document.hidden) {
            setState((s) => ({ ...s, nextAt: null }));
            return;
        }
        const at = Date.now() + ms;
        timerRef.current = setTimeout(() => runRef.current?.(), ms);
        setState((s) => ({ ...s, nextAt: at }));
    }, []);

    const run = useCallback(async () => {
        // Jeden dotaz naráz — jinak by pomalejší starší odpověď (online/
        // návrat do záložky během běžícího dotazu) přepsala novější data
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        clearTimeout(timerRef.current);
        lastAttemptRef.current = Date.now();
        setState((s) => ({ ...s, fetching: true }));
        let result = null;
        let source = demoFeed ? 'demo' : 'proxy';
        let error = null;
        try {
            if (demoFeed) {
                result = await demoFeed.snapshot();
            } else {
                let goDirect = Date.now() < proxyDownUntilRef.current;
                if (!goDirect) {
                    try {
                        result = await fetchProxy(council);
                        proxyFailsRef.current = 0;
                    } catch (e) {
                        proxyFailsRef.current += 1;
                        // Bez dat (první načtení) hned záloha, jinak až po
                        // druhém neúspěchu za sebou; mezitím backoff a stará data
                        goDirect = proxyFailsRef.current >= 2 || !prevKeysRef.current;
                        if (goDirect) {
                            proxyDownUntilRef.current = Date.now() + PROXY_RETRY_MS;
                            proxyFailsRef.current = 0;
                            console.warn('[volby] /api/volby nedostupné, beru data přímo z volby.gov.cz', e);
                        } else {
                            error = e;
                        }
                    }
                }
                if (!result && goDirect) {
                    source = 'direct';
                    result = await getDirectFeed(council).snapshot();
                }
            }
        } catch (e) {
            error = e;
        }

        if (result) {
            errorsRef.current = 0;
            const snap = result.snapshot;
            // Fázi přepočítat lokálně — CDN mohla podržet „pre" i po 14:00
            const phase = demoFeed ? snap.phase : phaseOf({ counted: snap.precincts.counted, official: snap.official });
            phaseRef.current = phase;
            const keys = Object.keys(snap.okrsky || {});
            const prev = prevKeysRef.current;
            const added = prev ? keys.filter((k) => !prev.has(k)) : [];
            prevKeysRef.current = new Set(keys);
            // Časy příchodu jen pro okrsky, které ve snapshotu opravdu jsou;
            // časy z doby před uzavřením místností (testovací data ČSÚ) neplatí
            setArrivals((old) => {
                const now = Date.now();
                const next = {};
                for (const k of keys) {
                    let at = k in old ? old[k] : prev ? now : null;
                    if (!demoFeed && at !== null && at < POLLS_CLOSE) at = null;
                    next[k] = at;
                }
                const same = keys.length === Object.keys(old).length && keys.every((k) => old[k] === next[k]);
                if (same) return old;
                if (!demoFeed) writeArrivals(council, next);
                return next;
            });
            setFreshIds(added);
            setSnapshot({ ...snap, phase });
            setState((s) => ({
                ...s,
                status: 'ok',
                source,
                stale: result.stale,
                error: result.stale ? result.error?.message || 'stale' : null,
                lastSuccess: Date.now(),
                fetching: false,
            }));
        } else {
            errorsRef.current += 1;
            setState((s) => ({
                ...s,
                status: s.lastSuccess ? 'ok' : 'error',
                stale: !!s.lastSuccess,
                error: error?.message || 'Nepodařilo se načíst výsledky',
                fetching: false,
            }));
        }
        inFlightRef.current = false;
        schedule(delayFor(phaseRef.current, errorsRef.current, !!demoFeed));
    }, [council, demoFeed, schedule]);

    useEffect(() => {
        runRef.current = run;
    }, [run]);

    useEffect(() => {
        if (idle) return undefined;
        // první načtení hned, ale mimo tělo efektu (setState v run)
        timerRef.current = setTimeout(() => runRef.current?.(), 0);
        const onVisible = () => {
            if (document.hidden) {
                clearTimeout(timerRef.current);
                setState((s) => ({ ...s, nextAt: null }));
                return;
            }
            const due = delayFor(phaseRef.current, errorsRef.current, !!demoFeed) * 0.85;
            const since = Date.now() - lastAttemptRef.current;
            if (since >= due) runRef.current?.();
            else schedule(due - since);
        };
        const onOnline = () => {
            if (!document.hidden) runRef.current?.();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('online', onOnline);
        return () => {
            clearTimeout(timerRef.current);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('online', onOnline);
        };
    }, [run, schedule, demoFeed, idle]);

    // Ruční obnovení: nejvýš jednou za 15 s (vrací false, když je moc brzy)
    const refresh = useCallback(() => {
        if (Date.now() - lastAttemptRef.current < (demoFeed ? 1000 : MANUAL_GAP_MS)) return false;
        runRef.current?.();
        return true;
    }, [demoFeed]);

    return { snapshot, ...state, arrivals, freshIds, refresh };
}
