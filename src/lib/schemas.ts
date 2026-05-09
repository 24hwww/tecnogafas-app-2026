import { z } from 'zod';

// Base schemas
export const StringSchema = z.string().min(1, 'Required field');
export const EmailSchema = z.string().email('Invalid email format');
export const NumberSchema = z.number().min(0, 'Must be non-negative');
export const OptionalStringSchema = z.string().optional();
export const OptionalNumberSchema = z.number().optional();

// Client schemas
export const ClientSchema = z.object({
  id: StringSchema,
  name: StringSchema,
  email: EmailSchema,
  phone: StringSchema,
  address: StringSchema,
  prescription: OptionalStringSchema,
  billing_city: OptionalStringSchema,
  billing_state: OptionalStringSchema,
  cuit: OptionalStringSchema,
});

export const ApiClientSchema = z.object({
  ID: NumberSchema,
  display_name: StringSchema,
  user_email: EmailSchema,
  billing_phone: z.string().nullable(),
  billing_address_1: z.string().nullable(),
  billing_city: z.string().nullable().optional(),
  billing_state: z.string().nullable().optional(),
  info_fiscal: z.string().nullable().optional(),
});

// Product schemas
export const ProductVariationSchema = z.object({
  vid: StringSchema,
  title: StringSchema,
  stock: NumberSchema,
  price: NumberSchema,
});

export const ProductSchema = z.object({
  id: StringSchema,
  name: StringSchema,
  category: StringSchema,
  price: NumberSchema,
  stock: NumberSchema,
  image: OptionalStringSchema,
  description: StringSchema,
  variations: z.array(ProductVariationSchema).optional(),
});

export const ApiProductSchema = z.object({
  product_id: NumberSchema.optional(),
  pid: NumberSchema.optional(),
  nombre_producto: StringSchema,
  variaciones: StringSchema,
  filtros: StringSchema,
});

// Cart and Order schemas
export const CartItemSchema = ProductSchema.extend({
  quantity: NumberSchema,
  vid: OptionalStringSchema,
});

export const OrderItemSchema = z.object({
  productId: StringSchema,
  productName: StringSchema,
  quantity: NumberSchema,
  price: NumberSchema,
  vid: OptionalStringSchema,
});

export const ApiOrderItemSchema = z.object({
  product_id: NumberSchema,
  name: StringSchema,
  quantity: NumberSchema,
  price: NumberSchema,
  vid: OptionalStringSchema,
});

export const ApiCustomerSchema = z.object({
  ID: NumberSchema,
  user_login: OptionalStringSchema,
  display_name: OptionalStringSchema,
  user_email: EmailSchema,
  first_name: StringSchema,
  last_name: StringSchema,
  billing_first_name: OptionalStringSchema,
  billing_last_name: OptionalStringSchema,
  billing_company: OptionalStringSchema,
  billing_email: OptionalStringSchema,
  billing_address_1: OptionalStringSchema,
  billing_city: OptionalStringSchema,
  billing_state: OptionalStringSchema,
  billing_country: OptionalStringSchema,
  billing_phone: OptionalStringSchema,
  info_fiscal: OptionalStringSchema,
});

export const ApiOrderSchema = z.object({
  ID: NumberSchema,
  post_title: StringSchema,
  post_status: StringSchema,
  post_date: StringSchema,
  order_total: z.union([StringSchema, NumberSchema]),
  items_count: NumberSchema,
  customer_id: NumberSchema,
  ocode: StringSchema,
  seller_id: NumberSchema,
  seller_name: OptionalStringSchema,
  post_author: NumberSchema,
  discount: StringSchema,
  recargo: StringSchema,
  transport: StringSchema,
  methodpay: StringSchema,
  iva: NumberSchema,
  customer_note: OptionalStringSchema,
  observaciones: OptionalStringSchema,
  billing: z
    .object({
      country: OptionalStringSchema,
    })
    .optional(),
  items: z.array(ApiOrderItemSchema).optional(),
  customer: ApiCustomerSchema.optional(),
});

export const OrderSchema = z.object({
  id: StringSchema,
  clientId: StringSchema,
  clientName: StringSchema,
  items: z.array(OrderItemSchema),
  total: NumberSchema,
  status: z.enum(['attended', 'unattended']),
  createdAt: StringSchema,
  sellerId: StringSchema,
  sellerName: OptionalStringSchema,
  rawData: ApiOrderSchema,
});

// Draft Order schemas
export const DraftOrderDetailsSchema = z.object({
  commit: OptionalStringSchema,
  discount: z.union([NumberSchema, StringSchema]).optional(),
  recargo: z.union([NumberSchema, StringSchema]).optional(),
  transport: OptionalStringSchema,
  methodpay: OptionalStringSchema,
  otheremail: OptionalStringSchema,
  iva: z.union([NumberSchema, StringSchema]).optional(),
});

export const DraftOrderSchema = z.object({
  id: StringSchema,
  client: ClientSchema,
  items: z.array(CartItemSchema),
  details: DraftOrderDetailsSchema,
  status: z.enum(['no enviado', 'enviado']),
  date: StringSchema,
});

// Shared Cart schemas
export const SharedCartSchema = z.object({
  id: StringSchema,
  code: StringSchema,
  client: ClientSchema.optional(),
  items: z.array(CartItemSchema),
  total: NumberSchema,
  createdAt: StringSchema,
  expiresAt: StringSchema,
  isActive: z.boolean(),
});

// Notification schemas
export const AppNotificationSchema = z.object({
  id: NumberSchema,
  type: StringSchema,
  content: z.object({
    title: OptionalStringSchema,
    body: OptionalStringSchema,
  }),
  read: z.boolean(),
  created_at: StringSchema,
});

// API Response schemas
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: OptionalStringSchema,
  message: OptionalStringSchema,
});

export const PaginatedResponseSchema = z.object({
  data: z.array(z.unknown()),
  total: NumberSchema,
  page: NumberSchema,
  limit: NumberSchema,
  totalPages: NumberSchema,
});

// Type exports
export type Client = z.infer<typeof ClientSchema>;
export type ApiClient = z.infer<typeof ApiClientSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type ProductVariation = z.infer<typeof ProductVariationSchema>;
export type CartItem = z.infer<typeof CartItemSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type ApiOrderItem = z.infer<typeof ApiOrderItemSchema>;
export type ApiCustomer = z.infer<typeof ApiCustomerSchema>;
export type ApiOrder = z.infer<typeof ApiOrderSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type DraftOrderDetails = z.infer<typeof DraftOrderDetailsSchema>;
export type DraftOrder = z.infer<typeof DraftOrderSchema>;
export type SharedCart = z.infer<typeof SharedCartSchema>;
export type AppNotification = z.infer<typeof AppNotificationSchema>;
export type ApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & { data?: T };
export type PaginatedResponse<T = unknown> = z.infer<typeof PaginatedResponseSchema> & {
  data: T[];
};

// Validation helpers
export function validateApiResponse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function safeValidateApiResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}
