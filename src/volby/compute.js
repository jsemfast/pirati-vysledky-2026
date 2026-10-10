// Přepočet hlasů na mandáty a odvozené ukazatele pro KV 2026.
// Postup podle zákona č. 491/2001 Sb., § 45:
//  1. uzavírací klauzule 5 % — u kandidátky s méně kandidáty, než je mandátů,
//     se celkový počet platných hlasů přepočte (÷ mandáty × kandidáti);
//     postoupí-li méně než 2 strany, hranice klesá po 1 p. b.,
//  2. d'Hondt (dělitelé 1, 2, 3, …), strana nedostane víc mandátů, než má
//     kandidátů; při rovnosti podílů rozhoduje vyšší počet hlasů,
//  3. uvnitř strany: kandidát s alespoň 110 % průměru hlasů na kandidáta
//     („hranice") jde dopředu (seřazeni podle hlasů), ostatní podle listiny.
// Hlasy kandidáta v KV nejsou „preferenční" jako ve sněmovních volbách:
// křížek u strany dá hlas každému jejímu kandidátovi (§ 40 odst. 2), takže
// mají všichni podobně (v Praze 2022 medián 99 % průměru, 95 % kandidátů
// pod 115 %) a o posunu rozhoduje jen to, kdo má aspoň 110 % průměru.
// Ověřeno na oficiálních výsledcích KV 2022 (Praha 3: mandáty i zvolení sedí).
// Funkce jsou čisté — používá je UI i demo režim.

export function allocateSeats(parties, { seats }) {
    const total = parties.reduce((s, p) => s + (p.votes || 0), 0);
    const rows = parties.map((p) => {
        const candidates = p.candidates || seats;
        const base = candidates < seats ? (total / seats) * candidates : total;
        return {
            id: p.id,
            votes: p.votes || 0,
            candidates,
            base,
            share: total ? (p.votes / total) * 100 : 0,
            adjPct: base ? (p.votes / base) * 100 : 0,
            passed: false,
            seats: 0,
            toNext: null,
            margin: null,
            toThreshold: null,
        };
    });
    if (!total) return { total, threshold: 5, rows, byId: indexById(rows), lastSeat: null, nextSeat: null };

    let threshold = 5;
    while (threshold > 0 && rows.filter((r) => r.adjPct >= threshold).length < 2) threshold -= 1;
    for (const r of rows) r.passed = r.votes > 0 && r.adjPct >= threshold;

    const quotients = [];
    for (const r of rows) {
        if (!r.passed) continue;
        for (let k = 1; k <= Math.min(r.candidates, seats); k++) {
            quotients.push({ id: r.id, k, q: r.votes / k, votes: r.votes });
        }
    }
    quotients.sort((a, b) => b.q - a.q || b.votes - a.votes || a.id - b.id);
    const winners = quotients.slice(0, seats);
    const byId = indexById(rows);
    for (const w of winners) byId[w.id].seats += 1;

    // Kolik hlasů straně chybí na další mandát / kolik může ztratit, aby
    // poslední mandát udržela — při neměnných hlasech ostatních stran.
    // U klauzule počítáme s tím, že získané/ztracené hlasy mění i celkový
    // počet: projde, když (v ± x) ≥ t·k·(T ± x), k = podíl kandidátů.
    const t = threshold / 100;
    for (const r of rows) {
        const tk = t * (r.candidates < seats ? r.candidates / seats : 1);
        if (!r.passed) {
            r.toThreshold = Math.max(0, Math.ceil((tk * total - r.votes) / (1 - tk) - 1e-9));
            continue;
        }
        const others = quotients.filter((q) => q.id !== r.id).map((q) => q.q);
        if (r.seats < Math.min(r.candidates, seats)) {
            const rival = others[seats - r.seats - 1];
            if (rival !== undefined) r.toNext = Math.floor(rival * (r.seats + 1)) + 1 - r.votes;
        }
        if (r.seats > 0) {
            const rival = others[seats - r.seats];
            const dhondt = rival === undefined ? r.votes : Math.floor(r.votes - rival * r.seats);
            // pod klauzulí by strana přišla o všechny mandáty naráz
            const clause = Math.floor((r.votes - tk * total) / (1 - tk) + 1e-9);
            r.margin = Math.max(0, Math.min(dhondt, clause));
        }
    }

    return {
        total,
        threshold,
        rows,
        byId,
        lastSeat: winners[winners.length - 1] || null,
        nextSeat: quotients[seats] || null,
    };
}

