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
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { differenceInDays, isPast, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface EfficiencyDashboardProps {
  orders: Order[];
}

type SortField = 'name' | 'total' | 'onTime' | 'late' | 'rate';
type SortOrder = 'asc' | 'desc';

export default function EfficiencyDashboard({ orders }: EfficiencyDashboardProps) {
  const [clientSearch, setClientSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('rate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Calculates stats exactly corresponding to App.tsx rules
  const metrics = useMemo(() => {
    const now = new Date();
    let total = orders.length;
    let onTime = 0;
    let late = 0;
    let expiringSoon = 0;
    let pending = 0;
    let delivered = 0;
    
    let totalWeight = 0;
    let totalPackages = 0;

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
      } else {
        delivered++;
      }

      totalWeight += order.weight || 0;
      totalPackages += order.packages || 0;
    });

    const onTimeRate = total > 0 ? Math.round((onTime / total) * 100) : 0;
    const lateRate = total > 0 ? Math.round((late / total) * 100) : 0;

    return {
      total,
      onTime,
      late,
      expiringSoon,
      pending,
      delivered,
      onTimeRate,
      lateRate,
      totalWeight: Math.round(totalWeight * 10) / 10,
      totalPackages
    };
  }, [orders]);

  // Client-by-client efficiency (On Time Medida cliente por cliente)
  const clientData = useMemo(() => {
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

  // TMS Status delay risk performance
  const tmsStatusData = useMemo(() => {
    const now = new Date();
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
      
      const daysLeft = differenceInDays(order.deliveryDeadline, now);
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
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [clientData, clientSearch, sortField, sortOrder]);

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
      { name: 'En Tiempo', value: metrics.onTime, color: '#3fb950' },
      { name: 'Fuera de Tiempo', value: metrics.late, color: '#f85149' },
      { name: 'Próximo a Vencer', value: metrics.expiringSoon, color: '#d29922' }
    ].filter(item => item.value > 0);
  }, [metrics]);

  // Clients with charts representation data (limit to top 8 of major volume or sorted by choice)
  const topClientsChartData = useMemo(() => {
    return [...clientData]
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [clientData]);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-[#161b22] border border-[#30363d] rounded-2xl text-center space-y-4">
        <div className="w-16 h-16 bg-[#3b82f6]/10 rounded-full flex items-center justify-center border border-[#3b82f6]/20">
          <BarChart3 className="w-8 h-8 text-[#58a6ff]" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[#e6edf3]">No hay datos para calcular métricas</h3>
          <p className="text-[#8b949e] max-w-md mx-auto mt-1 text-sm">
            Por favor, importe un archivo Excel con la información logística de entregas para habilitar el tablero interactivo de eficiencia.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#161b22] border-[#30363d] rounded-xl overflow-hidden shadow-none">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-[#8b949e] uppercase tracking-wider font-semibold">Tasa de On-Time</span>
              <div className="text-3xl font-extrabold text-[#3fb950] font-mono">{metrics.onTimeRate}%</div>
              <p className="text-[10px] text-[#8b949e]">Efectividad logística global</p>
            </div>
            <div className="w-12 h-12 bg-[#3fb950]/10 border border-[#3fb950]/25 rounded-full flex items-center justify-center text-[#3fb950]">
              <Percent className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#161b22] border-[#30363d] rounded-xl overflow-hidden shadow-none">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-[#8b949e] uppercase tracking-wider font-semibold">Fuera de Tiempo</span>
              <div className="text-3xl font-extrabold text-[#f85149] font-mono">{metrics.late}</div>
              <p className="text-[10px] text-[#8b949e]">{metrics.lateRate}% de desvíos totales</p>
            </div>
            <div className="w-12 h-12 bg-[#f85149]/10 border border-[#f85149]/25 rounded-full flex items-center justify-center text-[#f85149]">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#161b22] border-[#30363d] rounded-xl overflow-hidden shadow-none">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-[#8b949e] uppercase tracking-wider font-semibold">Destinatarios Únicos</span>
              <div className="text-3xl font-extrabold text-[#58a6ff] font-mono">{clientData.length}</div>
              <p className="text-[10px] text-[#8b949e]">Clientes operativos con entregas</p>
            </div>
            <div className="w-12 h-12 bg-[#58a6ff]/10 border border-[#58a6ff]/25 rounded-full flex items-center justify-center text-[#58a6ff]">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#161b22] border-[#30363d] rounded-xl overflow-hidden shadow-none">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-[#8b949e] uppercase tracking-wider font-semibold">Carga Manejada</span>
              <div className="text-2xl font-extrabold text-[#d29922] font-mono whitespace-nowrap">{metrics.totalWeight.toLocaleString()} kg</div>
              <p className="text-[10px] text-[#8b949e]">{metrics.totalPackages.toLocaleString()} bultos cargados</p>
            </div>
            <div className="w-12 h-12 bg-[#d29922]/10 border border-[#d29922]/25 rounded-full flex items-center justify-center text-[#d29922]">
              <Package className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Share Distribution Pie Chart */}
        <Card className="bg-[#161b22] border-[#30363d] lg:col-span-2 shadow-none rounded-xl">
          <CardHeader className="border-b border-[#30363d] py-4 px-6">
            <CardTitle className="text-base font-medium text-[#e6edf3]">Desglose de Estados de Entrega</CardTitle>
            <CardDescription className="text-xs text-[#8b949e]">Proporción de entregas según vencimiento general</CardDescription>
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
                                  {Math.round((data.value / metrics.total) * 100)}% del total
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
                    <span className="text-[10px] text-[#8b949e] uppercase tracking-widest font-semibold">cumplimiento</span>
                    <span className="text-3xl font-extrabold text-[#3fb950] font-sans -mt-0.5">{metrics.onTimeRate}%</span>
                    <span className="text-[9px] text-[#8b949e]">a tiempo</span>
                  </div>
                </div>

                {/* Custom list description below chart */}
                <div className="w-full grid grid-cols-3 gap-2 mt-4 text-xs">
                  <div className="flex flex-col items-center p-2 rounded-lg bg-[#0b0e14]/50 border border-[#30363d]/30">
                    <div className="flex items-center gap-1.5 text-[#3fb950] font-semibold">
                      <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
                      <span>{metrics.onTime}</span>
                    </div>
                    <span className="text-[10px] text-[#8b949e]">On Time</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-lg bg-[#0b0e14]/50 border border-[#30363d]/30">
                    <div className="flex items-center gap-1.5 text-[#f85149] font-semibold">
                      <span className="w-2 h-2 rounded-full bg-[#f85149]" />
                      <span>{metrics.late}</span>
                    </div>
                    <span className="text-[10px] text-[#8b949e]">Fuera ETA</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-lg bg-[#0b0e14]/50 border border-[#30363d]/30">
                    <div className="flex items-center gap-1.5 text-[#d29922] font-semibold">
                      <span className="w-2 h-2 rounded-full bg-[#d29922]" />
                      <span>{metrics.expiringSoon}</span>
                    </div>
                    <span className="text-[10px] text-[#8b949e]">A Vencer</span>
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
              <CardTitle className="text-base font-medium text-[#e6edf3]">On-Time % por Clientes Clave</CardTitle>
              <CardDescription className="text-xs text-[#8b949e]">Tasa de cumplimiento de los mayores clientes</CardDescription>
            </div>
            <span className="text-[10px] bg-[#21262d] border border-[#30363d] px-2 py-0.5 rounded-full text-[#8b949e] font-mono shrink-0">
              Top 8 con mayor volumen
            </span>
          </CardHeader>
          <CardContent className="p-6">
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topClientsChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={true} vertical={false} />
                  <XAxis 
                    type="number" 
                    domain={[0, 100]} 
                    stroke="#8b949e" 
                    fontSize={10} 
                    tickFormatter={(value) => `${value}%`}
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
                            <div>Efectividad On-Time: <strong className="text-[#3fb950] font-mono">{data.rate}%</strong></div>
                            <div className="text-[#8b949e]">A Tiempo: <strong className="text-white font-mono">{data.onTime}</strong> de <strong className="text-white font-mono">{data.total}</strong> pedidos</div>
                            <div className="text-[#8b949e]">Fuera de Tiempo: <strong className="text-[#f85149] font-mono">{data.late}</strong></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={14}>
                    {topClientsChartData.map((entry, index) => {
                      // Custom dynamic progress coloring based on threshold
                      let color = '#3fb950'; // excellent
                      if (entry.rate < 70) color = '#f85149'; // critical
                      else if (entry.rate < 90) color = '#d29922'; // acceptable
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* TMS Operational States on-time analysis */}
        <Card className="bg-[#161b22] border-[#30363d] lg:col-span-2 shadow-none rounded-xl">
          <CardHeader className="border-b border-[#30363d] py-4 px-6">
            <CardTitle className="text-base font-medium text-[#e6edf3]">Eficiencia por Estados de Logística (TMS)</CardTitle>
            <CardDescription className="text-xs text-[#8b949e]">Indice de regularidad en cada etapa operativa</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {tmsStatusData.map((state) => {
                let ratingColor = "bg-[#3fb950] text-[#3fb950]";
                let barColor = "bg-[#3fb950]/30";
                let textRating = "Excelente";
                
                if (state.rate < 70) {
                  ratingColor = "bg-[#f85149] text-[#f85149]";
                  barColor = "bg-[#f85149]/30";
                  textRating = "Crítico";
                } else if (state.rate < 90) {
                  ratingColor = "bg-[#d29922] text-[#d29922]";
                  barColor = "bg-[#d29922]/30";
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
              })}
            </div>
          </CardContent>
        </Card>

        {/* Client-by-Client On-Time detailed comparator */}
        <Card className="bg-[#161b22] border-[#30363d] lg:col-span-3 shadow-none rounded-xl">
          <CardHeader className="border-b border-[#30363d] py-4 px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-medium text-[#e6edf3]">Desempeño Cliente por Cliente</CardTitle>
              <CardDescription className="text-xs text-[#8b949e]">Métricas individuales de cumplimiento a tiempo</CardDescription>
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
                        <td className="py-3 px-4 font-medium text-[#e6edf3] truncate max-w-[150px]" title={client.name}>
                          {client.name}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[#8b949e]">
                          {client.total}
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
                    <td colSpan={5} className="py-6 text-center text-[#8b949e] italic">
                      No se encontraron clientes para la búsqueda
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
