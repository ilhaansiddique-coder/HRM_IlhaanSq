# HR MODULE
# SOLUTION BLUEPRINT

International-Grade Human Resource Management System

Next.js 14  ·  Supabase  ·  NestJS  ·  Tailwind CSS

Version 1.0  ·  March 2026

## Table of Contents

1. Executive Summary
2. System Architecture Overview
3. Core HR Modules
4. Database Design (Supabase / PostgreSQL)
5. Backend API Design (NestJS)
6. Frontend Architecture (Next.js + Tailwind)
7. International Standards & Compliance
8. Integration Ecosystem
9. Commercialization & Go-To-Market Strategy
10. Implementation Roadmap
11. Technical Appendix

---

## 1. Executive Summary

This document defines the complete solution blueprint for a commercial-grade, internationally sellable Human Resource Management System (HRMS). The module is engineered on a modern SaaS stack — Next.js 14 (App Router), Supabase (PostgreSQL + Auth + Storage), NestJS REST/GraphQL API, and Tailwind CSS — and is designed to meet ISO, GDPR, SOC 2, and regional labor-law compliance standards out of the box.

The system is architected as a white-label, multi-tenant SaaS product that can be licensed to enterprises globally, with plugin-style regional compliance packs (EU, US, GCC, APAC, LATAM) enabling fast market entry in any geography.

### TARGET MARKET
SMEs (50–5,000 employees) across industries · SaaS resellers & HR consultancies · White-label enterprise clients in EU, GCC, APAC, and North America

### TECH STACK
Frontend: Next.js 14 + Tailwind CSS  |  Backend: NestJS + REST/GraphQL  |  Database: Supabase (PostgreSQL)  |  Auth: Supabase Auth + MFA  |  Jobs: BullMQ + Redis

### COMPLIANCE
GDPR · ISO 27001 · SOC 2 Type II · DPDPA (India) · PDPA (Thailand/Singapore) · CCPA (California) · GCC Labour Law Packs · ILO Conventions

---

## 2. System Architecture Overview

### 2.1 High-Level Architecture Layers

The HRMS follows a modular, layered architecture with clear separation between the presentation layer (Next.js), business logic layer (NestJS), and persistence layer (Supabase PostgreSQL). All inter-service communication uses typed API contracts (OpenAPI 3.1).

| Layer | Technology | Responsibility | Scalability |
|-------|-----------|---------------|-------------|
| Presentation | Next.js 14 App Router | SSR/CSR UI, i18n routing, role-based views | Vercel Edge / CDN |
| API Gateway | NestJS (REST + GraphQL) | Business logic, validation, auth middleware | Kubernetes / Docker |
| Auth Service | Supabase Auth + JWT | SSO, MFA, RBAC, session management | Supabase managed |
| Core Database | Supabase PostgreSQL 15 | ACID transactions, RLS policies, full-text search | Supabase managed |
| File Storage | Supabase Storage + S3 | Documents, avatars, payslips, contracts | S3-compatible CDN |
| Background Jobs | BullMQ + Redis | Payroll processing, notifications, reports | Redis cluster |
| Email / SMS | Resend + Twilio | Payslip delivery, OTP, alerts | Managed SaaS |
| Observability | OpenTelemetry + Sentry | Tracing, error tracking, APM | Self-hosted / cloud |

### 2.2 Multi-Tenancy Design

The system uses a schema-based multi-tenancy model in Supabase. Each tenant gets an isolated PostgreSQL schema, ensuring data residency compliance (critical for EU GDPR and GCC data localization laws).

- Tenant onboarding creates a dedicated schema (e.g., `tenant_acme_corp`)
- Row-Level Security (RLS) policies enforce per-tenant data access at the database layer
- API middleware validates tenant context from JWT claims on every request
- Storage buckets are namespaced per tenant with signed URL access only
- Tenant metadata (plan, locale, timezone, currency) stored in a master `tenants` table

### 2.3 Security Architecture

- **Authentication**: Supabase Auth (email/password, OAuth 2.0 SSO: Google, Microsoft, Okta, SAML 2.0)
- **Authorization**: 5-tier RBAC — Super Admin, HR Admin, Manager, Employee, Auditor
- **API Security**: JWT + refresh token rotation, rate limiting via NestJS ThrottlerGuard
- **Data Encryption**: AES-256 at rest (Supabase), TLS 1.3 in transit, pgcrypto for PII fields
- **Audit Logging**: Immutable audit trail for all write operations (GDPR Article 5 requirement)
- OWASP Top-10 mitigations built into NestJS middleware pipeline

