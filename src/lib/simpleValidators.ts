import { z } from 'zod';

// ============================================================================
// VALIDADORES SIMPLES Y PRÁCTICOS
// ============================================================================

/**
 * Validador simple para productos de API
 */
export const SimpleProductValidator = z.object({
  product_id: z.number().optional(),
  pid: z.number().optional(),
  nombre_producto: z.string(),
  variaciones: z.string(),
  filtros: z.string(),
});

/**
 * Validador simple para vendedores
 */
export const SimpleSellerValidator = z.object({
  id: z.string(),
  name: z.string(),
});

/**
 * Validador simple para respuestas API básicas
 */
export const SimpleApiResponseValidator = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

/**
 * Función de validación simple y segura
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context = 'datos'
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      return { success: false, error: `Error en ${context}: ${messages}` };
    }
    return { success: false, error: `Error desconocido en ${context}` };
  }
}

/**
 * Función para validar arrays de forma segura
 */
export function safeValidateArray<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context = 'datos'
): { success: true; data: T[] } | { success: false; error: string } {
  try {
    const arraySchema = z.array(schema);
    const result = arraySchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      return { success: false, error: `Error en ${context}: ${messages}` };
    }
    return { success: false, error: `Error desconocido en ${context}` };
  }
}

/**
 * Helper para manejar datos undefined de forma segura
 */
export function safeString(value: unknown, defaultValue = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  return defaultValue;
}

/**
 * Helper para manejar números undefined de forma segura
 */
export function safeNumber(value: unknown, defaultValue = 0): number {
  if (typeof value === 'number') {
    return value;
  }
  return defaultValue;
}

/**
 * Helper para manejar arrays undefined de forma segura
 */
export function safeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

/**
 * Helper para validar y obtener datos de localStorage de forma segura
 */
export function safeStorageGet<T>(key: string, schema: z.ZodSchema<T>): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    
    const parsed = JSON.parse(item);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Helper para guardar datos en localStorage de forma segura
 */
export function safeStorageSet<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error guardando ${key} en localStorage:`, error);
  }
}
