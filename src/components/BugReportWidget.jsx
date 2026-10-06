// Brouk na nahlášení chyby — plovoucí tlačítko vpravo dole na všech
// stránkách. Formulář (název, popis, volitelný screenshot přetažením,
// výběrem nebo Ctrl+V) → /api/bug → GitHub issue. Proti robotům honeypot
// a časová past (viz api/bug.js).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BugReportScreenshotError, prepareScreenshot, submitBugReport } from '../volby/bugReport';
import { useDialog } from '../hooks/useDialog';

// Stejný brouk jako v ostatních projektech (czexpats-connect)
function BugIcon({ className = 'w-5 h-5' }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <ellipse cx="12" cy="13" rx="5" ry="6" stroke="currentColor" strokeWidth="1.8" />
            <path d="M9 7.5C9 6.12 10.34 5 12 5s3 1.12 3 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M10 5L8.5 3M14 5L15.5 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M7 10H4M7 13H4M7 16H4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M17 10H20M17 13H20M17 16H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="12" y1="7.5" x2="12" y2="19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1.5 2" />
        </svg>
    );
}

// Brouk na mobilu překrývá pravý sloupec čísel (mandáty, procenta) — při
// posouvání dolů uhne, při posunu nahoru (nebo nahoře na stránce) se vrátí.
// Scroll událost nebublá, proto capture na dokumentu: chytí i vnitřní
// posuvné panely stránky zastupitelstva.
function useHideOnScroll() {
    const [hidden, setHidden] = useState(false);
    useEffect(() => {
        const last = new WeakMap();
        const onScroll = (e) => {
            const el = e.target === document ? document.scrollingElement : e.target;
            // rolování uvnitř menu nebo jiného okna se stránky netýká
            if (!el || typeof el.scrollTop !== 'number' || el.closest('[role=dialog]')) return;
            const y = el.scrollTop;
            const prev = last.get(el) ?? 0;
            last.set(el, y);
            if (y < 40 || y < prev) setHidden(false);
            else if (y > prev) setHidden(true);
        };
        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
        return () => document.removeEventListener('scroll', onScroll, { capture: true });
    }, []);
    return hidden;
}