---

## 3. Core HR Modules

The HRMS is composed of 12 independently deployable modules. Each module has its own NestJS controller, Supabase schema tables, and Next.js page routes. Customers can license individual modules (modular pricing) or the full suite.

| # | Module Name | Key Features | Int'l Standard |
|---|-------------|--------------|----------------|
| 1 | Employee Lifecycle | Hire-to-retire, org chart, digital contracts | ISO 30408 |
| 2 | Attendance & Time | Biometric/QR/GPS, shifts, overtime calc | ILO Working Time |
| 3 | Leave Management | Multi-policy engine, carryover, encashment | Regional Labor Laws |
| 4 | Payroll Engine | Multi-currency, tax slabs, statutory deductions | IFRS / IAS 19 |
| 5 | Performance Mgmt | OKR/KPI/360, appraisals, bell curve | ISO 10667 |
| 6 | Recruitment (ATS) | Pipeline, JD builder, offer letters, onboarding | EEOC / GDPR Art 13 |
| 7 | Learning & Dev (LMS) | Courses, certifications, skill matrix | SCORM 2004 / xAPI |
| 8 | Benefits & Comp | Insurance, loans, flexi-benefits, salary bands | IAS 19 / ASC 715 |
| 9 | Document Mgmt | e-Sign, templates, expiry alerts, DMS | eIDAS / ESIGN Act |
| 10 | Analytics & Reports | Custom dashboards, scheduled exports, HR BI | ISO 30414 |
| 11 | Compliance Engine | Regulatory calendar, policy library, audit trail | GDPR / SOX / PDPA |
| 12 | Employee Self-Service | ESS portal, mobile PWA, chatbot assistant | UX best practices |

### 3.1 Employee Lifecycle Management

The core module manages the complete employee journey from job offer acceptance through offboarding. It serves as the master data hub for all other modules.

#### Key Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| employees | Master employee record | id, emp_code, tenant_id, status, hire_date, termination_date |
| employee_profiles | PII & contact info | full_name, dob, national_id, passport_no, phone, address |
| positions | Job catalog | title, grade, band, job_family, is_manager |
| departments | Org structure | name, parent_id, head_employee_id, cost_center |
| employment_history | Job changes audit | employee_id, from_date, to_date, position_id, salary |
| org_chart_nodes | Hierarchy cache | employee_id, manager_id, depth, path (ltree) |

#### NestJS REST Endpoints

- `GET /employees` — Paginated list with full-text search, filter, sort
- `POST /employees` — Create employee (triggers onboarding workflow)
- `PATCH /employees/:id` — Update with field-level audit log
- `POST /employees/:id/transfer` — Department/position transfer with history
- `POST /employees/:id/terminate` — Offboarding checklist + final settlement trigger
- `GET /org-chart/:departmentId` — Real-time org chart using Supabase ltree

### 3.2 Payroll Engine

The payroll engine is the highest-value module. It supports multi-currency payroll, country-specific statutory deductions, and generates IFRS-compliant payroll accounting entries.

#### SUPPORTED REGIONS
Bangladesh (BEPZA, PF, Gratuity) · India (TDS, PF, ESI, PT) · UAE (DEWS, WPS) · UK (PAYE, NI, Pension) · USA (Federal/State, 401k) · Singapore (CPF) · Saudi Arabia (GOSI)

#### Payroll Processing Pipeline (BullMQ Queue)

1. Lock payroll period — prevents concurrent modifications
2. Aggregate attendance, leave, overtime data for the pay period
3. Apply salary components (Basic, HRA, Allowances, Deductions per structure)
4. Run country-specific statutory deduction calculator
5. Apply one-time adjustments, arrears, bonus amounts
6. Generate payslip PDF per employee (stored in Supabase Storage)
7. Create GL journal entries (export to QuickBooks / Xero / SAP)
8. Trigger payslip distribution via email and ESS portal notification
9. Unlock period, archive payroll run with full audit trail

#### Payroll Schema (Key Tables)

