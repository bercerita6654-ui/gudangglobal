export interface User {
  name: string;
  phone: string;
}

export type Role = 'gudang' | 'server';

export interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  unit: string;
  img: string;
  driveId: string;
  category: string;
  merk: string;
  stockQty?: number;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  address: string;
}

export interface OrderItem {
  sku: string;
  name: string;
  supplierQty?: number;
  qty: number;
  unit?: string;
  totalQty?: number;
  price?: number;
  img?: string;
  driveId?: string;
}

export interface Order {
  id: string;
  date: string;
  customer: OrderCustomer;
  items: OrderItem[] | string;
  totalAmount?: number;
  status: string;
  note?: string;
  gudangInfo?: string;
  laporanUrl?: string;
}

export interface TransferCartItem {
  sku: string;
  name: string;
  unit: string;
  supplierQty: number;
  dest: {
    'Barang Masuk': number;
    'Toko': number;
    'Gudang Piranha': number;
    'Floor 1': number;
    'Lantai 2': number;
    'Lantai 3': number;
  };
  note: string;
}

export interface LaporanUrlItem {
  area: string;
  url: string;
}

export interface SkuHistoryRecord {
  id: string;
  date: string;
  senderArea: string;
  senderPic: string;
  targetArea: string;
  receiverPic: string;
  qtyTf: number;
  qtyDiterima: number;
  status: string;
  laporanUrl?: string;
  timestamp?: number;
}

export interface SkuGroupData {
  sku: string;
  name: string;
  unit: string;
  supplierQty: number;
  qtyTf: number;
  qtyDiterima: number;
  history: SkuHistoryRecord[];
  latestDate?: number;
  oldestDate?: number;
}

export interface AlertModalState {
  isOpen: boolean;
  type: 'success' | 'warning';
  title: string;
  message: string;
}
