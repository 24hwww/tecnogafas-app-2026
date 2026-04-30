/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Analytics } from "@vercel/analytics/react";
import { AppProvider } from './AppContext';
import { ThemeWrapper } from './components/ThemeWrapper';
import { Layout } from './components/Layout';
import { UpdatePrompt } from './components/UpdatePrompt';
import { DeployNotification } from './components/DeployNotification';
import { lazy, Suspense } from 'react';
import { useAndroidBack } from './hooks/useAndroidBack';
import { kodular } from './lib/kodularBridge';
import { useEffect } from 'react';

// Lazy load pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const Clients = lazy(() => import('./pages/Clients'));
const Orders = lazy(() => import('./pages/Orders'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Settings = lazy(() => import('./pages/Settings'));
const TestApiPage = lazy(() => import('./pages/TestApiPage'));

function AppInner() {
  useAndroidBack();

  useEffect(() => {
    kodular.init();
  }, []);

  return (
    <Layout>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Cargando...</div>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/productos" element={<Products />} />
          <Route path="/clientes" element={<Clients />} />
          <Route path="/pedidos" element={<Orders />} />
          <Route path="/carrito" element={<Cart />} />
          <Route path="/pago" element={<Checkout />} />
          <Route path="/notificaciones" element={<Notifications />} />
          <Route path="/configuracion" element={<Settings />} />
          <Route path="/test" element={<TestApiPage />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ThemeWrapper>
        <Router>
          <AppInner />
        </Router>
        <UpdatePrompt />
        <DeployNotification />
      </ThemeWrapper>
      <Analytics />
    </AppProvider>
  );
}