| Table | Description |
|-------|-------------|
| payroll_periods | Monthly/bi-weekly run definitions with lock status and approver |
| salary_structures | Template defining component calculation rules per grade/band |
| salary_components | Individual earnings/deductions (Basic, HRA, PF, Income Tax) |
| employee_salaries | Effective-dated salary assignments with revision history |
| payroll_runs | Execution log per period (status, processed_count, total_cost) |
| payslip_lines | Row-level payslip data per component (amount, ytd, tax_ytd) |
| statutory_configs | Country-specific tax/statutory rules stored as versioned JSON |

### 3.3 Leave Management

A policy-driven leave engine that supports unlimited leave policies, multi-approval workflows, and automatic statutory compliance for each country's mandatory leave entitlements.

- **Leave Types**: Annual, Sick, Maternity/Paternity, Unpaid, Compensatory, Emergency, Custom
- **Accrual Engine**: Monthly/annual accrual with pro-rata for joiners and leavers
- **Carryover Rules**: Configurable cap with auto-lapse on policy deadline dates
- **Multi-level Approval**: Configurable approval chain (manager → HR → skip-level)
- **Calendar Integration**: Conflict check against public holidays (per country) and team calendar
- **Statutory Defaults**: Pre-loaded leave entitlements for 40+ countries

### 3.4 Recruitment & ATS

A full applicant tracking system integrated with LinkedIn, Indeed, and custom job boards. GDPR-compliant candidate data handling with consent management built in.

- Full workflow: Job Requisition → Approval → Publishing → Pipeline → Offer → Onboard
- AI-assisted JD generation via Anthropic Claude API integration
- Structured interview scorecard builder with calibrated rating scales
- EEOC / diversity reporting built-in for US market compliance
- Candidate data auto-deletion policy (GDPR Right to Erasure, configurable retention)
- Integrations: LinkedIn Talent Hub, Indeed, Naukri, Bayt.com

### 3.5 Performance Management

Supports three frameworks simultaneously — OKR (Objectives & Key Results), KPI scorecards, and 360-degree feedback — configurable per tenant.

- Goal cascading: Company → Department → Team → Individual
- Review cycles: Quarterly check-ins + Annual appraisals with configurable forms
- Calibration tool: Bell curve normalization with forced distribution settings
- Competency framework builder with behavioral indicators per role family
- PIP (Performance Improvement Plan) workflow with legal compliance documentation

---

## 4. Database Design (Supabase / PostgreSQL)

### 4.1 Schema Organization

| Schema | Purpose | Example Tables |
|--------|---------|----------------|
| public | Shared tenant registry | tenants, plans, regions, currencies, feature_flags |
| hr_core | Employee master data | employees, departments, positions, org_chart_nodes |
| hr_payroll | Payroll engine | payroll_runs, payslip_lines, salary_components |
| hr_leave | Leave management | leave_policies, leave_requests, leave_accruals |
| hr_recruit | ATS pipeline | jobs, applications, interviews, offers |
| hr_perf | Performance mgmt | goals, reviews, ratings, 360_feedback |
| hr_compliance | Audit & compliance | audit_logs, policy_documents, regulatory_alerts |
| hr_lms | Learning & development | courses, enrollments, completions, certificates |
| hr_analytics | Materialized views | employee_headcount_mv, turnover_mv, payroll_cost_mv |

### 4.2 Row-Level Security (RLS) Strategy

- Every table has RLS enabled with DENY-by-default policy
- Tenant isolation: `WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid`
- Role-based: HR Admin can SELECT/INSERT/UPDATE/DELETE; Employee can SELECT own records only
- Manager scope: Managers can view direct reports via org_chart_nodes hierarchy
- Payroll data: pgcrypto encryption for salary fields + additional RLS on payroll schema

### 4.3 Key PostgreSQL Extensions

- **ltree** — Org chart hierarchy traversal (ancestor/descendant queries)
- **pg_trgm** — Full-text fuzzy search on employee names and documents
- **pgcrypto** — Encrypted storage for PII fields (national_id, bank_account_number)
- **pg_cron** — Scheduled jobs (leave accrual runs, compliance deadline alerts)
- **Supabase Realtime** — Live org chart updates, notification badge counts
- **Table partitioning** — payslip_lines and audit_logs partitioned by year/tenant

---

## 5. Backend API Design (NestJS)

### 5.1 Module Directory Structure

