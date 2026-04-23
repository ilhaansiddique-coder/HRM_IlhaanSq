import { invokeProtectedApi } from "@/utils/invokeProtectedApi";

export interface SaleServerCreatePayload {
  sale: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  paymentSplits?: Array<{ method: string; amount: number }>;
}

const parseApiError = (error: unknown): { message: string; statusCode?: number } => {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");

  try {
    const parsed = JSON.parse(rawMessage) as {
      message?: string;
      error?: string;
      statusCode?: number;
    };

    return {
      message:
        String(parsed.message ?? "").trim() ||
        String(parsed.error ?? "").trim() ||
        rawMessage,
      statusCode: parsed.statusCode,
    };
  } catch {
    return { message: rawMessage };
  }
};

export const isSaleApiUnavailableError = (error: unknown): boolean => {
  const parsed = parseApiError(error);
  const statusCode =
    typeof (error as { statusCode?: unknown } | null)?.statusCode === "number"
      ? ((error as { statusCode?: number }).statusCode ?? parsed.statusCode)
      : parsed.statusCode;
  return (
    statusCode === 404 ||
    statusCode === 503 ||
    /cannot connect to api/i.test(parsed.message) ||
    /failed to fetch/i.test(parsed.message) ||
    /service unavailable/i.test(parsed.message) ||
    /not found/i.test(parsed.message)
  );
};

export const createSaleWithServerAccess = async (
  payload: SaleServerCreatePayload,
): Promise<Record<string, unknown>> => {
  try {
    return await invokeProtectedApi<Record<string, unknown>>("/sales/create", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const parsed = parseApiError(error);
    const nextError = new Error(parsed.message) as Error & { statusCode?: number };
    nextError.statusCode = parsed.statusCode;
    throw nextError;
  }
};
