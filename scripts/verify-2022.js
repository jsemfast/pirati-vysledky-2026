// Ověření výpočtu mandátů a zvolených kandidátů (src/volby/compute.js) na
// oficiálních výsledcích komunálních voleb 2022.
//
//   npm run verify            sledovaná zastupitelstva ze src/councils.js
//   npm run verify -- --all   všechna zastupitelstva v ČR (~6 200 voleb)
import { COUNCILS } from '../src/councils.js';
import { allocateSeats, rankCandidates } from '../src/volby/compute.js';
import { csvFromZip, download } from './lib/util.js';

const REG_2022 = 'https://volby.gov.cz/opendata/kv2022/KV2022reg20260328_csv.zip';
const DATE_2022 = '20220923';
const all = process.argv.includes('--all');

const reg = await download(REG_2022);
const ros = csvFromZip(reg, 'kvros.csv').filter((r) => !r.DATUMVOLEB || r.DATUMVOLEB === DATE_2022);
const rk = csvFromZip(reg, 'kvrk.csv').filter((r) => r.PLATNOST === 'A' && (!r.DATUMVOLEB || r.DATUMVOLEB === DATE_2022));

// Volba = zastupitelstvo + volební obvod (většina obcí má 1 obvod)
const key = (r) => `${r.KODZASTUP}|${r.COBVODU}`;
const listsBy = new Map();
for (const r of ros) {
    if (!listsBy.has(key(r))) listsBy.set(key(r), []);
    listsBy.get(key(r)).push(r);
}
const candsBy = new Map();
for (const c of rk) {
    const k = `${key(c)}|${c.POR_STR_HL}`;
    if (!candsBy.has(k)) candsBy.set(k, []);
    candsBy.get(k).push(c);
}

const targets = all
    ? [...listsBy.keys()]
    : COUNCILS.flatMap((c) => [...listsBy.keys()].filter((k) => k.startsWith(`${c.zastup}|`)));

let ok = 0;
let seatErrors = 0;
let candErrors = 0;
const failures = [];
for (const k of targets) {
    const lists = listsBy.get(k);
    const seats = lists.reduce((s, l) => s + (Number(l.MAND_STR) || 0), 0);
    if (!seats) continue;
    const parties = lists.map((l) => ({
        id: Number(l.POR_STR_HL),
        votes: Number(l.HLASY_STR) || 0,
        candidates: (candsBy.get(`${k}|${l.POR_STR_HL}`) || []).length,
        official: Number(l.MAND_STR) || 0,
    }));
    const alloc = allocateSeats(parties, { seats });
    let good = true;
    for (const p of parties) {
        if (alloc.byId[p.id].seats !== p.official) {
            good = false;
            seatErrors++;
        }
        const cands = (candsBy.get(`${k}|${p.id}`) || []).map((c) => ({
            n: Number(c.PORCISLO),
            votes: Number(c.POCHLASU) || 0,
            official: c.MANDAT === 'A',
        }));
        const { ranked } = rankCandidates(cands, p.official, { partyVotes: p.votes });
        for (const c of ranked) {
            if (c.seat !== cands.find((x) => x.n === c.n).official) {
                good = false;
                candErrors++;
            }
        }
    }
    if (good) ok++;
    else failures.push(`${k} ${lists[0].NAZEVZAST}`);
    if (!all) console.log(`${good ? '✓' : '✗'} ${lists[0].NAZEVZAST} (${k}) — ${seats} mandátů, ${parties.length} kandidátek`);
}

const total = ok + failures.length;
console.log(`\n${ok} / ${total} voleb sedí (${((ok / total) * 100).toFixed(2)} %), chyb v mandátech stran: ${seatErrors}, ve zvolených: ${candErrors}`);
if (failures.length) console.log('Nesedí:', failures.slice(0, 20).join('; '), failures.length > 20 ? '…' : '');
process.exit(failures.length && !all ? 1 : 0);