| Directory | Contents |
|-----------|----------|
| src/modules/employees/ | EmployeeModule, EmployeeController, EmployeeService, DTOs, Specs |
| src/modules/payroll/ | PayrollModule, Controller, Service, PayrollProcessor (BullMQ job) |
| src/modules/leave/ | LeaveModule, LeaveController, LeaveService, AccrualService |
| src/modules/attendance/ | AttendanceModule, ShiftService, OvertimeCalculator |
| src/modules/recruitment/ | RecruitModule, ATSController, OfferService, JDGeneratorService |
| src/modules/performance/ | PerfModule, GoalService, ReviewService, CalibrationService |
| src/modules/compliance/ | ComplianceModule, AuditService, PolicyService |
| src/common/guards/ | JwtAuthGuard, RolesGuard, TenantGuard, PermissionsGuard |
| src/common/interceptors/ | AuditLogInterceptor, ResponseTransformInterceptor, CacheInterceptor |
| src/common/pipes/ | ZodValidationPipe, TenantContextPipe, SanitizePipe |
| src/config/ | database.config, redis.config, supabase.config, throttle.config |

### 5.2 API Standards

- OpenAPI 3.1 spec auto-generated via @nestjs/swagger decorators
- JSON:API response format: `{ data, meta, errors, links }` for all endpoints
- Cursor-based pagination for all list endpoints (no offset-based for performance)
- Versioning: URI versioning (`/api/v1/`, `/api/v2/`) for backward compatibility
- Rate limiting: 1,000 req/min per tenant via ThrottlerGuard + Redis
- Idempotency: POST endpoints accept `Idempotency-Key` header to prevent duplicates
- Webhooks: Tenant-configurable webhooks for 30+ HR events with retry logic

### 5.3 API Endpoint Summary

| Module | Base Route | Critical Endpoints |
|--------|-----------|-------------------|
| Employees | `/api/v1/employees` | CRUD, bulk-import CSV, org-chart, transfer, terminate |
| Payroll | `/api/v1/payroll` | Run payroll, approve, payslips, salary-revision, GL-export |
| Leave | `/api/v1/leave` | Apply, approve, cancel, policy-config, balance, calendar |
| Attendance | `/api/v1/attendance` | Check-in/out, shifts, overtime, regularization request |
| Recruitment | `/api/v1/jobs` | Create job, pipeline, schedule interview, extend offer |
| Performance | `/api/v1/performance` | Create goals, submit review, calibration, 360-feedback |
| Documents | `/api/v1/documents` | Upload, template-generate, e-sign request, expiry alerts |
| Analytics | `/api/v1/analytics` | Headcount, attrition, turnover, payroll-cost, HRIS BI |
| Compliance | `/api/v1/compliance` | Audit logs, policy docs, regulatory calendar, alerts |
| Auth/Tenants | `/api/v1/auth` | Login, refresh, invite-user, manage-roles, SSO config |

---

## 6. Frontend Architecture (Next.js + Tailwind)

### 6.1 App Router Structure

| Route | Module | Key Components |
|-------|--------|----------------|
| `/(auth)/login` | Auth | LoginForm, SSOButtons, MFAChallenge |
| `/dashboard` | Home | HeadcountCard, AlertsWidget, QuickActions, WelcomeBanner |
| `/employees` | Employees | EmployeeTable, OrgChart, EmployeeProfile, BulkImport |
| `/payroll` | Payroll | PayrollDashboard, RunPayroll, PayslipViewer, SalaryRevision |
| `/leave` | Leave | LeaveCalendar, ApplyLeave, BalanceCard, PolicyConfig |
| `/attendance` | Attendance | AttendanceLog, ShiftPlanner, OTReport, RegularizationForm |
| `/recruitment` | ATS | KanbanPipeline, JobBoard, CandidateCard, InterviewScheduler |
| `/performance` | Performance | GoalTree, ReviewForm, CalibrationTable, 360Survey |
| `/learning` | LMS | CourseLibrary, MyLearning, CertTracker, SCORMPlayer |
| `/reports` | Analytics | ReportBuilder, ScheduledReports, HRMetrics, ExportButton |
| `/settings` | Admin | TenantConfig, ModuleToggles, IntegrationHub, UserManagement |
| `/ess` | Self-Service | MyProfile, MyPayslips, MyLeave, MyGoals, MyDocuments |

### 6.2 Design System (Tailwind CSS)

