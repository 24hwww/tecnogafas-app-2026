# Tecnogafas PWA - Agent Instructions & Architecture Guide (2026)

This document is the absolute source of truth for any AI agent or developer working on the Tecnogafas PWA project. It defines the mandatory rules, architecture, operational flows, and technical standards required to preserve system integrity, scalability, performance, and maintainability.

---

# 🚀 1. Core Technology Stack

| Layer              | Technology         | Version            |
| :----------------- | :----------------- | :----------------- |
| Framework          | React              | 19.0 (Strict Mode) |
| Build Tool         | Vite               | 7.0                |
| Language           | TypeScript         | 5.8 (Strict)       |
| Mobile             | Capacitor          | 8.3                |
| Local Database     | Dexie.js           | 4.4                |
| Backend / Realtime | Supabase           | 2.105              |
| Styling            | Tailwind CSS       | 4.1                |
| UI Components      | DaisyUI / Radix UI | 5.5 / Latest       |
| Animations         | Framer Motion      | 12.3               |

---

# 🛠️ 2. Project Architecture

The project follows a modular, service-oriented architecture.

```text
src/
├── components/     # Atomic UI and shared components
├── contexts/       # Global state (Auth, Cart, Orders, UI, Connection)
├── hooks/          # Reusable logic (useDataSync, useCacheManager, etc.)
├── lib/            # Utilities, validators, configs, helpers
├── modules/        # Complex business modules (chat, analytics, etc.)
├── pages/          # Main application pages/views
├── services/       # API integrations and business logic
├── stores/         # Dexie database definitions and offline storage
└── styles/         # Tailwind 4 design tokens and global styles
```

---

# 🔄 3. Critical Offline-First Strategy

Offline-first behavior is a CORE REQUIREMENT and MUST NEVER be bypassed.

## Read Operations

* ALWAYS prioritize `appDB` (Dexie) for reads.
* `useDataSync` is responsible for synchronizing remote data into local cache.
* Avoid direct API reads unless explicitly required.

## Write Operations

### Online

* Direct API write
* Trigger realtime notifications

### Offline

* Store locally in IndexedDB queue
* Backup operation in Supabase `pending_orders`
* Sync later using retry-safe mechanisms

## Synchronization

* `pendingOrdersSync.ts` handles retry logic with exponential backoff.
* Prevent duplicated sync execution.
* All sync operations must be idempotent.

---

# 🔒 4. Protected Operational Flow (NEVER BREAK)

The sales/order flow is considered critical business logic.

Any refactor MUST preserve the following operational sequence:

1. Client selection from `/clientes`
2. Product browsing and variation selection
3. Cart management in `/carrito`
4. Checkout details (IVA, discounts, transport, notes)
5. Mandatory 8-digit seller PIN validation
6. Synchronization:

   * API
   * Email
   * Realtime chat notification
   * Statistics update

NEVER modify this flow unless explicitly requested.

---

# 📜 5. Mandatory Technical Rules

## TypeScript Strict Rules

* NEVER use `any`
* Existing `any` types must be migrated to proper types or `unknown`
* All API payloads MUST use Zod validation
* All Supabase events MUST be typed
* Never silence TypeScript errors artificially

## Naming Conventions

* Components: `PascalCase`
* Hooks: `useCamelCase`
* Services: `camelCaseService.ts`
* Types/Interfaces: `PascalCase`
* Constants: `UPPER_SNAKE_CASE`

## Import Rules

* Prefer absolute imports using aliases
* Avoid deep relative imports (`../../../`)
* Avoid circular dependencies
* Shared types should live in dedicated type files

## State Management Rules

Use Context ONLY for:

* Authentication
* Connectivity
* Theme
* Cart
* Global session state

Avoid unnecessary global state for local UI concerns.

---

# 💎 6. Premium UI/UX Rules (Origin UI Vega Style)

## Theme

* Dark mode by default
* Main background:
  `--color-base-100: #0A0F1E`

## Interaction Rules

* Provide tactile feedback on buttons
* Use animated skeletons for loading states
* Use smooth Framer Motion transitions
* Mobile-first always

## Accessibility

* Minimum touch target size: 44px
* Maintain proper text contrast
* Avoid inaccessible UI patterns

---

# ⚡ 7. React & TypeScript Safety Rules

Before finalizing ANY modification:

* Verify React Hooks rules
* Validate dependency arrays
* Prevent stale closures
* Prevent unnecessary re-renders
* Validate props typing
* Properly cleanup async effects
* Prevent realtime listener leaks
* Prevent memory leaks in subscriptions

