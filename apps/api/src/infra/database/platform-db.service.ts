import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool, type PoolConfig } from "pg";

@Injectable()
export class PlatformDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformDbService.name);
  private pool: Pool | null;
  private activeConnectionString: string | null;
  private readonly resolvedConnectionSource:
    | "PLATFORM_DATABASE_URL"
    | "PLATFORM_DATABASE_POOLER_URL"
    | "DATABASE_URL"
    | "SUPABASE_DB_URL"
    | null;
  private isConnectivityValidated = false;

  constructor(private readonly configService: ConfigService) {
    const connectionCandidates = [
      {
        key: "PLATFORM_DATABASE_URL" as const,
        value: this.configService.get<string>("PLATFORM_DATABASE_URL") ?? "",
      },
      {
        key: "PLATFORM_DATABASE_POOLER_URL" as const,
        value: this.configService.get<string>("PLATFORM_DATABASE_POOLER_URL") ?? "",
      },
      {
        key: "DATABASE_URL" as const,
        value: this.configService.get<string>("DATABASE_URL") ?? "",
      },
      {
        key: "SUPABASE_DB_URL" as const,
        value: this.configService.get<string>("SUPABASE_DB_URL") ?? "",
      },
    ];
    const selectedCandidate = connectionCandidates.find((entry) => Boolean(entry.value.trim()));
    const connectionString = this.normalizeConnectionString(selectedCandidate?.value?.trim() ?? "");
    this.resolvedConnectionSource = selectedCandidate?.key ?? null;
    this.activeConnectionString = connectionString || null;
    this.pool = this.createPool(connectionString || null);
  }

  private buildPoolConfig(
    connectionString: string,
    overrides: Partial<Pick<PoolConfig, "max" | "idleTimeoutMillis" | "connectionTimeoutMillis">> = {},
  ): PoolConfig {
    const config: PoolConfig = {
      connectionString,
      max: overrides.max ?? 20,
      idleTimeoutMillis: overrides.idleTimeoutMillis ?? 30_000,
      connectionTimeoutMillis: overrides.connectionTimeoutMillis ?? 5_000,
    };

    try {
      const parsed = new URL(connectionString);
      const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
      if (sslMode === "no-verify") {
        config.ssl = { rejectUnauthorized: false };
      } else if (sslMode === "disable") {
        config.ssl = false;
      }
    } catch {
      // Keep the raw connection string behavior if URL parsing fails.
    }

    return config;
  }

  private createPool(connectionString: string | null): Pool | null {
    return connectionString
      ? new Pool(this.buildPoolConfig(connectionString))
      : null;
  }

  private parseBooleanEnv(rawValue: string | undefined, defaultValue: boolean): boolean {
    if (rawValue === undefined) return defaultValue;
    const normalized = rawValue.trim().toLowerCase();
    if (!normalized) return defaultValue;
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return defaultValue;
  }

  private shouldAttemptSupabasePoolerFallback(error: unknown): boolean {
    const enabled = this.parseBooleanEnv(
      this.configService.get<string>("PLATFORM_DATABASE_ENABLE_POOLER_FALLBACK"),
      true,
    );
    if (!enabled) return false;

    const message = String(error instanceof Error ? error.message : error).toLowerCase();
    return message.includes("enotfound") || message.includes("eai_again") || message.includes("getaddrinfo");
  }

  private buildSupabasePoolerFallbacks(connectionString: string): string[] {
    try {
      const parsed = new URL(connectionString);
      const match = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
      if (!match) {
        return [];
      }

      const projectRef = match[1];
      const baseUser = parsed.username || "postgres";
      const poolerUser = baseUser.endsWith(`.${projectRef}`) ? baseUser : `${baseUser}.${projectRef}`;

      const regions = [
        "ap-south-1",
        "ap-southeast-1",
        "ap-southeast-2",
        "ap-northeast-1",
        "ap-northeast-2",
        "eu-central-1",
        "eu-central-2",
        "eu-west-1",
        "eu-west-2",
        "eu-north-1",
        "us-east-1",
        "us-west-1",
        "us-west-2",
        "ca-central-1",
        "sa-east-1",
      ];
      const poolerPrefixes = ["aws-0", "aws-1"];

      const candidates = poolerPrefixes.flatMap((prefix) =>
        regions.map((region) => {
          const candidate = new URL(connectionString);
          candidate.hostname = `${prefix}-${region}.pooler.supabase.com`;
          candidate.port = "6543";
          candidate.username = poolerUser;
          if (!candidate.searchParams.get("sslmode")) {
            candidate.searchParams.set("sslmode", "require");
          }
          return this.normalizeConnectionString(candidate.toString());
        }),
      );

      return Array.from(new Set(candidates));
    } catch {
      return [];
    }
  }

  private async trySupabasePoolerFallback(): Promise<boolean> {
    if (!this.activeConnectionString) {
      return false;
    }

    const fallbackCandidates = this.buildSupabasePoolerFallbacks(this.activeConnectionString);
    if (!fallbackCandidates.length) {
      return false;
    }

    this.logger.warn(
      `Attempting Supabase pooler fallback for platform DB (${fallbackCandidates.length} regional hosts).`,
    );

    let authFailureHost: string | null = null;
    for (const candidateConnectionString of fallbackCandidates) {
      const probePool = new Pool(
        this.buildPoolConfig(candidateConnectionString, {
          max: 1,
          idleTimeoutMillis: 5_000,
          connectionTimeoutMillis: 3_000,
        }),
      );
      const candidateHost = (() => {
        try {
          return new URL(candidateConnectionString).hostname;
        } catch {
          return "unknown-host";
        }
      })();
      try {
        const client = await probePool.connect();
        try {
          await client.query("SELECT 1");
        } finally {
          client.release();
        }

        await probePool.end();

        if (this.pool) {
          await this.pool.end().catch(() => undefined);
        }
        this.pool = this.createPool(candidateConnectionString);
        this.activeConnectionString = candidateConnectionString;

        const resolvedHost = new URL(candidateConnectionString).hostname;
        this.logger.log(`Platform DB fallback succeeded using Supabase pooler host '${resolvedHost}'.`);
        return true;
      } catch (error) {
        const message = String(error instanceof Error ? error.message : error).toLowerCase();
        if (message.includes("password authentication failed")) {
          authFailureHost = candidateHost;
        }
        await probePool.end().catch(() => undefined);
      }
    }

    if (authFailureHost) {
      this.logger.error(
        `Supabase pooler fallback reached '${authFailureHost}' but authentication failed. Verify DB password and pooler connection string in PLATFORM_DATABASE_POOLER_URL.`,
      );
    }

    return false;
  }

  private normalizeConnectionString(connectionString: string): string {
    if (!connectionString) {
      return connectionString;
    }

    try {
      const parsed = new URL(connectionString);
      const nodeEnv = (this.configService.get<string>("NODE_ENV") ?? "development").toLowerCase();
      const sslModeOverride = (this.configService.get<string>("PLATFORM_DATABASE_SSL_MODE") ?? "").toLowerCase();
      const allowSelfSignedDev = ["1", "true"].includes(
        (this.configService.get<string>("PLATFORM_DATABASE_ALLOW_SELF_SIGNED_DEV") ?? "").toLowerCase(),
      );
      const allowedSslModes = new Set([
        "disable",
        "allow",
        "prefer",
        "require",
        "verify-ca",
        "verify-full",
        "no-verify",
      ]);

      const envDefaultSslMode =
        nodeEnv === "development"
          ? allowSelfSignedDev
            ? "no-verify"
            : "require"
          : "verify-full";
      const effectiveSslMode = sslModeOverride || envDefaultSslMode;

      if (!allowedSslModes.has(effectiveSslMode)) {
        throw new Error(
          `Invalid PLATFORM_DATABASE_SSL_MODE '${effectiveSslMode}'. Allowed: ${Array.from(allowedSslModes).join(", ")}`,
        );
      }

      if (nodeEnv !== "development" && effectiveSslMode !== "verify-full") {
        throw new Error(
          `In ${nodeEnv}, PLATFORM_DATABASE_SSL_MODE must be 'verify-full'. Current: '${effectiveSslMode}'.`,
        );
      }

      parsed.searchParams.set("sslmode", effectiveSslMode);
      if (nodeEnv === "development" && effectiveSslMode === "no-verify") {
        this.logger.warn(
          "Platform DB SSL mode is set to 'no-verify' for development. Use PLATFORM_DATABASE_ALLOW_SELF_SIGNED_DEV=0 or PLATFORM_DATABASE_SSL_MODE=require to enforce certificate validation locally.",
        );
      }
      return parsed.toString();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid database URL";
      throw new Error(`Invalid platform DB SSL configuration: ${message}`);
    }
  }

  async onModuleInit() {
    if (!this.pool) {
      this.logger.warn(
        "Platform DB URL is not configured. Set PLATFORM_DATABASE_URL (preferred), DATABASE_URL, or SUPABASE_DB_URL.",
      );
      return;
    }

    this.logger.log(`Platform DB configured via ${this.resolvedConnectionSource}.`);

    try {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT 1");
        this.isConnectivityValidated = true;
        this.logger.log("Platform DB connectivity check passed.");
      } finally {
        client.release();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown DB bootstrap error";
      const recovered = this.shouldAttemptSupabasePoolerFallback(error)
        ? await this.trySupabasePoolerFallback()
        : false;
      if (recovered && this.pool) {
        try {
          const client = await this.pool.connect();
          try {
            await client.query("SELECT 1");
            this.isConnectivityValidated = true;
            this.logger.log("Platform DB connectivity check passed after pooler fallback.");
            return;
          } finally {
            client.release();
          }
        } catch {
          // Final error is logged below.
        }
      }
      this.isConnectivityValidated = false;
      this.logger.error(
        `Platform DB connectivity check failed: ${message}. API will continue running, but DB-backed endpoints may return 503.`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  private getPool(): Pool {
    if (!this.pool) {
      throw new ServiceUnavailableException(
        "Platform DB is not configured. Set PLATFORM_DATABASE_URL (preferred), DATABASE_URL, or SUPABASE_DB_URL.",
      );
    }

    return this.pool;
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      const { rows } = await this.getPool().query(sql, params);
      this.isConnectivityValidated = true;
      return rows as T[];
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown DB query error";
      const normalizedMessage = message.toLowerCase();
      const connectivityError =
        normalizedMessage.includes("self-signed certificate") ||
        normalizedMessage.includes("password authentication failed") ||
        normalizedMessage.includes("connection terminated") ||
        normalizedMessage.includes("enotfound") ||
        normalizedMessage.includes("eai_again") ||
        normalizedMessage.includes("connect") ||
        normalizedMessage.includes("timeout");

      if (connectivityError || !this.isConnectivityValidated) {
        throw new ServiceUnavailableException(
          `Platform DB is unavailable. Verify PLATFORM_DATABASE_URL and SSL settings. Details: ${message}`,
        );
      }

      throw error;
    }
  }

  async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }
}
