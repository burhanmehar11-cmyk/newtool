/** Inline <head> script: enables reveal styles before first paint, only when motion is allowed. */
export const FX_BOOT_SCRIPT = `try{if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('fx')}catch(e){}`;
