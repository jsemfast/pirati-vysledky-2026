// Přehled sledovaných zastupitelstev (/) — rozcestník na jednotlivé stránky
import React, { useEffect, useState } from 'react';
import { COUNCILS, POLLS_CLOSE } from '../councils';
import { countdown } from '../volby/format';

export default function Landing() {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        document.title = 'Volby 2026 · Piráti Praha';
        const t = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(t);
    }, []);
    const before = now < POLLS_CLOSE;

    return (
        <div className="min-h-dvh bg-[#F3F3F1] text-neutral-900 overflow-y-auto">
            <header className="bg-black text-white">
                <div className="max-w-4xl mx-auto px-5 pt-6 pb-10 md:pt-8 md:pb-14">
                    <img src="/brand/logo-full-white.svg" alt="Česká pirátská strana" className="h-9 md:h-11" />
                    <h1 className="mt-8 font-display text-6xl md:text-8xl leading-[0.85] tracking-wide">
                        Komunální volby <span className="text-[#FEC900]">2026</span>
                    </h1>
                    <p className="mt-4 max-w-xl text-white/70 text-base md:text-lg">
                        Živé výsledky z volby.gov.cz — sečtené okrsky, mandáty, zvolení zastupitelé a možné koalice.
                        Stránky se samy obnovují každou minutu.
                    </p>
                    <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 font-condensed text-sm">
                        {before ? (
                            <>
                                <span className="w-2 h-2 rounded-full bg-white/60" />
                                Místnosti se zavírají v sobotu 10. 10. ve 14:00 — za <b className="text-[#FEC900]">{countdown(POLLS_CLOSE - now)}</b>
                            </>
                        ) : (
                            <>
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                Sčítá se — výsledky průběžně přicházejí z okrskových komisí
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-5 -mt-6 pb-12">
                <div className="grid gap-3 sm:grid-cols-2">
                    {COUNCILS.map((c) => (
                        <a
                            key={c.slug}
                            href={`/${c.slug}`}
                            className="group relative block rounded-2xl bg-white border border-neutral-200 p-5 shadow-sm hover:shadow-md hover:border-black transition"
                        >
                            <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-[#FEC900] scale-x-0 group-hover:scale-x-100 origin-left transition-transform" />
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="font-condensed text-xs font-bold uppercase tracking-wider text-neutral-400">
                                        {c.zastup === 554782 ? 'Magistrát' : 'Městská část'}
                                        {c.beta && <span className="ml-2 rounded bg-black text-[#FEC900] px-1.5 py-0.5">beta</span>}
                                    </div>
                                    <div className="mt-1 font-display text-5xl leading-none tracking-wide">{c.name}</div>
                                </div>
                                <span className="mt-1 text-2xl text-neutral-300 group-hover:text-black transition-colors">→</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
                                <span><b className="text-black">{c.seats}</b> mandátů</span>
                                <span><b className="text-black">{c.precincts}</b> okrsků</span>
                                <span>Piráti: kandidátka č. <b className="text-black">{c.pirates}</b></span>
                            </div>
                            <div className="mt-1 text-xs text-neutral-400">Současná koalice: {c.coalition.label}</div>
                        </a>
                    ))}
                </div>

                <section className="mt-8 grid gap-6 md:grid-cols-3 text-sm text-neutral-600">
                    <div>
                        <h2 className="font-display text-2xl tracking-wide text-black">Odkud jsou data</h2>
                        <p className="mt-1">
                            Přímo z ČSÚ (volby.gov.cz) — stejné soubory, ze kterých čte oficiální výsledková aplikace.
                            Loga stran a část fotek kandidátů z programydovoleb.cz.
                        </p>
                    </div>
                    <div>
                        <h2 className="font-display text-2xl tracking-wide text-black">Mandáty a zvolení</h2>
                        <p className="mt-1">
                            Do vyhlášení ČSÚ je počítáme sami podle zákona: 5% klauzule, d'Hondt a 10% hranice pro
                            preferenční hlasy. Výpočet sedí na všech výsledcích voleb 2022.
                        </p>
                    </div>
                    <div>
                        <h2 className="font-display text-2xl tracking-wide text-black">Vyzkoušet předem</h2>
                        <p className="mt-1">
                            Každá stránka má demo sčítání (<code className="text-xs bg-white px-1 rounded">?demo</code>) — simulaci
                            večera z dat 2022. Čísla v demu nejsou predikce.
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}
