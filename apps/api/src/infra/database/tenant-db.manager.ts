import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool, PoolClient } from "pg";

import { PlatformDbService } from "./platform-db.service";

export interface TenantRegistryRecord {
  tenant_id: string;
  slug: string;
  name: string;
  status: string;
  role: string;
  db_key: string;
  db_host: string;
  db_port: number;
  db_name: string;
  db_user: string;
  db_password_ciphertext: string;
  db_status: string;
}

type SecretProvider = "plaintext" | "http_kms";

@Injectable()
export class TenantDbManager {
  private readonly logger = new Logger(TenantDbManager.name);
  private readonly pools = new Map<string, Pool>();
  private readonly poolCreationPromises = new Map<string, Promise<Pool>>();
  private readonly secretProvider: SecretProvider;
  private readonly decryptUrl: string;
  private readonly decryptAuthToken: string;
  private readonly decryptTimeoutMs: number;
  private readonly nodeEnv: string;

  constructor(
    private readonly platformDb: PlatformDbService,
    private readonly configService: ConfigService,
  ) {
    this.nodeEnv = (this.configService.get<string>("NODE_ENV") ?? "development").toLowerCase();
    this.decryptUrl = (this.configService.get<string>("TENANT_DB_DECRYPT_URL") ?? "").trim();
    this.decryptAuthToken = (this.configService.get<string>("TENANT_DB_DECRYPT_AUTH_TOKEN") ?? "").trim();
    this.decryptTimeoutMs = Number(this.configService.get<number>("TENANT_DB_DECRYPT_TIMEOUT_MS") ?? 5000);

    const configuredProvider = (this.configService.get<string>("TENANT_DB_SECRET_PROVIDER") ?? "")
      .trim()
      .toLowerCase();
    this.secretProvider = configuredProvider === "http_kms" ? "http_kms" : "plaintext";

    this.assertDecryptorConfiguration();
  }

  private assertDecryptorConfiguration() {
    const isDevelopment = this.nodeEnv === "development";

    if (this.secretProvider === "plaintext") {
      if (!isDevelopment) {
        throw new Error(
          "Tenant DB decryptor is not configured. Set TENANT_DB_SECRET_PROVIDER=http_kms and configure TENANT_DB_DECRYPT_URL/TENANT_DB_DECRYPT_AUTH_TOKEN.",
        );
      }

      this.logger.warn(
        "Using plaintext tenant DB secret provider in development. This mode is forbidden outside development.",
      );
      return;
    }

    if (!this.decryptUrl || !this.decryptAuthToken) {
      throw new Error(
        "TENANT_DB_SECRET_PROVIDER=http_kms requires TENANT_DB_DECRYPT_URL and TENANT_DB_DECRYPT_AUTH_TOKEN.",
      );
    }
  }

  async resolveTenantContext(input: { tenantSlug: string; userId: string }) {
    const membership = await this.platformDb.queryOne<TenantRegistryRecord>(
      `
        SELECT
          t.id AS tenant_id,
          t.slug,
          t.name,
          t.status,
          m.role,
          r.db_key,
          r.db_host,
          r.db_port,
          r.db_name,
          r.db_user,
          r.db_password_ciphertext,
          r.db_status
        FROM tenants t
        JOIN tenant_members m ON m.tenant_id = t.id
        JOIN tenant_database_registry r ON r.tenant_id = t.id
        WHERE t.slug = $1
          AND m.user_id = $2
          AND m.status = 'active'
          AND t.deleted_at IS NULL
        LIMIT 1
      `,
      [input.tenantSlug, input.userId],
    );

    if (!membership) {
      throw new UnauthorizedException("Not a member of this tenant");
    }

    if (membership.status !== "active" || membership.db_status !== "active") {
      throw new ForbiddenException("Tenant is suspended or unavailable");
    }

    return membership;
  }

  async withTenantClient<T>(
    registry: TenantRegistryRecord,
    userId: string,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const pool = await this.getOrCreatePool(registry);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId]);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async getOrCreatePool(registry: TenantRegistryRecord): Promise<Pool> {
    if (!registry.db_host || !registry.db_name || !registry.db_user) {
      throw new ServiceUnavailableException("Tenant database registry is incomplete");
    }

    const existingPool = this.pools.get(registry.db_key);
    if (existingPool) {
      return existingPool;
    }

    const existingCreationPromise = this.poolCreationPromises.get(registry.db_key);
    if (existingCreationPromise) {
      return existingCreationPromise;
    }

    const creationPromise = (async () => {
      const decryptedPassword = await this.decryptRegistrySecret(registry.db_password_ciphertext);
      const pool = new Pool({
        host: registry.db_host,
        port: Number(registry.db_port || 5432),
        database: registry.db_name,
        user: registry.db_user,
        password: decryptedPassword,
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      });

      this.pools.set(registry.db_key, pool);
      return pool;
    })();

    this.poolCreationPromises.set(registry.db_key, creationPromise);

    try {
      return await creationPromise;
    } finally {
      this.poolCreationPromises.delete(registry.db_key);
    }
  }

  private async decryptRegistrySecret(ciphertext: string): Promise<string> {
    if (!ciphertext || !ciphertext.trim()) {
      throw new ServiceUnavailableException("Tenant DB password ciphertext is missing");
    }

    if (this.secretProvider === "plaintext") {
      return ciphertext;
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.decryptTimeoutMs);

    try {
      const response = await fetch(this.decryptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.decryptAuthToken}`,
        },
        body: JSON.stringify({ ciphertext }),
        signal: abortController.signal,
      });

      const body = (await response.json().catch(() => ({}))) as {
        plaintext?: string;
        value?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new ServiceUnavailableException(
          body.error || "Tenant DB secret decrypt request failed",
        );
      }

      const plaintext = String(body.plaintext ?? body.value ?? "").trim();
      if (!plaintext) {
        throw new ServiceUnavailableException("Tenant DB secret provider returned an empty plaintext");
      }

      return plaintext;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Unknown decrypt error";
      throw new ServiceUnavailableException(
        `Tenant DB secret decryption failed. Verify KMS provider configuration. Details: ${message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
