export interface ApiProduct {
  product_id?: number;
  pid?: number;
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
  user_email: string;
  first_name: string;
  last_name: string;
  phone: string;
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
}

export interface Order {
  id: string;
  clientId: string;
  clientName: string;
  items: OrderItem[];
  total: number;
  status: 'Pendiente' | 'En Proceso' | 'Completado' | 'Cancelado';
  createdAt: string;
  sellerId: string;
  rawData: ApiOrder;
}

export interface CartItem extends Product {
  quantity: number;
  vid?: string;
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
