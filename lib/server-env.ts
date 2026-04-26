const DATABASE_URL_CANDIDATES = [
  "DATABASE_URL",
  "PLATFORM_DATABASE_POOLER_URL",
  "PLATFORM_DATABASE_URL",
  "SUPABASE_DB_URL",
] as const;

export type DatabaseUrlSource = (typeof DATABASE_URL_CANDIDATES)[number];

export function resolveDatabaseUrl(): {
  connectionString: string | null;
  source: DatabaseUrlSource | null;
} {
  for (const source of DATABASE_URL_CANDIDATES) {
    const connectionString = process.env[source]?.trim();
    if (connectionString) {
      return { connectionString, source };
    }
  }

  return { connectionString: null, source: null };
}
