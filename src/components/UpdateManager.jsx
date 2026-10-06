// Mountuje se v main.jsx nad všemi stránkami. Dvě role:
// 1. Když je nasazená nová verze, vynutí obnovení stránky (s krátkým
//    upozorněním; nereloaduje uprostřed psaní do textového pole).
// 2. Po první návštěvě v nové verzi jednou ukáže „Co je nové".
import React, { useCallback, useEffect, useState } from 'react';
import { APP_VERSION } from '../changelog';
import { CHANGELOG_OPEN_EVENT } from '../utils/openChangelog';
import { useUpdateCheck } from '../hooks/useUpdateCheck';
import ChangelogModal from './ChangelogModal';

const SEEN_KEY = 'kv26_seen_version'; // poslední verze, jejíž novinky uživatel viděl
const RELOADED_KEY = 'kv26_reloaded_for'; // pojistka proti reload smyčce (session)

const isEditing = () => {
    const el = document.activeElement;
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return true;
    return el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes(el.type);
};

export default function UpdateManager() {
    const newVersion = useUpdateCheck();

    // Uživatel naposledy viděl starší verzi → rovnou od prvního renderu
    // otevřít novinky od jeho poslední viděné verze
    const [modal, setModal] = useState(() => {
        let seen = null;
        try {
            seen = localStorage.getItem(SEEN_KEY);
        } catch {
            /* private mode */
        }
        return seen && seen !== APP_VERSION
            ? { open: true, afterUpdate: true, since: seen }
            : { open: false, afterUpdate: false, since: null };
    });

    // Na kterou verzi už se tahle session zkusila reloadnout (čte se jen při
    // mountu — po reloadu je to nová session stránky)
    const [reloadedFor] = useState(() => {
        try {
            return sessionStorage.getItem(RELOADED_KEY);
        } catch {
            return null;
        }
    });
    const reloadBlocked = !!newVersion && reloadedFor === newVersion;

    // První návštěva vůbec: novinky nevyskakovat, jen si verzi zapamatovat
    useEffect(() => {
        try {
            if (!localStorage.getItem(SEEN_KEY)) localStorage.setItem(SEEN_KEY, APP_VERSION);
        } catch {
            /* ignore */
        }
    }, []);

    // Otevření z menu
    useEffect(() => {
        const onOpen = () => setModal({ open: true, afterUpdate: false, since: null });
        window.addEventListener(CHANGELOG_OPEN_EVENT, onOpen);
        return () => window.removeEventListener(CHANGELOG_OPEN_EVENT, onOpen);
    }, []);

    const closeModal = useCallback(() => {
        setModal({ open: false, afterUpdate: false, since: null });
        try {
            localStorage.setItem(SEEN_KEY, APP_VERSION);
        } catch {
            /* ignore */
        }
    }, []);

    // Nová verze na serveru → vynucený reload. Jen jednou na verzi (kdyby po
    // reloadu pořád běžel starý bundle, např. kvůli cache, nesmí se to zacyklit
    // — místo toho zůstane tlačítko Obnovit).
    useEffect(() => {
        if (!newVersion || reloadedFor === newVersion) return undefined;

        const reload = () => {
            try {
                sessionStorage.setItem(RELOADED_KEY, newVersion);
            } catch {
                /* ignore */
            }
            window.location.reload();
        };

        // Stránka na pozadí — obnovit hned, uživatel o nic nepřijde
        if (document.visibilityState === 'hidden') {
            reload();
            return undefined;
        }

        // Krátké upozornění, pak reload; při psaní počkat na dopsání
        const tryReload = () => {
            if (!isEditing()) reload();
        };
        const initial = setTimeout(tryReload, 2500);
        const retry = setInterval(tryReload, 5000);
        return () => {
            clearTimeout(initial);
            clearInterval(retry);
        };
    }, [newVersion, reloadedFor]);

    return (
        <>
            {newVersion && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[4000] bg-black text-white text-sm font-medium rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 max-w-[calc(100vw-2rem)]">
                    {reloadBlocked ? (
                        <>
                            <span>Je k dispozici nová verze {newVersion}.</span>
                            <button
                                onClick={() => window.location.reload()}
                                className="shrink-0 bg-[#FEC900] text-black text-xs font-bold rounded-lg px-3 py-1.5"
                            >
                                Obnovit
                            </button>
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4 animate-spin shrink-0 text-[#FEC900]" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                            <span>Vyšla nová verze {newVersion} — aktualizuji…</span>
                        </>
                    )}
                </div>
            )}

            <ChangelogModal
                open={modal.open}
                onClose={closeModal}
                since={modal.afterUpdate ? modal.since : null}
                afterUpdate={modal.afterUpdate}
            />
        </>
    );
}
