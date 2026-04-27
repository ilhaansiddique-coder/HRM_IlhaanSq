# Prisma Migrations Workflow

This project uses **Prisma Migrations** as the source of truth for schema
changes. Every edit to `prisma/schema.prisma` produces a migration file
in `prisma/migrations/`, and Vercel applies pending migrations on every
deploy via `prisma migrate deploy`.

The repo contains a baseline migration (`prisma/migrations/0_init/`)
that mirrors the current schema. Production and any other existing
database must be marked as having that baseline already applied — see
**Step 2** below — before the workflow starts running automatically.

---

## One-time setup (do this once, in order)

### Step 1 — Fix production schema drift

Production is currently missing several columns and a table the
schema declares. Apply the schema manually:

```bash
# Use the production DATABASE_URL from Vercel → Settings → Environment Variables
DATABASE_URL="<paste-prod-url>" npx prisma db push
```

Read every prompt carefully. Accept additions; **say no** to any
"column will be lost" warnings (none expected, but verify).

### Step 2 — Baseline production into the migrations history

Tell Prisma that `0_init` is already applied on production (don't run
it again — every `CREATE TABLE` would collide):

```bash
DATABASE_URL="<paste-prod-url>" npx prisma migrate resolve --applied 0_init
```

This creates the `_prisma_migrations` tracking table and records
`0_init` as applied without executing the SQL.

### Step 3 — Repeat Step 2 for any other environment

If you have a staging DB or a teammate's local DB that already has the
schema, mark `0_init` applied there too. **Empty/fresh databases skip
this step** — `prisma migrate deploy` will run `0_init` against them
normally.

### Step 4 — Wire `migrate deploy` into the build

Once production is baselined, update `package.json`:

```diff
-    "build": "next build",
+    "build": "prisma migrate deploy && next build",
```

Commit and push. From now on, every Vercel build applies any pending
migrations *before* compiling Next, so schema and code stay in sync.

> **Vercel env vars**: `DATABASE_URL` (or whichever fallback the repo
> resolves — see [`lib/server-env.ts`](lib/server-env.ts)) must be set
> for the **Build** step, not just runtime. It already is, since the
> `postinstall` hook runs `prisma generate` against it.

---

## Day-to-day workflow

### Editing the schema

```bash
# 1. Edit prisma/schema.prisma — add a column, table, index, etc.
# 2. Generate a migration locally and run it against your dev DB:
npx prisma migrate dev --name add_foo_to_bar

# 3. Review the generated SQL in prisma/migrations/<timestamp>_add_foo_to_bar/
# 4. Commit the schema + the new migration folder together.
# 5. Push. Vercel runs `prisma migrate deploy` on the next build, which
#    applies your migration to production.
```

### Resetting a dev database

```bash
# Wipes local DB and re-runs every migration from scratch. Never run
# this against production.
npx prisma migrate reset
```

### Inspecting drift

```bash
# Shows what would change if you ran a migration right now.
# Useful for catching "I forgot to commit a migration" before pushing.
npx prisma migrate status
```

---

## What changed in this commit

- `prisma/migrations/0_init/migration.sql` — full SQL to recreate the
  current schema from an empty database.
- `prisma/migrations/migration_lock.toml` — Prisma's provider lock; do
  not edit.
- This file (`MIGRATIONS.md`) — the workflow guide.

The build script in `package.json` is **not** changed yet. Update it
in **Step 4** above, after baselining production.
