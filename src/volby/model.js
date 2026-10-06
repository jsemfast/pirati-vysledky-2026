// Odvozený model pro UI: snapshot + statická data zastupitelstva
// (kandidátky, kandidáti, výsledky 2022) → seřazené strany, mandáty,
// zastupitelé s fotkami, koalice.
import { computeOutcome, minimalCoalitions, sumSeats, baselineShare } from './compute.js';
import { activeCouncil, partyMeta } from './council.js';
import { candidateName } from './format.js';
import { POLLS_CLOSE } from '../councils.js';

export function buildModel(snapshot, { kandidati, results2022 }) {
    if (!snapshot) return null;
    const council = activeCouncil();
    const outcome = computeOutcome(snapshot, { seats: council.seats });
    const totalVotes = outcome.alloc.total;
    const hasVotes = totalVotes > 0;
    // Během sčítání srovnávat s 2022 jen ve stejných (už sečtených) okrscích —
    // jinak by první sečtené okrsky (třeba naše bašty) dávaly falešný skok.
    // Bez okrskových dat (Magistrát) se srovnává s celou Prahou.
    const countedIds = Object.keys(snapshot.okrsky || {});
    const partial = countedIds.length > 0 && countedIds.length < (snapshot.precincts?.total || Infinity);
    const scope = partial ? countedIds : null;
    const seats2022 = Object.fromEntries((council.lists2022 || []).map((l) => [l.id, l.seats]));

    const parties = (snapshot.parties || []).map((p) => {
        const meta = partyMeta(p.id);
        const a = outcome.alloc.byId[p.id] || {};
        const ids = meta.baseline?.ids;
        const share = hasVotes ? a.share : null;
        const base = ids ? baselineShare(results2022, ids, scope) : null;
        return {
            id: p.id,
            meta,
            name: meta.short,
            fullName: meta.name || p.fullName || p.name,
            votes: p.votes,
            share,
            adjPct: a.adjPct ?? null,
            passed: !!a.passed,
            seats: outcome.seatsById[p.id] || 0,
            candidates: p.candidates,
            toNext: a.toNext ?? null,
            margin: a.margin ?? null,
            toThreshold: a.toThreshold ?? null,
            baseline: base,
            baselineTotal: ids ? baselineShare(results2022, ids) : null,
            baselineSeats: ids ? ids.reduce((s, id) => s + (seats2022[id] || 0), 0) : null,
            split2022: meta.split2022
                ? meta.split2022.map((s) => ({ ...s, share: baselineShare(results2022, [s.id], scope) }))
                : null,
            delta: share !== null && base !== null ? share - base : null,
        };
    });
    parties.sort((a, b) => (hasVotes ? b.votes - a.votes || a.id - b.id : a.id - b.id));
    const byId = Object.fromEntries(parties.map((p) => [p.id, p]));

    // Zastupitelé / kandidáti s registrem (jména, povolání) a fotkami
    const councilors = {};
    for (const p of parties) {
        const regList = kandidati?.parties?.[p.id]?.candidates || [];
        const regByN = new Map(regList.map((c) => [c.n, c]));
        const ranked = outcome.councilors[p.id]?.ranked?.length
            ? outcome.councilors[p.id].ranked
            : regList.map((c, i) => ({ n: c.n, votes: 0, pct: 0, order: i + 1, seat: false, preferred: false, jumped: false, bumped: false }));
        councilors[p.id] = {
            limit: outcome.councilors[p.id]?.limit ?? null,
            list: ranked.map((c) => {
                const reg = regByN.get(c.n);
                return {
                    ...c,
                    partyId: p.id,
                    ...candidateName(reg, c.name),
                    age: reg?.vek ?? c.age,
                    job: reg?.povolani || '',
                    affiliation: reg?.prislusnost || '',
                    photo: reg?.photo || null,
                };
            }),
        };
    }

    const coalitionLists = council.coalition?.lists || [];

    // Boj o poslední mandát: kdo ho drží a kdo je nejblíž dalšímu
    let lastSeat = null;
    if (hasVotes && !outcome.official && outcome.alloc.lastSeat) {
        const holder = byId[outcome.alloc.lastSeat.id];
        const challenger = parties
            .filter((p) => p.passed && p.toNext !== null && p.toNext > 0)
            .sort((a, b) => a.toNext - b.toNext)[0] || null;
        lastSeat = { holder, challenger };
    }

    return {
        snapshot,
        council,
        official: outcome.official,
        hasVotes,
        totalVotes,
        threshold: outcome.alloc.threshold,
        // počet okrsků, ve kterých se srovnává s 2022 (null = celé zastupitelstvo)
        baselineScope: partial ? countedIds.length : null,
        parties,
        byId,
        seatsById: outcome.seatsById,
        councilors,
        coalition: {
            members: coalitionLists,
            label: council.coalition?.label || '',
            seats: sumSeats(outcome.seatsById, coalitionLists),
            majority: council.majority,
            seats2022: council.coalition?.seats2022 ?? null,
            seatsTotal2022: council.coalition?.seatsTotal2022 ?? null,
        },
        coalitions: hasVotes ? minimalCoalitions(outcome.seatsById, { majority: council.majority }) : [],
        ours: byId[council.pirates] || null,
        lastSeat,
    };
}

