import { supabase } from "@/integrations/supabase/client";

export interface InvoiceWebhookData {
  invoice_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  sale_date: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  payment_status: string;
  courier_status: string;
  notes?: string;
}

export interface SystemSettings {
  invoice_webhook_url?: string;
  invoice_webhook_enabled?: boolean;
  invoice_webhook_auth_token?: string;
  invoice_webhook_timeout?: number;
}

interface InvoiceSaleRecord {
  id: string;
  invoice_number: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  created_at: string;
  subtotal?: number | null;
  tax_amount?: number | null;
  discount_amount?: number | null;
  grand_total?: number | null;
  payment_status?: string | null;
  courier_status?: string | null;
  notes?: string | null;
}

interface InvoiceCustomerRecord {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface InvoiceSaleItemRecord {
  product_name?: string | null;
  quantity?: number | null;
  rate?: number | null;
  sale_price?: number | null;
  total?: number | null;
}

/**
 * Get system settings for invoice webhook
 */
export async function getInvoiceWebhookSettings(): Promise<SystemSettings | null> {
  try {
    let query = supabase
      .from("system_settings")
      .select("invoice_webhook_url, invoice_webhook_enabled, invoice_webhook_auth_token, invoice_webhook_timeout");

    const { data: tenantId } = await (supabase as any).rpc("current_tenant_id");
    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Error fetching invoice webhook settings:", error);
      return null;
    }

    return data ?? null;
  } catch (error) {
    console.error("Error fetching invoice webhook settings:", error);
    return null;
  }
}

/**
 * Send invoice data to external webhook
 */
export async function sendInvoiceWebhook(invoiceData: InvoiceWebhookData): Promise<{ success: boolean; error?: string }> {
  try {
    // Get webhook settings
    const settings = await getInvoiceWebhookSettings();
    
    if (!settings?.invoice_webhook_enabled || !settings.invoice_webhook_url) {
      console.log("Invoice webhook is disabled or URL not configured");
      return { success: true }; // Not an error, just not configured
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication token if provided
    if (settings.invoice_webhook_auth_token) {
      headers['Authorization'] = `Bearer ${settings.invoice_webhook_auth_token}`;
    }

    // Set timeout
    const timeout = Math.max(5, Math.min(120, settings.invoice_webhook_timeout || 30)) * 1000;

    // Send webhook request
    const response = await fetch(settings.invoice_webhook_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(invoiceData),
      signal: AbortSignal.timeout(timeout)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log("Invoice webhook sent successfully");
    return { success: true };

  } catch (error: unknown) {
    const resolvedError = error instanceof Error ? error : new Error(String(error ?? "Unknown webhook error"));
    console.error("Error sending invoice webhook:", error);
    
    // Don't throw error to prevent breaking the sale creation process
    // Just log it and return failure
    return { 
      success: false, 
      error: resolvedError.name === 'AbortError' 
        ? 'Webhook timeout - request took too long to respond'
        : resolvedError.message || 'Unknown webhook error'
    };
  }
}

/**
 * Prepare invoice data from sale and related data
 */
export async function prepareInvoiceData(saleId: string): Promise<InvoiceWebhookData | null> {
  try {
    // Get sale data
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        id,
        invoice_number,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        created_at,
        subtotal,
        tax_amount,
        discount_amount,
        grand_total,
        payment_status,
        courier_status,
        notes
      `)
      .eq('id', saleId)
      .single();

    if (saleError || !sale) {
      console.error("Error fetching sale data:", saleError);
      return null;
    }

    let customer: InvoiceCustomerRecord | null = null;
    const saleRecord = sale as InvoiceSaleRecord;

    if (saleRecord.customer_id) {
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("name, phone, email")
        .eq("id", saleRecord.customer_id)
        .maybeSingle();

      if (customerError) {
        console.warn("Error fetching customer data for invoice webhook:", customerError);
      } else {
        customer = (customerData as InvoiceCustomerRecord | null) ?? null;
      }
    }

    // Get sale items
    const { data: saleItems, error: itemsError } = await supabase
      .from('sales_items')
      .select("product_name, quantity, rate, sale_price, total")
      .eq('sale_id', saleId);

    if (itemsError) {
      console.error("Error fetching sale items:", itemsError);
      return null;
    }

    // Prepare items data
    const items = ((saleItems || []) as InvoiceSaleItemRecord[]).map(item => {
      const unitPrice =
        item.sale_price !== null && item.sale_price !== undefined
          ? Number(item.sale_price) || 0
          : Number(item.rate) || 0;
      const quantity = Number(item.quantity) || 0;

      return {
        product_name: item.product_name || 'Unknown Product',
        quantity,
        unit_price: unitPrice,
        total_price: Number(item.total) || quantity * unitPrice,
      };
    });

    // Prepare invoice data
    const invoiceData: InvoiceWebhookData = {
      invoice_number: saleRecord.invoice_number,
      customer_name: customer?.name || saleRecord.customer_name || 'Unknown Customer',
      customer_phone: customer?.phone || saleRecord.customer_phone || undefined,
      customer_email: customer?.email || saleRecord.customer_email || undefined,
      sale_date: saleRecord.created_at,
      items,
      subtotal: Number(saleRecord.subtotal) || 0,
      tax_amount: Number(saleRecord.tax_amount) || 0,
      discount_amount: Number(saleRecord.discount_amount) || 0,
      grand_total: Number(saleRecord.grand_total) || 0,
      payment_status: saleRecord.payment_status || 'pending',
      courier_status: saleRecord.courier_status || 'not_sent',
      notes: saleRecord.notes || undefined,
    };

    return invoiceData;

  } catch (error) {
    console.error("Error preparing invoice data:", error);
    return null;
  }
}

