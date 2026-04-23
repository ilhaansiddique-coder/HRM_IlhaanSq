"use client";

// Forwarding wrapper around Next.js Link so it works with shadcn `asChild` pattern
// (which renders the child as the actual element via Slot).
// Also marks the clicked href as optimistically-active so the sidebar updates
// instantly on click rather than after the destination page renders.

import Link from "next/link";
import { forwardRef, type AnchorHTMLAttributes } from "react";
import { useOptimisticNav } from "./optimistic-nav";

export const NavLink = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>(function NavLink({ href, onClick, ...props }, ref) {
  const { markPending } = useOptimisticNav();
  return (
    <Link
      href={href}
      ref={ref}
      onClick={(e) => {
        markPending(href);
        onClick?.(e);
      }}
      {...props}
    />
  );
});
