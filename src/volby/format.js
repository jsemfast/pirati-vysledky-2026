// Formátování čísel, jmen a časů pro výsledkovou stránku
const intFmt = new Intl.NumberFormat('cs-CZ');
const pctFmt = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const timeFmt = new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const shortTimeFmt = new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit' });

export const fmtInt = (n) => (n === null || n === undefined ? '–' : intFmt.format(Math.round(n)));
export const fmtPct = (n) => (n === null || n === undefined ? '–' : `${pctFmt.format(n)} %`);
export const fmtPp = (n) => {
    if (n === null || n === undefined) return '–';
    const s = pctFmt.format(Math.abs(n));
    return `${n > 0.05 ? '+' : n < -0.05 ? '−' : '±'}${s} p. b.`;
};
const validDate = (d) => {
    if (!d) return null;
    const date = new Date(d);
    return Number.isNaN(date.getTime()) ? null : date;
};
export const fmtTime = (d) => (validDate(d) ? timeFmt.format(validDate(d)) : '–');
export const fmtShortTime = (d) => (validDate(d) ? shortTimeFmt.format(validDate(d)) : '–');

// ČSÚ v generovano posílá místní čas bez zóny („2026-10-10T14:31:05")
export function parseCsuTime(s) {
    if (!s) return null;
    const d = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? new Date(s) : new Date(`${s}+02:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function plural(n, one, few, many) {
    const abs = Math.abs(n);
    if (abs === 1) return one;
    if (abs >= 2 && abs <= 4) return few;
    return many;
}

export function mandatesLabel(n) {
    return `${n} ${plural(n, 'mandát', 'mandáty', 'mandátů')}`;
}

// Jméno kandidáta: z registru (jméno/příjmení/tituly zvlášť), jinak z řetězce
// ČSÚ ve tvaru „Příjmení Jméno Tituly"
export function candidateName(reg, fallback) {
    if (reg) {
        return {
            full: [reg.titulPred, `${reg.jmeno} ${reg.prijmeni}`, reg.titulZa].filter(Boolean).join(' ').replace(' ,', ','),
            display: `${reg.jmeno} ${reg.prijmeni}`,
            initials: `${reg.jmeno[0] || ''}${reg.prijmeni[0] || ''}`,
        };
    }
    const parts = String(fallback || '').split(/\s+/).filter((p) => p && !p.includes('.'));
    const display = parts.length >= 2 ? `${parts.slice(1).join(' ')} ${parts[0]}` : String(fallback || '');
    return {
        full: String(fallback || ''),
        display,
        initials: parts.length >= 2 ? `${parts[1][0]}${parts[0][0]}` : display.slice(0, 2),
    };
}

export function countdown(ms) {
    if (ms <= 0) return 'teď';
    const min = Math.floor(ms / 60000);
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    const m = min % 60;
    if (d > 0) return `${d} d ${h} h`;
    if (h > 0) return `${h} h ${m} min`;
    return `${Math.max(1, m)} min`;
}
