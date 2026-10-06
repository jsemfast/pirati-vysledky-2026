// Hlavička výsledkové stránky: stav živých dat, odpočet do další kontroly,
// ruční obnovení, pruh okrsků a přepínač zastupitelstev.
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNow } from '../hooks/useNow';
import { APP_VERSION } from '../changelog';
import { openChangelog } from '../utils/openChangelog';
import { COUNCILS, POLLS_CLOSE } from '../councils';
import { activeCouncil } from '../volby/council';
import { countdown, fmtPct, fmtShortTime, fmtTime, parseCsuTime } from '../volby/format';
import { PrecinctStrip } from './Precincts';

export function StatusPill({ phase, demo, stale }) {
    const base = 'font-condensed rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wider';
    if (demo) return <span className={`${base} bg-[#FEC900] text-black`}>DEMO</span>;
    if (stale) return <span className={`${base} bg-orange-500 text-white`}>OFFLINE</span>;
    if (phase === 'final') return <span className={`${base} bg-emerald-500 text-white`}>KONEČNÉ</span>;
    if (phase === 'counting' || phase === 'waiting') {
        return (
            <span className={`${base} inline-flex items-center gap-1 bg-red-600 text-white`}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> ŽIVĚ
            </span>
        );
    }
    return <span className={`${base} bg-white/15 text-white/80`}>PŘED VOLBAMI</span>;
}

