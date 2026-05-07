import type React from 'react';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { apiService } from '../services/apiService';
import type { Order } from '../types';

interface OrdersContextType {
  orders: Order[];
  totalOrders: number;
  grandTotalOrders: number;
  dashboardOrders: Order[];
  pendingOrdersCount: number;
  isOrdersLoading: boolean;
  ordersError: string | null;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setTotalOrders: React.Dispatch<React.SetStateAction<number>>;
  setGrandTotalOrders: React.Dispatch<React.SetStateAction<number>>;
  setDashboardOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setPendingOrdersCount: React.Dispatch<React.SetStateAction<number>>;
  setIsOrdersLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setOrdersError: React.Dispatch<React.SetStateAction<string | null>>;
  fetchOrders: (
    page?: number,
    perPage?: number,
    sellerId?: number,
    customerId?: number,
  ) => Promise<void>;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [grandTotalOrders, setGrandTotalOrders] = useState(0);
  const [dashboardOrders, setDashboardOrders] = useState<Order[]>([]);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const fetchOrders = async (
    page: number = 1,
    perPage: number = 25,
    sellerId?: number,
    customerId?: number,
  ) => {
    setIsOrdersLoading(true);
    setOrdersError(null);
    try {
      const o = await apiService.getOrders(page, perPage, sellerId, customerId);
      setOrders(o.orders);
      setTotalOrders(o.total);
    } catch (error) {
      console.error('Failed to fetch orders', error);
      setOrdersError('No se pudieron cargar los pedidos');
    } finally {
      setIsOrdersLoading(false);
    }
  };

  return (
    <OrdersContext.Provider
      value={{
        orders,
        totalOrders,
        grandTotalOrders,
        dashboardOrders,
        pendingOrdersCount,
        isOrdersLoading,
        ordersError,
        setOrders,
        setTotalOrders,
        setGrandTotalOrders,
        setDashboardOrders,
        setPendingOrdersCount,
        setIsOrdersLoading,
        setOrdersError,
        fetchOrders,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) throw new Error('useOrders must be used within OrdersProvider');
  return context;
}