- Custom Tailwind config extending default: brand colors, HR-specific spacing tokens
- Shadcn/UI as the base component library (accessible, headless, unstyled)
- Key custom components: OrgChartNode, PayslipCard, LeaveCalendar, GoalProgressBar
- Dark mode support: CSS variables + Tailwind `dark:` variants throughout
- RTL support: `dir='rtl'` on `<html>` with Tailwind RTL plugin (Arabic, Hebrew markets)
- Responsive: Mobile-first design (ESS portal heavily used on mobile devices)

### 6.3 Internationalization (i18n)

Full i18n support is a core sellability requirement. The system uses next-intl with ICU message format for pluralization and gender-aware strings.

- **Launch languages**: English, Arabic (RTL), French, Spanish, German, Hindi, Bengali
- **Number formatting**: Intl.NumberFormat respects locale (e.g., 1,00,000 INR vs 100,000 USD)
- **Date formatting**: Locale-aware (DD/MM/YYYY vs MM/DD/YYYY vs Hijri calendar option)
- **Currency**: ISO 4217 codes, real-time FX rates via Open Exchange Rates API
- **Timezone**: Tenant-level IANA timezone configuration stored in tenant settings

---

## 7. International Standards & Compliance

### 7.1 Data Privacy Compliance Matrix

| Regulation | Region | Key Requirements | Implementation |
|------------|--------|-----------------|----------------|
| GDPR | European Union | Consent, Right to Access/Erasure, DPA | Consent records, deletion queues, DPA templates |
| CCPA | California, USA | Opt-out of sale, data disclosure | Privacy preference center, data export API |
| DPDPA 2023 | India | Data fiduciary obligations, consent | Consent management module, DPO dashboard |
| PDPA | Thailand / Singapore | Data subject rights, breach notification | 72hr breach alert workflow, DSR self-service |
| POPIA | South Africa | Information officer, lawful processing | Processing register, PoPI compliance checklist |
| PIPL | China | Cross-border data restriction | Data residency option, consent audit trail |
| GCC Labour Law | UAE / Saudi Arabia | WPS, end of service, gratuity | WPS file export, gratuity auto-calculation |

### 7.2 Security & Quality Standards

- ISO/IEC 27001:2022 — Information Security Management System documentation included
- SOC 2 Type II — Audit-ready evidence collection (access logs, change management, encryption proof)
- OWASP ASVS Level 2 — Application security verification standard compliance
- PCI-DSS scope minimized — Payroll disbursement via bank APIs, no card data stored
- WCAG 2.1 AA — Accessibility compliance required for government contracts in EU/UK/US

### 7.3 HR-Specific International Standards

- ISO 30408: Human Governance — Organizational transparency, workforce metrics reporting
- ISO 30414: HR Reporting — 23 core human capital metrics for ESG/investor reporting
- ISO 10667: Assessment in HR — Structured competency framework for performance module
- ILO Convention 131 (Minimum Wage) — Payroll engine validates against country minimum wage floors
- ILO Convention 1 (Hours of Work) — Overtime alerts when weekly hours exceed ILO limits
- SCORM 2004 / xAPI (Tin Can) — LMS module fully compliant for e-learning content import

### 7.4 Payroll Tax Compliance by Region

| Country | Tax Engine | Statutory Deductions | Reporting Format |
|---------|------------|---------------------|-----------------|
| Bangladesh | Slab-based income tax | PF 10%, Gratuity, BEPZA rules | NBR e-filing XML |
| India | New tax regime + Old regime | PF 12%, ESI 3.25%, PT state-wise | Form 24Q TDS, Form 16 |
| UAE | Tax-free (DEWS) | WPS compliance, End of Service | WPS SIF file format |
| Saudi Arabia | GOSI | GOSI 9.75% employer + employee | GOSI portal CSV export |
| United Kingdom | PAYE (HMRC) | NI, Student Loan, Auto-enroll pension | FPS/EPS RTI submission |
| USA | Federal + State slab | FICA 7.65%, 401k, State income tax | W-2, 941 quarterly filing |
| Singapore | Tiered income tax | CPF 17% employer + 20% employee | CPF e-submission |

---

## 8. Integration Ecosystem

### 8.1 Native Integrations (Launch Tier)

