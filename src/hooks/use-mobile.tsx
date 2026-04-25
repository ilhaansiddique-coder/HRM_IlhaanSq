import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Always start false on both SSR and the FIRST client render —
  // identical to what the server emitted. If we read window.innerWidth
  // here via a lazy useState init, the client can resolve to true
  // before hydration commits, producing a tree mismatch (sidebar
  // primitive renders <Sheet> on mobile vs. <div ...> on desktop).
  // The useEffect below flips the value AFTER hydration, which is a
  // normal re-render — no warning, no React DOM hydration error.
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
      const update = () =>
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)

      if (mql.addEventListener) {
        mql.addEventListener("change", update)
      } else if (mql.addListener) {
        mql.addListener(update)
      }

      // Initial sync — sets the real value on the post-hydration render.
      update()

      return () => {
        try {
          if (mql.removeEventListener) {
            mql.removeEventListener("change", update)
          } else if (mql.removeListener) {
            mql.removeListener(update)
          }
        } catch (error) {
          console.warn('Failed to remove media query listener:', error)
        }
      }
    } catch (error) {
      console.warn('Failed to set up media query listener:', error)
    }
  }, [])

  return isMobile
}

// Returns true when the app is running as an installed PWA (display-mode:
// standalone). Use this to render PWA-specific chrome — e.g. a back/refresh
// button in the header, since Safari's native chrome is hidden in that mode.
export function useIsStandalone() {
  const [isStandalone, setIsStandalone] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const mql = window.matchMedia("(display-mode: standalone)")
      const update = () => setIsStandalone(mql.matches)
      update()
      if (mql.addEventListener) {
        mql.addEventListener("change", update)
      } else if (mql.addListener) {
        mql.addListener(update)
      }
      return () => {
        if (mql.removeEventListener) {
          mql.removeEventListener("change", update)
        } else if (mql.removeListener) {
          mql.removeListener(update)
        }
      }
    } catch (error) {
      console.warn("Failed to detect standalone mode:", error)
    }
  }, [])

  return isStandalone
}
