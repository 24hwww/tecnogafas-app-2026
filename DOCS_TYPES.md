# Documentación de Tipos - Tecnogafas App

La aplicación utiliza un sistema de tipos centralizado para asegurar la integridad de los datos. Todos los tipos principales residen en `src/types.ts`.

## Interfaces Principales

### `Product`
Representa el catálogo de productos disponible para la venta.
- `id`: `string | number` - Identificador único.
- `name`: `string` - Nombre del producto.
- `price`: `number` - Precio base.
- `stock`: `number` - Cantidad disponible (crucial para sincronización).
- `vid`: `number` (opcional) - ID de variación si aplica.

### `Order`
Representa un pedido realizado.
- `id`: `string`
- `client_id`: `number`
- `products`: `OrderItem[]`
- `status`: `string` ('pendiente', 'enviado', etc.)
- `total`: `number`

### `Notification / Event`
Representa los mensajes en tiempo real.
- `type`: `'order' | 'notification' | 'message'`
- `content`: `string` o `object`
- `read`: `number` (0 = no leído, 1 = leído)

## Buenas Prácticas de Tipado
1. **Evitar `any`**: Se debe migrar gradualmente de `any` a tipos definidos en `types.ts`.
2. **Definiciones en `types.ts`**: Si un objeto complejo se usa en múltiples archivos (como el objeto `details` en los pedidos), debe ser movido a `src/types.ts`.
3. **Strict Mode**: El proyecto debe mantener configuraciones de TypeScript que fuercen la validación de `null` y `undefined` (ver `tsconfig.json`).

---
Para ampliar esta documentación con las interfaces específicas que necesitas ahora, por favor revisa `src/types.ts` y si detectas algún tipo genérico, avísame para que lo documentemos o lo refinemos.
