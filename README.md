# 🕶️ Tecnogafas PWA (2026 Edition)

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4.1-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.3-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Tecnogafas PWA** is a high-performance, mobile-first sales management platform designed for 2026. Built with a focus on speed, reliability, and offline-first capabilities, it empowers field sales agents with a premium, native-like experience.

---

## ✨ Key Features

- 🚀 **Ultra-Fast Performance**: Powered by React 19 and Vite 7.
- 📶 **Offline-First Architecture**: Seamless work without internet using **Dexie.js** and background synchronization.
- ⚡ **Real-time Updates**: Instant synchronization with **Supabase** and Server-Sent Events (SSE).
- 📱 **Native Experience**: Cross-platform deployment via **Capacitor 8.3** (Android/iOS).
- 💎 **Premium Design**: Modern UI based on **DaisyUI 5** and **Radix UI**, inspired by Linear and Vercel.
- 🔐 **Secure Auth**: PIN-based seller authentication with role-based access.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | React 19 (Strict Mode) |
| **Build Tool** | Vite 7 |
| **Language** | TypeScript 5.8 |
| **Styling** | Tailwind CSS 4.1 + DaisyUI 5 |
| **State & Offline** | Dexie.js (IndexedDB) + React Context |
| **Backend / DB** | Supabase 2.105 |
| **Animations** | Framer Motion 12.3 |
| **Mobile Shell** | Capacitor 8.3 |

---

## 📂 Project Architecture

The project follows a modular, service-oriented structure:

```text
src/
├── components/     # Atomic UI components (Buttons, Cards, Modals)
├── contexts/       # Global State (Auth, Cart, Orders, Connection)
├── hooks/          # Reusable logic (useDataSync, useCacheManager)
├── lib/            # Utilities, validators (Zod), and core configs
├── modules/        # Complex business modules (e.g., Chat, Analytics)
├── pages/          # Main application views
├── services/       # API integration & heavy business logic
├── stores/         # Dexie DB definitions (Offline Storage)
└── styles/         # Global styles and Tailwind 4 tokens
```

### 🔄 Critical Operational Flow
1. **Client Selection**: Search and assign client from `/clientes`.
2. **Product Catalog**: Browse and select variations/quantities.
3. **Cart Management**: Review and adjust in `/carrito`.
4. **Checkout**: Finalize details (IVA, discounts, notes).
5. **Security**: Mandatory 8-digit **Seller PIN** validation.
6. **Sync**: Concurrent sync to API, Email, and Real-time Chat.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (Latest LTS)
- npm or pnpm

### Installation
```bash
# Clone the repository
git clone https://github.com/24hwww/tecnogafas-app-2026.git

# Install dependencies
npm install
```

### Development
```bash
# Start local development server
npm run dev
```

### Build & Mobile
```bash
# Production build
npm run build

# Sync with Android
npm run android:sync

# Open Android Studio
npm run android:open
```

---

## 📜 Development Rules

To maintain code quality and architectural integrity:

- **Strict TypeScript**: No `any` allowed. Use Zod for API validation.
- **Offline Integrity**: Always prioritize `appDB` (Dexie) for reads.
- **UI Consistency**: Follow the **Origin UI Vega Style**. Use Framer Motion for transitions.
- **Documentation**: Refer to [AGENTS.md](./AGENTS.md) for detailed AI instruction and [DESIGN.md](./DESIGN.md) for UX guidelines.

---

## 🛡️ License

© 2026 Tecnogafas. All rights reserved. Built with ❤️ for the sales team.