| Category | Integration | Purpose |
|----------|-------------|---------|
| Accounting | QuickBooks, Xero, SAP (REST) | Auto-post payroll GL journal entries |
| Calendar | Google Calendar, Microsoft 365 | Leave & interview meeting sync |
| Payroll Bank | Stripe Payouts, local bank SFTP | Salary disbursement automation |
| Communication | Slack, MS Teams, WhatsApp | Approval notifications, ESS chatbot |
| Video Interview | Zoom, Google Meet, MS Teams | Interview scheduler link generation |
| Job Boards | LinkedIn, Indeed, Naukri, Bayt | Automatic job posting & inbound sync |
| Background Check | Checkr, AuthBridge (India) | Pre-employment verification |
| ERP | SAP HCM, Oracle HCM (REST) | Bi-directional employee data sync |
| Document Sign | DocuSign, Adobe Sign | Contract & offer letter e-signature |
| Biometric | ZKTeco, Hikvision (SDK) | Attendance punch data import/sync |

### 8.2 Integration Architecture

- All integrations use an IntegrationHub NestJS module with a pluggable adapter pattern
- Each integration adapter implements the IntegrationAdapter interface (connect, sync, webhook)
- OAuth 2.0 token management with encrypted token storage in Supabase
- Webhook receiver endpoint for inbound events from all external systems
- Integration marketplace UI in tenant settings: one-click connect/disconnect

---

## 9. Commercialization & Go-To-Market Strategy

### 9.1 Pricing Model (Per-Employee Per-Month)

Industry-standard PEPM pricing model designed for international SaaS sales. All tiers include hosted infrastructure, automatic compliance updates, and 24/7 API uptime SLA.

| Plan | Target Segment | PEPM (USD) | Modules Included |
|------|---------------|-----------|-----------------|
| Starter | SMEs < 100 employees | $4 – $6 | Core + Payroll + Leave + Attendance + ESS |
| Growth | SMEs 100–500 employees | $8 – $12 | All Starter + ATS + Performance + LMS |
| Enterprise | 500+ / Multinationals | $15 – $25 | Full Suite + Compliance Engine + Custom Integrations |
| White-Label | HR Consultancies / Resellers | Custom (rev-share) | Full Suite + Custom Branding + API Access |

#### COMPETITIVE POSITIONING
BambooHR: $6-9 PEPM · Darwinbox: $3-5 PEPM · HiBob: $8-12 PEPM · Workday: $20-35 PEPM — Target: Darwinbox price + HiBob UX quality = strong international value proposition

### 9.2 Market Entry Priority Sequence

1. **Bangladesh / South Asia** — Home market, BEPZA & RMG industry, lowest regulatory lift to start
2. **GCC (UAE, Saudi Arabia)** — High PEPM potential, WPS-compliance gap, large expat workforce
3. **Southeast Asia (Malaysia, Singapore, Thailand)** — Tech-forward, PDPA-ready, English-speaking
4. **United Kingdom** — PAYE module, IR35 compliance, strong SaaS procurement culture
5. **India** — Massive SME market, PF/ESI/TDS compliance, compete with GreytHR and Keka

### 9.3 White-Label Reseller Package

- Custom domain, logo, and color scheme via Tailwind theme token overrides
- Reseller admin portal to manage all sub-tenants and usage analytics
- API-first: Resellers can build their own frontend on top of the NestJS API
- Revenue share model: 30% commission to reseller on all tenant ARR they originate
- Dedicated reseller documentation portal, Postman collection, and sandbox environment

### 9.4 Trust & Certification Roadmap

