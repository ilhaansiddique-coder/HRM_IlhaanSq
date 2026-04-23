"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

// Makes the sidebar highlight jump to the clicked link IMMEDIATELY, before
// Next.js finishes fetching/rendering the destination. Without this, the
// active-link style only moves after the navigation commits, which is what
// makes the sidebar feel laggy.

type Ctx = {
  activePath: string;
  markPending: (href: string) => void;
};

const OptimisticNavContext = createContext<Ctx | null>(null);

export function OptimisticNavProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);

  // When the real pathname catches up (or the browser navigates elsewhere
  // without using our NavLink), drop the optimistic override.
  useEffect(() => {
    setPending(null);
  }, [pathname]);

  const value: Ctx = {
    activePath: pending ?? pathname,
    markPending: setPending,
  };

  return (
    <OptimisticNavContext.Provider value={value}>
      {children}
    </OptimisticNavContext.Provider>
  );
}

export function useOptimisticNav(): Ctx {
  const ctx = useContext(OptimisticNavContext);
  if (!ctx) {
    // Safe fallback for any component that renders outside the provider —
    // just returns the real pathname with a no-op setter.
    return {
      activePath: typeof window !== "undefined" ? window.location.pathname : "/",
      markPending: () => {},
    };
  }
  return ctx;
}
