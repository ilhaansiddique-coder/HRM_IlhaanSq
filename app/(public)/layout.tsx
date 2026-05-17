import type { ReactNode } from "react";
import { Navbar } from "./_components/navbar";
import { Footer } from "./_components/footer";

export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 pt-16">{children}</main>
      <Footer />
    </div>
  );
}
