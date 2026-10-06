import { useEffect, useRef } from 'react';

// Společné chování překryvných oken (menu, Co je nové, nahlášení chyby):
// Esc zavře, stránka pod oknem se neroluje, fokus skočí do okna a po
// zavření se vrátí tam, kde byl. Vrací ref pro kontejner okna
// (potřebuje tabIndex={-1}, aby šel zaměřit).
export function useDialog(open, onClose) {
    const ref = useRef(null);
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return undefined;
        const previous = document.activeElement;
        ref.current?.focus({ preventScroll: true });
        const onKey = (e) => {
            if (e.key === 'Escape') closeRef.current?.();
        };
        window.addEventListener('keydown', onKey);
        const html = document.documentElement;
        const overflow = html.style.overflow;
        html.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            html.style.overflow = overflow;
            if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
        };
    }, [open]);

    return ref;
}
