import * as React from 'react';
import { useMemo, useState } from 'react';
import { Order } from '../src/types';
import { 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Users, 
  TrendingUp, 
  BarChart3, 
  Truck, 
  Package, 
  Percent,
  Search,
  ArrowUpDown,
  CalendarDays,
  AlertTriangle
} from 'lucide-react';
import { differenceInDays, isPast, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface EfficiencyDashboardProps {
  orders: Order[];
}

type SortField = 'name' | 'total' | 'onTime' | 'late' | 'rate' | 'weight';
type SortOrder = 'asc' | 'desc';

export default function EfficiencyDashboard({ orders }: EfficiencyDashboardProps) {
  const [clientSearch, setClientSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('rate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // State for active card filter
  const [activeFilter, setActiveFilter] = useState<'all' | 'onTime' | 'late' | 'expiringSoon'>('all');
  
  // State for orders sub-table pagination
  const [orderPage, setOrderPage] = useState(1);
  const ordersPerPage = 10;

  // Calculates overall (unfiltered) metrics with deep logistics analytics
  const overallMetrics = useMemo(() => {
    const now = new Date();
    const total = orders.length;
    let onTime = 0;
    let late = 0;
    let expiringSoon = 0;
    let pending = 0;
    let delivered = 0;
    
    let totalWeight = 0;
    let totalPackages = 0;
    
    let deliveredOnTime = 0;
    let deliveredLate = 0;
    let pendingOnTime = 0;
    let pendingLate = 0;
    
    let weightOnTime = 0;
    let packagesOnTime = 0;

    let highPriorityTotal = 0;
    let highPriorityOnTime = 0;

    orders.forEach(order => {
      const isLate = (order.status === 'delivered' && order.actualDeliveryDate && order.actualDeliveryDate > order.deliveryDeadline) || 
                      (order.status === 'pending' && isPast(order.deliveryDeadline));
      
      const daysLeft = differenceInDays(order.deliveryDeadline, now);
      const isExpiringSoon = order.status === 'pending' && !isLate && daysLeft >= 0 && daysLeft <= 5;

      if (isLate) {
        late++;
      } else if (isExpiringSoon) {
        expiringSoon++;
      } else {
        onTime++;
      }

      if (order.status === 'pending') {
        pending++;
        if (!isLate) {
          pendingOnTime++;
          weightOnTime += order.weight || 0;
          packagesOnTime += order.packages || 0;
        } else {
          pendingLate++;
        }
      } else {
        delivered++;
        if (!isLate) {
          deliveredOnTime++;
          weightOnTime += order.weight || 0;
          packagesOnTime += order.packages || 0;
        } else {
          deliveredLate++;
        }
      }

      if (order.priority === 'high') {
        highPriorityTotal++;
        if (!isLate) {
          highPriorityOnTime++;
        }
      }

      totalWeight += order.weight || 0;
      totalPackages += order.packages || 0;
    });

    const onTimeRate = total > 0 ? Math.round((onTime / total) * 100) : 0;
    const lateRate = total > 0 ? Math.round((late / total) * 100) : 0;
    
    // Universal On-Time Delivery (OTD) for finalized/delivered orders ONLY
    const otdRate = delivered > 0 ? Math.round((deliveredOnTime / delivered) * 100) : 0;
    // Active SLA Compliance for pending orders
    const activeSlaRate = pending > 0 ? Math.round((pendingOnTime / pending) * 100) : 100;
    
    // Mass-to-SLA and Packages-to-SLA ratios
    const weightComplianceRate = totalWeight > 0 ? Math.round((weightOnTime / totalWeight) * 100) : 0;
    const packagesComplianceRate = totalPackages > 0 ? Math.round((packagesOnTime / totalPackages) * 100) : 0;
    // High Priority SLA Rate
    const highPrioritySlaRate = highPriorityTotal > 0 ? Math.round((highPriorityOnTime / highPriorityTotal) * 100) : 100;

    return {
      total,
      onTime,
      late,
      expiringSoon,
      pending,
      delivered,
      onTimeRate,
      lateRate,
      otdRate,
      activeSlaRate,
      deliveredOnTime,
      deliveredLate,
      pendingOnTime,
      pendingLate,
      weightComplianceRate,
      packagesComplianceRate,
      highPrioritySlaRate,
      highPriorityTotal,
      totalWeight: Math.round(totalWeight * 10) / 10,
      totalPackages
    };
  }, [orders]);

  // Handle filtering of individual order records matching the active KPI card state
  const filteredOrders = useMemo(() => {
    if (activeFilter === 'all') return orders;
    const now = new Date();
    return orders.filter(order => {
      const isLate = (order.status === 'delivered' && order.actualDeliveryDate && order.actualDeliveryDate > order.deliveryDeadline) || 
                      (order.status === 'pending' && isPast(order.deliveryDeadline));
      
      const daysLeft = differenceInDays(order.deliveryDeadline, now);
      const isExpiringSoon = order.status === 'pending' && !isLate && daysLeft >= 0 && daysLeft <= 5;

      if (activeFilter === 'onTime') {
        return !isLate && !isExpiringSoon;
      }
      if (activeFilter === 'late') {
        return isLate;
      }
      if (activeFilter === 'expiringSoon') {
        return isExpiringSoon;
      }
      return true;
    });
  }, [orders, activeFilter]);

  // Client global data representing True Overall client metrics, preventing filters from breaking client SLA rates
  const clientGlobalData = useMemo(() => {
    const now = new Date();
    const map: Record<string, {
      name: string;
      total: number;
      onTime: number;
      late: number;
      expiringSoon: number;
      delivered: number;
      weight: number;
      packages: number;
    }> = {};

    orders.forEach(order => {
      const client = order.customerName || 'Cliente Inespecífico';
      if (!map[client]) {
        map[client] = {
          name: client,
          total: 0,
          onTime: 0,
          late: 0,
          expiringSoon: 0,
          delivered: 0,
          weight: 0,
          packages: 0
        };
      }

      const isLate = (order.status === 'delivered' && order.actualDeliveryDate && order.actualDeliveryDate > order.deliveryDeadline) || 
                      (order.status === 'pending' && isPast(order.deliveryDeadline));
      
      const daysLeft = differenceInDays(order.deliveryDeadline, now);
      const isExpiringSoon = order.status === 'pending' && !isLate && daysLeft >= 0 && daysLeft <= 5;

      const record = map[client];
      record.total++;
      if (isLate) {
        record.late++;
      } else if (isExpiringSoon) {
        record.expiringSoon++;
      } else {
        record.onTime++;
      }

      if (order.status === 'delivered') {
        record.delivered++;
      }
      record.weight += order.weight || 0;
      record.packages += order.packages || 0;
    });

    return Object.values(map).map(c => {
      const rate = c.total > 0 ? Math.round((c.onTime / c.total) * 100) : 0;
      return {
        ...c,
        rate,
        weight: Math.round(c.weight * 10) / 10
      };
    });
  }, [orders]);

  // Computes client metrics containing filters and searched items to match user view state
  const clientData = useMemo(() => {
    const clientToFilteredCount: Record<string, { total: number; onTime: number; late: number; expiringSoon: number }> = {};
    
    filteredOrders.forEach(order => {
      const client = order.customerName || 'Cliente Inespecífico';
      if (!clientToFilteredCount[client]) {
        clientToFilteredCount[client] = { total: 0, onTime: 0, late: 0, expiringSoon: 0 };
      }
      
      const isLate = (order.status === 'delivered' && order.actualDeliveryDate && order.actualDeliveryDate > order.deliveryDeadline) || 
                      (order.status === 'pending' && isPast(order.deliveryDeadline));
      
      const daysLeft = differenceInDays(order.deliveryDeadline, new Date());
      const isExpiringSoon = order.status === 'pending' && !isLate && daysLeft >= 0 && daysLeft <= 5;
      
      const stats = clientToFilteredCount[client];
      stats.total++;
      if (isLate) stats.late++;
      else if (isExpiringSoon) stats.expiringSoon++;
      else stats.onTime++;
    });

    return clientGlobalData.map(gc => {
      const fCount = clientToFilteredCount[gc.name] || { total: 0, onTime: 0, late: 0, expiringSoon: 0 };
      return {
        ...gc,
        filteredTotal: fCount.total,
        filteredOnTime: fCount.onTime,
        filteredLate: fCount.late,
        filteredExpiringSoon: fCount.expiringSoon
      };
    }).filter(c => activeFilter === 'all' || c.filteredTotal > 0);
  }, [clientGlobalData, filteredOrders, activeFilter]);

  // Sorting and searching logic for client performance list
  const filteredAndSortedClients = useMemo(() => {
    const searched = clientData.filter(client => 
      client.name.toLowerCase().includes(clientSearch.toLowerCase())
    );

    return searched.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'total') {
        comparison = a.total - b.total;
      } else if (sortField === 'onTime') {
        comparison = a.onTime - b.onTime;
      } else if (sortField === 'late') {
        comparison = a.late - b.late;
      } else if (sortField === 'rate') {
        comparison = a.rate - b.rate;
      } else if (sortField === 'weight') {
        comparison = a.weight - b.weight;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [clientData, clientSearch, sortField, sortOrder]);

  // Turno (Shift) compliance rate calculations
  const shiftComplianceData = useMemo(() => {
    const map: Record<string, { name: string; total: number; onTime: number; late: number }> = {};
    orders.forEach(order => {
      const shift = order.shift || 'Sin Turno';
      if (!map[shift]) {
        map[shift] = { name: shift, total: 0, onTime: 0, late: 0 };
      }
      
      const isLate = (order.status === 'delivered' && order.actualDeliveryDate && order.actualDeliveryDate > order.deliveryDeadline) || 
                      (order.status === 'pending' && isPast(order.deliveryDeadline));
      
      const record = map[shift];
      record.total++;
      if (isLate) {
        record.late++;
      } else {
        record.onTime++;
      }
    });

    return Object.values(map).map(s => {
      const rate = s.total > 0 ? Math.round((s.onTime / s.total) * 100) : 0;
      return {
        ...s,
        rate
      };
    }).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [orders]);

  // Critical locations compliance analysis
  const locationComplianceData = useMemo(() => {
    const map: Record<string, { name: string; total: number; onTime: number; late: number }> = {};
    orders.forEach(order => {
      const loc = order.location || 'Sin Localidad';
      if (!map[loc]) {
        map[loc] = { name: loc, total: 0, onTime: 0, late: 0 };
      }
      
      const isLate = (order.status === 'delivered' && order.actualDeliveryDate && order.actualDeliveryDate > order.deliveryDeadline) || 
                      (order.status === 'pending' && isPast(order.deliveryDeadline));
      
      const record = map[loc];
      record.total++;
      if (isLate) {
        record.late++;
      } else {
        record.onTime++;
      }
    });

    return Object.values(map).map(l => {
      const rate = l.total > 0 ? Math.round((l.onTime / l.total) * 100) : 0;
      return {
        ...l,
        rate
      };
    }).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [orders]);

  // Priority-based SLA analytics
  const priorityComplianceData = useMemo(() => {
    const map: Record<string, { name: string; total: number; onTime: number; late: number; color: string }> = {
      'high': { name: 'Alta prioridad', total: 0, onTime: 0, late: 0, color: '#f85149' },
      'medium': { name: 'Media prioridad', total: 0, onTime: 0, late: 0, color: '#d29922' },
      'low': { name: 'Baja prioridad', total: 0, onTime: 0, late: 0, color: '#58a6ff' }
    };

    orders.forEach(order => {
      const prio = order.priority || 'medium';
      const record = map[prio];
      if (record) {
        record.total++;
        const isLate = (order.status === 'delivered' && order.actualDeliveryDate && order.actualDeliveryDate > order.deliveryDeadline) || 
                        (order.status === 'pending' && isPast(order.deliveryDeadline));
        if (isLate) {
          record.late++;
        } else {
          record.onTime++;
        }
      }
    });

    return Object.values(map).map(p => {
      const rate = p.total > 0 ? Math.round((p.onTime / p.total) * 100) : 100;
      return {
        ...p,
        rate
      };
    });
  }, [orders]);

  // TMS Status operational states delay risk performance based on global dataset (prevents 0% filter bug)
  const tmsStatusData = useMemo(() => {
    const map: Record<string, {
      name: string;
      total: number;
      onTime: number;
      late: number;
      expiringSoon: number;
    }> = {};

    orders.forEach(order => {
      const status = order.tmsStatus || 'Sin Estado';
      if (!map[status]) {
        map[status] = {
          name: status,
          total: 0,
          onTime: 0,
          late: 0,
          expiringSoon: 0
        };
      }

      const isLate = (order.status === 'delivered' && order.actualDeliveryDate && order.actualDeliveryDate > order.deliveryDeadline) || 
                      (order.status === 'pending' && isPast(order.deliveryDeadline));
      
      const daysLeft = differenceInDays(order.deliveryDeadline, new Date());
      const isExpiringSoon = order.status === 'pending' && !isLate && daysLeft >= 0 && daysLeft <= 5;

      const record = map[status];
      record.total++;
      if (isLate) {
        record.late++;
      } else if (isExpiringSoon) {
        record.expiringSoon++;
      } else {
        record.onTime++;
      }
    });

    return Object.values(map).map(s => {
      const rate = s.total > 0 ? Math.round((s.onTime / s.total) * 100) : 0;
      return {
        ...s,
        rate
      };
    }).sort((a, b) => b.rate - a.rate);
  }, [orders]);

  // Dynamic bar chart metric based on active filter
  const barChartMetric = useMemo(() => {
    if (activeFilter === 'all') {
      return { 
        key: 'rate', 
        label: 'Tasa On-Time %', 
        format: (v: number) => `${v}%`, 
        max: 100,
        description: 'Tasa de cumplimiento de SLA histórica general'
      };
    }
    if (activeFilter === 'onTime') {
      return { 
        key: 'filteredOnTime', 
        label: 'Entregas En Tiempo', 
        format: (v: number) => `${v}`, 
        max: undefined,
        description: 'Entregas exitosas dentro del límite establecido'
      };
    }
    if (activeFilter === 'late') {
      return { 
        key: 'filteredLate', 
        label: 'Entregas Fuera de Tiempo', 
        format: (v: number) => `${v}`, 
        max: undefined,
        description: 'Volumen de entregas con demoras (SLA vencido)'
      };
    }
    return { 
      key: 'filteredExpiringSoon', 
      label: 'Entregas Próximas a Vencer', 
      format: (v: number) => `${v}`, 
      max: undefined,
      description: 'Carga de trabajo crítica próxima a vencer (<= 5 días)'
    };
  }, [activeFilter]);

  // Sorting handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Pie chart formatted data
  const pieData = useMemo(() => {
    return [
      { name: 'En Tiempo', value: overallMetrics.onTime, color: '#3fb950' },
      { name: 'Fuera de Tiempo', value: overallMetrics.late, color: '#f85149' },
      { name: 'Próximo a Vencer', value: overallMetrics.expiringSoon, color: '#d29922' }
    ].filter(item => item.value > 0);
  }, [overallMetrics]);

  // Clients with charts representation data (limit to top 8 of major volume)
  const topClientsChartData = useMemo(() => {
    return [...clientData]
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [clientData]);

  // Filtered orders paginated list
  const paginatedFilteredOrders = useMemo(() => {
    const start = (orderPage - 1) * ordersPerPage;
    return filteredOrders.slice(start, start + ordersPerPage);
  }, [filteredOrders, orderPage]);

  const totalOrderPages = Math.ceil(filteredOrders.length / ordersPerPage);

  const toggleFilter = (filterType: 'all' | 'onTime' | 'late' | 'expiringSoon') => {
    setActiveFilter(prev => {
      const nextFilter = prev === filterType ? 'all' : filterType;
      setOrderPage(1); // Reset page selection on filter toggling
      return nextFilter;
    });
  };

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-[#161b22] border border-[#30363d] rounded-2xl text-center space-y-4">
        <div className="w-16 h-16 bg-[#3b82f6]/10 rounded-full flex items-center justify-center border border-[#3b82f6]/20">
          <BarChart3 className="w-8 h-8 text-[#58a6ff]" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[#e6edf3]">No hay datos para calcular métricas</h3>
          <p className="text-[#8b949e] max-w-md mx-auto mt-1 text-sm">
            Por favor, importe un archivo Excel con la información de logística para habilitar el reporte de efectividad táctica.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 8 Core Logistic KPIs Panel */}
      <div>
        <p className="text-xs text-[#8b949e] mb-3 px-1 font-sans flex items-center gap-1">
          <span>💡</span> 
          <span><strong>Panel Interactivo:</strong> Haga clic en las tarjetas de <strong>Pedidos</strong>, <strong>En Tiempo</strong>, <strong>Fuera de Tiempo</strong> o <strong>Próximos a Vencer</strong> para filtrar el reporte completo.</span>
        </p>
        
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* KPI 1: Universo de Pedidos (Interactive Filter) */}
          <Card 
            id="kpi-card-all"
            onClick={() => toggleFilter('all')}
            className={cn(
              "rounded-xl overflow-hidden shadow-none cursor-pointer border transition-all text-left relative",
              activeFilter === 'all' 
                ? "bg-[#1f293d]/60 border-[#58a6ff] ring-1 ring-[#58a6ff]/40 shadow-lg" 
                : "bg-[#161b22] border-[#30363d] hover:border-[#58a6ff]/50 hover:bg-[#161b22]/70"
            )}
          >
            {activeFilter === 'all' && (
              <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#58a6ff] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#58a6ff]"></span>
              </span>
            )}
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] text-[#8b949e] uppercase tracking-wider font-semibold">Total de Pedidos</span>
                <div className="text-2xl font-extrabold text-[#e6edf3] font-mono">{overallMetrics.total}</div>
                <div className="text-[10px] text-[#8b949e] flex items-center gap-1">
                  <span>{overallMetrics.pending} pendientes</span>
                  <span>•</span>
                  <span>{overallMetrics.delivered} ent.</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-[#58a6ff]/10 border border-[#58a6ff]/25 rounded-full flex items-center justify-center text-[#58a6ff]">
                <BarChart3 className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>

          {/* KPI 2: Entregas En Tiempo (Interactive Filter) */}
          <Card 
            id="kpi-card-on-time"
            onClick={() => toggleFilter('onTime')}
            className={cn(
              "rounded-xl overflow-hidden shadow-none cursor-pointer border transition-all text-left relative",
              activeFilter === 'onTime' 
                ? "bg-[#1a3024]/60 border-[#3fb950] ring-1 ring-[#3fb950]/40 shadow-lg" 
                : "bg-[#161b22] border-[#30363d] hover:border-[#3fb950]/50 hover:bg-[#161b22]/70"
            )}
          >
            {activeFilter === 'onTime' && (
              <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3fb950] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3fb950]"></span>
              </span>
            )}
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] text-[#8b949e] uppercase tracking-wider font-semibold">SLA En Tiempo</span>
                <div className="text-2xl font-extrabold text-[#3fb950] font-mono">{overallMetrics.onTime}</div>
                <div className="text-[10px] text-[#3fb950] font-medium">Tasa General: {overallMetrics.onTimeRate}%</div>
              </div>
              <div className="w-10 h-10 bg-[#3fb950]/10 border border-[#3fb950]/25 rounded-full flex items-center justify-center text-[#3fb950]">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>

          {/* KPI 3: Fuera de Tiempo (Interactive Filter) */}
          <Card 
            id="kpi-card-late"
            onClick={() => toggleFilter('late')}
            className={cn(
              "rounded-xl overflow-hidden shadow-none cursor-pointer border transition-all text-left relative",
              activeFilter === 'late' 
                ? "bg-[#351e1e]/60 border-[#f85149] ring-1 ring-[#f85149]/40 shadow-lg" 
                : "bg-[#161b22] border-[#30363d] hover:border-[#f85149]/50 hover:bg-[#161b22]/70"
            )}
          >
            {activeFilter === 'late' && (
              <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f85149] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f85149]"></span>
              </span>
            )}
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] text-[#8b949e] uppercase tracking-wider font-semibold">Fuera de SLA / Demoras</span>
                <div className="text-2xl font-extrabold text-[#f85149] font-mono">{overallMetrics.late}</div>
                <div className="text-[10px] text-[#f85149] font-medium">Tercerización: {overallMetrics.lateRate}%</div>
              </div>
              <div className="w-10 h-10 bg-[#f85149]/10 border border-[#f85149]/25 rounded-full flex items-center justify-center text-[#f85149]">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>

          {/* KPI 4: A Vencer (Interactive Filter) */}
          <Card 
            id="kpi-card-expiring"
            onClick={() => toggleFilter('expiringSoon')}
            className={cn(
              "rounded-xl overflow-hidden shadow-none cursor-pointer border transition-all text-left relative",
              activeFilter === 'expiringSoon' 
                ? "bg-[#302619]/60 border-[#d29922] ring-1 ring-[#d29922]/40 shadow-lg" 
                : "bg-[#161b22] border-[#30363d] hover:border-[#d29922]/50 hover:bg-[#161b22]/70"
            )}
          >
            {activeFilter === 'expiringSoon' && (
              <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d29922] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#d29922]"></span>
              </span>
            )}
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] text-[#8b949e] uppercase tracking-wider font-semibold">Próximo a Vencer</span>
                <div className="text-2xl font-extrabold text-[#d29922] font-mono">{overallMetrics.expiringSoon}</div>
                <div className="text-[10px] text-[#d29922] font-medium">Vencimiento &lt;= 5 días</div>
              </div>
              <div className="w-10 h-10 bg-[#d29922]/10 border border-[#d29922]/25 rounded-full flex items-center justify-center text-[#d29922]">
                <Clock className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>

        </section>

        {/* 4 Secondary Advanced Metrics Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          
          {/* SLA 5: OTD Entregados (industry standard) */}
          <Card className="bg-[#0f141c] border-[#30363d]/60 rounded-xl overflow-hidden">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-500/15 border border-emerald-500/25 rounded-lg flex items-center justify-center text-emerald-500 font-mono font-bold text-xs">
                OTD
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-[#8b949e] uppercase tracking-wider font-semibold">Tasa OTD (Finalizados)</span>
                <div className="text-lg font-bold text-[#e6edf3] font-mono">{overallMetrics.otdRate}%</div>
                <p className="text-[9px] text-[#8b949e] leading-none">Efectividad real de entregados</p>
              </div>
            </CardContent>
          </Card>

          {/* SLA 6: SLA Pendientes Activos */}
          <Card className="bg-[#0f141c] border-[#30363d]/60 rounded-xl overflow-hidden">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-[#58a6ff]/15 border border-[#58a6ff]/25 rounded-lg flex items-center justify-center text-[#58a6ff] font-mono font-bold text-xs">
                SLA
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-[#8b949e] uppercase tracking-wider font-semibold">SLA Pipeline Activo</span>
                <div className="text-lg font-bold text-[#e6edf3] font-mono">{overallMetrics.activeSlaRate}%</div>
                <p className="text-[9px] text-[#8b949e] leading-none">{overallMetrics.pending - overallMetrics.pendingLate} de {overallMetrics.pending} vigentes</p>
              </div>
            </CardContent>
          </Card>

          {/* SLA 7: Kilos a Tiempo */}
          <Card className="bg-[#0f141c] border-[#30363d]/60 rounded-xl overflow-hidden">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-500/15 border border-amber-500/25 rounded-lg flex items-center justify-center text-amber-500 font-mono font-bold text-xs">
                KG
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-[#8b949e] uppercase tracking-wider font-semibold">Efectividad por Carga (Kg)</span>
                <div className="text-lg font-bold text-[#e6edf3] font-mono">{overallMetrics.weightComplianceRate}%</div>
                <p className="text-[9px] text-[#8b949e] leading-none">{overallMetrics.totalWeight.toLocaleString()} kg totales gestionados</p>
              </div>
            </CardContent>
          </Card>

          {/* SLA 8: Prioridad Alta Compliance */}
          <Card className="bg-[#0f141c] border-[#30363d]/60 rounded-xl overflow-hidden">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-rose-500/15 border border-rose-500/25 rounded-lg flex items-center justify-center text-rose-500 font-mono font-bold text-xs">
                SLA H
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-[#8b949e] uppercase tracking-wider font-semibold">SLA Prioridad Alta</span>
                <div className="text-lg font-bold text-[#e6edf3] font-mono">{overallMetrics.highPrioritySlaRate}%</div>
                <p className="text-[9px] text-[#8b949e] leading-none">{overallMetrics.highPriorityTotal} pedidos de urgencia máxima</p>
              </div>
            </CardContent>
          </Card>

        </section>
      </div>

      {/* Segment Meta Info Sub-banner and Active SLA status bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-[#8b949e] bg-[#161b22]/40 p-3 border border-[#30363d]/60 rounded-xl justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#58a6ff]" />
            <span>Destinatarios Únicos: <strong className="text-[#e6edf3]">{clientData.length}</strong></span>
          </div>
          <span className="w-px h-3 bg-[#30363d] hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-amber-500" />
            <span>Bultos totales: <strong className="text-[#e6edf3]">{overallMetrics.totalPackages.toLocaleString()}</strong></span>
          </div>
          <span className="w-px h-3 bg-[#30363d] hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <span>Efectividad en Bultos: <strong className="text-[#3fb950] font-mono">{overallMetrics.packagesComplianceRate}% a tiempo</strong></span>
          </div>
        </div>
        
        {/* Active Filter Indication Badge */}
        <div className="flex items-center gap-2">
          {activeFilter !== 'all' ? (
            <Badge variant="outline" className="bg-[#3fb950]/10 border-[#3fb950]/30 text-[#3fb950] flex items-center gap-1 py-0.5 px-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
              <span>
                Filtro Activo de Registros: {activeFilter === 'onTime' ? 'En Tiempo' : activeFilter === 'late' ? 'Fuera de Tiempo' : 'Próximos a Vencer'}
              </span>
              <button 
                onClick={() => toggleFilter('all')} 
                className="ml-1.5 font-bold hover:text-white cursor-pointer select-none text-[11px]"
                title="Quitar filtro"
              >
                ✕
              </button>
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-white/5 border-[#30363d] text-[#8b949e]">
              Visualización: Datos Totales de Calicio S.A.
            </Badge>
          )}
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Share Distribution Pie Chart */}
        <Card className="bg-[#161b22] border-[#30363d] lg:col-span-2 shadow-none rounded-xl">
          <CardHeader className="border-b border-[#30363d] py-4 px-6">
            <CardTitle className="text-base font-medium text-[#e6edf3]">Desglose Global de Cumplimiento</CardTitle>
            <CardDescription className="text-xs text-[#8b949e]">Distribución de entregas según vencimiento de SLA</CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[300px]">
            {pieData.length > 0 ? (
              <>
                <div className="w-full h-52 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-[#161b22] border border-[#30363d] p-2.5 rounded-lg text-xs leading-5">
                                <span className="font-semibold text-[#e6edf3]">{data.name}</span>: <strong className="text-white font-mono">{data.value}</strong> pedidos
                                <div className="text-[#8b949e] font-sans font-normal">
                                  {Math.round((data.value / overallMetrics.total) * 100)}% del universo total
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Gauge indicator inner label */}
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] text-[#8b949e] uppercase tracking-widest font-semibold">TASA SLA</span>
                    <span className="text-3xl font-extrabold text-[#3fb950] font-sans -mt-0.5">{overallMetrics.onTimeRate}%</span>
                    <span className="text-[9px] text-[#8b949e] font-medium text-[#3fb950]">efectiva global</span>
                  </div>
                </div>

                {/* Legend list description below chart */}
                <div className="w-full grid grid-cols-3 gap-2 mt-4 text-xs">
                  <div className="flex flex-col items-center p-2 rounded-lg bg-[#0b0e14]/50 border border-[#30363d]/30 text-center">
                    <div className="flex items-center gap-1.5 text-[#3fb950] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
                      <span>{overallMetrics.onTime}</span>
                    </div>
                    <span className="text-[9px] text-[#8b949e] mt-0.5 uppercase tracking-wider font-semibold">On Time</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-lg bg-[#0b0e14]/50 border border-[#30363d]/30 text-center">
                    <div className="flex items-center gap-1.5 text-[#f85149] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f85149]" />
                      <span>{overallMetrics.late}</span>
                    </div>
                    <span className="text-[9px] text-[#8b949e] mt-0.5 uppercase tracking-wider font-semibold">Demorado</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-lg bg-[#0b0e14]/50 border border-[#30363d]/30 text-center">
                    <div className="flex items-center gap-1.5 text-[#d29922] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#d29922]" />
                      <span>{overallMetrics.expiringSoon}</span>
                    </div>
                    <span className="text-[9px] text-[#8b949e] mt-0.5 uppercase tracking-wider font-semibold">A Vencer</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-[#8b949e] text-sm">Sin suficientes valores para graficar</div>
            )}
          </CardContent>
        </Card>

        {/* Efficiencies Top Clients Bar Chart */}
        <Card className="bg-[#161b22] border-[#30363d] lg:col-span-3 shadow-none rounded-xl">
          <CardHeader className="border-b border-[#30363d] py-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-medium text-[#e6edf3]">
                {barChartMetric.label} por Clientes Clave
              </CardTitle>
              <CardDescription className="text-xs text-[#8b949e]">
                {barChartMetric.description}
              </CardDescription>
            </div>
            <span className="text-[10px] bg-[#21262d] border border-[#30363d] px-2 py-0.5 rounded-full text-[#8b949e] font-mono shrink-0">
              Top 8 con mayor volumen
            </span>
          </CardHeader>
          <CardContent className="p-6">
            <div className="w-full h-64">
              {topClientsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topClientsChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={true} vertical={false} />
                    <XAxis 
                      type="number" 
                      domain={barChartMetric.max ? [0, barChartMetric.max] : ['auto', 'auto']} 
                      stroke="#8b949e" 
                      fontSize={10} 
                      tickFormatter={barChartMetric.format}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      stroke="#8b949e" 
                      fontSize={10} 
                      width={100}
                      tickFormatter={(value) => value.length > 15 ? `${value.slice(0, 13)}...` : value}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#161b22] border border-[#30363d] p-3 rounded-lg text-xs shadow-xl leading-5">
                              <div className="font-semibold text-white border-b border-[#30363d] pb-1.5 mb-1.5">{data.name}</div>
                              <div>Tasa de SLA Global: <strong className="text-[#3fb950] font-mono">{data.rate}%</strong></div>
                              <div className="text-[#8b949e] mt-1">Pedidos Totales: <strong className="text-white font-mono">{data.total}</strong></div>
                              <div className="text-[#8b949e]">Pedidos A Tiempo: <strong className="text-[#3fb950] font-mono">{data.onTime}</strong></div>
                              <div className="text-[#8b949e]">Pedidos Demorados: <strong className="text-[#f85149] font-mono">{data.late}</strong></div>
                              <div className="text-[#8b949e]">Kilos totals: <strong className="text-[#e6edf3] font-mono">{data.weight.toLocaleString()} kg</strong></div>
                              {activeFilter !== 'all' && (
                                <div className="mt-1.5 pt-1.5 border-t border-[#30363d]/60 text-emerald-400">
                                  Coincidentes con filtro activo: <strong className="font-mono font-bold text-white">{data.filteredTotal}</strong>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey={barChartMetric.key} radius={[0, 4, 4, 0]} barSize={14}>
                      {topClientsChartData.map((entry, index) => {
                        let color = '#3fb950';
                        if (activeFilter === 'all') {
                          if (entry.rate < 70) color = '#f85149';
                          else if (entry.rate < 90) color = '#d29922';
                        } else if (activeFilter === 'late') {
                          color = '#f85149';
                        } else if (activeFilter === 'expiringSoon') {
                          color = '#d29922';
                        }
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-[#8b949e] italic">
                  Sin datos aplicables para este segmento
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLA by Priority, Location & Shift Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card A: Priority Compliance */}
        <Card className="bg-[#161b22] border-[#30363d] shadow-none rounded-xl">
          <CardHeader className="border-b border-[#30363d] py-3 px-5">
            <CardTitle className="text-sm font-semibold text-[#e6edf3] flex items-center justify-between">
              <span>SLA por Prioridad del Pedido</span>
              <TrendingUp className="w-4 h-4 text-[#3fb950]" />
            </CardTitle>
            <CardDescription className="text-[11px] text-[#8b949e]">Cumplimiento porcentual según urgencia comercial</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {priorityComplianceData.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-[#e6edf3] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-[#8b949e]">({item.onTime}/{item.total} OK)</span>
                    <strong className="text-white font-bold">{item.rate}%</strong>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-[#0b0e14] rounded-full overflow-hidden border border-[#30363d]/50">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.rate}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Card B: Turno (Shift) Compliance */}
        <Card className="bg-[#161b22] border-[#30363d] shadow-none rounded-xl">
          <CardHeader className="border-b border-[#30363d] py-3 px-5">
            <CardTitle className="text-sm font-semibold text-[#e6edf3] flex items-center justify-between">
              <span>Desempeño por Turno Diario</span>
              <CalendarDays className="w-4 h-4 text-[#58a6ff]" />
            </CardTitle>
            <CardDescription className="text-[11px] text-[#8b949e]">Efectividad logística según franjahoraria / Turno</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {shiftComplianceData.length > 0 ? (
              shiftComplianceData.map((item) => {
                let colorClass = "bg-[#3fb950]";
                if (item.rate < 70) colorClass = "bg-[#f85149]";
                else if (item.rate < 90) colorClass = "bg-[#d29922]";

                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-[#e6edf3] font-mono text-[11px] bg-[#0b0e14] border border-[#30363d] px-1.5 py-0.5 rounded truncate max-w-[120px]" title={item.name}>
                        {item.name}
                      </span>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="text-[#8b949e]">({item.total} ped)</span>
                        <strong className="text-white">{item.rate}%</strong>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-[#0b0e14] rounded-full overflow-hidden border border-[#30363d]/50">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-500", colorClass)}
                        style={{ width: `${item.rate}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-xs text-[#8b949e] italic">No se registran turnos de entrega</div>
            )}
          </CardContent>
        </Card>

        {/* Card C: Location Compliance */}
        <Card className="bg-[#161b22] border-[#30363d] shadow-none rounded-xl">
          <CardHeader className="border-b border-[#30363d] py-3 px-5">
            <CardTitle className="text-sm font-semibold text-[#e6edf3] flex items-center justify-between">
              <span>SLA en Localidades Líderes</span>
              <Truck className="w-4 h-4 text-[#d29922]" />
            </CardTitle>
            <CardDescription className="text-[11px] text-[#8b949e]">Cumplimiento OTD de las 5 mayores localidades</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {locationComplianceData.length > 0 ? (
              locationComplianceData.map((item) => {
                let colorClass = "bg-[#3fb950]";
                if (item.rate < 70) colorClass = "bg-[#f85149]";
                else if (item.rate < 90) colorClass = "bg-[#d29922]";

                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-[#c9d1d9] truncate max-w-[130px]" title={item.name}>
                        {item.name}
                      </span>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="text-[#8b949e]">({item.total} ped)</span>
                        <strong className="text-white">{item.rate}%</strong>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-[#0b0e14] rounded-full overflow-hidden border border-[#30363d]/50">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-500", colorClass)}
                        style={{ width: `${item.rate}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-xs text-[#8b949e] italic">No se registran localidades en la base</div>
            )}
          </CardContent>
        </Card>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* TMS Operational States Delay Risk */}
        <Card className="bg-[#161b22] border-[#30363d] lg:col-span-2 shadow-none rounded-xl">
          <CardHeader className="border-b border-[#30363d] py-4 px-6">
            <CardTitle className="text-base font-medium text-[#e6edf3]">Eficiencia por Estados de Logística (TMS)</CardTitle>
            <CardDescription className="text-xs text-[#8b949e]">Índice de regularidad en cada etapa operativa general</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {tmsStatusData.length > 0 ? (
                tmsStatusData.map((state) => {
                  let ratingColor = "bg-[#3fb950] text-[#3fb950]";
                  let textRating = "Excelente";
                  
                  if (state.rate < 70) {
                    ratingColor = "bg-[#f85149] text-[#f85149]";
                    textRating = "Crítico";
                  } else if (state.rate < 90) {
                    ratingColor = "bg-[#d29922] text-[#d29922]";
                    textRating = "Regular";
                  }

                  return (
                    <div key={state.name} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#e6edf3] font-mono text-[11px] bg-[#0b0e14] px-2 py-0.5 border border-[#30363d] rounded">
                            {state.name}
                          </span>
                          <span className="text-[10px] text-[#8b949e]">({state.total} ped)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#8b949e]">{textRating}</span>
                          <strong className="font-mono text-white">{state.rate}%</strong>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-[#0b0e14] rounded-full overflow-hidden border border-[#30363d]/50">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-500", ratingColor.split(' ')[0])}
                          style={{ width: `${state.rate}%` }}
                        />
                      </div>
                      {state.late > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-[#f85149]">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>Contiene {state.late} entregas fuera de fecha de vencimiento ETA</span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-[#8b949e] italic">
                  Sin datos operacionales coincidentes
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Client-by-Client dynamic detailed table */}
        <Card className="bg-[#161b22] border-[#30363d] lg:col-span-3 shadow-none rounded-xl">
          <CardHeader className="border-b border-[#30363d] py-4 px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-medium text-[#e6edf3]">Desempeño Cliente por Cliente</CardTitle>
              <CardDescription className="text-xs text-[#8b949e]">Métricas de cumplimiento calculadas sobre su base general</CardDescription>
            </div>
            
            <div className="relative w-full md:w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8b949e]" />
              <Input
                placeholder="Buscar cliente..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-[#0b0e14] border-[#30363d] text-[#e6edf3]"
              />
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#30363d] text-[#8b949e] font-sans font-medium hover:bg-transparent">
                  <th className="py-2.5 px-4 cursor-pointer hover:text-[#e6edf3] select-none" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">
                      Cliente
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3 text-right cursor-pointer hover:text-[#e6edf3] select-none" onClick={() => handleSort('total')}>
                    <div className="flex items-center justify-end gap-1">
                      Pedidos
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3 text-right cursor-pointer hover:text-[#e6edf3] select-none" onClick={() => handleSort('weight')}>
                    <div className="flex items-center justify-end gap-1">
                      Kilos Totales
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3 text-right cursor-pointer hover:text-[#e6edf3] select-none" onClick={() => handleSort('onTime')}>
                    <div className="flex items-center justify-end gap-1 text-[#3fb950]">
                      A Tiempo
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3 text-right cursor-pointer hover:text-[#e6edf3] select-none" onClick={() => handleSort('late')}>
                    <div className="flex items-center justify-end gap-1 text-[#f85149]">
                      Fuera ETA
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-2.5 px-4 text-right cursor-pointer hover:text-[#e6edf3] select-none" onClick={() => handleSort('rate')}>
                    <div className="flex items-center justify-end gap-1">
                      Cumplimiento %
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d]/55">
                {filteredAndSortedClients.length > 0 ? (
                  filteredAndSortedClients.map(client => {
                    let progressBgColor = "bg-[#3fb950]";
                    let performanceText = "Alto";
                    let textClass = "text-[#3fb950]";

                    if (client.rate < 70) {
                      progressBgColor = "bg-[#f85149]";
                      performanceText = "Crítico";
                      textClass = "text-[#f85149]";
                    } else if (client.rate < 90) {
                      progressBgColor = "bg-[#d29922]";
                      performanceText = "Medio";
                      textClass = "text-[#d29922]";
                    }

                    return (
                      <tr key={client.name} className="hover:bg-[#1c2128]/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-[#e6edf3] truncate max-w-[130px]" title={client.name}>
                          {client.name}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[#8b949e]">
                          {activeFilter !== 'all' ? (
                            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1 py-0.5 rounded leading-none mr-1.5" title="Coincidentes con filtro">
                              {client.filteredTotal} matched
                            </span>
                          ) : null}
                          {client.total}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[#8b949e]">
                          {client.weight.toLocaleString()} kg
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[#3fb950] font-medium">
                          {client.onTime}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[#f85149]">
                          {client.late}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center gap-1.5 leading-none">
                              <span className={cn("text-[10px] uppercase tracking-wider font-semibold", textClass)}>
                                {performanceText}
                              </span>
                              <strong className="font-mono text-white text-[13px]">{client.rate}%</strong>
                            </div>
                            <div className="w-[110px] h-1.5 bg-[#0b0e14] border border-[#30363d]/50 rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full rounded-full", progressBgColor)}
                                style={{ width: `${client.rate}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[#8b949e] italic">
                      No se encontraron clientes para la búsqueda
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Dynamic Filtered Orders Details Log Table (Shown when any filter is active) */}
      {activeFilter !== 'all' && (
        <Card className="bg-[#161b22] border-[#30363d] shadow-none rounded-xl mt-6 overflow-hidden">
          <CardHeader className="border-b border-[#30363d] py-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#0b0e14]/30">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-[#e6edf3]">
                  Listado Detallado de Pedidos en Filtro Activo
                </CardTitle>
                <Badge variant="outline" className={cn(
                  "text-[10px] leading-none px-2 py-0.5 font-semibold",
                  activeFilter === 'onTime' && "bg-[#3fb950]/10 border-[#3fb950]/20 text-[#3fb950]",
                  activeFilter === 'late' && "bg-[#f85149]/10 border-[#f85149]/20 text-[#f85149]",
                  activeFilter === 'expiringSoon' && "bg-[#d29922]/10 border-[#d29922]/20 text-[#d29922]"
                )}>
                  {activeFilter === 'onTime' ? 'En Tiempo' : activeFilter === 'late' ? 'Fuera de Tiempo' : 'Próximos a Vencer'} ({filteredOrders.length})
                </Badge>
              </div>
              <CardDescription className="text-xs text-[#8b949e]">
                Registros individuales de carga incluidos en la clasificación seleccionada
              </CardDescription>
            </div>
            
            <button 
              onClick={() => toggleFilter('all')} 
              className="text-xs text-[#8b949e] hover:text-[#e6edf3] bg-[#21262d] border border-[#30363d] rounded-lg px-2.5 py-1 transition-colors cursor-pointer"
            >
              Quitar Filtro
            </button>
          </CardHeader>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#30363d] text-[#8b949e] bg-[#0b0e14]/10 font-sans font-medium">
                  <th className="py-2.5 px-4">Pedido ID</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Destinatario</th>
                  <th className="py-2.5 px-3">Ubicación / Destino</th>
                  <th className="py-2.5 px-3 text-center font-mono">Turno</th>
                  <th className="py-2.5 px-3 text-right">Peso</th>
                  <th className="py-2.5 px-3 text-right">Bultos</th>
                  <th className="py-2.5 px-3 text-center">Días Transcurridos</th>
                  <th className="py-2.5 px-3 text-center">SLA Límite</th>
                  <th className="py-2.5 px-4 text-center">Estado TMS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d]/55">
                {paginatedFilteredOrders.length > 0 ? (
                  paginatedFilteredOrders.map((order) => {
                    const parsedDeadline = typeof order.deliveryDeadline === 'string' 
                      ? new Date(order.deliveryDeadline) 
                      : order.deliveryDeadline;
                    const formatLimit = format(parsedDeadline, 'dd/MM/yy HH:mm');

                    const createdAtDate = typeof order.createdAt === 'string'
                      ? new Date(order.createdAt)
                      : order.createdAt;
                    const elapsedDays = Math.max(0, differenceInDays(new Date(), createdAtDate));
                    
                    return (
                      <tr key={order.id} className="hover:bg-[#1c2128]/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#58a6ff]">
                          {order.id}
                        </td>
                        <td className="py-3 px-3 font-medium text-[#e6edf3]">
                          {order.customerName}
                        </td>
                        <td className="py-3 px-3 text-[#e6edf3] font-medium truncate max-w-[150px]" title={order.recipient}>
                          {order.recipient || '-'}
                        </td>
                        <td className="py-3 px-3 text-[#8b949e]">
                          {order.location}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-[#8b949e]">
                          {order.shift}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[#e6edf3]">
                          {order.weight} kg
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[#e6edf3]">
                          {order.packages}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border",
                            elapsedDays === 0 && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                            elapsedDays > 0 && elapsedDays <= 3 && "bg-[#1f6feb]/10 text-[#58a6ff] border-[#1f6feb]/20",
                            elapsedDays > 3 && elapsedDays <= 6 && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                            elapsedDays > 6 && "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          )}>
                            {elapsedDays} {elapsedDays === 1 ? 'día' : 'días'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-[#8b949e]">
                          {formatLimit}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#21262d] text-[#8b949e] border border-[#30363d]">
                            {order.tmsStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-[#8b949e] italic">
                      No hay registros coincidentes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          {totalOrderPages > 1 && (
            <div className="border-t border-[#30363d] py-3 px-4 flex items-center justify-between text-xs bg-[#0b0e14]/20">
              <span className="text-[#8b949e]">
                Mostrando <strong className="text-white">{(orderPage - 1) * ordersPerPage + 1}</strong> - <strong className="text-white">{Math.min(orderPage * ordersPerPage, filteredOrders.length)}</strong> de <strong className="text-white">{filteredOrders.length}</strong> pedidos
              </span>
              <div className="flex gap-1.5">
                <Button
                  id="order-page-prev"
                  variant="outline"
                  size="sm"
                  disabled={orderPage === 1}
                  onClick={() => setOrderPage(p => Math.max(1, p - 1))}
                  className="h-7 text-xs bg-[#0b0e14] border-[#30363d] hover:bg-[#21262d] text-[#e6edf3] cursor-pointer"
                >
                  Anterior
                </Button>
                <Button
                  id="order-page-next"
                  variant="outline"
                  size="sm"
                  disabled={orderPage === totalOrderPages}
                  onClick={() => setOrderPage(p => Math.min(totalOrderPages, p + 1))}
                  className="h-7 text-xs bg-[#0b0e14] border-[#30363d] hover:bg-[#21262d] text-[#e6edf3] cursor-pointer"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
