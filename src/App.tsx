import { UIProvider } from './contexts/UIContext';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { AuthProvider } from './contexts/AuthContext';
import { OrdersProvider } from './contexts/OrdersContext';
import { CartProvider } from './contexts/CartContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { useAuth } from './contexts/AuthContext';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from "./AppContext";
import { ThemeWrapper } from './components/ThemeWrapper';
import { Layout } from './components/Layout';
import { UpdatePrompt } from './components/UpdatePrompt';
import { DeployNotification } from './components/DeployNotification';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useEffect } from 'react';
import { useAndroidBack } from './hooks/useAndroidBack';
import { kodular } from './lib/kodularBridge';
import { ChatProvider } from './modules/chat';
import { Analytics } from '@vercel/analytics/react';

import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Clients from './pages/Clients';
import Orders from './pages/Orders';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import SharedCart from './pages/SharedCart';
import QRScanner from './pages/QRScanner';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import Notifications from './pages/Notifications';

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
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/carrito" element={<Cart />} />
        <Route path="/shared-cart/:code" element={<SharedCart />} />
        <Route path="/productos" element={<Products />} />
        <Route path="/clientes" element={<Clients />} />
        <Route path="/pedidos" element={<Orders />} />
        <Route path="/qr-scan" element={<QRScanner />} />
        <Route path="/pago" element={<Checkout />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/configuracion" element={<Settings />} />
        <Route path="/notificaciones" element={<Notifications />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

function AuthenticatedApp() {
  const { supabaseUser } = useAuth();
  return (
    <ChatProvider currentUserId={supabaseUser?.id || null} currentUser={supabaseUser ? { id: supabaseUser.id, username: supabaseUser.email } : null}>
       <AppInner />
    </ChatProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <UIProvider>
        <ConnectionProvider>
          <AuthProvider>
            <OrdersProvider>
              <CartProvider>
                <NotificationsProvider>
                  <AppProvider>
                    <ThemeWrapper>
                      <Router>
                        <AuthenticatedApp />
                        <Analytics />
                      </Router>
                    </ThemeWrapper>
                  </AppProvider>
                </NotificationsProvider>
              </CartProvider>
            </OrdersProvider>
          </AuthProvider>
        </ConnectionProvider>
      </UIProvider>
    </ErrorBoundary>
  );
}
