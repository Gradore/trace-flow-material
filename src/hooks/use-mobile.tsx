import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/**
 * Resolve the breakpoint synchronously so the very first committed render is
 * already correct. Reading it from an effect made the shell paint the desktop
 * sidebar margin on a phone and then animate it away on every navigation.
 */
function readIsMobile(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false; // no DOM (SSR/tests) - assume the desktop layout
  }
  return window.matchMedia(MOBILE_QUERY).matches;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(readIsMobile);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mql.addEventListener("change", onChange);
    // The viewport can have changed between the first render and this effect.
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
