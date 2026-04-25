"use client";

// Forwarding wrapper around Next.js Link so it works with shadcn `asChild` pattern
// (which renders the child as the actual element via Slot).
//
// Three perf wins layered onto the plain Link:
//   1. `prefetch` is set explicitly so visible sidebar links pre-fetch the
//      destination's RSC payload aggressively — landing on a sub-page is
//      near-instant after that.
//   2. `startTransition` wraps the optimistic-active update so React treats
//      the navigation as non-urgent and never blocks the click feedback paint.
//   3. `markPending` flips the sidebar pill to the new route immediately —
//      the user sees their click register the same frame.

import Link from "next/link";
import {
  forwardRef,
  startTransition,
  type AnchorHTMLAttributes,
} from "react";
import { useOptimisticNav } from "./optimistic-nav";

export const NavLink = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }
>(function NavLink({ href, onClick, prefetch = true, ...props }, ref) {
  const { markPending } = useOptimisticNav();
  return (
    <Link
      href={href}
      prefetch={prefetch}
      ref={ref}
      onClick={(e) => {
        startTransition(() => {
          markPending(href);
        });
        onClick?.(e);
      }}
      {...props}
    />
  );
});