// Seznam zvolených v pořadí pro půlkruh (strany zleva doprava)
export function seatList(model, order) {
    const seats = [];
    for (const id of order) {
        const c = model.councilors[id];
        if (!c) continue;
        for (const person of c.list.filter((x) => x.seat)) seats.push({ partyId: id, person });
    }
    return seats;
}

// Okrsky KV 2022 ve tvaru snapshotu (hlasy předchůdců přepočtené na
// kandidátky 2026) — mapa je ukazuje, dokud se nezačne sčítat
export function precincts2022(results2022) {
    const council = activeCouncil();
    const out = {};
    for (const [id, r] of Object.entries(results2022?.okrsky || {})) {
        const votes = {};
        for (const meta of Object.values(council.metas)) {
            // bez jednoznačného předchůdce stranu vynechat — mapa ji ukáže
            // jako „bez dat", ne jako 0 %
            if (!meta.baseline) continue;
            votes[meta.id] = meta.baseline.ids.reduce((s, old) => s + (r.votes?.[old] || 0), 0);
        }
        // zbytek (strany bez nástupce) jako „ostatní", ať podíly sedí s 2022
        votes[0] = Math.max(0, r.validVotes - Object.values(votes).reduce((s, v) => s + v, 0));
        out[id] = {
            voters: r.voters,
            envelopes: r.envelopes,
            turnout: r.voters ? (r.envelopes / r.voters) * 100 : 0,
            validVotes: r.validVotes,
            votes,
        };
    }
    return out;
}

// Náhradní snapshot jen z kandidátek — když se live data vůbec nenačtou,
// stránka ukáže aspoň odpočet, kandidátky a výchozí stav 2022
export function emptySnapshot(kandidati, now = Date.now()) {
    const council = activeCouncil();
    const parties = Object.entries(kandidati?.parties || {}).map(([id, p]) => ({
        id: Number(id),
        name: partyMeta(Number(id)).short,
        fullName: partyMeta(Number(id)).name,
        votes: 0,
        pct: 0,
        candidates: p.candidates.length,
        recalcPct: null,
        seats: null,
    }));
    const candidates = Object.fromEntries(Object.entries(kandidati?.parties || {}).map(([id, p]) => [
        id,
        p.candidates.map((c) => ({ n: c.n, name: `${c.prijmeni} ${c.jmeno}`, age: c.vek, votes: 0, pct: 0, elected: null, rank: null })),
    ]));
    return {
        v: 1,
        placeholder: true,
        zastup: council.zastup,
        fetchedAt: null,
        generated: null,
        phase: now < POLLS_CLOSE ? 'pre' : 'waiting',
        seats: council.seats,
        precincts: { total: council.precincts, counted: 0, pct: 0 },
        turnout: { voters: 0, envelopes: 0, pct: 0, returned: 0, validBallots: 0, validVotes: 0 },
        official: false,
        parties,
        candidates,
        limits: {},
        okrsky: {},
    };
}
