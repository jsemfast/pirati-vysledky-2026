// Otevření changelog modalu odkudkoli (menu, patička přehledu) bez
// prop-drillingu — event poslouchá UpdateManager mountovaný v main.jsx.
export const CHANGELOG_OPEN_EVENT = 'kv26:open-changelog';

export function openChangelog() {
    window.dispatchEvent(new Event(CHANGELOG_OPEN_EVENT));
}