function indexById(rows) {
    return Object.fromEntries(rows.map((r) => [r.id, r]));
}

// Pořadí kandidátů jedné strany po přednostním posunu (§ 45 odst. 4) —
// v tomhle pořadí dostávají mandáty a stávají se náhradníky.
// Hranici počítáme vždy sami (pole `hranice` od ČSÚ nejde před volbami
// ověřit a náš vzorec sedí na všech kandidátech KV 2022).
export function rankCandidates(candidates, seats, { partyVotes } = {}) {
    const list = [...(candidates || [])].sort((a, b) => a.n - b.n);
    const votes = partyVotes ?? list.reduce((s, c) => s + c.votes, 0);
    // Průměr „vyjádřený celým číslem bez zaokrouhlení" (§ 45 odst. 4), tj.
    // useknutý — s přesným průměrem by v KV 2022 nesedělo ~1 100 kandidátů.
    // Celočíselně: hlasy·10 ≥ ⌊průměr⌋·11 — s 1,1 v plovoucí čárce by
    // 100·1,1 = 110,00000000000001.
    const base = list.length ? Math.floor(votes / list.length) : null;
    const preferred = votes > 0 && base !== null
        ? list.filter((c) => c.votes * 10 >= base * 11).sort((a, b) => b.votes - a.votes || a.n - b.n)
        : [];
    const hranice = base === null ? Infinity : (base * 11) / 10;
    const prefSet = new Set(preferred.map((c) => c.n));
    const order = [...preferred, ...list.filter((c) => !prefSet.has(c.n))];
    return {
        limit: Number.isFinite(hranice) ? hranice : null,
        average: base || null,
        ranked: order.map((c, i) => ({
            ...c,
            order: i + 1,
            preferred: prefSet.has(c.n),
            // % průměru na kandidáta, useknuté na celé procento: ≥ 110 právě
            // tehdy, když kandidát přeskočí (zaokrouhlení by u 109,6 % ukázalo
            // 110 % u někoho, kdo neprošel)
            ofAvg: base ? Math.floor((c.votes * 100) / base) : null,
            seat: i < seats,
            // přeskočil(a) díky hlasům — podle listiny by mandát neměl(a)
            jumped: prefSet.has(c.n) && i < seats && c.n > seats,
            // podle listiny by mandát měl(a), ale o mandát přišel/přišla —
            // i nad hranicí, když ho předběhli ještě silnější kandidáti
            bumped: i >= seats && c.n <= seats,
        })),
    };
}

// Kompletní stav: oficiální mandáty, když je ČSÚ vyhlásil, jinak náš odhad
export function computeOutcome(snapshot, { seats } = {}) {
    const seatsTotal = snapshot?.seats || seats;
    const parties = snapshot?.parties || [];
    const alloc = allocateSeats(parties, { seats: seatsTotal });
    const official = !!snapshot?.official && parties.some((p) => p.seats !== null);

    const seatsById = {};
    for (const p of parties) seatsById[p.id] = official ? p.seats || 0 : alloc.byId[p.id]?.seats || 0;

    const councilors = {};
    for (const p of parties) {
        const cands = snapshot.candidates?.[p.id] || [];
        const { ranked, limit, average } = rankCandidates(cands, seatsById[p.id], { partyVotes: p.votes });
        // Oficiální značky zvolení od ČSÚ mají přednost před naším výpočtem —
        // ale jen když sedí s počtem mandátů (formát sloupce šlo před volbami
        // ověřit jen z kódu prezentační aplikace, ne na živých datech)
        const flagged = cands.filter((c) => c.elected).length;
        if (official && flagged > 0 && flagged === seatsById[p.id]) {
            const s = seatsById[p.id];
            for (const c of ranked) {
                const src = cands.find((x) => x.n === c.n);
                c.seat = !!src?.elected;
                // odznaky musí odpovídat oficiálnímu výsledku, ne odhadu
                c.jumped = c.seat && c.n > s;
                c.bumped = !c.seat && c.n <= s;
            }
            // zvolení napřed (v pořadí ČSÚ, když ho máme), pak ostatní
            ranked.sort((a, b) => (Number(b.seat) - Number(a.seat))
                || (a.seat && a.rank && b.rank ? a.rank - b.rank : a.order - b.order));
            ranked.forEach((c, i) => {
                c.order = i + 1;
            });
        }
        councilors[p.id] = { ranked, limit, average };
    }

    return { official, alloc, seatsById, councilors, seatsTotal };
}