---

# 🔐 8. Supabase & Security Rules

## Security

* RLS (Row Level Security) MUST always remain enabled
* Never expose service_role keys
* Never trust client-side validation alone
* Sanitize unsafe HTML rendering
* Avoid `dangerouslySetInnerHTML`

## Database Rules

* Avoid recursive RLS policies
* Avoid N+1 queries
* Use `.in()` or `rpc()` when possible
* Avoid queries inside loops

---

# 💾 9. Dexie / Offline Storage Rules

* Do not store massive blobs
* Keep Dexie schema synchronized with TypeScript types
* Prevent duplicated queue items
* Avoid inconsistent offline states
* All offline operations must be retry-safe

---

# 🔍 10. Mandatory Post-Modification Validation

After modifying ANY file, the agent MUST perform a full self-review before considering the task complete.

## Required Validation Checklist

The agent MUST verify and fix:

* Syntax errors
* Undefined variables
* Missing imports
* TypeScript type errors
* Broken JSX/TSX structures
* Invalid hook usage
* Async/await mistakes
* Null/undefined access risks
* Incorrect Tailwind classes
* Supabase typing inconsistencies
* Dexie schema mismatches
* Unused variables/imports

## Mandatory Actions

After every modification:

1. Re-read the modified file completely
2. Analyze surrounding dependent files if necessary
3. Detect newly introduced errors
4. Correct issues immediately
5. Preserve architectural consistency
6. Ensure operational flow remains intact

## Strict Rules

* NEVER assume generated code is correct
* NEVER finalize tasks with unresolved syntax/type issues
* NEVER introduce placeholder code or incomplete refactors
* NEVER use `any` to suppress errors

## Quality Gate

The task is NOT complete unless:

* Code is syntactically valid
* Imports resolve correctly
* No undefined variables remain
* TypeScript strict mode passes
* Existing flows continue working
* Offline-first behavior remains intact

---

# 🧠 11. Refactor Safety Rules

When modifying existing code:

* Prefer minimal, surgical modifications
* Avoid rewriting large files unnecessarily
* Preserve existing business logic
* Maintain backward compatibility whenever possible
* Respect realtime and offline synchronization flows
* Avoid introducing architectural inconsistencies

---

# ⚠️ 12. Technical Debt & Anti-Patterns To Fix

Actively identify and eliminate the following:

## Fragile Regex Parsing

`apiService.ts` currently relies on regex parsing for product variations.

This should migrate toward:

* structured parsers
* typed schemas
* Zod validation

## God Objects

`apiService.ts` is oversized (>1000 lines).

Split into:

* `clientService`
* `productService`
* `orderService`
* `authService`

## Unsafe Casts

Remove:

```ts
(supabase as any)
```

Replace with properly typed Supabase interfaces.

## Offline Redundancy

Unify:

* local IndexedDB queues
* Supabase `pending_orders`

to avoid inconsistent states.

---

# ⚡ 13. Performance Rules

* Lazy load routes whenever possible
* Virtualize large lists
* Avoid unnecessary renders
* Use memoization only when measurable
* Lazy load images
* Minimize bundle size
* Prevent excessive realtime subscriptions

---

# 🧪 14. Testing & Stability Rules

Before finalizing tasks:

* Ensure TypeScript checks pass
* Ensure linting passes
* Validate offline mode using DevTools
* Validate realtime functionality
* Prevent listener leaks
* Validate critical operational flow

Recommended stack:

* Vitest
* Playwright
* React Testing Library

---

# ✅ 15. Pre-Finalization Checklist

Before completing ANY task:

* [ ] TypeScript passes
* [ ] No syntax errors exist
* [ ] No undefined variables remain
* [ ] Imports are valid
* [ ] Offline mode still works
* [ ] Realtime listeners are cleaned correctly
* [ ] Zod validations were added if necessary
* [ ] Critical order flow remains intact
* [ ] UI follows premium design standards
* [ ] No architectural regressions were introduced

---

> IMPORTANT:
>
> This project is a mission-critical sales platform used by field sales agents.
>
> Stability, responsiveness, offline reliability, and operational consistency are MORE IMPORTANT than unnecessary visual refactors or experimental architectural changes.
>
> Always prioritize:
>
> * Reliability
> * Performance
> * Offline-first integrity
> * Realtime stability
> * Type safety
> * Maintainability
