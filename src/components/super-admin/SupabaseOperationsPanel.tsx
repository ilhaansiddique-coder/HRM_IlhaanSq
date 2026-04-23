import { AlertTriangle, CheckCircle2, KeyRound, Rocket, TerminalSquare, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const projectRef = "alhntgyjagjiobqzflqc";

const localSetupSteps = [
  "Install and verify Supabase CLI with `supabase --version`.",
  "Authenticate once with `supabase login`.",
  "Confirm `project_id` in `supabase/config.toml` matches the configured project ref.",
];

const dayToDayCommands = [
  "npm run supabase:db:push:remote",
  "npm run supabase:functions:deploy:remote",
  "npm run supabase:remote:bootstrap",
  "npm run supabase:docker -- start",
  "npm run supabase:docker -- status",
];

const requiredSecrets = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "APP_URL",
  "ALLOWED_ORIGINS",
  "TENANT_REQUEST_NOTIFY_EMAILS",
  "APP_NAME",
  "SUPPORT_EMAIL",
];

const bootstrapCommands = [
  '$env:SUPABASE_ACCESS_TOKEN="your-personal-access-token"',
  "npm run supabase:remote:bootstrap",
  `supabase secrets set --project-ref ${projectRef} --env-file supabase/.env.remote`,
  "powershell -ExecutionPolicy Bypass -File ./scripts/bootstrap-supabase-remote.ps1 -SkipDbPush",
];

const deploymentChecks = [
  "If PAT is missing or expired, run `supabase login` again or set `SUPABASE_ACCESS_TOKEN`.",
  "If local CLI is blocked, use the Docker wrapper scripts.",
  "If deployment fails, confirm project access and the configured project ref.",
  "If functions fail preflight, redeploy functions and verify startup logs.",
  "If email delivery fails, verify `SUPABASE_ANON_KEY`, `APP_URL`, and auth templates.",
];

export function SupabaseOperationsPanel() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Supabase Operations
          </CardTitle>
          <CardDescription>
            Working summary of the existing Supabase workflow and remote bootstrap runbook already stored in project docs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Badge variant="outline">Project Ref: {projectRef}</Badge>
          <Badge variant="secondary">Source: SUPABASE_DEVELOPMENT_WORKFLOW.md</Badge>
          <Badge variant="secondary">Source: remote-supabase-bootstrap.md</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Local Setup
            </CardTitle>
            <CardDescription>One-time environment steps for CLI-based operations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {localSetupSteps.map((step) => (
              <div key={step} className="rounded-lg border p-3 text-sm">
                {step}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TerminalSquare className="h-5 w-5" />
              Day-to-Day Commands
            </CardTitle>
            <CardDescription>Common project scripts for migrations, functions, and Docker-backed CLI access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dayToDayCommands.map((command) => (
              <pre key={command} className="overflow-x-auto rounded-lg border bg-muted/30 p-3 text-sm">
                <code>{command}</code>
              </pre>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Required Secrets
            </CardTitle>
            <CardDescription>Important remote secrets for the current frontend and edge-function flow.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {requiredSecrets.map((secret) => (
              <Badge key={secret} variant="outline">
                {secret}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Remote Bootstrap
            </CardTitle>
            <CardDescription>Runbook commands for restoring the current shared-schema app on the configured remote Supabase project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {bootstrapCommands.map((command) => (
              <pre key={command} className="overflow-x-auto rounded-lg border bg-muted/30 p-3 text-sm">
                <code>{command}</code>
              </pre>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Deployment Checks
          </CardTitle>
          <CardDescription>Operational cautions and failure triage already documented in the project workflow docs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {deploymentChecks.map((item) => (
            <div key={item} className="rounded-lg border p-3 text-sm">
              {item}
            </div>
          ))}
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Keep `supabase/migrations/*` separate from `infra/migrations/platform/*` unless that merge is intentionally designed.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SupabaseOperationsPanel;
