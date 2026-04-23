import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";
import { ResetPasswordForm } from "./_components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16">
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your account email and we&apos;ll send you a reset link.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-8">
          <ResetPasswordForm />

          <div className="mt-6 pt-6 border-t border-border/60 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
