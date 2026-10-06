// Půlkruh zastupitelstva (35 / 45 / 65 křesel). Křesla jsou přiřazená
// konkrétním zvoleným (odhad nebo oficiální výsledek) — klik/tap ukáže, kdo
// na něm sedí. Strany jsou seřazené zhruba zleva doprava (council.js → AXIS).
import React, { useMemo, useRef, useState } from 'react';
import { activeCouncil, partyMeta } from '../volby/council';
import { seatList } from '../volby/model';
import { fmtInt, fmtPct } from '../volby/format';
import { Avatar } from './ui';

const W = 230;
const H = 122;
const CX = W / 2;
const CY = H - 9;
const R_OUT = 104;

const layoutCache = new Map();
function layout(total) {
    if (layoutCache.has(total)) return layoutCache.get(total);
    // Víc mandátů = víc řad a menší křesla
    const ROWS = total <= 40 ? 3 : total <= 55 ? 4 : 5;
    const R_IN = ROWS === 3 ? 56 : ROWS === 4 ? 48 : 42;
    const spacing = (R_OUT - R_IN) / (ROWS - 1);
    const radii = Array.from({ length: ROWS }, (_, i) => R_IN + spacing * i);
    const sumR = radii.reduce((s, r) => s + r, 0);
    const counts = radii.map((r) => Math.round((total * r) / sumR));
    let diff = total - counts.reduce((s, c) => s + c, 0);
    for (let i = ROWS - 1; diff !== 0; i = (i - 1 + ROWS) % ROWS) {
        counts[i] += Math.sign(diff);
        diff -= Math.sign(diff);
    }
    const seats = [];
    radii.forEach((r, row) => {
        const n = counts[row];
        for (let j = 0; j < n; j++) {
            const theta = n === 1 ? Math.PI / 2 : Math.PI * (1 - j / (n - 1));
            seats.push({ x: CX + r * Math.cos(theta), y: CY - r * Math.sin(theta), theta, r });
        }
    });
    // Zleva doprava po úhlu — strany pak tvoří souvislé výseče
    seats.sort((a, b) => b.theta - a.theta || b.r - a.r);
    const arc = (Math.PI * R_IN) / Math.max(1, counts[0] - 1);
    const result = { positions: seats, seatR: Math.min(9, spacing * 0.42, arc * 0.42) };
    layoutCache.set(total, result);
    return result;
}

export default function Hemicycle({ model, highlight = null, onSelectPerson, centerLabel }) {
    const [active, setActive] = useState(null);
    const council = activeCouncil();
    const { positions: POSITIONS, seatR } = layout(council.seats);
    const seats = useMemo(() => (model ? seatList(model, model.council.order) : []), [model]);
    const highlightSet = highlight ? new Set(highlight) : null;
    const highlighted = highlightSet ? seats.filter((s) => highlightSet.has(s.partyId)).length : null;
    const activeSeat = active !== null ? seats[active] : null;

    // Křesla mají na telefonu 17–24 px a dotýkají se — místo trefování
    // kroužku vybere klepnutí nejbližší křeslo a přejetí prstem po půlkruhu
    // křesla projíždí (touch-pan-y: svislý posun stránky dál funguje)
    const svgRef = useRef(null);
    const pressing = useRef(false);
    const nearest = (e) => {
        const ctm = svgRef.current?.getScreenCTM();
        if (!ctm) return null;
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
        let best = null;
        let bestD = (seatR * 3) ** 2;
        POSITIONS.forEach((pos, i) => {
            if (!seats[i]) return;
            const d = (pos.x - pt.x) ** 2 + (pos.y - pt.y) ** 2;
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        });
        return best;
    };
    const hover = (e) => {
        if (e.pointerType !== 'mouse' && !pressing.current) return;
        const i = nearest(e);
        if (i !== null) setActive(i);
    };
    const select = (i) => {
        setActive(i);
        onSelectPerson?.(seats[i].person);
    };
    // Klávesnice: šipky projíždějí křesla, Enter vybere
    const onKeyDown = (e) => {
        if (!seats.length) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const step = e.key === 'ArrowRight' ? 1 : -1;
            setActive((a) => (a === null ? (step > 0 ? 0 : seats.length - 1) : (a + step + seats.length) % seats.length));
        } else if (e.key === 'Enter' && active !== null) {
            select(active);
        }
    };

    return (
        <div>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="w-full max-w-md mx-auto block select-none touch-pan-y rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FEC900]"
                role="group"
                aria-label="Rozdělení mandátů v zastupitelstvu — šipkami projdeš křesla"
                tabIndex={seats.length ? 0 : -1}
                onKeyDown={onKeyDown}
                onPointerDown={(e) => {
                    pressing.current = true;
                    hover(e);
                }}
                onPointerMove={hover}
                onPointerUp={() => {
                    pressing.current = false;
                }}
                onPointerCancel={() => {
                    pressing.current = false;
                }}
                onClick={(e) => {
                    const i = nearest(e);
                    if (i !== null) select(i);
                }}
            >
                {POSITIONS.map((pos, i) => {
                    const seat = seats[i];
                    const color = seat ? partyMeta(seat.partyId).color : '#E5E5E3';
                    const dim = highlightSet && seat && !highlightSet.has(seat.partyId);
                    const isActive = active === i;
                    return (
                        <circle
                            key={i}
                            cx={pos.x}
                            cy={pos.y}
                            r={isActive ? seatR + 1.5 : seatR}
                            fill={color}
                            opacity={dim ? 0.18 : 1}
                            stroke={isActive ? '#FEC900' : '#fff'}
                            strokeWidth={isActive ? 2.4 : 1.2}
                            className={seat ? 'cursor-pointer transition-[r,opacity] duration-300' : ''}
                        >
                            {seat && <title>{`${seat.person.display} — ${partyMeta(seat.partyId).short}`}</title>}
                        </circle>
                    );
                })}
                <text x={CX} y={CY - 16} textAnchor="middle" className="fill-neutral-900" style={{ fontSize: 30, fontFamily: 'Bebas Neue, sans-serif' }}>
                    {highlighted ?? seats.length}
                </text>
                <text x={CX} y={CY - 2} textAnchor="middle" className="fill-neutral-500" style={{ fontSize: 8, fontWeight: 600 }}>
                    {centerLabel || `z ${council.seats} · většina ${council.majority}`}
                </text>
            </svg>

            <div className="min-h-[52px] mt-1" aria-live="polite">
                {activeSeat ? (
                    <div className="flex items-center gap-3 rounded-xl bg-neutral-50 px-3 py-2">
                        <Avatar person={activeSeat.person} size={36} ring={partyMeta(activeSeat.partyId).pirates} />
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-neutral-900 truncate">{activeSeat.person.display}</div>
                            <div className="text-[11px] text-neutral-500 truncate">
                                {partyMeta(activeSeat.partyId).short} · {activeSeat.person.n}. na listině
                                {activeSeat.person.votes > 0 && ` · ${fmtInt(activeSeat.person.votes)} hl. (${fmtPct(activeSeat.person.pct)})`}
                            </div>
                        </div>
                        {activeSeat.person.jumped && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 shrink-0">↑ preference</span>
                        )}
                    </div>
                ) : (
                    <div className="text-[11px] text-neutral-400 text-center pt-3">
                        {seats.length ? 'Klepni na křeslo nebo po nich přejeď prstem — ukáže, kdo na něm sedí' : 'Mandáty se rozdělí s prvními sečtenými okrsky'}
                    </div>
                )}
            </div>
        </div>
    );
}
