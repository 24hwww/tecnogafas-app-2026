# Sistema de Chat Realtime - Arquitectura Completa

## Stack Tecnológico

- **Frontend**: React 19 + Vite + TypeScript
- **Backend**: Supabase Free (PostgreSQL + Realtime)
- **Offline-First**: Dexie (IndexedDB)
- **PWA**: vite-plugin-pwa + Capacitor
- **UI**: Tailwind CSS + Lucide Icons

---

## 1. ARQUITECTURA FRONTEND

### Estructura de Carpetas

```
src/modules/chat/
├── types.ts              # Tipos TypeScript
├── lib/
│   ├── supabase.ts       # Cliente Supabase + Realtime
│   └── dateUtils.ts      # Utilidades de fechas
├── stores/
│   └── chatDatabase.ts   # Dexie IndexedDB
├── hooks/
│   ├── useMessages.ts    # Mensajes + Realtime
│   ├── useConversations.ts
│   ├── useReactions.ts
│   └── useTyping.ts
├── providers/
│   └── ChatProvider.tsx  # Contexto global
├── components/
│   ├── ChatLayout.tsx    # Layout principal
│   ├── ChatList.tsx      # Lista conversaciones
│   ├── ChatMessageList.tsx
│   ├── MessageBubble.tsx
│   ├── ChatInput.tsx
│   └── TypingIndicator.tsx
└── index.ts              # Exports
```

### Flujo de Datos

```
┌─────────────────┐     ┌──────────────┐     ┌────────────────┐
│   UI Components │────▶│   Context    │────▶│     Hooks      │
│                 │     │ ChatProvider │     │                │
└─────────────────┘     └──────────────┘     └────────────────┘
                                                        │
          ┌─────────────────────────────────────────────┼─────────────┐
          │                                             │             │
          ▼                                             ▼             ▼
   ┌─────────────┐                              ┌────────────┐ ┌──────────┐
   │   Dexie     │                              │  Supabase  │ │ Realtime │
   │ (IndexedDB) │                              │   REST API │ │   WS     │
   └─────────────┘                              └────────────┘ └──────────┘
```

---

## 2. FLUJO REALTIME

### Subscripciones Supabase

```typescript
// Canal por conversación para mensajes
const channel = supabase.channel(`messages:${conversationId}`)
  .on('postgres_changes', { 
    event: 'INSERT', 
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}` 
  }, handleNewMessage)
  .on('postgres_changes', { 
    event: 'UPDATE', 
    table: 'messages' 
  }, handleUpdateMessage)
  .on('postgres_changes', { 
    event: 'DELETE', 
    table: 'messages' 
  }, handleDeleteMessage)
  .subscribe();
```

### Eventos Manejados

| Evento | Tabla | Acción |
|--------|-------|--------|
| `INSERT` | messages | Agregar mensaje a UI |
| `UPDATE` | messages | Actualizar contenido/edición |
| `DELETE` | messages | Marcar como eliminado |
| `INSERT` | message_reactions | Agregar reacción |
| `DELETE` | message_reactions | Quitar reacción |
| `*` | typing_status | Mostrar "escribiendo..." |
| `*` | user_presence | Actualizar online status |

### Optimistic Updates

1. Actualizar UI inmediatamente
2. Enviar a Supabase en background
3. Si falla: revertir cambio
4. Si offline: guardar en cola

---

## 3. ESTRATEGIA OFFLINE-FIRST

### Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      CACHE STRATEGY                         │
├─────────────────────────────────────────────────────────────┤
│  1. Leer desde IndexedDB (instantáneo)                     │
│  2. Fetch desde Supabase (background)                      │
│  3. Merge y guardar en IndexedDB                           │
│  4. Actualizar UI con datos frescos                        │
└─────────────────────────────────────────────────────────────┘
```

### Cola de Operaciones Offline

```typescript
interface PendingOperation {
  id: string;
  type: 'send_message' | 'update_message' | 'add_reaction';
  payload: unknown;
  created_at: string;
  retry_count: number;
}
```

### Proceso de Sincronización

1. Detectar conexión restaurada (`navigator.onLine`)
2. Leer operaciones pendientes de IndexedDB
3. Ejecutar en orden FIFO
4. Marcar como completadas
5. Sincronizar datos actualizados

---

## 4. BASE DE DATOS (Supabase)

### Tablas

| Tabla | Propósito | Índices Clave |
|-------|-----------|---------------|
| `profiles` | Info de usuarios | `username`, `status` |
| `conversations` | Canales/Grupos/DMs | `last_message_at`, `type` |
| `conversation_members` | Miembros + metadata | `[conversation_id+user_id]` |
| `messages` | Mensajes del chat | `[conversation_id+created_at]` |
| `message_reactions` | Reacciones emoji | `[message_id+emoji]` |
| `typing_status` | Indicador typing | `expires_at` |
| `user_presence` | Online/Ausente/Ocupado | `last_active_at` |

### Triggers PostgreSQL

```sql
-- Auto-increment message_count
CREATE TRIGGER increment_message_count
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION increment_conversation_message_count();

-- Auto-update unread counters
CREATE TRIGGER update_unread_counts
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_unread_counts();

-- Auto-update reply_count
CREATE TRIGGER update_reply_count
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_parent_reply_count();
```

### RLS Policies

```sql
-- Mensajes solo visibles por miembros
CREATE POLICY "Messages viewable by members"
  ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversation_members 
    WHERE conversation_id = messages.conversation_id 
    AND user_id = auth.uid()
  ));
```

---

## 5. PRESENCE Y TYPING

### User Presence

