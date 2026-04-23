# Supabase Auth Email Template

Use this template in Supabase Dashboard:

1. `Authentication` -> `Templates`
2. Update both templates:
   - `Confirm signup`
   - `Magic Link`

This project sends auth emails with `auth.signInWithOtp(...)` and `auth.signUp(...)`. The relevant `Data.source` values are:

- `tenant_request`
- `tenant_request_alert`
- `tenant_access_approved`
- `tenant_welcome`
- `tenant_created_by_superadmin`
- `tenant_created_alert`

## Subject

```gotemplate
{{ if eq .Data.source "tenant_request" }}Verify your email to continue your tenant request{{ else if eq .Data.source "tenant_request_alert" }}New tenant request requires review{{ else if eq .Data.source "tenant_access_approved" }}Your tenant access is approved{{ else if eq .Data.source "tenant_created_by_superadmin" }}Verify your new tenant access{{ else if eq .Data.source "tenant_created_alert" }}A tenant was created by super admin{{ else if eq .Data.source "tenant_welcome" }}Welcome to {{ if .Data.workspace_name }}{{ .Data.workspace_name }}{{ else }}your workspace{{ end }}{{ else }}Your secure sign-in link{{ end }}
```

## HTML Body

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Account Email</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background: #eef2f7;
        font-family: Arial, Helvetica, sans-serif;
        color: #0f172a;
      }
      .wrap {
        width: 100%;
        padding: 24px 12px;
      }
      .card {
        max-width: 640px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #dbe3ee;
        border-radius: 16px;
        overflow: hidden;
      }
      .head {
        background: linear-gradient(135deg, #0f3d91, #0b5fff);
        color: #ffffff;
        padding: 24px;
      }
      .head h1 {
        margin: 0;
        font-size: 22px;
        line-height: 1.3;
      }
      .body {
        padding: 24px;
      }
      .body p {
        margin: 0 0 14px;
        font-size: 14px;
        line-height: 1.65;
      }
      .panel {
        margin: 18px 0;
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #dbe3ee;
        border-radius: 12px;
      }
      .danger {
        margin: 18px 0;
        padding: 16px;
        background: #fff1f2;
        border: 1px solid #fecdd3;
        border-radius: 12px;
        color: #9f1239;
      }
      .row {
        margin: 0 0 8px;
        font-size: 13px;
        line-height: 1.5;
      }
      .label {
        color: #475569;
        font-weight: 700;
      }
      .mono {
        font-family: Consolas, "Courier New", monospace;
        font-size: 12px;
        word-break: break-word;
      }
      .cta-wrap {
        margin: 24px 0;
      }
      .cta {
        display: inline-block;
        background: #0b5fff;
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 700;
        font-size: 14px;
        padding: 12px 18px;
        border-radius: 10px;
      }
      .small {
        color: #64748b;
        font-size: 12px;
        line-height: 1.6;
      }
      .foot {
        border-top: 1px solid #dbe3ee;
        padding: 16px 24px 22px;
        color: #64748b;
        font-size: 12px;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="head">
          <h1>
            {{ if eq .Data.source "tenant_request" }}
              Verify your email to continue your tenant request
            {{ else if eq .Data.source "tenant_request_alert" }}
              New tenant request received
            {{ else if eq .Data.source "tenant_access_approved" }}
              Your tenant access is approved
            {{ else if eq .Data.source "tenant_created_by_superadmin" }}
              Your tenant access is ready
            {{ else if eq .Data.source "tenant_created_alert" }}
              A new tenant was created by super admin
            {{ else if eq .Data.source "tenant_welcome" }}
              Welcome to {{ if .Data.workspace_name }}{{ .Data.workspace_name }}{{ else }}your workspace{{ end }}
            {{ else }}
              Secure sign-in link
            {{ end }}
          </h1>
        </div>

        <div class="body">
          {{ if eq .Data.source "tenant_request" }}
            <p>Hello {{ if .Data.applicant_name }}{{ .Data.applicant_name }}{{ else }}there{{ end }},</p>
            <p>Please verify your email address to continue your tenant onboarding request.</p>
          {{ else if eq .Data.source "tenant_request_alert" }}
            <p>A new tenant request needs superadmin review.</p>
          {{ else if eq .Data.source "tenant_created_alert" }}
            <p>A tenant was created directly by super admin.</p>
          {{ else if eq .Data.source "tenant_access_approved" }}
            <p>Hello {{ if .Data.full_name }}{{ .Data.full_name }}{{ else }}there{{ end }},</p>
            <p>Your tenant access is now approved. Continue with the secure link below.</p>
          {{ else if eq .Data.source "tenant_created_by_superadmin" }}
            <p>Hello {{ if .Data.full_name }}{{ .Data.full_name }}{{ else }}there{{ end }},</p>
            <p>Your tenant workspace has been created by the super admin. Verify your email, then sign in using the temporary password below.</p>
          {{ else if eq .Data.source "tenant_welcome" }}
            <p>Hello {{ if .Data.owner_name }}{{ .Data.owner_name }}{{ else }}there{{ end }},</p>
            <p>Welcome aboard. Your workspace is ready to use.</p>
          {{ else }}
            <p>Use the secure link below to continue.</p>
          {{ end }}

          <div class="panel">
            {{ if .Data.workspace_name }}<p class="row"><span class="label">Workspace:</span> {{ .Data.workspace_name }}</p>{{ end }}
            {{ if .Data.business_name }}<p class="row"><span class="label">Business:</span> {{ .Data.business_name }}</p>{{ end }}
            {{ if .Data.applicant_name }}<p class="row"><span class="label">Applicant:</span> {{ .Data.applicant_name }}</p>{{ end }}
            {{ if .Data.applicant_email }}<p class="row"><span class="label">Applicant email:</span> {{ .Data.applicant_email }}</p>{{ end }}
            {{ if .Data.tenant_admin_name }}<p class="row"><span class="label">Tenant admin:</span> {{ .Data.tenant_admin_name }}</p>{{ end }}
            {{ if .Data.tenant_admin_email }}<p class="row"><span class="label">Tenant admin email:</span> {{ .Data.tenant_admin_email }}</p>{{ end }}
            {{ if .Data.plan_key }}<p class="row"><span class="label">Plan:</span> {{ .Data.plan_key }}</p>{{ end }}
            {{ if .Data.requested_domain }}<p class="row"><span class="label">Requested domain:</span> {{ .Data.requested_domain }}</p>{{ end }}
            {{ if .Data.business_type }}<p class="row"><span class="label">Business type:</span> {{ .Data.business_type }}</p>{{ end }}
            {{ if .Data.contact_phone }}<p class="row"><span class="label">Phone:</span> {{ .Data.contact_phone }}</p>{{ end }}
            {{ if .Data.created_by_name }}<p class="row"><span class="label">Created by:</span> {{ .Data.created_by_name }}</p>{{ end }}
            {{ if .Data.created_by_email }}<p class="row"><span class="label">Created by email:</span> {{ .Data.created_by_email }}</p>{{ end }}
          </div>

          {{ if .Data.temp_password }}
            <div class="danger">
              <p class="row"><strong>Temporary password:</strong></p>
              <p class="row mono">{{ .Data.temp_password }}</p>
              <p class="row">
                {{ if .Data.temporary_password_message }}
                  {{ .Data.temporary_password_message }}
                {{ else }}
                  This password is temporary. Reset it after your first sign-in.
                {{ end }}
              </p>
              {{ if .Data.reset_password_url }}
                <p class="row"><span class="label">Reset password page:</span> {{ .Data.reset_password_url }}</p>
              {{ end }}
            </div>
          {{ end }}

          <div class="cta-wrap">
            <a class="cta" href="{{ .ConfirmationURL }}">
              {{ if eq .Data.source "tenant_request" }}
                Verify Email
              {{ else if eq .Data.source "tenant_request_alert" }}
                Open Tenant Requests
              {{ else if eq .Data.source "tenant_created_alert" }}
                Open Tenants
              {{ else if eq .Data.source "tenant_access_approved" }}
                Open Dashboard
              {{ else if eq .Data.source "tenant_created_by_superadmin" }}
                Verify & Continue
              {{ else if eq .Data.source "tenant_welcome" }}
                Open Dashboard
              {{ else }}
                Continue
              {{ end }}
            </a>
          </div>

          {{ if .Data.login_url }}
            <p class="small"><strong>Sign-in page:</strong> {{ .Data.login_url }}</p>
          {{ end }}
          {{ if .Data.admin_panel_url }}
            <p class="small"><strong>Admin panel:</strong> {{ .Data.admin_panel_url }}</p>
          {{ end }}
          <p class="small">If the button does not work, copy and open this link:</p>
          <p class="small mono">{{ .ConfirmationURL }}</p>
        </div>

        <div class="foot">
          <div>{{ if .Data.app_name }}{{ .Data.app_name }}{{ else }}RaheDeen Inventory{{ end }}</div>
          {{ if .Data.support_email }}
            <div>Support: {{ .Data.support_email }}</div>
          {{ end }}
          <div>This is an automated email. Please do not reply to this message.</div>
        </div>
      </div>
    </div>
  </body>
</html>
```

## Plain Text Body

```gotemplate
{{ if eq .Data.source "tenant_request" }}Verify your email to continue your tenant request.{{ else if eq .Data.source "tenant_request_alert" }}A new tenant request needs superadmin review.{{ else if eq .Data.source "tenant_access_approved" }}Your tenant access is approved.{{ else if eq .Data.source "tenant_created_by_superadmin" }}Your tenant access has been created by super admin.{{ else if eq .Data.source "tenant_created_alert" }}A tenant was created by super admin.{{ else if eq .Data.source "tenant_welcome" }}Welcome to your workspace.{{ else }}Use this secure sign-in link.{{ end }}

{{ if .Data.workspace_name }}Workspace: {{ .Data.workspace_name }}{{ end }}
{{ if .Data.business_name }}Business: {{ .Data.business_name }}{{ end }}
{{ if .Data.applicant_name }}Applicant: {{ .Data.applicant_name }}{{ end }}
{{ if .Data.applicant_email }}Applicant email: {{ .Data.applicant_email }}{{ end }}
{{ if .Data.tenant_admin_name }}Tenant admin: {{ .Data.tenant_admin_name }}{{ end }}
{{ if .Data.tenant_admin_email }}Tenant admin email: {{ .Data.tenant_admin_email }}{{ end }}
{{ if .Data.plan_key }}Plan: {{ .Data.plan_key }}{{ end }}
{{ if .Data.requested_domain }}Requested domain: {{ .Data.requested_domain }}{{ end }}
{{ if .Data.temp_password }}Temporary password: {{ .Data.temp_password }}{{ end }}
{{ if .Data.temporary_password_message }}{{ .Data.temporary_password_message }}{{ end }}
{{ if .Data.login_url }}Sign-in page: {{ .Data.login_url }}{{ end }}
{{ if .Data.admin_panel_url }}Admin panel: {{ .Data.admin_panel_url }}{{ end }}

Continue: {{ .ConfirmationURL }}
```
