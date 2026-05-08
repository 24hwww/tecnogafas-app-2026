# Tecnogafas PWA - Agent Instructions & Architecture Guide (2026)

Este documento es la **fuente de verdad absoluta** para cualquier agente de IA o desarrollador que trabaje en el proyecto Tecnogafas PWA. Define las reglas, patrones, arquitectura y flujos críticos que deben respetarse para mantener la integridad, performance y escalabilidad del sistema.

---

## 🚀 1. Stack Tecnológico & Core

| Capa                    | Tecnología         | Versión            |
| :---------------------- | :----------------- | :----------------- |
| **Framework**           | React              | 19.0 (Strict Mode) |
| **Build Tool**          | Vite               | 7.0                |
| **Lenguaje**            | TypeScript         | 5.8 (Strict)       |
| **Mobile**              | Capacitor          | 8.3                |
| **Base de Datos Local** | Dexie.js           | 4.4 (IndexedDB)    |
| **Backend / Realtime**  | Supabase           | 2.105              |
| **Estilos**             | Tailwind CSS       | 4.1                |
| **Componentes UI**      | DaisyUI / Radix UI | 5.5 / Latest       |
| **Animaciones**         | Framer Motion      | 12.3               |

---

## 🛠️ 2. Arquitectura del Proyecto

El proyecto sigue una estructura modular y orientada a servicios:

```text
src/
├── components/     # UI Atómica y componentes compartidos
├── contexts/       # Estado global (Auth, Cart, Orders, UI, Connection)
├── hooks/          # Lógica reutilizable (useDataSync, useCacheManager, etc.)
├── lib/            # Utilidades, validadores y configuraciones core
├── modules/        # Módulos complejos (e.g. chat/ con su propia lógica)
├── pages/          # Vistas principales de la aplicación
├── services/       # Integración con API externa y lógica de negocio pesada
├── stores/         # Definición de bases de datos locales (Dexie)
└── styles/         # Design System y tokens CSS (Tailwind 4)
```

### Estrategia Offline-First (CRÍTICO)

1.  **Lectura**: Siempre priorizar `appDB` (Dexie). El hook `useDataSync` se encarga de poblar la caché desde la API.
2.  **Escritura**:
    - Si hay red: API Directa -> Notificación Realtime.
    - Si no hay red: Guardar en `indexedDB` (cola local) + Backup en `Supabase` (tabla `pending_orders`).
3.  **Sincronización**: El servicio `pendingOrdersSync.ts` gestiona el reintento con backoff exponencial.

---

## 🔄 3. Flujo Operacional Protegido (NUNCA CAMBIAR)

La experiencia de usuario para la creación de pedidos es sagrada. Cualquier refactorización debe preservar estos pasos:

1.  **Selección de Cliente**: Búsqueda y asignación desde `/clientes`.
2.  **Selección de Productos**: Navegación por `/productos`, selección de variaciones y cantidades.
3.  **Gestión de Carrito**: Revisión en `/carrito`.
4.  **Resumen y Detalles**: En `/checkout`, ingresar IVA, descuentos, transporte y notas.
5.  **Confirmación y PIN**: Validación obligatoria de PIN de vendedor (8 dígitos).
6.  **Sincronización**: Envío a API -> Envío de Email -> Notificación en Chat -> Actualización de Stats.

---

## 📜 4. Reglas Técnicas Obligatorias

### TypeScript Strict

- **PROHIBIDO** el uso de `any`. Si encuentras `any` existente, refactoriza a `unknown` o define el tipo correcto.
- **Zod**: Obligatorio para validar respuestas de API y payloads de Supabase.
- **Tipado Realtime**: Todos los eventos de Supabase deben estar tipados en `types.ts`.

### UI/UX Premium (Origin UI Vega Style)

- **Theme**: Dark mode por defecto (`--color-base-100: #0A0F1E`).
- **Interacción**:
  - Feedback táctil en botones.
  - Skeletons animados para estados de carga.
  - Transiciones suaves con `Framer Motion`.
- **Mobile-First**: Los targets de click deben ser de al menos 44px (especialmente en Android).

### Supabase & Seguridad

- **RLS (Row Level Security)**: Siempre activo. Ninguna tabla debe permitir acceso anónimo sin política.
- **Recursión**: Evitar políticas que dependan de la misma tabla de forma circular (causa fallos de performance masivos).
- **N+1**: Prohibido hacer queries dentro de loops. Usar `.in()` o `rpc` de ser necesario.

### Dexie (Offline)

- No almacenar blobs gigantes.
- Mantener el esquema de `appDatabase.ts` sincronizado con los cambios en `types.ts`.

---

## ⚠️ 5. Deuda Técnica & Anti-patterns a Corregir

Al trabajar en el código, busca y elimina activamente:

1.  **Regex en API**: La extracción de variaciones en `apiService.ts` mediante regex es frágil. Debería migrarse a un parser estructurado o validación Zod.
2.  **God Objects**: `apiService.ts` es demasiado grande (>1000 líneas). Dividir en `clientService`, `productService`, `orderService`.
3.  **Casteos Innecesarios**: Eliminar `(supabase as any)` implementando las interfaces de Supabase correctamente.
4.  **Redundancia Offline**: Unificar la lógica de `indexedDB` simple con la tabla `pending_orders` de Supabase para evitar estados inconsistentes.

---

## ✅ 6. Checklist de Pre-Finalización

Antes de entregar cualquier tarea, verifica:

- [ ] ¿El código pasa el check de TypeScript (`npm run lint`)?
- [ ] ¿Se mantiene el flujo de pedidos intacto?
- [ ] ¿Funciona el modo offline (simular con DevTools)?
- [ ] ¿El diseño sigue el sistema de colores y animaciones premium?
- [ ] ¿Se han evitado memory leaks en listeners de Supabase/Realtime?
- [ ] ¿Se han agregado validaciones Zod para nuevos datos?

---

> [!IMPORTANT]
> Este proyecto es una herramienta de trabajo crítica para vendedores en campo. La estabilidad y la velocidad de respuesta (optimistic UI) son más importantes que cualquier feature estética secundaria.