```typescript
// Heartbeat cada 30 segundos
const updatePresence = () => {
  supabase.from('user_presence').upsert({
    user_id: currentUserId,
    status: 'online', // | 'away' | 'dnd' | 'offline'
    last_active_at: new Date().toISOString(),
  });
};
```

### Typing Indicator

```typescript
// Debounce: 300ms antes de enviar
// Duration: 30 segundos de duración
// Cleanup: Auto-limpiar expirados cada 10s
```

---

## 6. OPTIMIZACIÓN DE PERFORMANCE

### Paginación

- 50 mensajes por página
- Scroll infinito (load more al llegar al top)
- Cursor-based pagination (no offset)

### Virtualización (Futuro)

```typescript
// react-window para listas largas
<VariableSizeList
  height={containerHeight}
  itemCount={messages.length}
  itemSize={getMessageHeight}
>
  {MessageRow}
</VariableSizeList>
```

### Memoización

- `React.memo` para MessageBubble
- `useMemo` para agrupar mensajes por fecha
- `useCallback` para handlers

### Supabase Limits (Free Tier)

- **Realtime**: 200 concurrent connections
- **Database**: 500 requests/segundo
- **Storage**: 1GB
- **Bandwidth**: 2GB/month

### Estrategia de Rate Limiting

```typescript
// Debounce para typing: 300ms
// Throttle para presence: 30s
// Batch para reads: Marcar como leído cada 5s
```

---

## 7. SEGURIDAD

### Row Level Security

Todas las tablas tienen RLS enabled. Políticas clave:

1. **Profiles**: Lectura pública, solo autoupdate
2. **Conversations**: Solo miembros pueden leer
3. **Messages**: Solo miembros de la conversación
4. **Members**: Self-service join/leave

### Auth Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│ Supabase │────▶│  Google  │
│          │◀────│   Auth   │◀────│  OAuth   │
└──────────┘     └──────────┘     └──────────┘
```

### JWT Tokens

- Access token: 1 hora
- Refresh token: 1 semana
- Auto-refresh en background

---

## 8. CONFIGURACIÓN PWA

### vite.config.ts

```typescript
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 }
            }
          }
        ]
      }
    })
  ]
};
```

### Service Worker

```typescript
// Estrategia: Network First con fallback a cache
// Background sync para mensajes offline
// Push notifications (opcional)
```

---

## 9. TIPOS DE MENSAJES ESPECIALES

### Mensajes de Sistema

```typescript
{
  type: 'system',
  content: '@usuario se unió al canal',
  metadata: { action: 'user_joined', user_id: '...' }
}
```

### Mensajes de Pedido

```typescript
{
  type: 'order',
  content: 'Nuevo pedido #1234',
  order_data: {
    order_id: '1234',
    order_number: 'ORD-2024-001',
    status: 'pending',
    total: 999.99,
    items: [...],
    url: '/orders/1234'
  }
}
```

### Mensajes de Alerta

```typescript
{
  type: 'alert',
  content: 'Stock bajo de producto X',
  alert_data: {
    level: 'warning', // | 'info' | 'error' | 'success'
    title: 'Alerta de Inventario',
    action: { label: 'Ver', url: '/inventory' }
  }
}
```

---

## 10. IMPLEMENTACIÓN EN PROYECTO EXISTENTE

### 1. Variables de Entorno

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Ejecutar SQL Schema

1. Ir a Supabase Dashboard > SQL Editor
2. Copiar contenido de `supabase/schema.sql`
3. Ejecutar

### 3. Integrar Provider

```tsx
// App.tsx
import { ChatProvider } from './modules/chat';

function App() {
  return (
    <ChatProvider currentUserId={user?.id} currentUser={user}>
      <YourExistingApp />
    </ChatProvider>
  );
}
```

### 4. Usar Componente Chat

```tsx
// En tu página/componente
import { ChatLayout } from './modules/chat/components/ChatLayout';

function ChatPage() {
  return <ChatLayout />;
}
```

---

## 11. TESTING

### Unit Tests (Jest)

```typescript
// hooks/useMessages.test.ts
describe('useMessages', () => {
  it('should load messages from cache first', async () => {
    // Mock Dexie
    // Mock Supabase
    // Assert
  });
});
```

### E2E Tests (Playwright)

```typescript
// tests/chat.spec.ts
test('user can send message', async ({ page }) => {
  await page.goto('/chat');
  await page.fill('[data-testid="chat-input"]', 'Hello');
  await page.click('[data-testid="send-button"]');
  await expect(page.locator('.message-bubble')).toContainText('Hello');
});
```

---

## 12. MONITOREO Y DEBUGGING

### Console Logs Estructurados

```typescript
console.log('[Chat:useMessages] Loading messages', { conversationId });
console.log('[Chat:Realtime] New message received', payload);
console.log('[Chat:Dexie] Cache updated', { count });
```

### Métricas Relevantes

- Time to First Message (TTFM)
- Cache hit rate
- Realtime reconnection count
- Offline queue size

---

## 13. ROADMAP Y MEJORAS FUTURAS

### Corto Plazo

- [ ] Búsqueda full-text en mensajes
- [ ] Threads/Respuestas anidadas
- [ ] Editar mensajes
- [ ] Borrar mensajes

### Mediano Plazo

- [ ] Mensajes de voz
- [ ] Compartir archivos (Supabase Storage)
- [ ] Videollamadas (WebRTC)
- [ ] Notificaciones push

### Largo Plazo

- [ ] E2E Encryption
- [ ] AI Moderación
- [ ] Analytics dashboard
- [ ] Exportar conversaciones

---

## Referencias

- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Dexie.js](https://dexie.org/)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [Tailwind CSS](https://tailwindcss.com/)
