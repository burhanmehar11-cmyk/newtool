/** localStorage key for the app appearance: "light" | "dark" | "system" (default). */
export const THEME_KEY = "locentio.theme";

/**
 * Inline <head> script, before first paint:
 * - enables reveal styles only when motion is allowed;
 * - applies the saved app appearance on /app pages, so there's no flash.
 */
export const FX_BOOT_SCRIPT = `try{if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('fx')}catch(e){}
try{if(location.pathname.indexOf('/app')===0){var t=localStorage.getItem('${THEME_KEY}')||'system';if(t==='system')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;
