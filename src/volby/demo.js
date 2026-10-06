// Demo režim (?demo, ?demo=60 = délka v sekundách): simulované sčítání
// postavené na okrskových výsledcích KV 2022 a skutečných kandidátkách 2026.
// Slouží k vyzkoušení stránky před volbami — snapshot má stejný tvar jako
// ten z /api/volby a sítě se nedotkne. Čísla NEJSOU predikce.
import { allocateSeats, rankCandidates } from './compute.js';
import { activeCouncil } from './council.js';
import { SNAPSHOT_VERSION } from './feed.js';
import { gaussFrom, mulberry32 } from './random.js';

export function createDemoFeed({ results2022, kandidati, durationMs = 150000, seed = Date.now() }) {
    const council = activeCouncil();
    const rand = mulberry32(seed);
    const gauss = gaussFrom(rand);
    const startedAt = Date.now();
    const metas = Object.values(council.metas);
    const listIds = metas.map((m) => m.id).sort((a, b) => a - b);

    // Rozdělená kandidátka 2022 se mezi nástupce dělí rovným dílem
    const owners = {};
    for (const m of metas) for (const s of m.split2022 || []) owners[s.id] = (owners[s.id] || 0) + 1;
    // Mírný „posun" proti 2022 — jen aby demo nebylo kopií minulých voleb
    const drift = Object.fromEntries(metas.map((m) => [
        m.id,
        (m.pirates ? 1.06 : 1) * (1 + 0.08 * gauss()),
    ]));

    const ids = Object.keys(results2022?.okrsky || {});
    const precincts = {};
    for (const id of ids) {
        const r = results2022.okrsky[id];
        const share22 = (listId) => (r.validVotes ? (r.votes?.[listId] || 0) / r.validVotes : 0);
        const raw = {};
        for (const m of metas) {
            let base = 0;
            if (m.baseline) base = m.baseline.ids.reduce((s, old) => s + share22(old), 0);
            else if (m.split2022) base = m.split2022.reduce((s, x) => s + share22(x.id) / (owners[x.id] || 1), 0);
            else base = 0.025;
            raw[m.id] = Math.max(0.002, base * drift[m.id] * (1 + 0.14 * gauss()));
        }
        const sum = Object.values(raw).reduce((s, v) => s + v, 0);
        const envelopes = Math.round(r.envelopes * (1.05 + 0.04 * gauss()));
        const validVotes = Math.round(r.validVotes * (envelopes / Math.max(1, r.envelopes)) * 0.99);
        const votes = {};
        for (const lid of listIds) votes[lid] = Math.round((raw[lid] / sum) * validVotes);
        precincts[id] = {
            voters: r.voters,
            envelopes,
            turnout: r.voters ? (envelopes / r.voters) * 100 : 0,
            validVotes: Object.values(votes).reduce((s, v) => s + v, 0),
            votes,
        };
    }

    // Příchod okrsků: náhodné pořadí, S-křivka (pár prvních, nápor, ocas)
    const order = [...ids].sort(() => rand() - 0.5);
    const arrival = {};
    order.forEach((id, i) => {
        const x = order.length > 1 ? i / (order.length - 1) : 1;
        const eased = x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
        arrival[id] = 4000 + eased * durationMs + rand() * 2500;
    });
    const lastArrival = Math.max(...Object.values(arrival), 0);

    // Váhy kandidátů: lídr táhne, s pořadím klesají, pár „preferenčních hvězd"
    const weights = {};
    for (const lid of listIds) {
        const list = kandidati.parties[lid]?.candidates || [];
        const stars = new Set([7 + Math.floor(rand() * 10), 12 + Math.floor(rand() * 15)]);
        weights[lid] = list.map((c) => {
            let w = ((c.n === 1 ? 2.6 : 1) / (1 + 0.04 * (c.n - 1))) * Math.exp(0.22 * gauss());
            if (stars.has(c.n)) w *= 2.4;
            return w;
        });
    }

    function snapshotAt(now) {
        const elapsed = now - startedAt;
        const counted = ids.filter((id) => arrival[id] <= elapsed);
        const totals = Object.fromEntries(listIds.map((lid) => [lid, 0]));
        let voters = 0;
        let envelopes = 0;
        for (const id of counted) {
            voters += precincts[id].voters;
            envelopes += precincts[id].envelopes;
            for (const lid of listIds) totals[lid] += precincts[id].votes[lid];
        }
        const validVotes = Object.values(totals).reduce((s, v) => s + v, 0);

        const candidates = {};
        for (const lid of listIds) {
            const list = kandidati.parties[lid]?.candidates || [];
            const wsum = weights[lid].reduce((s, w) => s + w, 0) || 1;
            candidates[lid] = list.map((c, i) => {
                const v = Math.round((totals[lid] * weights[lid][i]) / wsum);
                return { n: c.n, name: `${c.prijmeni} ${c.jmeno}`, age: c.vek, votes: v, pct: totals[lid] ? (v / totals[lid]) * 100 : 0, elected: null, rank: null };
            });
        }

        const parties = listIds.map((lid) => ({
            id: lid,
            name: council.metas[lid]?.short,
            fullName: council.metas[lid]?.name,
            votes: totals[lid],
            pct: validVotes ? (totals[lid] / validVotes) * 100 : 0,
            candidates: kandidati.parties[lid]?.candidates.length || council.seats,
            recalcPct: null,
            seats: null,
        }));

        // Po posledním okrsku „vyhlásí ČSÚ" mandáty — jako v reálu
        const official = counted.length === ids.length && elapsed > lastArrival + 8000;
        if (official) {
            const alloc = allocateSeats(parties, { seats: council.seats });
            for (const p of parties) {
                p.seats = alloc.byId[p.id].seats;
                const { ranked } = rankCandidates(candidates[p.id], p.seats, { partyVotes: p.votes });
                for (const c of ranked) {
                    const src = candidates[p.id].find((x) => x.n === c.n);
                    src.elected = c.seat;
                    src.rank = c.seat ? c.order : null;
                }
            }
        }

        const withPrecincts = council.precinctFiles !== false;
        return {
            v: SNAPSHOT_VERSION,
            demo: true,
            zastup: council.zastup,
            fetchedAt: new Date(now).toISOString(),
            generated: new Date(now).toISOString(),
            phase: official ? 'final' : counted.length ? 'counting' : 'waiting',
            seats: council.seats,
            precincts: { total: ids.length, counted: counted.length, pct: ids.length ? (counted.length / ids.length) * 100 : 0 },
            turnout: { voters, envelopes, pct: voters ? (envelopes / voters) * 100 : 0, returned: envelopes, validBallots: envelopes, validVotes },
            official,
            parties,
            candidates,
            limits: {},
            okrsky: withPrecincts ? Object.fromEntries(counted.map((id) => [id, precincts[id]])) : {},
        };
    }

    return {
        startedAt,
        endsAt: startedAt + lastArrival + 8000,
        snapshot: async () => ({ snapshot: snapshotAt(Date.now()), stale: false, error: null }),
    };
}

