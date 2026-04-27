# Sistema de Gestión de Pedidos - TecnoGafas

Esta aplicación es un sistema de gestión de pedidos para TecnoGafas, desarrollado con React, Vite y TypeScript, diseñado para optimizar el flujo de trabajo de los vendedores.

## 🚀 Arquitectura

La aplicación sigue un patrón de Single Page Application (SPA), comunicándose con una API REST servida desde `https://api.tecnogafas.com.ar`.

### Stack Tecnológico
* **Frontend:** React 18+, Vite, TypeScript, Tailwind CSS, Motion (para animaciones).
* **Gestión de Estado:** `AppContext` para manejar el estado global (vendedor actual, carrito, etc.).
* **Comunicación:** `apiService` para interactuar con el backend REST.

## 📂 Estructura del Sistema

- `src/components/`: Componentes UI reutilizables (Botones, Layout, Barra de navegación).
- `src/pages/`: Páginas principales:
    - **Dashboard:** Resumen y navegación principal.
    - **Productos:** Listado y filtrado de catálogo.
    - **Clientes:** Gestión de clientes (listar, crear/editar).
    - **Pedidos:** Gestión, estado y acciones sobre los pedidos.
    - **Carrito:** Visualización de artículos seleccionados.
    - **Checkout:** Proceso de finalización de pedido.
    - **Configuración:** Preferencias de la aplicación.
- `src/services/apiService.ts`: Centraliza toda la lógica de comunicación con la API.

## 🔄 Flujo de Funcionamiento

### 1. Autenticación
El sistema utiliza un inicio de sesión basado en PIN mediante `apiService.loginSeller()`. Al iniciar sesión, se establece la identidad del vendedor (`sellerId`), que es necesario para autorizar las acciones posteriores (crear pedidos, descargar PDFs, enviar emails).

### 2. Gestión de Productos y Clientes
- **Catálogo:** Los productos se obtienen desde `/productos` y se procesan localmente para manejar variantes, stock e información de filtrado.
- **Clientes:** Se gestionan mediante `/clientes`. El formulario de Checkout permite seleccionar o crear un nuevo cliente dinámicamente antes de enviar un pedido.

### 3. Proceso de Pedido (Checkout)
1. **Selección:** Los productos se añaden al carrito en el `AppContext`.
2. **Checkout:** Se completan los detalles necesarios (Cliente, Notas, Transporte, Pago).
3. **Envío:** Al confirmar, el `apiService.createOrder()` envía los datos mediante un `POST` a `/pedido`. El *Header* `Authorization: Bearer <sellerId>` garantiza que el pedido quede asociado correctamente al vendedor actual.

### 4. Gestión de Pedidos y Post-venta
Desde la página de **Pedidos**:
- **Visualización:** Lista todos los pedidos con su información (título del post, fecha, cliente, items).
- **Acciones:**
    - **Descargar PDF:** Solicita `/pedido/{orderId}/pdf`. El sistema gestiona la descarga del archivo binario directamente en el navegador.
    - **Enviar Email:** Solicita `/pedido/{orderId}/enviar`. Envía el comprobante al correo registrado.
    - **Cambiar Estado:** Permite actualizar el estado de un pedido (ej: `attended` / `unattended`) mediante `/pedido/{orderId}/estado`.

## 🛠️ Desarrollo y Pruebas

La aplicación incluye una utilidad de pruebas (`/src/pages/TestApiPage.tsx`) que permite verificar la integridad de todos los endpoints, facilitando la depuración de respuestas de la API ante diversas acciones de lectura y escritura.
