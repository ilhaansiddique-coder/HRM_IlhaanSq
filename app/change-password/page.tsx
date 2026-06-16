import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Package, KeyRound } from "lucide-react";
import Link from "next/link";
import { ChangePasswordForm } from "./_components/change-password-form";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // If user already changed their password, send them home
  if (!session.mustResetPassword) redirect("/hr");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Package className="h-5 w-5" />
            </div>
          </Link>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 mb-4">
            <KeyRound className="h-6 w-6 text-warning" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Set your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hi {session.name}, you signed in with a temporary password. Please choose a new one to continue.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-8 shadow-sm">
          <ChangePasswordForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Pick something only you would know. Minimum 8 characters.
        </p>
      </div>
    </div>
  );
}