- ISO 27001 Certification — Target 12 months post-launch (builds on Supabase's existing ISO 27001)
- SOC 2 Type II Report — Commission via Drata or Vanta (automated evidence collection)
- GDPR DPA Template — Legal template ready for all EU and UK customers at signup
- Annual Penetration Test — External pentest from CREST-accredited firm, report shared with enterprise buyers
- WCAG 2.1 AA Audit — Required for government and public sector contracts in EU/UK/US

---

## 10. Implementation Roadmap

### Phase 1 — Foundation (Months 1–3)

| Sprint | Deliverable | Priority |
|--------|-------------|----------|
| Sprint 1-2 | Project scaffold: NestJS + Supabase multi-tenant setup, RLS policies, JWT auth flow | Critical |
| Sprint 3-4 | Employee Lifecycle module (full CRUD, org chart with ltree, digital contracts) | Critical |
| Sprint 5-6 | Attendance & Leave modules with multi-level approval workflows | Critical |

### Phase 2 — Core Revenue Modules (Months 4–6)

| Sprint | Deliverable | Priority |
|--------|-------------|----------|
| Sprint 7-8 | Payroll Engine v1 (Bangladesh + India + UAE) with BullMQ processing queue | Critical |
| Sprint 9-10 | ESS Portal (Next.js mobile-friendly PWA) + payslip PDF generation | High |
| Sprint 11-12 | Analytics dashboard v1 + payroll GL export to QuickBooks/Xero | High |

### Phase 3 — Growth Modules (Months 7–9)

| Sprint | Deliverable | Priority |
|--------|-------------|----------|
| Sprint 13-14 | Recruitment ATS + LinkedIn/Indeed integration + candidate consent management | High |
| Sprint 15-16 | Performance Management (OKR + 360-degree feedback + calibration tool) | High |
| Sprint 17-18 | LMS module (SCORM 2004 player + certification tracking + skill matrix) | Medium |

### Phase 4 — Enterprise & Compliance (Months 10–12)

| Sprint | Deliverable | Priority |
|--------|-------------|----------|
| Sprint 19-20 | Compliance Engine + GDPR DSR portal + immutable audit trail + breach workflow | Critical |
| Sprint 21-22 | Payroll expansion: UK (PAYE/RTI), Singapore (CPF), USA (Federal + state) | High |
| Sprint 23-24 | White-label reseller portal + API marketplace + developer documentation site | High |

#### TEAM RECOMMENDATION
Minimum team: 2 Full-Stack Devs (Next.js/NestJS), 1 Backend/DB Dev (Supabase/PostgreSQL), 1 UI/UX Designer, 1 QA Engineer, 1 Product Owner. Target: 12-month MVP to market-ready SaaS product.

---

## 11. Technical Appendix

### 11.1 Environment Variables Reference

| Variable | Service | Description |
|----------|---------|-------------|
| SUPABASE_URL | Supabase | Project API URL (from Supabase project settings) |
| SUPABASE_SERVICE_KEY | Supabase | Service role key — server-side only, never expose to client |
| DATABASE_URL | PostgreSQL | Direct connection string for NestJS TypeORM/Prisma |
| REDIS_URL | Redis / BullMQ | BullMQ job queue connection URL |
| JWT_SECRET | Auth | JWT signing secret — 256-bit minimum, rotate every 90 days |
| RESEND_API_KEY | Email | Transactional email delivery via Resend |
| TWILIO_ACCOUNT_SID | SMS / OTP | Twilio for SMS notifications and MFA OTP |
| ANTHROPIC_API_KEY | AI Features | JD generation, chatbot assistant, smart search |
| STRIPE_SECRET_KEY | Billing | SaaS subscription and invoice management |

### 11.2 Key NPM Packages

| Package | Layer | Purpose |
|---------|-------|---------|
| @nestjs/swagger | Backend | OpenAPI 3.1 auto-generation from decorators |
| @nestjs/bull + bullmq | Backend | Background job queues for payroll and notifications |
| zod + nestjs-zod | Backend | Runtime schema validation with TypeScript inference |
| @supabase/supabase-js | Both | Supabase client SDK for auth, DB, storage, realtime |
| next-intl | Frontend | i18n with App Router support and ICU message format |
| @tanstack/react-query | Frontend | Server state management with caching and sync |
| react-hook-form + zod | Frontend | Performant form validation with type safety |
| recharts | Frontend | Composable HR analytics charts and dashboards |
| pdfmake | Backend | Payslip and contract PDF generation |
| date-fns + date-fns-tz | Both | Timezone-aware date handling and formatting |

### 11.3 Production Infrastructure

- **Frontend**: Vercel (Next.js) — CDN edge network, automatic preview deployments per PR
- **Backend API**: Railway or Render (NestJS Docker) — or Kubernetes on AWS EKS / GCP GKE for enterprise
- **Database**: Supabase Cloud (Pro plan minimum) — daily backups, PITR, read replicas
- **Redis**: Upstash Redis (serverless) or Redis Cloud for BullMQ queues
- **Storage**: Supabase Storage (Tigris S3-compatible) — CDN-backed for payslip/document delivery
- **CI/CD**: GitHub Actions — test, lint, build Docker image, deploy with zero-downtime rolling update
- **Monitoring**: Sentry (error tracking) + Better Uptime + Grafana Cloud (metrics & alerts)

---

*This blueprint is a living document — iterate based on customer discovery and market feedback.*

Built for global reach  ·  Next.js · Supabase · NestJS · Tailwind CSS
