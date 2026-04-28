# Sistema de Gestión de Pedidos - TecnoGafas

Esta aplicación es un sistema de gestión de pedidos para TecnoGafas, desarrollado con React, Vite y TypeScript, diseñado para optimizar el flujo de trabajo de los vendedores.

## 🚀 Arquitectura

La aplicación sigue un patrón de Single Page Application (SPA), comunicándose con una API REST servida desde `https://api.tecnogafas.com.ar`.

### Stack Tecnológico
* **Frontend:** React 18+, Vite, TypeScript, Tailwind CSS, Motion (para animaciones).
* **Gestión de Estado:** `AppContext` para manejar el estado global (vendedor actual, autenticación, carrito).
* **Comunicación:** `apiService` para interactuar con el backend REST y eventos en tiempo real.

## 🛠️ Nuevas Funcionalidades
- **Sistema de Caché:** Los productos se almacenan en caché local por 5 minutos para mejorar el rendimiento, renovándose automáticamente al expirar.
- **Tiempo Real:** Conexión mediante SSE (`/events/stream`) para recibir actualizaciones instantáneas de productos, mensajes y notificaciones.
- **Autenticación:** Sistema de PIN para gestionar la sesión del vendedor (`currentSeller`), necesario para todas las operaciones autorizadas.

## 📂 Estructura del Sistema (Resumen)

- `src/components/`, `src/pages/`: UI y vistas principales.
- `src/AppContext.tsx`: Manejo de estado centralizado, incluyendo autenticación y conexión SSE.
- `src/services/apiService.ts`: Centraliza la lógica de API (Fetch, Caching, Event Subscription).

## 🔄 Flujo de Funcionamiento

### 1. Autenticación y Identidad
Autenticación PIN vía `apiService.loginSeller()`. Al loguearse, el `AppContext` establece el `currentSeller` y activa la suscripción en tiempo real a las notificaciones y eventos del sistema.

### 2. Gestión de Productos y Caché
Para asegurar rapidez sin perder actualización:
- La primera carga obtiene los datos de la API.
- Se implementa un TTL de 5 minutos en `apiService` para reutilizar datos.
- Las actualizaciones en tiempo real (`/events/stream`) deberían invalidar o refrescar este caché.

### 3. Proceso de Pedido y Eventos
- Los eventos en tiempo real aseguran que el vendedor sea notificado inmediatamente sobre cambios en stock, estados de pedido, o mensajes.

... (resto del contenido original)
