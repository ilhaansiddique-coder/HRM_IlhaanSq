"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getAvailableViews,
  viewCookieName,
  viewLanding,
  type ViewMode,
} from "@/lib/view-mode";

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, matches the session

// Set the active view (validated against what the user actually holds) and
// send them to that view's landing page.
export async function setViewModeAction(mode: ViewMode) {
  const session = await getSession();
  if (!session) redirect("/login");

  const available = await getAvailableViews(session);
  if (!available.includes(mode)) redirect("/continue");

  (await cookies()).set(viewCookieName(session.userId), mode, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  redirect(viewLanding(mode));
}
