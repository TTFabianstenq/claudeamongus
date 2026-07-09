/**
 * Applies the persisted theme class before first paint to avoid a flash.
 * Reads the zustand-persisted session store directly from localStorage.
 */
export function ThemeScript() {
  const code = `(function(){try{var raw=localStorage.getItem("crewfall-session");if(raw){var theme=JSON.parse(raw).state.theme;var el=document.documentElement;if(theme==="light"){el.classList.remove("dark");el.classList.add("light");}else{el.classList.add("dark");el.classList.remove("light");}}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
