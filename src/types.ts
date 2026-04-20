export type OrderStatus = 'pending' | 'delivered';

export interface Order {
  id: string;
  uniqueId: string;
  customerName: string;
  createdAt: Date;
  deliveryDeadline: Date;
  actualDeliveryDate?: Date;
  status: OrderStatus;
  items: string;
  priority: 'low' | 'medium' | 'high';
  tmsStatus: string;
  recipient: string;
  location: string;
  packages: number;
  weight: number;
  shift: string;
}

export interface KPIStats {
  total: number;
  onTime: number;
  late: number;
  pending: number;
  expiringSoon: number; // Within 5 days
}
