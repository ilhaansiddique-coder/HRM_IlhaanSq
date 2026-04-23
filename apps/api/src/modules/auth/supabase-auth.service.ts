import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseAuthService {
  private readonly supabase;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>("SUPABASE_URL") ?? "";
    const serviceRoleKey = this.configService.get<string>("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      this.supabase = null;
      return;
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async verifyAccessToken(accessToken: string) {
    if (!this.supabase) {
      throw new ServiceUnavailableException("Supabase auth is not configured");
    }

    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser(accessToken);

    if (error || !user) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    return {
      id: user.id,
      email: user.email ?? null,
      app_metadata: user.app_metadata ?? {},
      user_metadata: user.user_metadata ?? {},
    };
  }
}
