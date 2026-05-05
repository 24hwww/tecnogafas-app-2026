# Integración Pedidos → Chat

Este documento explica cómo configurar que cuando se cree un nuevo pedido en tu API, automáticamente llegue una notificación al chat.

## ¿Cómo funciona?

```
┌─────────────┐     INSERT     ┌─────────────────┐     TRIGGER      ┌─────────────┐
│   Tu API    │ ─────────────▶ │  Tabla orders   │ ───────────────▶ │   messages  │
│  (pedido)   │                │   (PostgreSQL)  │   (automático) │   (chat)    │
└─────────────┘                └─────────────────┘                └─────────────┘
                                                                        │
                                                                        │ Realtime
                                                                        ▼
                                                                  ┌─────────────┐
                                                                  │     PWA     │
                                                                  │   (chat)    │
                                                                  └─────────────┘
```

## Archivos generados

| Archivo | Descripción |
|---------|-------------|
| `triggers_orders.sql` | Funciones y triggers PostgreSQL |
| `OrderMessageCard.tsx` | Componente visual para mostrar pedidos en el chat |

---

## Pasos de instalación

### 1. Ejecutar el SQL de triggers

En el **Supabase Dashboard** → **SQL Editor**:

```bash
# Copiar el contenido de:
supabase/triggers_orders.sql
```

⚠️ **IMPORTANTE**: Revisa las líneas marcadas con `-- IMPORTANTE:` y ajusta:
- Nombre de tu tabla de pedidos (por defecto: `orders`)
- Nombres de columnas si son diferentes

### 2. Ajustar nombre de tabla (si es necesario)

Si tu tabla de pedidos se llama diferente, busca en `triggers_orders.sql`:

```sql
-- Cambiar 'orders' por el nombre real de tu tabla
DROP TRIGGER IF EXISTS on_order_created_chat_notification ON orders;

CREATE TRIGGER on_order_created_chat_notification
  AFTER INSERT ON orders  -- <-- Cambiar aquí
  ...
```

### 3. Verificar que existe una conversación

El trigger busca automáticamente:
1. Canal `#pedidos` (preferido)
2. Canal `#general` (fallback)
3. Cualquier conversación pública (último recurso)

Para crear un canal #pedidos:
```sql
INSERT INTO conversations (type, slug, name, description, created_by, is_private)
VALUES ('channel', 'pedidos', 'Pedidos', 'Notificaciones automáticas de pedidos', 'tu-user-id', false);
```

---

## Datos que se envían al chat

Cuando se crea un pedido, el trigger extrae:

```typescript
{
  order_id: "uuid-del-pedido",
  order_number: "PED-2024-001",
  status: "pending",
  total: 999.99,
  customer_name: "Nombre Cliente",
  customer_email: "cliente@email.com",
  items_count: 3,
  url: "/orders/uuid-del-pedido"
}
```

### Columnas esperadas en tabla `orders`:

| Columna | Tipo | Requerida | Descripción |
|---------|------|-----------|-------------|
| `id` | UUID | ✅ | ID del pedido |
| `order_number` | TEXT | ❌ | Número de pedido legible |
| `total` | NUMERIC | ❌ | Monto total |
| `status` | TEXT | ❌ | Estado del pedido |
| `customer_name` | TEXT | ❌ | Nombre del cliente |
| `customer_email` | TEXT | ❌ | Email del cliente |
| `items_count` | INTEGER | ❌ | Cantidad de items |

**Si tus columnas tienen nombres diferentes**, edita la función en `triggers_orders.sql`:

```sql
-- Ejemplo: si usas 'numero' en vez de 'order_number'
order_message_content := format(
  '📦 Nuevo pedido #%s - Total: $%s',
  COALESCE(NEW.numero, NEW.id::text),  -- <-- Cambiado
  COALESCE(NEW.monto_total::text, '0.00')  -- <-- Cambiado
);
```

---

## Estados de pedido soportados

El componente `OrderMessageCard.tsx` muestra badges coloridos según el estado:

| Estado | Badge | Emoji |
|--------|-------|-------|
| `pending` | ⏳ Amarillo | Pendiente |
| `processing` | ⚙️ Azul | Procesando |
| `shipped` | 🚚 Morado | Enviado |
| `completed` | ✅ Verde | Completado |
| `cancelled` | ❌ Rojo | Cancelado |

---

## Testear la integración

### Opción 1: Insertar directo en SQL

```sql
-- Crear pedido de prueba
INSERT INTO orders (
  order_number, 
  total, 
  status, 
  customer_name,
  customer_email,
  items_count
) VALUES (
  'TEST-001', 
  999.99, 
  'pending',
  'Cliente de Prueba',
  'test@example.com',
  3
);
```

### Opción 2: Desde tu API

Simplemente crea un pedido normalmente desde tu aplicación. El mensaje aparecerá automáticamente en el chat.

---

## Actualizaciones de estado

Además de la creación, también se notifican los cambios de estado:

```sql
-- Cuando cambias el status de un pedido:
UPDATE orders SET status = 'shipped' WHERE id = '...';

-- El chat recibe:
"🚚 Pedido #TEST-001 actualizado: pending → shipped"
```

---

## Personalización avanzada

### Enviar a conversación específica

Si quieres enviar siempre a un canal específico (no buscar automáticamente):

```sql
-- Reemplazar la lógica de búsqueda por:
channel_conversation_id := 'UUID-DE-TU-CONVERSACION'::UUID;
```

### Enviar a múltiples canales

```sql
-- Insertar en varias conversaciones
FOR target_conversation_id IN 
  SELECT id FROM conversations WHERE slug IN ('pedidos', 'general')
LOOP
  INSERT INTO messages (conversation_id, ...) 
  VALUES (target_conversation_id, ...);
END LOOP;
```

### Mensaje privado al cliente

```sql
-- Crear mensaje solo para el usuario que hizo el pedido
INSERT INTO messages (
  conversation_id,
  user_id,  -- Solo este usuario verá el mensaje
  type,
  content,
  order_data
)
SELECT 
  c.id,
  NEW.customer_user_id,  -- ID del cliente
  'order',
  'Tu pedido ha sido recibido',
  order_metadata
FROM conversations c
WHERE c.id = 'canal-privado-del-cliente';
```

---

## Troubleshooting

### El mensaje no aparece en el chat

1. **Verificar el trigger está creado**:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_order_created_chat_notification';
```

2. **Verificar la función existe**:
```sql
SELECT * FROM pg_proc WHERE proname = 'create_order_chat_message';
```

3. **Verificar que hay una conversación pública**:
```sql
SELECT id, name, slug FROM conversations WHERE is_private = false;
```

4. **Verificar RLS no bloquea**:
El trigger usa `SECURITY DEFINER` para ejecutarse con permisos elevados.

### El componente no muestra la card

Verificar que `MessageBubble.tsx` tiene el switch case para `type: 'order'`:

```typescript
case 'order':
  return <OrderMessageCard message={message} />;
```

---

## Ejemplo visual

Cuando llega un pedido nuevo, el chat muestra:

```
┌─────────────────────────────────────┐
│  📦  Pedido #PED-2024-001           │
│     Cliente: Juan Pérez             │
│                                     │
│  Total: $999.99          [Pendiente ⏳]│
│  Productos: 3 items                 │
│                                     │
│  [Ver detalles del pedido]          │
└─────────────────────────────────────┘
```

---

## Próximos pasos

- [ ] Agregar imagen del producto a la notificación
- [ ] Notificar al cliente vía push notification
- [ ] Crear resumen diario de pedidos
- [ ] Integrar con sistema de envíos para tracking automático
