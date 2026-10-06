// Přehled novinek ve všech verzích (src/changelog.js). Po aktualizaci
// zvýrazní, co přibylo od verze, kterou uživatel viděl naposledy.
import React from 'react';
import { CHANGELOG } from '../changelog';

const TYPE_BADGES = {
    new: { label: 'Novinka', cls: 'bg-emerald-100 text-emerald-700' },
    improved: { label: 'Vylepšení', cls: 'bg-blue-100 text-blue-700' },
    fixed: { label: 'Oprava', cls: 'bg-amber-100 text-amber-700' },
};

const fmtDate = (iso) => new Date(iso).toLocaleDateString('cs-CZ');

// since = verze, kterou uživatel viděl naposledy — všechno novější se zvýrazní
export default function ChangelogModal({ open, onClose, since, afterUpdate }) {
    if (!open) return null;

    const sinceIdx = since ? CHANGELOG.findIndex((e) => e.version === since) : -1;

    return (
        <div className="fixed inset-0 z-[3500] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85dvh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 bg-black text-white flex items-start justify-between gap-3">
                    <div>
                        <h2 className="font-display text-3xl leading-none tracking-wide">
                            {afterUpdate ? 'Aplikace byla aktualizována' : 'Co je nové'}
                        </h2>
                        {afterUpdate && <p className="text-xs text-white/60 mt-1">Tady je přehled novinek od tvé poslední návštěvy.</p>}
                    </div>
                    <button onClick={onClose} aria-label="Zavřít" className="p-2 -m-2 text-white/60 hover:text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    {CHANGELOG.map((entry, i) => {
                        const isFresh = sinceIdx > 0 && i < sinceIdx;
                        return (
                            <div key={entry.version} className={isFresh ? 'rounded-xl bg-[#FFF6D1] -mx-2 px-2 py-2' : ''}>
                                <div className="flex items-baseline gap-2 mb-1.5">
                                    <span className="text-sm font-bold text-neutral-900">{entry.version}</span>
                                    <span className="text-xs text-neutral-400">{fmtDate(entry.date)}</span>
                                    {i === 0 && (
                                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-black text-[#FEC900] rounded-full px-2 py-0.5">
                                            Aktuální
                                        </span>
                                    )}
                                    {isFresh && (
                                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-600 text-white rounded-full px-2 py-0.5">
                                            Nové
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm font-semibold text-neutral-800 mb-1.5">{entry.title}</div>
                                <ul className="space-y-1.5">
                                    {entry.items.map((item, j) => {
                                        const badge = TYPE_BADGES[item.type] || TYPE_BADGES.new;
                                        return (
                                            <li key={j} className="flex items-start gap-2">
                                                <span className={`shrink-0 mt-0.5 text-[10px] font-semibold rounded-full px-2 py-0.5 ${badge.cls}`}>
                                                    {badge.label}
                                                </span>
                                                <span className="text-sm text-neutral-700">{item.text}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </div>

                <div className="p-3 border-t border-neutral-100">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-neutral-800 transition-colors"
                    >
                        Zavřít
                    </button>
                </div>
            </div>
        </div>
    );
}
