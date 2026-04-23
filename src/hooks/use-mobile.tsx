import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const getIsMobile = React.useCallback(() => {
    if (typeof window === "undefined") {
      return false
    }
    return window.innerWidth < MOBILE_BREAKPOINT
  }, [])

  const [isMobile, setIsMobile] = React.useState<boolean>(getIsMobile)

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
      const onChange = () => {
        try {
          setIsMobile(getIsMobile())
        } catch (error) {
          console.warn('Failed to update mobile state:', error)
        }
      }

      if (mql.addEventListener) {
        mql.addEventListener("change", onChange)
      } else if (mql.addListener) {
        mql.addListener(onChange)
      }

      onChange()

      return () => {
        try {
          if (mql.removeEventListener) {
            mql.removeEventListener("change", onChange)
          } else if (mql.removeListener) {
            mql.removeListener(onChange)
          }
        } catch (error) {
          console.warn('Failed to remove media query listener:', error)
        }
      }
    } catch (error) {
      console.warn('Failed to set up media query listener:', error)
      setIsMobile(false)
      return
    }
  }, [getIsMobile])

  return isMobile
}
