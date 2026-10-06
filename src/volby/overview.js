// Přehled všech pražských zastupitelstev (/, /api/prehled): za každé jen
// souhrnný soubor vysled/<okres>/<zastup>.json → stav sčítání, hlasy
// a mandáty stran a hlavně výsledek Pirátů. Okrsky ani kandidáti se
// neposílají — odpověď má pro všech 58 zastupitelstev pár KB.
//
// Stejně jako feed.js běží na serveru (api/prehled.js, podmíněně přes ETag)
// i v prohlížeči (záloha, jen zastupitelstva s Piráty) a v demu.
import { councilByZastup, KV_BASE_URL } from '../councils.js';
import { allocateSeats } from './compute.js';
import { createJsonCache, createLimiter, normalizeResults, pathsFor, phaseOf } from './feed.js';

export const OVERVIEW_VERSION = 1;

const mulberry32 = (seed) => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

// Souhrn jednoho zastupitelstva z normalizovaného výsledku (normalizeResults).
// Mandáty: oficiální, když je ČSÚ vyhlásil, jinak náš odhad (allocateSeats).
// parties: [[č. kandidátky, hlasy, mandáty], …] seřazené podle hlasů
export function summarizeCouncil(council, results) {
    const alloc = allocateSeats(results.parties, { seats: results.seats });
    const official = !!results.official && results.parties.some((p) => p.seats !== null);
    const seatsOf = (p) => (official ? p.seats || 0 : alloc.byId[p.id]?.seats || 0);
    const sorted = [...results.parties].sort((a, b) => b.votes - a.votes || a.id - b.id);
    const counted = results.precincts.counted;
    const ours = council.pirates ? results.parties.find((p) => p.id === council.pirates) : null;
    const a = ours ? alloc.byId[ours.id] : null;
    return {
        z: council.zastup,
        generated: results.generated,
        phase: phaseOf({ counted, official }),
        counted,
        total: results.precincts.total,
        official,
        seats: results.seats,
        votes: alloc.total,
        turnout: results.turnout.pct,
        parties: sorted.map((p) => [p.id, p.votes, seatsOf(p)]),
        pirates: ours
            ? {
                id: ours.id,
                votes: ours.votes,
                pct: alloc.total ? a.share : null,
                seats: seatsOf(ours),
                passed: a.passed,
                rank: sorted.indexOf(ours) + 1,
                toNext: official ? null : a.toNext,
                margin: official ? null : a.margin,
                toThreshold: official ? null : a.toThreshold,
            }
            : null,
    };
}

// Snapshot přehledu: souhrny + součty za městské části (Magistrát má stejné
// okrsky, do součtu se nepočítá). official = všechna zastupitelstva vyhlášená.
export function composeOverview(summaries, { now = Date.now(), demo = false } = {}) {
    const list = Object.values(summaries);
    const mc = list.filter((s) => !councilByZastup(s.z)?.magistrat);
    const counted = mc.reduce((s, x) => s + x.counted, 0);
    const total = mc.reduce((s, x) => s + x.total, 0);
    const official = list.length > 0 && list.every((s) => s.official);
    const phase = phaseOf({ counted, official }, now);
    return {
        v: OVERVIEW_VERSION,
        ...(demo ? { demo: true } : {}),
        fetchedAt: new Date(now).toISOString(),
        generated: list.map((s) => s.generated).filter(Boolean).sort().pop() || null,
        // demo začíná rovnou po uzavření místností
        phase: demo && phase === 'pre' ? 'waiting' : phase,
        precincts: { counted, total, pct: total ? (counted / total) * 100 : 0 },
        official,
        councils: summaries,
    };
}