const fmtWait = (sec) => (sec >= 90 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec} s`);

// Ruční obnovení. Do konce odpočtu do další kontroly je ztlumené a kliknutí
// jen řekne, kdy to půjde — dřívější dotaz by zbytečně zatěžoval (data se
// stejně obnovují po minutě).
export function RefreshButton({ live, now, demo = false, showLabel = 'hidden sm:inline' }) {
    const [hint, setHint] = useState(false);
    const nextIn = live.nextAt ? Math.max(0, Math.ceil((live.nextAt - now) / 1000)) : null;
    const blocked = !demo && nextIn !== null && nextIn > 0;
    const onClick = () => {
        if (live.refresh()) return;
        setHint(true);
        setTimeout(() => setHint(false), 3000);
    };
    return (
        <button
            onClick={onClick}
            className={`relative flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 min-h-11 min-w-11 text-xs font-semibold transition-colors ${
                blocked ? 'text-white/45 cursor-not-allowed' : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
            aria-label={blocked ? `Obnovit půjde za ${fmtWait(nextIn)}` : 'Obnovit výsledky'}
            title={blocked ? `Další kontrola za ${fmtWait(nextIn)}` : 'Obnovit výsledky'}
        >
            <svg className={`w-4 h-4 ${live.fetching ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className={`${showLabel} tabular-nums`}>{nextIn === null ? 'pauza' : fmtWait(nextIn)}</span>
            {hint && (
                <span className="absolute top-full right-0 mt-1 z-10 whitespace-nowrap rounded bg-white text-neutral-700 text-[11px] font-normal px-2 py-1 shadow">
                    {nextIn ? <>Obnovit půjde za <b>{fmtWait(nextIn)}</b> — dřív nová data stejně nebudou</> : 'Zkus to za chvilku'}
                </span>
            )}
        </button>
    );
}

function CouncilMenu({ demo }) {
    const [open, setOpen] = useState(false);
    const current = activeCouncil();
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                aria-label="Vybrat zastupitelstvo"
                className="p-2.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>
            {/* Portál do body: hlavička má vlastní stacking context (relative
                z-[1200]), uvnitř by přes menu přečnívala spodní lišta i brouk */}
            {open && createPortal(
                <div className="fixed inset-0 z-[3000] bg-black/50" onClick={() => setOpen(false)}>
                    <div
                        className="absolute right-0 top-0 bottom-0 w-[86vw] max-w-sm bg-white shadow-2xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 bg-black text-white flex items-center justify-between">
                            <img src="/brand/logo-full-white.svg" alt="Piráti" className="h-6" />
                            <button onClick={() => setOpen(false)} aria-label="Zavřít" className="p-2 -m-2 text-white/60 hover:text-white">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                            <div className="font-condensed px-3 pt-1 pb-2 text-xs font-bold uppercase tracking-wider text-neutral-400">Piráti kandidují</div>
                            {COUNCILS.filter((c) => c.pirates).map((c) => {
                                const isCurrent = c.slug === current?.slug;
                                return (
                                    <a
                                        key={c.slug}
                                        href={`/${c.slug}${demo ? '?demo' : ''}`}
                                        className={`flex items-center justify-between rounded-xl px-3 py-2 ${isCurrent ? 'bg-black text-white' : 'hover:bg-neutral-100 text-neutral-800'}`}
                                    >
                                        <span>
                                            <span className="block font-display text-xl leading-none tracking-wide">{c.magistrat ? 'Magistrát' : c.name}</span>
                                            <span className={`block text-[11px] ${isCurrent ? 'text-white/60' : 'text-neutral-500'}`}>
                                                {c.seats} mandátů · {c.precincts} okrsků{c.beta ? ' · beta' : ''}
                                            </span>
                                        </span>
                                        {isCurrent && <span className="text-[#FEC900]">●</span>}
                                    </a>
                                );
                            })}
                            <div className="font-condensed px-3 pt-4 pb-2 text-xs font-bold uppercase tracking-wider text-neutral-400">Ostatní městské části</div>
                            <div className="grid grid-cols-2 gap-1">
                                {COUNCILS.filter((c) => !c.pirates).map((c) => (
                                    <a
                                        key={c.slug}
                                        href={`/${c.slug}${demo ? '?demo' : ''}`}
                                        className={`truncate rounded-lg px-3 py-2.5 text-sm ${c.slug === current?.slug ? 'bg-black text-white' : 'hover:bg-neutral-100 text-neutral-700'}`}
                                    >
                                        {c.name.replace(/^Praha-/, '')}
                                    </a>
                                ))}
                            </div>
                            <div className="pt-2 mt-2 border-t border-neutral-100 space-y-1">
                                <a href={demo ? `/${current?.slug || ''}` : `/${current?.slug || ''}?demo`} className="block rounded-xl px-3 py-2.5 hover:bg-[#FFF6D1] text-neutral-800">
                                    <div className="text-sm font-semibold">{demo ? 'Ukončit demo' : 'Demo sčítání'}</div>
                                    <div className="text-xs text-neutral-500">
                                        {demo ? 'zpět na skutečná data z volby.gov.cz' : 'simulace večera z dat 2022 — na vyzkoušení'}
                                    </div>
                                </a>
                                <a href={demo ? '/?demo' : '/'} className="block rounded-xl px-3 py-2.5 hover:bg-neutral-100 text-neutral-800">
                                    <div className="text-sm font-semibold">Přehled všech zastupitelstev</div>
                                </a>
                            </div>
                        </nav>
                        <div className="p-4 border-t border-neutral-100 text-[11px] text-neutral-400 leading-relaxed">
                            Data: ČSÚ (volby.gov.cz). Loga a část fotek: programydovoleb.cz. Mandáty do vyhlášení ČSÚ = odhad.
                            <div className="mt-2 flex items-center justify-between text-xs">
                                <span>Verze {APP_VERSION}</span>
                                <button onClick={openChangelog} className="py-2 -my-2 font-semibold text-black hover:underline">Co je nové</button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}

export default function ElectionHeader({ live, snapshot, demo, geoJson, selectedId, onSelectPrecinct, onOpenPrecincts }) {
    const now = useNow(1000);
    const council = activeCouncil();
    const phase = snapshot?.phase || 'pre';
    const p = snapshot?.precincts;
    const dataTime = demo ? snapshot?.fetchedAt : parseCsuTime(snapshot?.generated);

    let line;
    if (!snapshot) line = live.status === 'error' ? 'Výsledky se nepodařilo načíst — zkusím to znovu.' : 'Načítám výsledky…';
    else if (phase === 'pre') line = `Místnosti se zavírají v sobotu 10. 10. ve 14:00 · za ${countdown(POLLS_CLOSE - now)}`;
    else if (phase === 'waiting') line = 'Volby skončily — čekáme na první okrskové komise';
    else line = `Sečteno ${p.counted} z ${p.total} okrsků (${fmtPct(p.pct)}) · účast ${fmtPct(snapshot.turnout.pct)}`;

    return (
        <header className="bg-black text-white shrink-0 z-[1200] relative">
            <div className="px-4 pt-3 pb-2.5 md:px-5 short:pt-1.5 short:pb-1.5">
                <div className="flex items-center gap-3">
                    <a href={demo ? '/?demo' : '/'} className="shrink-0 py-2.5 -my-2.5" aria-label="Přehled zastupitelstev">
                        <img src="/brand/logo-full-white.svg" alt="Piráti" className="h-6 sm:h-7 md:h-8 short:h-6" />
                    </a>
                    <div className="min-w-0 flex-1 border-l border-white/20 pl-3">
                        <div className="flex items-center gap-2">
                            <StatusPill phase={phase} demo={demo} stale={live.stale} />
                            <span className="font-condensed text-[11px] uppercase tracking-wider text-white/50 truncate">
                                <span className="hidden sm:inline">Komunální volby 2026 · </span>{council?.seats} mandátů
                            </span>
                        </div>
                        <h1 className="font-display text-2xl md:text-3xl short:text-2xl leading-none tracking-wide truncate mt-0.5">
                            {council?.name}<span className="hidden sm:inline"> <span className="text-[#FEC900]">·</span> výsledky</span>
                        </h1>
                    </div>
                    <RefreshButton live={live} now={now} demo={demo} />
                    <CouncilMenu demo={demo} />
                </div>

                <div className="mt-2 short:mt-1 flex items-center justify-between gap-3 text-[11px] text-white/70">
                    <span className="truncate">{line}</span>
                    <span className="shrink-0 tabular-nums text-white/45 sm:hidden">{live.lastSuccess ? fmtShortTime(live.lastSuccess) : ''}</span>
                    <span className="hidden sm:inline shrink-0 tabular-nums text-white/45" title={dataTime ? `Data ČSÚ vygenerována ${fmtTime(dataTime)}` : undefined}>
                        {phase !== 'pre' && dataTime ? `ČSÚ ${fmtTime(dataTime)} · ` : ''}
                        {live.lastSuccess ? `kontrola ${fmtTime(live.lastSuccess)}` : ''}
                        {live.source === 'direct' && ' · přímo z ČSÚ'}
                    </span>
                </div>
                {snapshot && phase !== 'pre' && geoJson && (
                    <div className="mt-2">
                        <PrecinctStrip geoJson={geoJson} snapshot={snapshot} freshIds={live.freshIds} selectedId={selectedId} onSelect={onSelectPrecinct} onOpen={onOpenPrecincts} />
                    </div>
                )}
                {snapshot && phase !== 'pre' && !geoJson && p && (
                    <div className="mt-2 h-1.5 rounded-full bg-white/15 overflow-hidden">
                        <div className="h-full bg-[#FEC900] transition-[width] duration-700" style={{ width: `${p.pct}%` }} />
                    </div>
                )}
            </div>
            {live.stale && live.error && (
                <div className="bg-orange-500/90 text-white text-[11px] px-4 py-1">
                    Zdroj teď neodpovídá — ukazuji poslední načtená data, zkouším to znovu.
                </div>
            )}
        </header>
    );
}
