// Deterministický generátor pro dema (stejný seed = stejný večer)
export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Normální rozdělení N(0, 1) z rovnoměrného generátoru (Box–Muller)
export const gaussFrom = (rand) => () => {
    const u = Math.max(rand(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
};

// Váhy hlasů kandidátů jedné kandidátky pro dema. V KV dá křížek u strany
// hlas všem kandidátům, takže mají hlasy podobné — kalibrováno na pražské
// kandidátky s mandátem v KV 2022 (poměr k průměru na kandidáta): lídr
// medián 1,12 (10.–90. percentil 1,04–1,35), horní třetina listiny 1,03,
// prostředek 1,00, spodní třetina 0,96 (±0,03); silnější kandidát
// hlouběji na listině (≈ 1,1) jen u menšiny kandidátek.
export function candidateWeights(count, rand, gauss) {
    const star = count > 4 && rand() < 0.5 ? 4 + Math.floor(rand() * (count - 3)) : null;
    return Array.from({ length: count }, (_, i) => {
        const n = i + 1;
        const x = count > 1 ? i / (count - 1) : 0;
        let w = (1.05 - 0.1 * x) * Math.exp(0.025 * gauss());
        if (n === 1) w = 1.02 + 0.09 * Math.exp(0.9 * gauss());
        else if (n === 2) w += 0.04;
        if (n === star) w *= 1.07 + 0.08 * rand();
        return w;
    });
}