// Živý přehled. Zastupitelstvo, jehož soubor zrovna selže, drží poslední
// známý souhrn; selžou-li všechna a nic v paměti není, build() hodí chybu.
export function createOverviewFeed({
    councils,
    fetchImpl = (...args) => fetch(...args),
    conditional = true,
    baseUrl = KV_BASE_URL,
    minIntervalMs = 20000,
    concurrency = 6,
    timeoutMs = 8000,
    headers = {},
} = {}) {
    const getJson = createJsonCache({ fetchImpl, conditional, baseUrl, minIntervalMs, timeoutMs, headers });
    const limit = createLimiter(concurrency);
    const summaries = {};
    let last = null;
    let inflight = null;

    async function build() {
        const settled = await Promise.allSettled(councils.map((c) => limit(async () => {
            summaries[c.zastup] = summarizeCouncil(c, normalizeResults(await getJson(pathsFor(c).results), c));
        })));
        const failed = settled.filter((r) => r.status === 'rejected');
        if (!Object.keys(summaries).length) throw failed[0]?.reason || new Error('no-data');
        last = { ...composeOverview({ ...summaries }), missing: failed.length };
        return last;
    }

    async function snapshot() {
        if (!inflight) {
            inflight = build().finally(() => {
                inflight = null;
            });
        }
        try {
            return { snapshot: await inflight, stale: false, error: null };
        } catch (error) {
            if (last) return { snapshot: last, stale: true, error };
            throw error;
        }
    }

    return { snapshot };
}

// Demo přehledu (/?demo): každé zastupitelstvo se „sčítá" po svém (malé MČ
// rychle, velké déle), podíly vychází z KV 2022 s mírným posunem a během
// sčítání kolísají. Podklady = public/data/prehled.json. Čísla NEJSOU predikce.
export function createOverviewDemoFeed({ councils, statics, durationMs = 150000, seed = Date.now() }) {
    const rand = mulberry32(seed);
    const gauss = () => {
        const u = Math.max(rand(), 1e-9);
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
    };
    const startedAt = Date.now();
    const sims = councils.filter((c) => statics?.councils?.[c.zastup]).map((c) => {
        const st = statics.councils[c.zastup];
        const span = c.magistrat ? durationMs : durationMs * (0.35 + 0.5 * Math.min(1, c.precincts / 130));
        const start = 3000 + (c.magistrat ? 0 : rand() * (durationMs - span) * 0.7);
        const raw = st.lists.map((l) => Math.max(0.004, ((l.pct2022 ?? 3) / 100)
            * (l.id === c.pirates ? 1.06 : 1) * (1 + 0.1 * gauss())));
        const sum = raw.reduce((s, v) => s + v, 0);
        return {
            council: c,
            lists: st.lists,
            start,
            end: start + span,
            final: raw.map((v) => v / sum),
            wobble: st.lists.map(() => gauss()),
            votes: Math.max(1000, st.votes2022) * (1.03 + 0.05 * gauss()),
            turnout: 42 + 6 * gauss(),
        };
    });
    const lastEnd = Math.max(...sims.map((s) => s.end), 0);

    function snapshotAt(now) {
        const elapsed = now - startedAt;
        const summaries = {};
        for (const s of sims) {
            const x = Math.max(0, Math.min(1, (elapsed - s.start) / (s.end - s.start)));
            const eased = x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
            const counted = Math.round(s.council.precincts * eased);
            const done = counted / s.council.precincts;
            const shares = s.final.map((f, i) => Math.max(0, f * (1 + 0.3 * s.wobble[i] * (1 - done))));
            const sum = shares.reduce((a, b) => a + b, 0) || 1;
            const total = Math.round(s.votes * done);
            const parties = s.lists.map((l, i) => ({
                id: l.id,
                votes: Math.round((shares[i] / sum) * total),
                candidates: l.candidates || s.council.seats,
                seats: null,
            }));
            const official = done === 1 && elapsed > s.end + 8000;
            if (official) {
                const alloc = allocateSeats(parties, { seats: s.council.seats });
                for (const p of parties) p.seats = alloc.byId[p.id].seats;
            }
            const summary = summarizeCouncil(s.council, {
                generated: new Date(now).toISOString(),
                seats: s.council.seats,
                precincts: { total: s.council.precincts, counted },
                turnout: { pct: counted ? s.turnout : 0 },
                official,
                parties,
            });
            if (summary.phase === 'pre') summary.phase = 'waiting';
            summaries[s.council.zastup] = summary;
        }
        return composeOverview(summaries, { now, demo: true });
    }

    return {
        startedAt,
        endsAt: startedAt + lastEnd + 8000,
        snapshot: async () => ({ snapshot: snapshotAt(Date.now()), stale: false, error: null }),
    };
}
