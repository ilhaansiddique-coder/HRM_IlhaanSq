import type { ReactNode } from "react";

// Shared chrome for the public legal pages (Privacy, Terms). Keeps both pages
// visually consistent and uses the @tailwindcss/typography `prose` styles that
// are already configured in the project.
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: {updated}
      </p>
      <div className="prose prose-sm dark:prose-invert mt-8 max-w-none prose-headings:font-semibold prose-a:text-primary">
        {children}
      </div>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg">{title}</h2>
      {children}
    </section>
  );
}
