// Aktuální čas pro odpočty, obnovovaný po `ms` (ve skryté záložce stojí)
import { useEffect, useState } from 'react';

export function useNow(ms) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => {
            if (!document.hidden) setNow(Date.now());
        }, ms);
        return () => clearInterval(t);
    }, [ms]);
    return now;
}