// raised = stránka zastupitelstva: na mobilu nad spodní lištou záložek,
// na desktopu nad atribucí mapy
export default function BugReportWidget({ raised = false }) {
    const scrolledAway = useHideOnScroll();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [screenshot, setScreenshot] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [honeypot, setHoneypot] = useState('');
    const openedAt = useRef(0);
    const fileRef = useRef(null);

    const addFile = useCallback(async (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Přiložit jde jen obrázek.');
            return;
        }
        setError('');
        try {
            setScreenshot(await prepareScreenshot(file));
        } catch (err) {
            setError(err instanceof BugReportScreenshotError ? err.message : 'Screenshot se nepodařilo načíst.');
        }
    }, []);

    // Esc, zámek scrollu pod oknem a fokus (i na obrazovce „Chyba nahlášena")
    const close = useCallback(() => setOpen(false), []);
    const dialogRef = useDialog(open, close);

    // Screenshot ze schránky (Ctrl+V / ⌘V) kdekoli, když je formulář otevřený
    useEffect(() => {
        if (!open || result) return undefined;
        const onPaste = (e) => {
            const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
            if (file) {
                e.preventDefault();
                addFile(file);
            }
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [open, result, addFile]);

    const openForm = () => {
        openedAt.current = Date.now();
        setOpen(true);
    };

    const reset = () => {
        setTitle('');
        setDescription('');
        setScreenshot(null);
        setResult(null);
        setError('');
        setHoneypot('');
        openedAt.current = Date.now();
        if (fileRef.current) fileRef.current.value = '';
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;
        if (title.trim().length < 3) return setError('Název musí mít alespoň 3 znaky.');
        if (description.trim().length < 10) return setError('Popis musí mít alespoň 10 znaků.');
        setSubmitting(true);
        setError('');
        try {
            setResult(await submitBugReport({
                title: title.trim(),
                description: description.trim(),
                screenshot,
                hp_field: honeypot,
                elapsed_ms: Date.now() - openedAt.current,
            }));
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // stejné přepnutí na mobilní rozložení jako CouncilApp (i telefon na šířku)
    const position = raised
        ? 'right-3 bottom-9 mobile:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] short:bottom-[calc(3.25rem+env(safe-area-inset-bottom))]'
        : 'right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))]';

    return (
        <>
            {!open && (
                <button
                    onClick={openForm}
                    aria-label="Nahlásit chybu"
                    title="Nahlásit chybu"
                    // body[data-sheet] = na mobilu je otevřený detail okrsku přes mapu
                    className={`fixed ${position} z-[2500] w-11 h-11 rounded-full bg-black text-[#FEC900] shadow-lg ring-2 ring-white/70 flex items-center justify-center hover:scale-105 active:scale-95 transition-[transform,opacity] duration-200 [body[data-sheet]_&]:hidden ${
                        scrolledAway ? 'translate-y-24 opacity-0 pointer-events-none' : ''
                    }`}
                >
                    <BugIcon className="w-6 h-6" />
                </button>
            )}

            {open && (
                <div className="fixed inset-0 z-[3600] bg-black/40 flex items-end sm:items-center sm:justify-end sm:p-4" onClick={() => setOpen(false)}>
                    <div
                        ref={dialogRef}
                        tabIndex={-1}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Formulář pro nahlášení chyby"
                        className="w-full sm:w-[400px] max-h-[90dvh] overflow-y-auto overscroll-contain bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl outline-none pb-[env(safe-area-inset-bottom)] sm:pb-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-black text-white px-4 py-3 flex items-center justify-between">
                            <span className="flex items-center gap-2 font-display text-2xl leading-none tracking-wide">
                                <BugIcon className="w-5 h-5 text-[#FEC900]" />
                                Nahlásit chybu
                            </span>
                            <button onClick={close} aria-label="Zavřít" className="p-3 -m-3 text-white/60 hover:text-white">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {result ? (
                            <div className="p-5 text-center">
                                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl">✓</div>
                                <p className="mt-3 font-semibold text-neutral-900">Chyba nahlášena!</p>
                                <p className="mt-1 text-sm text-neutral-600">
                                    {result.issueUrl ? (
                                        <>Díky! Hlášení najdeš jako <a href={result.issueUrl} target="_blank" rel="noreferrer" className="underline font-semibold text-black">#{result.issueNumber}</a> na GitHubu.</>
                                    ) : (
                                        'Děkujeme za zpětnou vazbu.'
                                    )}
                                </p>
                                <div className="mt-4 flex gap-2 justify-center">
                                    <button onClick={reset} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold hover:border-black">Nahlásit další chybu</button>
                                    <button onClick={() => { setOpen(false); reset(); }} className="rounded-xl bg-black text-white px-3 py-2 text-sm font-semibold">Zavřít</button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={onSubmit} className="p-4 space-y-3">
                                {/* honeypot — lidé ho nevidí, roboti ho vyplní */}
                                <input
                                    type="text"
                                    name="website"
                                    value={honeypot}
                                    onChange={(e) => setHoneypot(e.target.value)}
                                    tabIndex={-1}
                                    autoComplete="off"
                                    aria-hidden="true"
                                    className="absolute -left-[9999px] w-px h-px opacity-0"
                                />
                                <label className="block">
                                    <span className="text-xs font-semibold text-neutral-700">Co nefunguje?</span>
                                    <input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        maxLength={120}
                                        placeholder="Krátce popiš, o jakou jde chybu"
                                        className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-black"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs font-semibold text-neutral-700">Popis</span>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        maxLength={5000}
                                        rows={4}
                                        placeholder="Co se stalo, co jsi čekal/a a jak se k chybě dostat…"
                                        className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-black resize-y"
                                    />
                                </label>

                                <div>
                                    <span className="text-xs font-semibold text-neutral-700">Screenshot (volitelné)</span>
                                    {screenshot ? (
                                        <div className="mt-1 relative">
                                            <img src={screenshot.dataUrl} alt="Náhled screenshotu" className="w-full max-h-48 object-contain rounded-xl border border-neutral-200 bg-neutral-50" />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setScreenshot(null);
                                                    if (fileRef.current) fileRef.current.value = '';
                                                }}
                                                className="absolute top-1.5 right-1.5 rounded-full bg-black/80 text-white text-sm px-3 py-1.5"
                                            >
                                                Odebrat
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => fileRef.current?.click()}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                setDragging(true);
                                            }}
                                            onDragLeave={() => setDragging(false)}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setDragging(false);
                                                addFile(e.dataTransfer.files[0]);
                                            }}
                                            aria-label="Nahrát screenshot"
                                            className={`mt-1 w-full rounded-xl border-2 border-dashed px-3 py-4 text-center text-sm transition-colors ${
                                                dragging ? 'border-[#FEC900] bg-[#FFF6D1]' : 'border-neutral-300 text-neutral-500 hover:border-neutral-500'
                                            }`}
                                        >
                                            {/* na dotykovém displeji nejde přetahovat ani Ctrl+V */}
                                            <span className="pointer-coarse:hidden">Přetáhni screenshot sem, vlož <b>Ctrl+V</b> nebo <span className="underline font-semibold text-black">vyber soubor</span></span>
                                            <span className="hidden pointer-coarse:inline"><span className="underline font-semibold text-black">Vyber screenshot</span> z galerie</span>
                                            <span className="block text-[11px] text-neutral-400 mt-0.5">PNG, JPG, GIF, WebP</span>
                                        </button>
                                    )}
                                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => addFile(e.target.files?.[0])} />
                                </div>

                                {error && <div className="rounded-lg bg-orange-50 text-orange-800 text-xs px-3 py-2">{error}</div>}

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full rounded-xl bg-black text-white py-2.5 text-sm font-semibold hover:bg-neutral-800 disabled:opacity-60"
                                >
                                    {submitting ? 'Odesílám…' : 'Odeslat hlášení'}
                                </button>
                                <p className="text-[11px] text-neutral-400 text-center">
                                    Hlášení se zveřejní jako issue na GitHubu (bez tvého jména). Přidáme adresu stránky, prohlížeč a verzi aplikace.
                                </p>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
