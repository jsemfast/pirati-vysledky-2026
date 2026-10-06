# Magistrát (Zastupitelstvo hl. m. Prahy) — příprava a výpočetní náročnost

Stav k 6. 10. 2026: **beta v lehkém režimu** na `/praha`.

| | Městská část (Praha 3) | Magistrát |
|---|---|---|
| Mandátů | 35 | **65** |
| Okrsků | 52 | **1 120** |
| Kandidátek | 9 | **24** |
| Kandidátů | 297 | **1 060** |
| Většina | 18 | 33 |
| Pirátská kandidátka | č. 1 | č. 7 |
| Současná koalice (2022–2026) | TOP+STAN, Piráti, Zelení | SPOLU (ODS + TOP 09), Piráti, STAN — 37/65 v roce 2022 |

## Co funguje už teď

- Průběžné výsledky stran, odhad mandátů (výpočet ověřený na KV 2022 —
  Magistrát sedí na 100 %), půlkruh 65 křesel, zvolení zastupitelé, „na
  hraně", preferenční hlasy, koalice a skládačka koalic.
- Ukazatel sečtených okrsků (pruh v hlavičce), účast.
- Demo sčítání `/praha?demo` (simulace z okrskových dat 2022).
- Seznam stran sbaluje drobné kandidátky („Zobrazit všech 24").

## Co je vypnuté a proč

`src/councils.js` → `map: false`, `precinctFiles: false`:

1. **Okrskové soubory.** Mapa by potřebovala výsledek každého okrsku = 1 120
   souborů ČSÚ (každý ~40–50 KB, protože obsahuje hlasy všech 1 060
   kandidátů) ≈ **50 MB za noc**. Hlavní problém je studený start funkce
   uprostřed sčítání: dotáhnout stovky okrsků trvá desítky sekund. Funkce
   sice čeká jen 3 s a zbytek dotahuje na pozadí, ale na novou instanci by
   se mapa plnila minuty.
2. **Velikost odpovědi.** S okrsky by snapshot měl ~470 KB (≈ 90 KB
   komprimovaně) při každém obnovení každého diváka. Bez okrsků 117 KB /
   **25 KB** komprimovaně.
3. **Vykreslení.** 1 120 polygonů překreslovaných každou minutu přes SVG je
   na slabších telefonech pomalé.

## Výpočetní náročnost

### Lehký režim (nasazený)

| | Hodnota |
|---|---|
| Dotazy funkce na volby.gov.cz | 2 soubory / 20 s, podmíněně (ETag → většinou 304) |
| Spuštění funkce | ~2×/min (CDN s-maxage 30 s) → ~720 za 6 h |
| CPU na spuštění | ~30–50 ms (parsování ~100 KB JSON, normalizace) |
| Odpověď | 117 KB raw / ~25 KB brotli |
| 1 000 diváků × 6 h | 360 tis. CDN requestů, ~9 GB přenosu |
| 10 000 diváků × 6 h | 3,6 mil. CDN requestů, ~90 GB přenosu |

Na Vercel Pro (10 mil. requestů, 1 TB v ceně) bez příplatku. Zátěž
volby.gov.cz ani počet spuštění funkce na počtu diváků nezávisí.

### Plný režim s mapou okrsků (naivně = jako městské části)

| | Hodnota | Problém |
|---|---|---|
| Okrskové soubory | 1 120 × ~45 KB ≈ 50 MB / noc / instanci | každá nová instance funkce znovu |
| Studený start uprostřed sčítání | 1 120 / 6 souběžně × ~0,2 s ≈ **35–45 s** | blízko limitu 30 s, mapa se plní minuty |
| Odpověď | ~470 KB / ~90 KB brotli | 3–4× víc přenosu na diváka |
| Klient | 1 120 SVG polygonů / min | sekání na mobilu |

## Plán na plnou verzi (odhad 1–1,5 dne)

1. **Okrsky z oficiálních XML dávek ČSÚ** místo 1 120 JSONů —
   `/appdata/kv2026/20261009/odata/vysledky_okrsky_NNNNN.xml` (popis
   `KV2026_XML.htm`): dávka každých 5 min jen s nově sečtenými okrsky, jen
   hlasy stran (bez kandidátů), ~10 MB za celou ČR a noc. Funkce si drží
   poslední zpracovanou dávku; opravy okrsků řeší `PORADI_ZPRAC`.
   *(~4 h)*
2. **Stav mezi instancemi** — agregované okrsky do Vercel Runtime Cache
   (nebo Blob), aby studený start nemusel nic dotahovat. *(~2 h)*
3. **Rozdělit odpověď** — `/api/volby?z=554782` souhrn (~25 KB, každou
   minutu) + `/api/volby?z=554782&part=okrsky` (jen hlasy stran po okrscích,
   ~40 KB, ETag → klient stáhne jen při změně). *(~2 h)*
4. **Mapa** — Leaflet canvas renderer (`preferCanvas`), změna jen barev
   (bez přemountování), výchozí pohled po **městských částech** (57
   polygonů, agregace okrsků podle `mco` v `okrsky.geojson`), okrsky při
   přiblížení. Geometrie Prahy je připravená (`public/data/praha/okrsky.geojson`,
   1 119 okrsků, chybí nový 34004). *(~4 h)*
5. Test na demu + kontrola výkonu na slabém telefonu. *(~1–2 h)*

Výpočetní nároky plné verze: funkce ~2×/min + jednou za 5 min dávka
(~50–500 KB XML), odpověď souhrnu ~25 KB a okrsků ~40 KB (jen při změně).
Při 10 000 divácích ~110 GB / 6 h — pořád v rámci Pro.

## Jak zapnout mapu, až bude hotová

`src/councils.js` → u `slug: 'praha'` nastavit `map: true` a
`precinctFiles: true` (resp. nový režim dávek), přidat rewrite `/praha`
už je ve `vercel.json`.
