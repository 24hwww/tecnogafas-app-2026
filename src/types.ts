import type { User as SupabaseUserType } from '@supabase/supabase-js';

export type SupabaseUser = SupabaseUserType;

export interface DeployEvent {
  content?: {
    message?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface AppNotification {
  id: number;
  type: string;
  content: {
    title?: string;
    body?: string;
    [key: string]: any;
  };
  read: boolean;
  created_at: string;
  [key: string]: any;
}

export interface LastOrder {
  client: Client;
  items: CartItem[];
  details: {
    iva: number;
    discount: number;
    recargo: number;
    methodpay: string;
    transport: string;
    commit: string;
    otheremail: string;
    [key: string]: any;
  };
  total: number;
  date: string;
}

export interface ApiProduct {
  product_id: number;
  nombre_producto: string;
  variaciones: string | null;
  filtros: string | null;
}

export interface ApiClient {
  ID: number;
  display_name: string;
  user_email: string;
  billing_phone: string | null;
  billing_address_1: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  info_fiscal?: string | null;
}

export interface ApiOrder {
  ID: number;
  post_title: string;
  post_status: string;
  post_date: string;
  order_total: string | number;
  items_count: number;
  customer_id: number;
  ocode: string;
  seller_id: number;
  seller_name?: string;
  post_author: number;
  discount: string;
  recargo: string;
  transport: string;
  methodpay: string;
  iva: number;
  customer_note?: string;
  observaciones?: string;
  billing?: {
    country?: string;
  };
  items?: ApiOrderItem[];
  customer?: ApiCustomer;
}

export interface ApiOrderItem {
  product_id: number;
  name: string;
  quantity: number;
  price: number;
  vid?: string;
}

export interface ApiCustomer {
  ID: number;
  user_login?: string;
  display_name?: string;
  user_email: string;
  first_name: string;
  last_name: string;
  billing_first_name?: string;
  billing_last_name?: string;
  billing_company?: string;
  billing_email?: string;
  billing_address_1?: string;
  billing_city?: string;
  billing_state?: string;
  billing_country?: string;
  billing_phone?: string;
  info_fiscal?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  image?: string;
  description: string;
  variations?: ProductVariation[];
}

export interface ProductVariation {
  vid: string;
  title: string;
  stock: number;
  price: number;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  prescription?: string;
  billing_city?: string;
  billing_state?: string;
  cuit?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  vid?: string;
}

export interface Order {
  id: string;
  clientId: string;
  clientName: string;
  items: OrderItem[];
  total: number;
  status: 'attended' | 'unattended';
  createdAt: string;
  sellerId: string;
  sellerName?: string;
  rawData: ApiOrder;
}

export interface CartItem extends Product {
  quantity: number;
  vid?: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface Seller {
  id: string;
  name: string;
}

export interface DraftOrder {
  id: string;
  client: Client;
  items: CartItem[];
  details: any;
  status: 'no enviado' | 'enviado';
  date: string;
}

export interface SharedCart {
  id: string;
  code: string;
  client?: Client;
  items: CartItem[];
  total: number;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}
