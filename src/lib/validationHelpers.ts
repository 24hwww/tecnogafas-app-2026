import { z } from 'zod';

// ============================================================================
// HELPERS PARA MANEJO SEGURO DE PROPIEDADES OPCIONALES
// ============================================================================

/**
 * Crea un objeto manejando propiedades opcionales de manera segura para exactOptionalPropertyTypes
 */
export function safeOptional<T extends Record<string, unknown>>(
  obj: T,
  keys: (keyof T)[],
): Partial<T> {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (key in obj && obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Maneja propiedades opcionales de tipo string
 */
export function safeOptionalString(value: string | undefined): string | undefined {
  return value === undefined ? undefined : value;
}

/**
 * Maneja propiedades opcionales de tipo number
 */
export function safeOptionalNumber(value: number | undefined): number | undefined {
  return value === undefined ? undefined : value;
}

/**
 * Crea un CartItem seguro manejando vid opcional
 */
export function safeCartItem(item: {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  category: string;
  description: string;
  vid?: string | undefined;
}) {
  const result = {
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    stock: item.stock,
    category: item.category,
    description: item.description,
  };

  // Solo agregar vid si no es undefined
  if (item.vid !== undefined) {
    Object.defineProperty(result, 'vid', {
      value: item.vid,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  return result;
}

/**
 * Crea un OrderItem seguro manejando vid opcional
 */
export function safeOrderItem(item: {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  vid?: string | undefined;
}) {
  const result = {
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    price: item.price,
  };

  // Solo agregar vid si no es undefined
  if (item.vid !== undefined) {
    Object.defineProperty(result, 'vid', {
      value: item.vid,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  return result;
}

/**
 * Validador simple para respuestas de API que no requiere estructura estricta
 */
export const SimpleApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

/**
 * Función de validación simple que maneja errores de forma amigable
 */
export function validateSimple<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string = 'validación',
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      return { success: false, error: `Error en ${context}: ${errorMessages}` };
    }
    return { success: false, error: `Error desconocido en ${context}` };
  }
}

/**
 * Valida un array de forma simple
 */
export function validateSimpleArray<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string = 'validación',
): { success: true; data: T[] } | { success: false; error: string } {
  try {
    const arraySchema = z.array(schema);
    const validatedData = arraySchema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      return { success: false, error: `Error en ${context}: ${errorMessages}` };
    }
    return { success: false, error: `Error desconocido en ${context}` };
  }
}
