export type OrderStatus = 'pending' | 'delivered';

export interface Order {
  id: string;
  customerName: string;
  orderDate: Date;
  deliveryDeadline: Date;
  actualDeliveryDate?: Date;
  status: OrderStatus;
  items: string;
  priority: 'low' | 'medium' | 'high';
  tmsStatus: string;
}

export interface KPIStats {
  total: number;
  onTime: number;
  late: number;
  pending: number;
  expiringSoon: number; // Within 5 days
}
