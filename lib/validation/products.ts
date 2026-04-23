import { z } from "zod";

const OPTIONAL_STRING = z
  .string()
  .max(255)
  .transform((v) => v.trim())
  .optional()
  .or(z.literal(""));

const NON_NEG_FLOAT = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Must be a non-negative number")
  .transform((v) => parseFloat(v));

const NON_NEG_INT = z
  .string()
  .regex(/^\d+$/, "Must be a non-negative integer")
  .transform((v) => parseInt(v, 10));

const OPTIONAL_NON_NEG_FLOAT = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? parseFloat(v) : undefined))
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), "Must be ≥ 0");

const OPTIONAL_NON_NEG_INT = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? parseInt(v, 10) : undefined))
  .refine((v) => v === undefined || (Number.isInteger(v) && v >= 0), "Must be ≥ 0");

export const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  sku: OPTIONAL_STRING,
  rate: NON_NEG_FLOAT,
  cost: OPTIONAL_NON_NEG_FLOAT,
  stockQuantity: OPTIONAL_NON_NEG_INT,
  imageUrl: z.string().url().max(2048).optional().or(z.literal("")),
  color: OPTIONAL_STRING,
  size: OPTIONAL_STRING,
  categoryLabel: z.string().max(100).optional().or(z.literal("")),
  categoryCode: z.string().max(10).optional().or(z.literal("")),
});

export const updateProductSchema = createProductSchema.extend({
  productId: z.string().uuid(),
});

export const deleteProductSchema = z.object({
  productId: z.string().uuid(),
});

export const duplicateProductSchema = deleteProductSchema;

export const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  quantity: z
    .string()
    .regex(/^-?\d+$/, "Integer required")
    .transform((v) => parseInt(v, 10))
    .refine((n) => Number.isFinite(n), "Invalid quantity"),
  type: z.enum(["in", "out", "adjustment"]),
  reason: OPTIONAL_STRING,
});

export type CreateProductFormValues = z.infer<typeof createProductSchema>;
export type UpdateProductFormValues = z.infer<typeof updateProductSchema>;
