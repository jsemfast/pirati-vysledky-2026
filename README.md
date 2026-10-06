# Volby 2026 — živé výsledky (Piráti Praha)

Webová aplikace pro sledování průběžných výsledků **komunálních voleb
9.–10. října 2026** v pražských zastupitelstvech. Data bere přímo z ČSÚ
(volby.gov.cz), sama se obnovuje a ukazuje, co nás ve volební noc zajímá:
kolik mají Piráti, kdo by byl zvolen, jestli drží současná koalice a s kým se
dá skládat většina.

| Zastupitelstvo | Adresa | Mandátů | Okrsků | Piráti | Stav |
|---|---|---|---|---|---|
| Praha 3 | `/praha-3` | 35 | 52 | kandidátka č. 1 (s PRAHA 3 SOBĚ a E. Janečkovou) | hotovo |
| Praha 6 | `/praha-6` | 45 | 104 | kandidátka č. 4 | hotovo |
| Praha 11 | `/praha-11` | 35 | 62 | kandidátka č. 6 | hotovo |
| Hl. m. Praha (Magistrát) | `/praha` | 65 | 1 120 | kandidátka č. 7 | **beta** — bez mapy okrsků, viz [docs/MAGISTRAT.md](docs/MAGISTRAT.md) |

![Přehled](docs/img/prehled.webp)

## Co aplikace umí

- **Živé výsledky** — sečtené okrsky, účast, hlasy a procenta stran, automatické
  obnovení každou minutu (ČSÚ data stejně cachuje 60 s), odpočet do další
  kontroly, ruční obnovení.
- **Mandáty a zvolení** — do vyhlášení ČSÚ vlastní výpočet podle zákona
  (5% klauzule s přepočteným základem, d'Hondt, 10% hranice preferenčních
  hlasů); po vyhlášení oficiální čísla. Půlkruh zastupitelstva — klepnutím na
  křeslo uvidíš, kdo na něm sedí.
- **Piráti v centru** — hero karta s procenty, mandáty, změnou proti roku
  2022 (jen ve stejných sečtených okrscích), kolik hlasů chybí na další
  mandát a jaká je rezerva posledního. Karty zvolených s fotkami, „na hraně"
  a pořadí podle preferenčních hlasů.
