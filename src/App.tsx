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
import { ErrorBoundary } from './components/ErrorBoundary';
import { lazy, Suspense, useEffect } from 'react';
import { useAndroidBack } from './hooks/useAndroidBack';
import { kodular } from './lib/kodularBridge';
import { Skeleton } from './components/Skeleton';

// Lazy load pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const Clients = lazy(() => import('./pages/Clients'));
const Orders = lazy(() => import('./pages/Orders'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Chat = lazy(() => import('./pages/Chat'));
const Settings = lazy(() => import('./pages/Settings'));
const TestApiPage = lazy(() => import('./pages/TestApiPage'));

function AppInner() {
  useAndroidBack();

  useEffect(() => {
    kodular.init();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        navigator.serviceWorker.controller?.postMessage({ type: 'APP_INACTIVE' });
      } else {
        navigator.serviceWorker.controller?.postMessage({ type: 'APP_ACTIVE' });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return (
    <Layout>
      <Suspense fallback={<div className="p-4 space-y-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-20 w-full" /></div>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/productos" element={<Products />} />
          <Route path="/clientes" element={<Clients />} />
          <Route path="/pedidos" element={<Orders />} />
          <Route path="/carrito" element={<Cart />} />
          <Route path="/pago" element={<Checkout />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/configuracion" element={<Settings />} />
          <Route path="/test" element={<TestApiPage />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
