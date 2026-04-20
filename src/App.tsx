import * as React from 'react';
import { useState, useMemo, useEffect, ChangeEvent, ReactNode } from 'react';
import { 
  Plus, 
  FileUp, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  ChevronRight,
  Filter,
  BarChart3,
  CalendarDays
} from 'lucide-react';
import { format, isPast, isWithinInterval, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster } from 'sonner';

import { Order, KPIStats } from './types';
import { mockOrders } from './mockData';
import { parseExcelFile } from './lib/excel-utils';

import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type FilterType = 'all' | 'onTime' | 'late' | 'pending' | 'expiringSoon';

export default function App() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [isImporting, setIsImporting] = useState(false);

  // Apply dark mode on mount
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const kpis = useMemo((): KPIStats => {
    const now = new Date();
    const stats = {
      total: orders.length,
      onTime: 0,
      late: 0,
      pending: 0,
      expiringSoon: 0,
    };

    orders.forEach(order => {
      if (order.status === 'delivered') {
        if (order.actualDeliveryDate && order.actualDeliveryDate <= order.deliveryDeadline) {
          stats.onTime++;
        } else {
          stats.late++;
        }
      } else {
        stats.pending++;
        const daysLeft = differenceInDays(order.deliveryDeadline, now);
        if (daysLeft >= 0 && daysLeft <= 5 && !isPast(order.deliveryDeadline)) {
          stats.expiringSoon++;
        }
      }
    });

    return stats;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.tmsStatus.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.shift.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      const now = new Date();
      if (activeFilter === 'all') return true;
      if (activeFilter === 'onTime') {
        return order.status === 'delivered' && 
               order.actualDeliveryDate && 
               order.actualDeliveryDate <= order.deliveryDeadline;
      }
      if (activeFilter === 'late') {
        // Late if delivered late OR pending and past deadline
        const isDeliveredLate = order.status === 'delivered' && 
                                order.actualDeliveryDate && 
                                order.actualDeliveryDate > order.deliveryDeadline;
        const isPendingLate = order.status === 'pending' && isPast(order.deliveryDeadline);
        return isDeliveredLate || isPendingLate;
      }
      if (activeFilter === 'pending') {
        return order.status === 'pending';
      }
      if (activeFilter === 'expiringSoon') {
        const daysLeft = differenceInDays(order.deliveryDeadline, now);
        return order.status === 'pending' && daysLeft >= 0 && daysLeft <= 5 && !isPast(order.deliveryDeadline);
      }
      return true;
    });
  }, [orders, searchTerm, activeFilter]);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const newOrders = await parseExcelFile(file);
      setOrders(newOrders);
      toast.success('Importación Exitosa', {
        description: `Se han cargado ${newOrders.length} pedidos correctamente.`,
      });
      setIsImporting(false);
    } catch (error) {
      console.error(error);
      toast.error('Error de Importación', {
        description: 'No se pudo procesar el archivo Excel. Verifique el formato.',
      });
      setIsImporting(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive" className="capitalize">Alta</Badge>;
      case 'medium': return <Badge variant="secondary" className="bg-amber-500/20 text-amber-500 border-amber-500/20 capitalize">Media</Badge>;
      default: return <Badge variant="outline" className="capitalize text-zinc-400">Baja</Badge>;
    }
  };

  const getStatusDisplay = (order: Order) => {
    if (order.status === 'delivered') {
      const onTime = order.actualDeliveryDate && order.actualDeliveryDate <= order.deliveryDeadline;
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-emerald-500 font-medium text-sm">
            <CheckCircle2 className="w-4 h-4" /> Entregado
          </div>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full w-fit border font-medium uppercase tracking-wider",
            onTime ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" : "text-rose-500 border-rose-500/30 bg-rose-500/10"
          )}>
            {onTime ? 'A Tiempo' : 'Fuera de Tiempo'}
          </span>
        </div>
      );
    }

    const isExpiring = differenceInDays(order.deliveryDeadline, new Date()) <= 5 && !isPast(order.deliveryDeadline);
    const isOverdue = isPast(order.deliveryDeadline);

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-blue-400 font-medium text-sm">
          <Clock className="w-4 h-4" /> Pendiente
        </div>
        {isOverdue ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full w-fit border border-rose-500/30 bg-rose-500/10 text-rose-500 font-medium uppercase tracking-wider">
            Vencido
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#e6edf3] font-sans p-6 overflow-x-hidden selection:bg-blue-500/30">
      <Toaster theme="dark" position="top-right" richColors />
      
      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-lg flex items-center justify-center font-bold text-white shadow-lg">
            L
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight text-[#e6edf3]">
              LogisTrack Pro
            </h1>
            <span className="text-[#8b949e] text-sm">v2.4</span>
          </div>
        </div>

        <Dialog>
          <DialogTrigger
            render={
              <Button className="bg-[#238636] hover:bg-[#2ea043] text-white border-none gap-2 px-5 font-medium rounded-md">
                <FileUp className="w-4 h-4" /> Actualizar Excel
              </Button>
            }
          />
          <DialogContent className="bg-[#161b22] border-[#30363d] text-[#e6edf3] max-w-lg">
            <DialogHeader>
              <DialogTitle>Importar Datos de Pedidos</DialogTitle>
              <DialogDescription className="text-[#8b949e]">
                El archivo Excel debe tener las siguientes columnas:
              </DialogDescription>
              <div className="grid grid-cols-2 gap-x-4 mt-2 text-[11px] font-mono bg-[#0b0e14] p-3 rounded-lg border border-[#30363d]">
                <span>A: Estado TMS</span>
                <span>B: Fecha Creación</span>
                <span>C: Cliente</span>
                <span>D: ID Pedido</span>
                <span>E: Destinatario</span>
                <span>F: Localidad</span>
                <span>G: Bultos</span>
                <span>H: Kilos</span>
                <span>I: Fecha Vencimiento</span>
                <span>J: Turno</span>
              </div>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#30363d] rounded-xl bg-[#0b0e14]/50 hover:border-[#8b949e] transition-colors cursor-pointer group relative">
              <FileUp className="w-12 h-12 text-[#30363d] mb-4 group-hover:text-[#8b949e] transition-colors" />
              <p className="text-sm text-[#8b949e]">Arrastre su archivo Excel aquí</p>
              <input 
                type="file" 
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
            {isImporting && (
              <div className="flex items-center justify-center gap-2 text-sm text-[#8b949e]">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <Clock className="w-4 h-4" />
                </motion.div>
                Procesando datos...
              </div>
            )}
          </DialogContent>
        </Dialog>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {/* Metrics Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard 
            title="Total Pedidos" 
            value={kpis.total} 
            isActive={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
            color="blue"
          />
          <KPICard 
            title="En Tiempo" 
            value={kpis.onTime} 
            isActive={activeFilter === 'onTime'}
            onClick={() => setActiveFilter('onTime')}
            color="green"
          />
          <KPICard 
            title="Fuera de Tiempo" 
            value={kpis.late} 
            isActive={activeFilter === 'late'}
            onClick={() => setActiveFilter('late')}
            color="red"
          />
          <KPICard 
            title="Vencimiento < 5 Días" 
            value={kpis.expiringSoon} 
            isActive={activeFilter === 'expiringSoon'}
            onClick={() => setActiveFilter('expiringSoon')}
            color="orange"
          />
        </section>

        {/* Filters and Table */}
        <div className="space-y-4">
          <div className="relative group max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b949e]" />
            <Input 
              placeholder="Buscar pedidos o clientes..." 
              className="pl-10 bg-[#161b22] border-[#30363d] focus:border-[#8b949e] focus:ring-0 text-[#e6edf3] placeholder:text-[#8b949e]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Card className="bg-[#161b22] border-[#30363d] rounded-xl overflow-hidden shadow-none">
            <div className="px-6 py-4 border-b border-[#30363d] flex justify-between items-center bg-[#161b22]">
              <h2 className="text-base font-medium text-[#e6edf3]">Gestión de Entregas Pendientes</h2>
              <div className="text-[#8b949e] text-[12px]">Última importación: Hoy, {format(new Date(), 'hh:mm a')}</div>
            </div>
            <div className="overflow-x-auto w-fit max-w-full border-[#30363d] border rounded-lg">
              <Table className="border-collapse table-fixed w-[1150px]">
                <TableHeader>
                  <TableRow className="border-[#30363d] hover:bg-transparent">
                    <TableHead className="text-[#8b949e] uppercase text-[10px] h-10 px-2 whitespace-nowrap w-[110px]">ID Pedido</TableHead>
                    <TableHead className="text-[#8b949e] uppercase text-[10px] h-10 px-2 whitespace-nowrap w-[110px]">Estado TMS</TableHead>
                    <TableHead className="text-[#8b949e] uppercase text-[10px] h-10 px-2 whitespace-nowrap w-[180px]">Cliente</TableHead>
                    <TableHead className="text-[#8b949e] uppercase text-[10px] h-10 px-2 whitespace-nowrap w-[160px]">Destinatario</TableHead>
                    <TableHead className="text-[#8b949e] uppercase text-[10px] h-10 px-2 whitespace-nowrap w-[140px]">Localidad</TableHead>
                    <TableHead className="text-[#8b949e] uppercase text-[10px] h-10 px-2 whitespace-nowrap w-[80px]">Creación</TableHead>
                    <TableHead className="text-[#8b949e] uppercase text-[10px] h-10 px-2 whitespace-nowrap w-[100px]">Vencimiento</TableHead>
                    <TableHead className="text-[#8b949e] uppercase text-[10px] h-10 px-2 whitespace-nowrap w-[70px]">Turno</TableHead>
                    <TableHead className="text-[#8b949e] uppercase text-[10px] h-10 px-2 whitespace-nowrap w-[80px] text-right">Bultos/Kg</TableHead>
                    <TableHead className="text-[#8b949e] uppercase text-[10px] h-10 px-2 text-center whitespace-nowrap w-[120px]">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow 
                      key={order.uniqueId}
                      className="border-[#21262d] hover:bg-[#1c2128] transition-colors"
                    >
                      <TableCell className="px-2 py-2 font-mono text-[#58a6ff] text-[12px] whitespace-nowrap">#{order.id}</TableCell>
                      <TableCell className="px-2 py-2 whitespace-nowrap">
                        <Badge variant="outline" className="bg-[#161b22] border-[#30363d] text-[#8b949e] text-[9px] whitespace-nowrap">
                          {order.tmsStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-2 py-2 font-medium text-[#e6edf3] text-[12px] whitespace-nowrap truncate" title={order.customerName}>
                        {order.customerName}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-[#e6edf3] text-[12px] whitespace-nowrap truncate" title={order.recipient}>
                        {order.recipient}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-[#8b949e] text-[12px] whitespace-nowrap truncate" title={order.location}>
                        {order.location}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-[#8b949e] text-[12px] whitespace-nowrap">
                        {format(order.createdAt, 'dd/MM/yy', { locale: es })}
                      </TableCell>
                      <TableCell className="px-2 py-2 whitespace-nowrap">
                        <div className="flex flex-col whitespace-nowrap leading-tight">
                          <span className="text-[#e6edf3] text-[12px]">{format(order.deliveryDeadline, 'dd/MM/yy', { locale: es })}</span>
                          <span className="text-[10px] text-[#8b949e] font-mono">{getTimeLeft(order.deliveryDeadline)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2 text-[12px] whitespace-nowrap">{order.shift}</TableCell>
                      <TableCell className="px-2 py-2 whitespace-nowrap text-right">
                        <div className="flex flex-col text-[11px] text-[#8b949e] whitespace-nowrap leading-tight">
                          <span>{order.packages} bultos</span>
                          <span>{order.weight} kg</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2 text-center whitespace-nowrap">
                        {getStatusTag(order)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

function getTimeLeft(deadline: Date) {
  const diffHours = Math.max(0, (deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60));
  const days = Math.floor(diffHours / 24);
  const hours = Math.floor(diffHours % 24);
  const mins = Math.floor((diffHours * 60) % 60);
  return `${days}d ${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
}

function getPriorityVisual(priority: string) {
  const width = priority === 'high' ? '85%' : priority === 'medium' ? '50%' : '20%';
  const color = priority === 'high' ? '#f85149' : priority === 'medium' ? '#d29922' : '#3fb950';
  return (
    <div className="w-[100px] h-[6px] bg-[#30363d] rounded-full overflow-hidden">
      <div 
        className="h-full rounded-full transition-all duration-500" 
        style={{ width, backgroundColor: color }}
      />
    </div>
  );
}

function getStatusTag(order: Order) {
  if (order.status === 'delivered') {
    const onTime = order.actualDeliveryDate && order.actualDeliveryDate <= order.deliveryDeadline;
    return onTime 
      ? <span className="px-2 py-1 rounded bg-[#3fb95015] text-[#3fb950] text-[10px] font-bold uppercase">A Tiempo</span>
      : <span className="px-2 py-1 rounded bg-[#f8514915] text-[#f85149] text-[10px] font-bold uppercase">Fuera de Tiempo</span>;
  }

  const daysLeft = differenceInDays(order.deliveryDeadline, new Date());
  if (isPast(order.deliveryDeadline)) {
    return <span className="px-2 py-1 rounded bg-[#f8514915] text-[#f85149] text-[10px] font-bold uppercase">Atrasado</span>;
  }
  if (daysLeft >= 0 && daysLeft <= 5) {
    return <span className="px-2 py-1 rounded bg-[#d2992215] text-[#d29922] text-[10px] font-bold uppercase whitespace-nowrap">Próximo a Vencer</span>;
  }
  return <span className="px-2 py-1 rounded bg-[#3fb95015] text-[#3fb950] text-[10px] font-bold uppercase">En Tiempo</span>;
}

interface KPICardProps {
  title: string;
  value: number;
  isActive: boolean;
  onClick: () => void;
  color: 'blue' | 'green' | 'red' | 'orange';
}

function KPICard({ title, value, isActive, onClick, color }: KPICardProps) {
  const valueColors = {
    blue: "text-[#58a6ff]",
    green: "text-[#3fb950]",
    red: "text-[#f85149]",
    orange: "text-[#d29922]",
  };

  return (
    <motion.button
      whileHover={{ backgroundColor: '#1c2128' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex flex-col p-5 rounded-xl border transition-all text-left relative overflow-hidden",
        "bg-[#161b22] border-[#30363d]",
        isActive && "border-[#3b82f6] bg-[#1f2937]"
      )}
    >
      <div className="text-[12px] text-[#8b949e] uppercase tracking-widest mb-2 font-medium">
        {title}
      </div>
      <div className={cn("text-3xl font-bold font-sans", valueColors[color])}>
        {value}
      </div>
    </motion.button>
  );
}
