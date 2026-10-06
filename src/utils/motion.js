// Uživatel si v systému vypnul animace → rolovat a posouvat mapu skokem
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const scrollBehavior = () => (reducedMotion() ? 'auto' : 'smooth');
