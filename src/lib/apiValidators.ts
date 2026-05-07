import { z } from 'zod';
import type {
  ApiClient,
  ApiOrder,
  ApiOrderItem,
  ApiProduct,
  ApiCustomer,
} from '../types';

// ============================================================================
// VALIDADORES DE RESPUESTA API
// ============================================================================

// Esquema base para respuestas de API
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

// Esquema para paginación
export const PaginationSchema = z.object({
  data: z.array(z.unknown()),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

// Validador para productos
export const ApiProductValidator = z.object({
  product_id: z.number().optional(),
  pid: z.number().optional(),
  nombre_producto: z.string().min(1, 'El nombre del producto es requerido'),
  variaciones: z.string(),
  filtros: z.string(),
});

// Validador para clientes
export const ApiClientValidator = z.object({
  ID: z.number(),
  display_name: z.string().min(1, 'El nombre es requerido'),
  user_email: z.string().email('Email inválido'),
  billing_phone: z.string().nullable(),
  billing_address_1: z.string().nullable(),
  billing_city: z.string().nullable().optional(),
  billing_state: z.string().nullable().optional(),
  info_fiscal: z.string().nullable().optional(),
});

// Validador para ítems de pedido
export const ApiOrderItemValidator = z.object({
  product_id: z.number(),
  name: z.string().min(1, 'El nombre del producto es requerido'),
  quantity: z.number().min(1, 'La cantidad debe ser mayor a 0'),
  price: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
  vid: z.string().optional(),
});

// Validador para cliente de pedido
export const ApiCustomerValidator = z.object({
  ID: z.number(),
  user_login: z.string().optional(),
  display_name: z.string().optional(),
  user_email: z.string().email('Email inválido'),
  first_name: z.string().min(1, 'El nombre es requerido'),
  last_name: z.string().min(1, 'El apellido es requerido'),
  billing_first_name: z.string().optional(),
  billing_last_name: z.string().optional(),
  billing_company: z.string().optional(),
  billing_email: z.string().email().optional(),
  billing_address_1: z.string().optional(),
  billing_city: z.string().optional(),
  billing_state: z.string().optional(),
  billing_country: z.string().optional(),
  billing_phone: z.string().optional(),
  info_fiscal: z.string().optional(),
});

// Validador para pedidos
export const ApiOrderValidator = z.object({
  ID: z.number(),
  post_title: z.string().min(1, 'El título es requerido'),
  post_status: z.string(),
  post_date: z.string(),
  order_total: z.union([z.string(), z.number()]),
  items_count: z.number(),
  customer_id: z.number(),
  ocode: z.string(),
  seller_id: z.number(),
  seller_name: z.string().optional(),
  post_author: z.number(),
  discount: z.string(),
  recargo: z.string(),
  transport: z.string(),
  methodpay: z.string(),
  iva: z.number(),
  customer_note: z.string().optional(),
  observaciones: z.string().optional(),
  billing: z.object({
    country: z.string().optional(),
  }).optional(),
  items: z.array(ApiOrderItemValidator).optional(),
  customer: ApiCustomerValidator.optional(),
});

// Validador para vendedores
export const SellerValidator = z.object({
  id: z.string().min(1, 'El ID del vendedor es requerido'),
  name: z.string().min(1, 'El nombre del vendedor es requerido'),
});

// Validador para eventos/notificaciones
export const NotificationValidator = z.object({
  id: z.number(),
  type: z.string(),
  content: z.object({
    title: z.string().optional(),
    body: z.string().optional(),
  }),
  read: z.boolean(),
  created_at: z.string(),
});

// ============================================================================
// TIPOS DERIVADOS SEGUROS
// ============================================================================

export type SafeApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & { data?: T };
export type SafePagination<T = unknown> = z.infer<typeof PaginationSchema> & { data: T[] };
export type SafeApiProduct = z.infer<typeof ApiProductValidator>;
export type SafeApiClient = z.infer<typeof ApiClientValidator>;
export type SafeApiOrder = z.infer<typeof ApiOrderValidator>;
export type SafeApiOrderItem = z.infer<typeof ApiOrderItemValidator>;
export type SafeApiCustomer = z.infer<typeof ApiCustomerValidator>;
export type SafeSeller = z.infer<typeof SellerValidator>;
export type SafeNotification = z.infer<typeof NotificationValidator>;

// ============================================================================
// FUNCIONES DE VALIDACIÓN
// ============================================================================

/**
 * Valida una respuesta de API de manera segura
 */
export function validateApiResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  try {
    // Primero validar la estructura básica de la respuesta
    const apiResponse = ApiResponseSchema.parse(data);
    
    if (!apiResponse.success) {
      return { 
        success: false, 
        error: apiResponse.error || apiResponse.message || 'Error en la respuesta de la API' 
      };
    }
    
    // Si hay datos, validarlos con el schema específico
    if (apiResponse.data !== undefined) {
      const validatedData = schema.parse(apiResponse.data);
      return { success: true, data: validatedData };
    }
    
    return { success: true, data: undefined as T };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return { success: false, error: `Validación fallida: ${errorMessages}` };
    }
    return { success: false, error: 'Error desconocido en la validación' };
  }
}

/**
 * Valida datos de manera segura sin estructura de API
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return { success: false, error: `Validación fallida: ${errorMessages}` };
    }
    return { success: false, error: 'Error desconocido en la validación' };
  }
}

/**
 * Valida un array de datos de manera segura
 */
export function validateArray<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T[] } | { success: false; error: string } {
  try {
    const arraySchema = z.array(schema);
    const validatedData = arraySchema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return { success: false, error: `Validación fallida: ${errorMessages}` };
    }
    return { success: false, error: 'Error desconocido en la validación' };
  }
}

/**
 * Crea un validador para datos de localStorage/sessionStorage
 */
export function createStorageValidator<T>(schema: z.ZodSchema<T>) {
  return {
    parse: (data: string | null): T | null => {
      if (!data) return null;
      try {
        const parsed = JSON.parse(data);
        const result = schema.safeParse(parsed);
        return result.success ? result.data : null;
      } catch {
        return null;
      }
    },
    stringify: (data: T): string => {
      return JSON.stringify(data);
    },
  };
}

// ============================================================================
// VALIDADORES ESPECÍFICOS PARA STORAGE
// ============================================================================

export const storageValidators = {
  seller: createStorageValidator(SellerValidator),
  pin: createStorageValidator(z.string().length(8, 'El PIN debe tener 8 dígitos')),
  cart: createStorageValidator(z.array(z.unknown())), // Los items del carrito se validan individualmente
  client: createStorageValidator(ApiClientValidator),
};
