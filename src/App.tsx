/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './AppContext';
import { ThemeWrapper } from './components/ThemeWrapper';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Clients from './pages/Clients';
import Orders from './pages/Orders';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';

export default function App() {
  return (
    <AppProvider>
      <ThemeWrapper>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/productos" element={<Products />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/pedidos" element={<Orders />} />
              <Route path="/carrito" element={<Cart />} />
              <Route path="/pago" element={<Checkout />} />
              <Route path="/notificaciones" element={<Notifications />} />
              <Route path="/configuracion" element={<Settings />} />
            </Routes>
          </Layout>
        </Router>
      </ThemeWrapper>
    </AppProvider>
  );
}