// Všechny minimální většinové koalice (odebráním kterékoli strany většina padne)
export function minimalCoalitions(seatsById, { majority }) {
    const ids = Object.keys(seatsById).map(Number).filter((id) => seatsById[id] > 0);
    const out = [];
    for (let mask = 1; mask < 1 << ids.length; mask++) {
        const members = ids.filter((_, i) => mask & (1 << i));
        const seats = members.reduce((s, id) => s + seatsById[id], 0);
        if (seats < majority) continue;
        if (members.every((id) => seats - seatsById[id] < majority)) out.push({ members, seats });
    }
    return out.sort((a, b) => a.members.length - b.members.length || b.seats - a.seats);
}

export function sumSeats(seatsById, members) {
    return members.reduce((s, id) => s + (seatsById[id] || 0), 0);
}

// Podíl strany v okrsku (v %), null = okrsek ještě není sečtený
export function precinctShare(okrsek, partyIds) {
    if (!okrsek?.votes) return null;
    const total = Object.values(okrsek.votes).reduce((s, v) => s + v, 0);
    if (!total) return null;
    const ids = Array.isArray(partyIds) ? partyIds : [partyIds];
    if (!ids.some((id) => id in okrsek.votes)) return null;
    return (ids.reduce((s, id) => s + (okrsek.votes[id] || 0), 0) / total) * 100;
}

export function precinctWinner(okrsek) {
    if (!okrsek?.votes) return null;
    let best = null;
    let second = null;
    const total = Object.values(okrsek.votes).reduce((s, v) => s + v, 0);
    for (const [id, v] of Object.entries(okrsek.votes)) {
        if (id === '0') continue; // „ostatní" (jen u mapy 2022)
        if (!best || v > best.votes) {
            second = best;
            best = { id: Number(id), votes: v };
        } else if (!second || v > second.votes) {
            second = { id: Number(id), votes: v };
        }
    }
    if (!best || !total) return null;
    return {
        id: best.id,
        pct: (best.votes / total) * 100,
        lead: ((best.votes - (second?.votes || 0)) / total) * 100,
    };
}

// Srovnání s KV 2022: podíl kandidátek 2022 (id) v okrsku, v seznamu okrsků
// (stejné okrsky jako dosud sečtené) nebo v celém zastupitelstvu (null).
// results2022 = public/data/<slug>/results2022.json
export function baselineShare(results2022, baselineIds, okrsky = null) {
    const all = results2022?.okrsky;
    if (!all || !baselineIds?.length) return null;
    const ids = okrsky === null ? null : Array.isArray(okrsky) ? okrsky : [okrsky];
    const rows = ids ? ids.map((id) => all[id]).filter(Boolean) : Object.values(all);
    let votes = 0;
    let total = 0;
    for (const r of rows) {
        total += r.validVotes || 0;
        for (const id of baselineIds) votes += r.votes?.[id] || 0;
    }
    return total ? (votes / total) * 100 : null;
}

// Účast v KV 2022 (celé zastupitelstvo)
export function turnout2022(results2022) {
    const rows = Object.values(results2022?.okrsky || {});
    const voters = rows.reduce((s, r) => s + r.voters, 0);
    return voters ? (rows.reduce((s, r) => s + r.envelopes, 0) / voters) * 100 : null;
}
