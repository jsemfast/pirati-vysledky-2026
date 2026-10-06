// Jediný zdroj pravdy o verzi aplikace.
//
// Nová verze = přidat záznam NA ZAČÁTEK pole. Verze prvního záznamu je
// aktuální verze aplikace — propíše se do version.json při buildu (viz
// vite.config.js) a klienti se podle ní samy obnoví po nasazení.
//
// type položky: 'new' (novinka) | 'improved' (vylepšení) | 'fixed' (oprava)

export const CHANGELOG = [
    {
        version: '1.2.0',
        date: '2026-10-06',
        title: 'Verzování a šetrnější obnovování',
        items: [
            { type: 'new', text: 'Automatická aktualizace — když vyjde nová verze, stránka se sama obnoví' },
            { type: 'new', text: 'Přehled novinek („Co je nové" v menu a v patičce přehledu); po aktualizaci se jednou ukáže sám' },
            { type: 'improved', text: 'Obnovit výsledky jde až po vypršení odpočtu — data se stejně mění jen po minutě a zbytečné dotazy zatěžují server' },
            { type: 'improved', text: 'Obnovení stránky před koncem odpočtu ukáže poslední načtená data a další kontrolu udělá až v plánovaný čas' },
        ],
    },
    {
        version: '1.1.0',
        date: '2026-10-06',
        title: 'Celá Praha',
        items: [
            { type: 'new', text: 'Všech 57 městských částí — každá má vlastní stránku s mapou okrsků, mandáty, zastupiteli a koalicemi' },
            { type: 'new', text: 'Přehled celé Prahy: kolik mandátů mají Piráti dohromady v MČ a na Magistrátu, karta každé MČ s průběžným procentem a mandáty už během sčítání' },
            { type: 'new', text: 'Řazení MČ podle čísla, procent nebo mandátů; čerstvě změněné MČ krátce zablikají' },
            { type: 'new', text: 'Demo sčítání celé Prahy na přehledu (?demo)' },
            { type: 'improved', text: 'Srovnání s rokem 2022 i u místních sdružení nezávislých (PRAHA 7 SOBĚ, SOS Suchdol…)' },
            { type: 'improved', text: 'Stránky MČ, kde Piráti nekandidují, ukazují výsledky všech kandidátek' },
        ],
    },
    {
        version: '1.0.0',
        date: '2026-10-06',
        title: 'Živé výsledky voleb 2026',
        items: [
            { type: 'new', text: 'Průběžné výsledky Prahy 3, 6, 11 a Magistrátu přímo z volby.gov.cz, samy se obnovují každou minutu' },
            { type: 'new', text: 'Odhad mandátů podle zákona (5% klauzule, d\'Hondt, preferenční hlasy) a půlkruh zastupitelstva' },
            { type: 'new', text: 'Mapa okrsků, zvolení zastupitelé, koalice a přehled okrsků v pořadí, jak je komise posílají' },
            { type: 'new', text: 'Demo sčítání na vyzkoušení (menu → Demo sčítání)' },
        ],
    },
];

export const APP_VERSION = CHANGELOG[0].version;
