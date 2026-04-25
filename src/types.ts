export interface ApiProduct {
  pid: number;
  nombre_producto: string;
  variaciones: string;
  filtros: string;
}

export interface ApiClient {
  ID: number;
  display_name: string;
  user_email: string;
  billing_phone: string | null;
  billing_address_1: string | null;
}

export interface ApiOrder {
  ID: number;
  post_title: string;
  post_status: string;
  post_date: string;
  order_total: string | null;
  customer_id: number | null;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  image?: string;
  description: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  prescription?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  clientId: string;
  clientName: string;
  items: OrderItem[];
  total: number;
  status: 'Pendiente' | 'En Proceso' | 'Completado' | 'Cancelado';
  createdAt: string;
}

export interface CartItem extends Product {
  quantity: number;
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
