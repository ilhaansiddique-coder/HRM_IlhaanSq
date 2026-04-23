import { invokeProtectedFunction } from "@/utils/invokeProtectedFunction";
import { invokeProtectedApi } from "@/utils/invokeProtectedApi";

export interface CustomerWriteData {
  name?: string;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  tags?: string[];
  status?: string;
  additional_info?: string | null;
  credit_limit?: number;
}

export interface CustomerWriteResponse {
  id: string;
  name: string;
}

const isEdgeFunctionUnavailableError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    /failed to send a request to the edge function/i.test(message) ||
    /edge function/i.test(message) && /failed|fetch|network|non-2xx|404|not found/i.test(message)
  );
};

const isApiUnavailableError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    /cannot connect to api/i.test(message) ||
    /failed to fetch/i.test(message) ||
    /api request failed \(404\)/i.test(message) ||
    /cannot post .*customers\/upsert/i.test(message) ||
    /not found/i.test(message)
  );
};

export const upsertCustomerWithServerAccess = async ({
  id,
  data,
}: {
  id?: string;
  data: CustomerWriteData;
}): Promise<CustomerWriteResponse> => {
  const body = {
    id,
    data,
  };

  try {
    return await invokeProtectedApi<CustomerWriteResponse>("/customers/upsert", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (apiError) {
    if (!isApiUnavailableError(apiError)) {
      throw apiError;
    }
  }

  try {
    return await invokeProtectedFunction<CustomerWriteResponse>("customer-upsert", {
      body,
    });
  } catch (edgeError) {
    if (!isEdgeFunctionUnavailableError(edgeError)) {
      throw edgeError;
    }

    throw new Error(
      "Customer write service is unavailable. Start the API server or deploy the customer-upsert function.",
    );
  }
};