- **Koalice** — kolik má současná koalice, skládačka vlastní koalice a seznam
  všech minimálních většin (filtr „jen s Piráty").
- **Mapa okrsků** — podíl Pirátů (pirátská žlutá škála), vítěz okrsku,
  současná koalice, změna proti 2022, libovolná strana, účast. Náhled po
  najetí myší, detail po kliknutí, čerstvě sečtené okrsky zablikají. Před
  sčítáním mapa ukazuje KV 2022.
- **Okrsky v pořadí, jak je komise posílají** — feed sečtených okrsků.
- **Loga stran a barvy** z programydovoleb.cz, fotky kandidátů (vlastní +
  programydovoleb.cz).
- **Demo sčítání** — `?demo` (nebo `?demo=60` = délka v sekundách) přehraje
  celý večer na datech 2022. Čísla v demu nejsou predikce.
- **Mobil first** — spodní lišta záložek, mapa přes celou obrazovku, bottom
  sheet s detailem okrsku.

| Desktop (Praha 6, demo) | Mobil (Praha 3, demo) |
|---|---|
| ![Praha 6](docs/img/praha-6-desktop.webp) | ![Praha 3 mobil](docs/img/praha-3-mobil.webp) ![Zastupitelé](docs/img/praha-3-zastupitele-mobil.webp) |

## Rychlý start (lokálně)

Potřebuješ **Node.js 20+** (doporučeno 22/24) a npm.

```bash
git clone <repo> pirati-vysledky-2026
cd pirati-vysledky-2026
npm install
npm run dev
```

Otevři <http://localhost:5173>:

- `http://localhost:5173/praha-3?demo` — demo sčítání (nejlepší na vyzkoušení),
- `http://localhost:5173/praha-6` — skutečná data z volby.gov.cz (před
  sobotou 14:00 jen kandidátky a odpočet).

Vite dev server pouští i serverovou funkci `api/volby.js` (plugin ve
`vite.config.js`), takže lokálně funguje stejná cesta jako na Vercelu.
Statická data jsou v repu — `npm run data` je potřeba jen při jejich obnově.

### Příkazy

| Příkaz | Co dělá |
|---|---|
| `npm run dev` | vývojový server (včetně `/api/volby`) |
| `npm run build` | produkční build do `dist/` |
| `npm run preview` | náhled buildu (bez `/api` — klient pak čte rovnou z volby.gov.cz) |
| `npm run lint` | ESLint |
| `npm run data` | znovu vygeneruje `public/data/` a `public/media/` (všechna zastupitelstva) |
| `npm run data -- praha-6` | jen jedno zastupitelstvo; `--fresh` ignoruje cache stažených souborů |
| `npm run verify` | ověří výpočet mandátů na oficiálních výsledcích 2022; `-- --all` na celé ČR |

## Jak funguje stahování výsledků

ČSÚ nemá veřejné API — jeho výsledková aplikace (`volby.gov.cz/app/kv2026`)
čte statické JSONy z `https://volby.gov.cz/appdata/kv2026/20261009/…`
(CORS `*`, ETag, webcache 60 s). Čteme stejné soubory:

| Soubor | Obsah | Kdy se stahuje |
|---|---|---|
| `vysled/1100/<zastup>.json` | souhrn: přehled, strany, hlasy kandidátů, po vyhlášení mandáty | každé kolo (podmíněně, většinou 304) |
| `ucast/obec/1100/<zastup>.json` | účast po okrscích = které okrsky jsou sečtené | každé kolo (podmíněně) |
| `vysled/okrsek/1100/<zastup>_<okrsek>.json` | výsledek jednoho okrsku | jen jednou, když okrsek přibude (nebo když ho ČSÚ opraví) |

Významy sloupců jsou zdokumentované v [`src/volby/feed.js`](src/volby/feed.js)
(vyčtené z kódu aplikace ČSÚ, formát ověřený na hotových datech KZ 2024).

```
prohlížeče ──(1×/min)──▶ CDN Vercelu ──(~2×/min/zastupitelstvo)──▶ api/volby.js ──(ETag, 304)──▶ volby.gov.cz
     │                                                                                              ▲
     └──────────────── záloha, když /api/volby 2× po sobě selže (CORS povolen) ─────────────────────┘
```

### Šetrnost ke kapacitě

- **Jedna sdílená odpověď pro všechny.** `api/volby.js?z=<kód>` vrací snapshot
  s `Cache-Control: s-maxage=30, stale-while-revalidate=60, stale-if-error=900`.
  Diváky obslouží CDN; funkce běží zhruba 2× za minutu za zastupitelstvo bez
  ohledu na počet lidí. Před 14:00 s-maxage až 5 min, po vyhlášení 10 min.
- **Klient podle fáze** ([`useLiveResults`](src/hooks/useLiveResults.js)):
  před 14:00 jednou za 10 min (a probudí se přesně na uzavření místností),
  při sčítání 60 s ± 15 % jitter, po vyhlášení 15 min. Ve skryté záložce
  nic, při chybách backoff až na 10 min, ruční obnovení nejvýš jednou za 15 s.
- **Ochrana zdroje.** Podmíněné dotazy (ETag), okrsky jen nové, časové
  limity (8 s funkce / 15 s prohlížeč), po chybě se soubor znovu zkouší až
  po intervalu a souběžné dotazy na stejný soubor se sdílí. Na okrskové
  soubory funkce čeká max. 3 s — zbytek doběhne na pozadí.
- **Whitelist.** Proxy obslouží jen zastupitelstva ze `src/councils.js`.
- **Odolnost.** Výpadek zdroje → poslední data se štítkem OFFLINE. Výpadek
  naší funkce → prohlížeč čte rovnou z volby.gov.cz. Nenačte se nic →
  stránka ukáže aspoň kandidátky, odpočet a výchozí stav 2022.

### Kapacita a náklady (odhad)

Velikost jedné odpovědi při plném sčítání (komprimovaně, brotli):
Praha 3 **9 KB**, Praha 6 **15 KB**, Praha 11 **10 KB**, Magistrát **25 KB**
(bez okrsků). První načtení stránky ≈ 0,5–0,8 MB (JS ~420 KB gzip, data,
loga; fotky jen na záložce Zastupitelé).

| Scénář: 6 h sledování | CDN requesty | Přenos | Funkce | Zdroj volby.gov.cz |
|---|---|---|---|---|
| 1 000 diváků na každém ze 4 zastupitelstev | ~1,5 mil. | ~27 GB | ~3 000 spuštění, < 3 min CPU | ~24 podmíněných dotazů/min + 218 okrskových souborů za noc |
| 5 000 diváků celkem | ~1,8 mil. | ~35 GB | stejně | stejně |
| 20 000 diváků celkem | ~7 mil. | ~130 GB | stejně | stejně |

Na **Vercel Pro** (10 mil. requestů a 1 TB přenosu v ceně) je to ve všech
scénářích 0 Kč navíc. Na Hobby (zhruba 1 mil. requestů / 100 GB měsíčně)
by velký scénář narazil — projekt proto patří do placeného týmu. Počet
spuštění funkce a zátěž volby.gov.cz na počtu diváků **nezávisí**.

## Data

Generuje je `npm run data` ([`scripts/build-data.js`](scripts/build-data.js)) do
`public/data/<slug>/` a `public/media/<slug>/`:

| Soubor | Obsah | Zdroj |
|---|---|---|
| `lists.json` | kandidátky 2026: název, složení, barva, loga, web, předchůdce 2022 | registr KV 2026 (ČSÚ), programydovoleb.cz |
| `kandidati.json` | kandidáti: jméno, tituly, věk, povolání, příslušnost, fotka | registr KV 2026, jmenný seznam volby.gov.cz |
| `results2022.json` | KV 2022 po okrscích: voliči, obálky, hlasy kandidátek | open data KV 2022 (ČSÚ) |
| `okrsky.geojson` | hranice okrsků (WGS84, zjednodušené) | ČSÚ, okrsky 2025 (S-JTSK → WGS84) |
| `media/*/logos`, `photos` | loga a fotky (WebP, zmenšené) | programydovoleb.cz, vlastní fotky |

**Předchůdci 2022** se párují automaticky podle složení stran (kódy ČSÚ,
bez nezávislých): kandidátka 2026 ← kandidátky 2022, se kterými sdílí
stranu. Když se kandidátka 2022 rozdělila mezi víc kandidátek 2026 (např.
KDU-ČSL + ODS na Praze 3, STAN se Zelenými na Praze 6), změna v p. b. se
nepočítá — UI ukáže jen informativní „2022: …". Výsledek párování vypíše
`npm run data` do konzole.

**Barvy:** Piráti vždy černí (v mapě pirátská žlutá škála), ostatní barva
kandidátky z programydovoleb.cz → barva strany → paleta; podobné barvy se
přidělí podle váhy strany v roce 2022. Ruční výjimky v `src/councils.js`.

## Konfigurace: `src/councils.js`

Jediné místo s ručně zadaným politickým kontextem:

- `pirates` — číslo pirátské kandidátky,
- `coalition` — současná koalice (čísla kandidátek 2026) a kolik měla
  mandátů v roce 2022,
- `lists` — zkrácené názvy (`short`, `tiny`), poznámka, případně barva,
- `photos` — vlastní fotky (`public/media/<slug>/photos/`),
- `map`, `precinctFiles` — mapa a okrskové soubory (u Magistrátu vypnuté).

> ⚠️ **Koalice jsou podle zpráv z let 2022–2023** (Praha 6: ODS + KDU-ČSL,
> STAN, PRAHA 6 SOBĚ; Praha 11: Piráti, ANO, ODS, TOP 09 + STAN; Magistrát:
> SPOLU, Piráti, STAN). Pokud se během volebního období změnily, uprav
> `coalition.lists` — nic dalšího měnit netřeba.

### Přidání dalšího zastupitelstva

1. Najdi kód zastupitelstva (`KODZASTUP`) — např. v
   `https://volby.gov.cz/appdata/kv2026/20261009/navig/obce/1100.json`
   (Praha; mimo Prahu jiný okres).
2. Přidej položku do `COUNCILS` (slug, zastup, okres, seats, precincts,
   pirates, coalition…). Počet mandátů a okrsků ověř v
   `vysled/<okres>/<zastup>.json` (`prehled[0]`, `prehled[2]`).
3. Přidej rewrite slugu do `vercel.json`.
4. `npm run data -- <slug>` a zkontroluj výpis (párování 2022, barvy, loga).
5. `npm run verify` a `/<slug>?demo`.

Mimo Prahu: hranice okrsků se filtrují podle `kod_mco` (MČ) nebo `kod_obec`
— viz `buildCouncil()` ve skriptu.

## Nasazení (Vercel)

Projekt je čistý Vite + jedna serverless funkce, žádné proměnné prostředí
ani databáze nepotřebuje.

```bash
npm i -g vercel           # případně npx vercel
vercel link               # vyber tým (doporučen placený — viz Kapacita)
vercel deploy             # preview
vercel deploy --prod      # produkce
```

Po nasazení ověř CDN cache — druhý dotaz do 30 s musí vrátit `HIT` nebo `STALE`:

```bash
curl -sI "https://<doména>/api/volby?z=500097" | grep -i x-vercel-cache
```

### Checklist na volební den

- [ ] Do čtvrtka nasazeno na produkci, prošlé `/<slug>?demo` na mobilu i desktopu.
- [ ] Koalice v `src/councils.js` odpovídají realitě.
- [ ] `x-vercel-cache: HIT` na `/api/volby?z=…` pro všechna zastupitelstva.
- [ ] Billing Vercel týmu v pořádku (žádná neuhrazená faktura).
- [ ] V sobotu po 14:00 první okrsky: zkontrolovat, že čísla sedí s volby.gov.cz/app/kv2026.
- [ ] Po vyhlášení mandátů ČSÚ: zkontrolovat, že se přepnulo na „oficiální mandáty".

## Ověření výpočtu

`npm run verify` přepočítá mandáty a zvolené kandidáty z oficiálních výsledků
KV 2022 a porovná je s ČSÚ:

- sledovaná zastupitelstva (Praha 3, 6, 11, Magistrát): **100 %**,
- celá ČR (`-- --all`): **6 357 z 6 384 voleb (99,58 %)**, zvolení
  kandidáti bez jediné chyby. Zbylých 27 jsou malé obce s přesnou shodou
  podílů, kterou zákon rozhoduje losem.

Neintuitivní detail: hranice pro preferenční posun je **⌊průměr hlasů na
kandidáta⌋ × 1,1** — ČSÚ zaokrouhluje průměr dolů (s přesným průměrem by
v roce 2022 nesedělo ~1 100 kandidátů).

## Struktura

```
api/volby.js              serverless proxy s CDN cache (whitelist zastupitelstev)
scripts/build-data.js     generování statických dat (ČSÚ + programydovoleb.cz)
scripts/verify-2022.js    ověření výpočtu na výsledcích 2022
src/councils.js           konfigurace zastupitelstev (ručně)
src/volby/feed.js         stahování a normalizace dat ČSÚ (server i prohlížeč)
src/volby/compute.js      klauzule, d'Hondt, preference, koalice, srovnání s 2022
src/volby/model.js        odvozený model pro UI
src/volby/council.js      metadata aktivního zastupitelstva (barvy, loga, osa)
src/volby/demo.js         demo sčítání
src/hooks/useLiveResults.js  polling, záloha, backoff
src/pages/                Landing (/), CouncilApp (/<slug>)
src/components/           hlavička, mapa, strany, zastupitelé, koalice, okrsky
docs/MAGISTRAT.md         Magistrát: stav, plán, výpočetní náročnost
```

## Známá omezení

- Mandáty a zvolení jsou do vyhlášení ČSÚ **odhad** z průběžných čísel —
  první sečtené okrsky nemusí být reprezentativní (UI to píše).
- Sloupec „zvolen" v datech ČSÚ šel před volbami ověřit jen z kódu jejich
  aplikace; použije se jen tehdy, když počet zvolených sedí s mandáty strany.
- Hranice okrsků jsou z roku 2025 (u Magistrátu chybí nový okrsek 34004);
  srovnání s 2022 po okrscích předpokládá stejná čísla okrsků.
- Časy v přehledu okrsků = kdy okrsek poprvé viděl daný prohlížeč.
- Fotky kandidátů jen tam, kde je máme (vlastní / programydovoleb.cz),
  ostatní mají iniciály.

## Zdroje a licence

- Výsledky, registry, hranice okrsků: **Český statistický úřad** (volby.gov.cz),
  [podmínky užití](https://csu.gov.cz/podminky_pro_vyuzivani_a_dalsi_zverejnovani_statistickych_udaju_csu).
- Loga stran, barvy a část fotek kandidátů: **programydovoleb.cz**.
- Podkladová mapa: **OpenFreeMap** (Positron), © přispěvatelé
  **OpenStreetMap**; záloha bez WebGL2: dlaždice OpenStreetMap.
- Logo a vizuální styl: **Česká pirátská strana** (pirati.cz).
