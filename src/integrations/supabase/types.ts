export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      "activity_logs": {
        Row: {
          "action": string
          "created_at": string
          "details": Json | null
          "entity_id": string | null
          "entity_type": string
          "id": string
          "summary": string | null
          "tenant_id": string
          "user_id": string | null
        
        }
        Insert: {
          "action"?: string | null
          "created_at"?: string | null
          "details"?: Json | null
          "entity_id"?: string | null
          "entity_type"?: string | null
          "id"?: string | null
          "summary"?: string | null
          "tenant_id"?: string | null
          "user_id"?: string | null
        
        }
        Update: {
          "action"?: string | null
          "created_at"?: string | null
          "details"?: Json | null
          "entity_id"?: string | null
          "entity_type"?: string | null
          "id"?: string | null
          "summary"?: string | null
          "tenant_id"?: string | null
          "user_id"?: string | null
        
        }
        Relationships: []
      }
      "auto_refresh_runs": {
        Row: {
          "completed_at": string | null
          "created_at": string
          "error_message": string | null
          "failed_updates": number | null
          "id": string
          "started_at": string
          "success": boolean | null
          "successful_updates": number | null
          "tenant_id": string
          "total_orders": number | null
        
        }
        Insert: {
          "completed_at"?: string | null
          "created_at"?: string | null
          "error_message"?: string | null
          "failed_updates"?: number | null
          "id"?: string | null
          "started_at"?: string | null
          "success"?: boolean | null
          "successful_updates"?: number | null
          "tenant_id"?: string | null
          "total_orders"?: number | null
        
        }
        Update: {
          "completed_at"?: string | null
          "created_at"?: string | null
          "error_message"?: string | null
          "failed_updates"?: number | null
          "id"?: string | null
          "started_at"?: string | null
          "success"?: boolean | null
          "successful_updates"?: number | null
          "tenant_id"?: string | null
          "total_orders"?: number | null
        
        }
        Relationships: []
      }
      "business_settings": {
        Row: {
          "address": string | null
          "address_line1": string | null
          "address_line2": string | null
          "brand_color": string | null
          "business_hours": string | null
          "business_name": string
          "created_at": string
          "created_by": string | null
          "email": string | null
          "facebook": string | null
          "id": string
          "invoice_count_start": number
          "invoice_footer_message": string | null
          "invoice_prefix": string | null
          "logo_url": string | null
          "low_stock_alert_quantity": number | null
          "phone": string | null
          "primary_email": string | null
          "secondary_email": string | null
          "tagline": string | null
          "tenant_id": string
          "updated_at": string
          "whatsapp": string | null
        
        }
        Insert: {
          "address"?: string | null
          "address_line1"?: string | null
          "address_line2"?: string | null
          "brand_color"?: string | null
          "business_hours"?: string | null
          "business_name"?: string | null
          "created_at"?: string | null
          "created_by"?: string | null
          "email"?: string | null
          "facebook"?: string | null
          "id"?: string | null
          "invoice_count_start"?: number | null
          "invoice_footer_message"?: string | null
          "invoice_prefix"?: string | null
          "logo_url"?: string | null
          "low_stock_alert_quantity"?: number | null
          "phone"?: string | null
          "primary_email"?: string | null
          "secondary_email"?: string | null
          "tagline"?: string | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "whatsapp"?: string | null
        
        }
        Update: {
          "address"?: string | null
          "address_line1"?: string | null
          "address_line2"?: string | null
          "brand_color"?: string | null
          "business_hours"?: string | null
          "business_name"?: string | null
          "created_at"?: string | null
          "created_by"?: string | null
          "email"?: string | null
          "facebook"?: string | null
          "id"?: string | null
          "invoice_count_start"?: number | null
          "invoice_footer_message"?: string | null
          "invoice_prefix"?: string | null
          "logo_url"?: string | null
          "low_stock_alert_quantity"?: number | null
          "phone"?: string | null
          "primary_email"?: string | null
          "secondary_email"?: string | null
          "tagline"?: string | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "whatsapp"?: string | null
        
        }
        Relationships: []
      }
      "courier_payment_rules": {
        Row: {
          "amount_due_behavior": string
          "amount_paid_behavior": string
          "created_at": string
          "payment_status": string
          "restore_inventory": boolean
          "status_key": string
          "tenant_id": string
          "updated_at": string
          "use_backup": boolean
        
        }
        Insert: {
          "amount_due_behavior"?: string | null
          "amount_paid_behavior"?: string | null
          "created_at"?: string | null
          "payment_status"?: string | null
          "restore_inventory"?: boolean | null
          "status_key"?: string | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "use_backup"?: boolean | null
        
        }
        Update: {
          "amount_due_behavior"?: string | null
          "amount_paid_behavior"?: string | null
          "created_at"?: string | null
          "payment_status"?: string | null
          "restore_inventory"?: boolean | null
          "status_key"?: string | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "use_backup"?: boolean | null
        
        }
        Relationships: []
      }
      "courier_status_logs": {
        Row: {
          "created_at": string
          "id": string
          "notes": string | null
          "sale_id": string
          "status": string
          "tenant_id": string
          "updated_at": string
          "updated_by": string | null
        
        }
        Insert: {
          "created_at"?: string | null
          "id"?: string | null
          "notes"?: string | null
          "sale_id": string
          "status": string
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "updated_by"?: string | null
        
        }
        Update: {
          "created_at"?: string | null
          "id"?: string | null
          "notes"?: string | null
          "sale_id"?: string
          "status"?: string
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "updated_by"?: string | null
        
        }
        Relationships: []
      }
      "courier_webhook_settings": {
        Row: {
          "auth_password": string | null
          "auth_username": string | null
          "auto_refresh_enabled": boolean | null
          "auto_refresh_interval_hours": number | null
          "auto_refresh_interval_minutes": number | null
          "created_at": string
          "default_courier": string | null
          "id": string
          "is_active": boolean
          "pathao_access_token": string | null
          "pathao_client_id": string | null
          "pathao_client_secret": string | null
          "pathao_enabled": boolean | null
          "pathao_refresh_token": string | null
          "pathao_store_id": string | null
          "pathao_token_expires_at": string | null
          "status_check_webhook_url": string
          "steadfast_api_key": string | null
          "steadfast_enabled": boolean | null
          "steadfast_secret_key": string | null
          "tenant_id": string
          "updated_at": string
          "webhook_description": string | null
          "webhook_name": string
          "webhook_url": string
        
        }
        Insert: {
          "auth_password"?: string | null
          "auth_username"?: string | null
          "auto_refresh_enabled"?: boolean | null
          "auto_refresh_interval_hours"?: number | null
          "auto_refresh_interval_minutes"?: number | null
          "created_at"?: string | null
          "default_courier"?: string | null
          "id"?: string | null
          "is_active"?: boolean | null
          "pathao_access_token"?: string | null
          "pathao_client_id"?: string | null
          "pathao_client_secret"?: string | null
          "pathao_enabled"?: boolean | null
          "pathao_refresh_token"?: string | null
          "pathao_store_id"?: string | null
          "pathao_token_expires_at"?: string | null
          "status_check_webhook_url"?: string | null
          "steadfast_api_key"?: string | null
          "steadfast_enabled"?: boolean | null
          "steadfast_secret_key"?: string | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "webhook_description"?: string | null
          "webhook_name"?: string | null
          "webhook_url"?: string | null
        
        }
        Update: {
          "auth_password"?: string | null
          "auth_username"?: string | null
          "auto_refresh_enabled"?: boolean | null
          "auto_refresh_interval_hours"?: number | null
          "auto_refresh_interval_minutes"?: number | null
          "created_at"?: string | null
          "default_courier"?: string | null
          "id"?: string | null
          "is_active"?: boolean | null
          "pathao_access_token"?: string | null
          "pathao_client_id"?: string | null
          "pathao_client_secret"?: string | null
          "pathao_enabled"?: boolean | null
          "pathao_refresh_token"?: string | null
          "pathao_store_id"?: string | null
          "pathao_token_expires_at"?: string | null
          "status_check_webhook_url"?: string | null
          "steadfast_api_key"?: string | null
          "steadfast_enabled"?: boolean | null
          "steadfast_secret_key"?: string | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "webhook_description"?: string | null
          "webhook_name"?: string | null
          "webhook_url"?: string | null
        
        }
        Relationships: []
      }
      "custom_settings": {
        Row: {
          "content": string | null
          "created_at": string
          "id": string
          "is_enabled": boolean
          "setting_type": string
          "tenant_id": string
          "updated_at": string
        
        }
        Insert: {
          "content"?: string | null
          "created_at"?: string | null
          "id"?: string | null
          "is_enabled"?: boolean | null
          "setting_type"?: string | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
        
        }
        Update: {
          "content"?: string | null
          "created_at"?: string | null
          "id"?: string | null
          "is_enabled"?: boolean | null
          "setting_type"?: string | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
        
        }
        Relationships: []
      }
      "customers": {
        Row: {
          "additional_info": string | null
          "address": string | null
          "cancelled_count": number | null
          "created_at": string | null
          "created_by": string | null
          "credit_limit": number | null
          "credit_used": number | null
          "deleted_at": string | null
          "delivered_count": number | null
          "email": string | null
          "id": string
          "is_deleted": boolean
          "last_purchase_date": string | null
          "name": string
          "order_count": number | null
          "phone": string | null
          "status": string | null
          "tags": string[] | null
          "tenant_id": string
          "total_spent": number | null
          "updated_at": string | null
          "whatsapp": string | null
        
        }
        Insert: {
          "additional_info"?: string | null
          "address"?: string | null
          "cancelled_count"?: number | null
          "created_at"?: string | null
          "created_by"?: string | null
          "credit_limit"?: number | null
          "credit_used"?: number | null
          "deleted_at"?: string | null
          "delivered_count"?: number | null
          "email"?: string | null
          "id"?: string | null
          "is_deleted"?: boolean | null
          "last_purchase_date"?: string | null
          "name"?: string | null
          "order_count"?: number | null
          "phone"?: string | null
          "status"?: string | null
          "tags"?: string[] | null
          "tenant_id"?: string | null
          "total_spent"?: number | null
          "updated_at"?: string | null
          "whatsapp"?: string | null
        
        }
        Update: {
          "additional_info"?: string | null
          "address"?: string | null
          "cancelled_count"?: number | null
          "created_at"?: string | null
          "created_by"?: string | null
          "credit_limit"?: number | null
          "credit_used"?: number | null
          "deleted_at"?: string | null
          "delivered_count"?: number | null
          "email"?: string | null
          "id"?: string | null
          "is_deleted"?: boolean | null
          "last_purchase_date"?: string | null
          "name"?: string | null
          "order_count"?: number | null
          "phone"?: string | null
          "status"?: string | null
          "tags"?: string[] | null
          "tenant_id"?: string | null
          "total_spent"?: number | null
          "updated_at"?: string | null
          "whatsapp"?: string | null
        
        }
        Relationships: []
      }
      "dismissed_alerts": {
        Row: {
          "alert_id": string
          "created_at": string
          "dismissed_at": string
          "id": string
          "tenant_id": string
          "user_id": string
        
        }
        Insert: {
          "alert_id"?: string | null
          "created_at"?: string | null
          "dismissed_at"?: string | null
          "id"?: string | null
          "tenant_id"?: string | null
          "user_id"?: string | null
        
        }
        Update: {
          "alert_id"?: string | null
          "created_at"?: string | null
          "dismissed_at"?: string | null
          "id"?: string | null
          "tenant_id"?: string | null
          "user_id"?: string | null
        
        }
        Relationships: []
      }
      "inventory_logs": {
        Row: {
          "created_at": string | null
          "created_by": string | null
          "id": string
          "product_id": string
          "quantity": number
          "reason": string | null
          "tenant_id": string
          "type": string
          "variant_id": string | null
        
        }
        Insert: {
          "created_at"?: string | null
          "created_by"?: string | null
          "id"?: string | null
          "product_id"?: string | null
          "quantity"?: number | null
          "reason"?: string | null
          "tenant_id"?: string | null
          "type"?: string | null
          "variant_id"?: string | null
        
        }
        Update: {
          "created_at"?: string | null
          "created_by"?: string | null
          "id"?: string | null
          "product_id"?: string | null
          "quantity"?: number | null
          "reason"?: string | null
          "tenant_id"?: string | null
          "type"?: string | null
          "variant_id"?: string | null
        
        }
        Relationships: []
      }
      "payment_methods": {
        Row: {
          "created_at": string
          "default_paid_behavior": string
          "default_terms": string
          "enabled": boolean
          "fee_type": string
          "fee_value": number | null
          "id": string
          "key": string
          "label": string
          "sort_order": number
          "tenant_id": string
          "type": string
          "updated_at": string
        
        }
        Insert: {
          "created_at"?: string | null
          "default_paid_behavior"?: string | null
          "default_terms"?: string | null
          "enabled"?: boolean | null
          "fee_type"?: string | null
          "fee_value"?: number | null
          "id"?: string | null
          "key"?: string | null
          "label"?: string | null
          "sort_order"?: number | null
          "tenant_id"?: string | null
          "type"?: string | null
          "updated_at"?: string | null
        
        }
        Update: {
          "created_at"?: string | null
          "default_paid_behavior"?: string | null
          "default_terms"?: string | null
          "enabled"?: boolean | null
          "fee_type"?: string | null
          "fee_value"?: number | null
          "id"?: string | null
          "key"?: string | null
          "label"?: string | null
          "sort_order"?: number | null
          "tenant_id"?: string | null
          "type"?: string | null
          "updated_at"?: string | null
        
        }
        Relationships: []
      }
      "product_attribute_values": {
        Row: {
          "attribute_id": string
          "created_at": string
          "id": string
          "tenant_id": string
          "value": string
        
        }
        Insert: {
          "attribute_id"?: string | null
          "created_at"?: string | null
          "id"?: string | null
          "tenant_id"?: string | null
          "value"?: string | null
        
        }
        Update: {
          "attribute_id"?: string | null
          "created_at"?: string | null
          "id"?: string | null
          "tenant_id"?: string | null
          "value"?: string | null
        
        }
        Relationships: []
      }
      "product_attributes": {
        Row: {
          "created_at": string
          "id": string
          "name": string
          "product_id": string
          "tenant_id": string
        
        }
        Insert: {
          "created_at"?: string | null
          "id"?: string | null
          "name"?: string | null
          "product_id"?: string | null
          "tenant_id"?: string | null
        
        }
        Update: {
          "created_at"?: string | null
          "id"?: string | null
          "name"?: string | null
          "product_id"?: string | null
          "tenant_id"?: string | null
        
        }
        Relationships: []
      }
      "product_variants": {
        Row: {
          "attributes": Json
          "cost": number | null
          "created_at": string
          "id": string
          "image_url": string | null
          "last_synced_at": string | null
          "low_stock_threshold": number | null
          "product_id": string
          "rate": number | null
          "sku": string | null
          "stock_quantity": number
          "tenant_id": string
          "updated_at": string
          "woocommerce_connection_id": string | null
          "woocommerce_id": number | null
        
        }
        Insert: {
          "attributes"?: Json | null
          "cost"?: number | null
          "created_at"?: string | null
          "id"?: string | null
          "image_url"?: string | null
          "last_synced_at"?: string | null
          "low_stock_threshold"?: number | null
          "product_id"?: string | null
          "rate"?: number | null
          "sku"?: string | null
          "stock_quantity"?: number | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "woocommerce_connection_id"?: string | null
          "woocommerce_id"?: number | null
        
        }
        Update: {
          "attributes"?: Json | null
          "cost"?: number | null
          "created_at"?: string | null
          "id"?: string | null
          "image_url"?: string | null
          "last_synced_at"?: string | null
          "low_stock_threshold"?: number | null
          "product_id"?: string | null
          "rate"?: number | null
          "sku"?: string | null
          "stock_quantity"?: number | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "woocommerce_connection_id"?: string | null
          "woocommerce_id"?: number | null
        
        }
        Relationships: []
      }
      "products": {
        Row: {
          "color": string | null
          "cost": number | null
          "created_at": string | null
          "created_by": string | null
          "deleted_at": string | null
          "has_variants": boolean
          "id": string
          "image_url": string | null
          "is_deleted": boolean
          "last_synced_at": string | null
          "low_stock_threshold": number | null
          "name": string
          "rate": number
          "size": string | null
          "sku": string | null
          "stock_quantity": number | null
          "tenant_id": string
          "updated_at": string | null
          "woocommerce_connection_id": string | null
          "woocommerce_id": number | null
        
        }
        Insert: {
          "color"?: string | null
          "cost"?: number | null
          "created_at"?: string | null
          "created_by"?: string | null
          "deleted_at"?: string | null
          "has_variants"?: boolean | null
          "id"?: string | null
          "image_url"?: string | null
          "is_deleted"?: boolean | null
          "last_synced_at"?: string | null
          "low_stock_threshold"?: number | null
          "name"?: string | null
          "rate"?: number | null
          "size"?: string | null
          "sku"?: string | null
          "stock_quantity"?: number | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "woocommerce_connection_id"?: string | null
          "woocommerce_id"?: number | null
        
        }
        Update: {
          "color"?: string | null
          "cost"?: number | null
          "created_at"?: string | null
          "created_by"?: string | null
          "deleted_at"?: string | null
          "has_variants"?: boolean | null
          "id"?: string | null
          "image_url"?: string | null
          "is_deleted"?: boolean | null
          "last_synced_at"?: string | null
          "low_stock_threshold"?: number | null
          "name"?: string | null
          "rate"?: number | null
          "size"?: string | null
          "sku"?: string | null
          "stock_quantity"?: number | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "woocommerce_connection_id"?: string | null
          "woocommerce_id"?: number | null
        
        }
        Relationships: []
      }
      "profiles": {
        Row: {
          "created_at": string | null
          "email": string | null
          "full_name": string
          "id": string
          "phone": string | null
          "role": string | null
          "updated_at": string | null
        
        }
        Insert: {
          "created_at"?: string | null
          "email"?: string | null
          "full_name"?: string | null
          "id"?: string | null
          "phone"?: string | null
          "role"?: string | null
          "updated_at"?: string | null
        
        }
        Update: {
          "created_at"?: string | null
          "email"?: string | null
          "full_name"?: string | null
          "id"?: string | null
          "phone"?: string | null
          "role"?: string | null
          "updated_at"?: string | null
        
        }
        Relationships: []
      }
      "reusable_attributes": {
        Row: {
          "created_at": string
          "created_by": string | null
          "display_name": string | null
          "id": string
          "is_required": boolean | null
          "name": string | null
          "options": Json | null
          "sort_order": number | null
          "tenant_id": string
          "type": string | null
          "updated_at": string | null
        
        }
        Insert: {
          "created_at"?: string | null
          "created_by"?: string | null
          "display_name"?: string | null
          "id"?: string | null
          "is_required"?: boolean | null
          "name"?: string | null
          "options"?: Json | null
          "sort_order"?: number | null
          "tenant_id"?: string | null
          "type"?: string | null
          "updated_at"?: string | null
        
        }
        Update: {
          "created_at"?: string | null
          "created_by"?: string | null
          "display_name"?: string | null
          "id"?: string | null
          "is_required"?: boolean | null
          "name"?: string | null
          "options"?: Json | null
          "sort_order"?: number | null
          "tenant_id"?: string | null
          "type"?: string | null
          "updated_at"?: string | null
        
        }
        Relationships: []
      }
      "role_permissions": {
        Row: {
          "allowed": boolean
          "created_at": string
          "id": string
          "permission_key": string
          "role": "admin" | "manager" | "staff" | "sales_associate" | "warehouse" | "store_manager"
          "updated_at": string
        
        }
        Insert: {
          "allowed"?: boolean | null
          "created_at"?: string | null
          "id"?: string | null
          "permission_key"?: string | null
          "role"?: "admin" | "manager" | "staff" | "sales_associate" | "warehouse" | "store_manager" | null
          "updated_at"?: string | null
        
        }
        Update: {
          "allowed"?: boolean | null
          "created_at"?: string | null
          "id"?: string | null
          "permission_key"?: string | null
          "role"?: "admin" | "manager" | "staff" | "sales_associate" | "warehouse" | "store_manager" | null
          "updated_at"?: string | null
        
        }
        Relationships: []
      }
      "sale_items": {
        Row: {
          "created_at": string
          "id": string
          "product_id": string | null
          "product_image_url": string | null
          "product_name": string | null
          "quantity": number
          "sale_id": string
          "tenant_id": string
          "total_price": number
          "unit_price": number
          "updated_at": string | null
          "variant_id": string | null
          "variant_image_url": string | null
        
        }
        Insert: {
          "created_at"?: string | null
          "id"?: string | null
          "product_id"?: string | null
          "product_image_url"?: string | null
          "product_name"?: string | null
          "quantity"?: number | null
          "sale_id"?: string | null
          "tenant_id"?: string | null
          "total_price"?: number | null
          "unit_price"?: number | null
          "updated_at"?: string | null
          "variant_id"?: string | null
          "variant_image_url"?: string | null
        
        }
        Update: {
          "created_at"?: string | null
          "id"?: string | null
          "product_id"?: string | null
          "product_image_url"?: string | null
          "product_name"?: string | null
          "quantity"?: number | null
          "sale_id"?: string | null
          "tenant_id"?: string | null
          "total_price"?: number | null
          "unit_price"?: number | null
          "updated_at"?: string | null
          "variant_id"?: string | null
          "variant_image_url"?: string | null
        
        }
        Relationships: []
      }
      "sale_payments": {
        Row: {
          "amount": number
          "created_at": string
          "id": string
          "method": string
          "sale_id": string
          "tenant_id": string
        
        }
        Insert: {
          "amount"?: number | null
          "created_at"?: string | null
          "id"?: string | null
          "method"?: string | null
          "sale_id"?: string | null
          "tenant_id"?: string | null
        
        }
        Update: {
          "amount"?: number | null
          "created_at"?: string | null
          "id"?: string | null
          "method"?: string | null
          "sale_id"?: string | null
          "tenant_id"?: string | null
        
        }
        Relationships: []
      }
      "sales": {
        Row: {
          "additional_info": string | null
          "amount_due": number | null
          "amount_paid": number | null
          "area": string | null
          "cancelled_at": string | null
          "charge": number
          "city": string | null
          "cn_number": string | null
          "consignment_id": string | null
          "courier_name": string | null
          "courier_notes": string | null
          "courier_status": string | null
          "created_at": string | null
          "created_by": string | null
          "credit_days": number | null
          "customer_address": string | null
          "customer_id": string | null
          "customer_name": string
          "customer_phone": string | null
          "customer_whatsapp": string | null
          "deleted_at": string | null
          "discount_amount": number | null
          "discount_percent": number | null
          "due_date": string | null
          "fee": number | null
          "grand_total": number
          "id": string
          "inventory_restored": boolean
          "invoice_number": string
          "is_deleted": boolean
          "last_status_check": string | null
          "lost_at": string | null
          "merchant_order_id": string | null
          "order_status": string | null
          "order_status_slug": string | null
          "payment_method": string
          "payment_status": string | null
          "payment_terms": "immediate" | "cod" | "credit" | null
          "returned_at": string | null
          "review_amount_due": number | null
          "review_amount_paid": number | null
          "status": string | null
          "status_backup_amount_due": number | null
          "status_backup_amount_paid": number | null
          "status_backup_payment_status": string | null
          "status_changed_at": string | null
          "subtotal": number
          "tenant_id": string
          "total_amount": number | null
          "tracking_code": string | null
          "tracking_number": string | null
          "updated_at": string | null
          "webhook_updated_at": string | null
          "zone": string | null
        
        }
        Insert: {
          "additional_info"?: string | null
          "amount_due"?: number | null
          "amount_paid"?: number | null
          "area"?: string | null
          "cancelled_at"?: string | null
          "charge"?: number | null
          "city"?: string | null
          "cn_number"?: string | null
          "consignment_id"?: string | null
          "courier_name"?: string | null
          "courier_notes"?: string | null
          "courier_status"?: string | null
          "created_at"?: string | null
          "created_by"?: string | null
          "credit_days"?: number | null
          "customer_address"?: string | null
          "customer_id"?: string | null
          "customer_name"?: string | null
          "customer_phone"?: string | null
          "customer_whatsapp"?: string | null
          "deleted_at"?: string | null
          "discount_amount"?: number | null
          "discount_percent"?: number | null
          "due_date"?: string | null
          "fee"?: number | null
          "grand_total"?: number | null
          "id"?: string | null
          "inventory_restored"?: boolean | null
          "invoice_number"?: string | null
          "is_deleted"?: boolean | null
          "last_status_check"?: string | null
          "lost_at"?: string | null
          "merchant_order_id"?: string | null
          "order_status"?: string | null
          "order_status_slug"?: string | null
          "payment_method"?: string | null
          "payment_status"?: string | null
          "payment_terms"?: "immediate" | "cod" | "credit" | null
          "returned_at"?: string | null
          "review_amount_due"?: number | null
          "review_amount_paid"?: number | null
          "status"?: string | null
          "status_backup_amount_due"?: number | null
          "status_backup_amount_paid"?: number | null
          "status_backup_payment_status"?: string | null
          "status_changed_at"?: string | null
          "subtotal"?: number | null
          "tenant_id"?: string | null
          "total_amount"?: number | null
          "tracking_code"?: string | null
          "tracking_number"?: string | null
          "updated_at"?: string | null
          "webhook_updated_at"?: string | null
          "zone"?: string | null
        
        }
        Update: {
          "additional_info"?: string | null
          "amount_due"?: number | null
          "amount_paid"?: number | null
          "area"?: string | null
          "cancelled_at"?: string | null
          "charge"?: number | null
          "city"?: string | null
          "cn_number"?: string | null
          "consignment_id"?: string | null
          "courier_name"?: string | null
          "courier_notes"?: string | null
          "courier_status"?: string | null
          "created_at"?: string | null
          "created_by"?: string | null
          "credit_days"?: number | null
          "customer_address"?: string | null
          "customer_id"?: string | null
          "customer_name"?: string | null
          "customer_phone"?: string | null
          "customer_whatsapp"?: string | null
          "deleted_at"?: string | null
          "discount_amount"?: number | null
          "discount_percent"?: number | null
          "due_date"?: string | null
          "fee"?: number | null
          "grand_total"?: number | null
          "id"?: string | null
          "inventory_restored"?: boolean | null
          "invoice_number"?: string | null
          "is_deleted"?: boolean | null
          "last_status_check"?: string | null
          "lost_at"?: string | null
          "merchant_order_id"?: string | null
          "order_status"?: string | null
          "order_status_slug"?: string | null
          "payment_method"?: string | null
          "payment_status"?: string | null
          "payment_terms"?: "immediate" | "cod" | "credit" | null
          "returned_at"?: string | null
          "review_amount_due"?: number | null
          "review_amount_paid"?: number | null
          "status"?: string | null
          "status_backup_amount_due"?: number | null
          "status_backup_amount_paid"?: number | null
          "status_backup_payment_status"?: string | null
          "status_changed_at"?: string | null
          "subtotal"?: number | null
          "tenant_id"?: string | null
          "total_amount"?: number | null
          "tracking_code"?: string | null
          "tracking_number"?: string | null
          "updated_at"?: string | null
          "webhook_updated_at"?: string | null
          "zone"?: string | null
        
        }
        Relationships: []
      }
      "sales_items": {
        Row: {
          "created_at": string | null
          "id": string
          "product_id": string | null
          "product_image_url": string | null
          "product_name": string
          "quantity": number
          "rate": number
          "sale_id": string
          "sale_price": number | null
          "tenant_id": string
          "total": number
          "variant_id": string | null
          "variant_image_url": string | null
        
        }
        Insert: {
          "created_at"?: string | null
          "id"?: string | null
          "product_id"?: string | null
          "product_image_url"?: string | null
          "product_name"?: string | null
          "quantity"?: number | null
          "rate"?: number | null
          "sale_id"?: string | null
          "sale_price"?: number | null
          "tenant_id"?: string | null
          "total"?: number | null
          "variant_id"?: string | null
          "variant_image_url"?: string | null
        
        }
        Update: {
          "created_at"?: string | null
          "id"?: string | null
          "product_id"?: string | null
          "product_image_url"?: string | null
          "product_name"?: string | null
          "quantity"?: number | null
          "rate"?: number | null
          "sale_id"?: string | null
          "sale_price"?: number | null
          "tenant_id"?: string | null
          "total"?: number | null
          "variant_id"?: string | null
          "variant_image_url"?: string | null
        
        }
        Relationships: []
      }
      "security_audit_log": {
        Row: {
          "action": string
          "created_at": string
          "id": string
          "ip_address": string | null
          "new_values": Json | null
          "old_values": Json | null
          "record_id": string | null
          "table_name": string | null
          "user_agent": string | null
          "user_id": string | null
        
        }
        Insert: {
          "action"?: string | null
          "created_at"?: string | null
          "id"?: string | null
          "ip_address"?: string | null
          "new_values"?: Json | null
          "old_values"?: Json | null
          "record_id"?: string | null
          "table_name"?: string | null
          "user_agent"?: string | null
          "user_id"?: string | null
        
        }
        Update: {
          "action"?: string | null
          "created_at"?: string | null
          "id"?: string | null
          "ip_address"?: string | null
          "new_values"?: Json | null
          "old_values"?: Json | null
          "record_id"?: string | null
          "table_name"?: string | null
          "user_agent"?: string | null
          "user_id"?: string | null
        
        }
        Relationships: []
      }
      "security_audit_logs": {
        Row: {
          "action": string
          "created_at": string | null
          "id": string
          "ip_address": string | null
          "record_id": string | null
          "table_name": string
          "user_agent": string | null
          "user_id": string | null
        
        }
        Insert: {
          "action"?: string | null
          "created_at"?: string | null
          "id"?: string | null
          "ip_address"?: string | null
          "record_id"?: string | null
          "table_name"?: string | null
          "user_agent"?: string | null
          "user_id"?: string | null
        
        }
        Update: {
          "action"?: string | null
          "created_at"?: string | null
          "id"?: string | null
          "ip_address"?: string | null
          "record_id"?: string | null
          "table_name"?: string | null
          "user_agent"?: string | null
          "user_id"?: string | null
        
        }
        Relationships: []
      }
      "system_settings": {
        Row: {
          "created_at": string
          "currency_code": string | null
          "currency_symbol": string | null
          "date_format": string | null
          "id": string
          "tenant_id": string
          "time_format": string | null
          "timezone": string | null
          "updated_at": string
        
        }
        Insert: {
          "created_at"?: string | null
          "currency_code"?: string | null
          "currency_symbol"?: string | null
          "date_format"?: string | null
          "id"?: string | null
          "tenant_id"?: string | null
          "time_format"?: string | null
          "timezone"?: string | null
          "updated_at"?: string | null
        
        }
        Update: {
          "created_at"?: string | null
          "currency_code"?: string | null
          "currency_symbol"?: string | null
          "date_format"?: string | null
          "id"?: string | null
          "tenant_id"?: string | null
          "time_format"?: string | null
          "timezone"?: string | null
          "updated_at"?: string | null
        
        }
        Relationships: []
      }
      "tenant_invites": {
        Row: {
          "accepted_at": string | null
          "accepted_by": string | null
          "created_at": string
          "email": string
          "expires_at": string
          "id": string
          "invited_by": string | null
          "role": string
          "tenant_id": string
          "token": string
        
        }
        Insert: {
          "accepted_at"?: string | null
          "accepted_by"?: string | null
          "created_at"?: string | null
          "email"?: string | null
          "expires_at"?: string | null
          "id"?: string | null
          "invited_by"?: string | null
          "role"?: string | null
          "tenant_id"?: string | null
          "token"?: string | null
        
        }
        Update: {
          "accepted_at"?: string | null
          "accepted_by"?: string | null
          "created_at"?: string | null
          "email"?: string | null
          "expires_at"?: string | null
          "id"?: string | null
          "invited_by"?: string | null
          "role"?: string | null
          "tenant_id"?: string | null
          "token"?: string | null
        
        }
        Relationships: []
      }
      "tenant_billing": {
        Row: {
          "cancel_at_period_end": boolean
          "created_at": string
          "current_period_end": string | null
          "id": string
          "plan_key": string
          "status": string
          "stripe_customer_id": string | null
          "stripe_price_id": string | null
          "stripe_subscription_id": string | null
          "tenant_id": string
          "updated_at": string
        
        }
        Insert: {
          "cancel_at_period_end"?: boolean | null
          "created_at"?: string | null
          "current_period_end"?: string | null
          "id"?: string | null
          "plan_key"?: string | null
          "status"?: string | null
          "stripe_customer_id"?: string | null
          "stripe_price_id"?: string | null
          "stripe_subscription_id"?: string | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
        
        }
        Update: {
          "cancel_at_period_end"?: boolean | null
          "created_at"?: string | null
          "current_period_end"?: string | null
          "id"?: string | null
          "plan_key"?: string | null
          "status"?: string | null
          "stripe_customer_id"?: string | null
          "stripe_price_id"?: string | null
          "stripe_subscription_id"?: string | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
        
        }
        Relationships: []
      }
      "tenant_members": {
        Row: {
          "created_at": string
          "id": string
          "invited_by": string | null
          "is_active": boolean
          "is_default": boolean
          "role": string
          "tenant_id": string
          "updated_at": string
          "user_id": string
        
        }
        Insert: {
          "created_at"?: string | null
          "id"?: string | null
          "invited_by"?: string | null
          "is_active"?: boolean | null
          "is_default"?: boolean | null
          "role"?: string | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "user_id"?: string | null
        
        }
        Update: {
          "created_at"?: string | null
          "id"?: string | null
          "invited_by"?: string | null
          "is_active"?: boolean | null
          "is_default"?: boolean | null
          "role"?: string | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "user_id"?: string | null
        
        }
        Relationships: []
      }
      "tenants": {
        Row: {
          "created_at": string
          "created_by": string | null
          "id": string
          "is_active": boolean
          "name": string
          "slug": string
          "updated_at": string
        
        }
        Insert: {
          "created_at"?: string | null
          "created_by"?: string | null
          "id"?: string | null
          "is_active"?: boolean | null
          "name"?: string | null
          "slug"?: string | null
          "updated_at"?: string | null
        
        }
        Update: {
          "created_at"?: string | null
          "created_by"?: string | null
          "id"?: string | null
          "is_active"?: boolean | null
          "name"?: string | null
          "slug"?: string | null
          "updated_at"?: string | null
        
        }
        Relationships: []
      }
      "user_preferences": {
        Row: {
          "compact_view": boolean
          "created_at": string
          "dark_mode": boolean
          "email_notifications": boolean
          "id": string
          "low_stock_alerts": boolean
          "sales_reports": boolean
          "tenant_id": string
          "updated_at": string
          "user_id": string
        
        }
        Insert: {
          "compact_view"?: boolean | null
          "created_at"?: string | null
          "dark_mode"?: boolean | null
          "email_notifications"?: boolean | null
          "id"?: string | null
          "low_stock_alerts"?: boolean | null
          "sales_reports"?: boolean | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "user_id"?: string | null
        
        }
        Update: {
          "compact_view"?: boolean | null
          "created_at"?: string | null
          "dark_mode"?: boolean | null
          "email_notifications"?: boolean | null
          "id"?: string | null
          "low_stock_alerts"?: boolean | null
          "sales_reports"?: boolean | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
          "user_id"?: string | null
        
        }
        Relationships: []
      }
      "user_roles": {
        Row: {
          "created_at": string | null
          "id": string
          "role": "admin" | "manager" | "staff" | "sales_associate" | "warehouse" | "store_manager"
          "updated_at": string | null
          "user_id": string
        
        }
        Insert: {
          "created_at"?: string | null
          "id"?: string | null
          "role"?: "admin" | "manager" | "staff" | "sales_associate" | "warehouse" | "store_manager" | null
          "updated_at"?: string | null
          "user_id"?: string | null
        
        }
        Update: {
          "created_at"?: string | null
          "id"?: string | null
          "role"?: "admin" | "manager" | "staff" | "sales_associate" | "warehouse" | "store_manager" | null
          "updated_at"?: string | null
          "user_id"?: string | null
        
        }
        Relationships: []
      }
      "woocommerce_connections": {
        Row: {
          "consumer_key": string
          "consumer_secret": string
          "created_at": string
          "id": string
          "is_active": boolean
          "last_import_at": string | null
          "site_name": string
          "site_url": string
          "tenant_id": string
          "total_products_imported": number | null
          "updated_at": string
          "user_id": string
        
        }
        Insert: {
          "consumer_key"?: string | null
          "consumer_secret"?: string | null
          "created_at"?: string | null
          "id"?: string | null
          "is_active"?: boolean | null
          "last_import_at"?: string | null
          "site_name"?: string | null
          "site_url"?: string | null
          "tenant_id"?: string | null
          "total_products_imported"?: number | null
          "updated_at"?: string | null
          "user_id"?: string | null
        
        }
        Update: {
          "consumer_key"?: string | null
          "consumer_secret"?: string | null
          "created_at"?: string | null
          "id"?: string | null
          "is_active"?: boolean | null
          "last_import_at"?: string | null
          "site_name"?: string | null
          "site_url"?: string | null
          "tenant_id"?: string | null
          "total_products_imported"?: number | null
          "updated_at"?: string | null
          "user_id"?: string | null
        
        }
        Relationships: []
      }
      "woocommerce_import_logs": {
        Row: {
          "completed_at": string | null
          "connection_id": string
          "created_at": string
          "current_page": number | null
          "error_message": string | null
          "failed_products": number | null
          "id": string
          "imported_products": number | null
          "progress_message": string | null
          "started_at": string
          "status": string
          "tenant_id": string
          "total_pages": number | null
          "total_products": number | null
        
        }
        Insert: {
          "completed_at"?: string | null
          "connection_id"?: string | null
          "created_at"?: string | null
          "current_page"?: number | null
          "error_message"?: string | null
          "failed_products"?: number | null
          "id"?: string | null
          "imported_products"?: number | null
          "progress_message"?: string | null
          "started_at"?: string | null
          "status"?: string | null
          "tenant_id"?: string | null
          "total_pages"?: number | null
          "total_products"?: number | null
        
        }
        Update: {
          "completed_at"?: string | null
          "connection_id"?: string | null
          "created_at"?: string | null
          "current_page"?: number | null
          "error_message"?: string | null
          "failed_products"?: number | null
          "id"?: string | null
          "imported_products"?: number | null
          "progress_message"?: string | null
          "started_at"?: string | null
          "status"?: string | null
          "tenant_id"?: string | null
          "total_pages"?: number | null
          "total_products"?: number | null
        
        }
        Relationships: []
      }
      "woocommerce_sync_logs": {
        Row: {
          "completed_at": string | null
          "connection_id": string
          "error_message": string | null
          "id": string
          "products_created": number | null
          "products_failed": number | null
          "products_updated": number | null
          "started_at": string
          "status": string
          "sync_type": string
          "tenant_id": string
        
        }
        Insert: {
          "completed_at"?: string | null
          "connection_id"?: string | null
          "error_message"?: string | null
          "id"?: string | null
          "products_created"?: number | null
          "products_failed"?: number | null
          "products_updated"?: number | null
          "started_at"?: string | null
          "status"?: string | null
          "sync_type"?: string | null
          "tenant_id"?: string | null
        
        }
        Update: {
          "completed_at"?: string | null
          "connection_id"?: string | null
          "error_message"?: string | null
          "id"?: string | null
          "products_created"?: number | null
          "products_failed"?: number | null
          "products_updated"?: number | null
          "started_at"?: string | null
          "status"?: string | null
          "sync_type"?: string | null
          "tenant_id"?: string | null
        
        }
        Relationships: []
      }
      "woocommerce_sync_schedules": {
        Row: {
          "connection_id": string
          "created_at": string
          "id": string
          "is_active": boolean
          "last_sync_at": string | null
          "next_sync_at": string | null
          "sync_interval_minutes": number
          "sync_time": string | null
          "tenant_id": string
          "updated_at": string
        
        }
        Insert: {
          "connection_id"?: string | null
          "created_at"?: string | null
          "id"?: string | null
          "is_active"?: boolean | null
          "last_sync_at"?: string | null
          "next_sync_at"?: string | null
          "sync_interval_minutes"?: number | null
          "sync_time"?: string | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
        
        }
        Update: {
          "connection_id"?: string | null
          "created_at"?: string | null
          "id"?: string | null
          "is_active"?: boolean | null
          "last_sync_at"?: string | null
          "next_sync_at"?: string | null
          "sync_interval_minutes"?: number | null
          "sync_time"?: string | null
          "tenant_id"?: string | null
          "updated_at"?: string | null
        
        }
        Relationships: []
      }
    }
    Views: {
      "activity_logs_view": {
        Row: {
          "action": string | null
          "created_at": string | null
          "details": Json | null
          "email": string | null
          "entity_id": string | null
          "entity_type": string | null
          "full_name": string | null
          "id": string | null
          "summary": string | null
          "tenant_id": string | null
          "user_id": string | null
        
        }
        Insert: {
          "action"?: string | null
          "created_at"?: string | null
          "details"?: Json | null
          "email"?: string | null
          "entity_id"?: string | null
          "entity_type"?: string | null
          "full_name"?: string | null
          "id"?: string | null
          "summary"?: string | null
          "tenant_id"?: string | null
          "user_id"?: string | null
        
        }
        Update: {
          "action"?: string | null
          "created_at"?: string | null
          "details"?: Json | null
          "email"?: string | null
          "entity_id"?: string | null
          "entity_type"?: string | null
          "full_name"?: string | null
          "id"?: string | null
          "summary"?: string | null
          "tenant_id"?: string | null
          "user_id"?: string | null
        
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
