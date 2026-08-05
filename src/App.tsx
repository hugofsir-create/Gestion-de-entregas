import * as React from 'react';
import { useState, useMemo, useEffect, ChangeEvent, ReactNode } from 'react';
import { 
  Plus, 
  FileUp, 
  FileDown,
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  ChevronRight,
  Filter,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FolderOpen,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  Check,
  X,
  MapPin,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { format, isPast, isWithinInterval, addDays, addHours, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster } from 'sonner';

import { Order, KPIStats } from './types';
import { parseExcelFile, exportToExcel, exportTemplateExcel } from './lib/excel-utils';
import { 
  saveMonitoredDirectoryHandle, 
  getMonitoredDirectoryHandle, 
  clearMonitoredDirectoryHandle 
} from './lib/directory-store';
import EfficiencyDashboard from '@/components/EfficiencyDashboard';
import LeadTimeConfigModal, { normalizeHours } from '@/components/LeadTimeConfigModal';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FilterType = 'all' | 'onTime' | 'late' | 'pending' | 'expiringSoon';

export function isOrderLate(order: Order): boolean {
  const now = new Date();
  if (order.status === 'delivered') {
    return order.actualDeliveryDate 
      ? order.actualDeliveryDate > order.deliveryDeadline 
      : isPast(order.deliveryDeadline);
  }
  const daysLeft = differenceInDays(order.deliveryDeadline, now);
  return isPast(order.deliveryDeadline) || daysLeft < 0;
}

export function applySLAToOrders(
  ordersList: Order[],
  leadTimes: Record<string, number>,
  defaultHoursVal: number
): Order[] {
  return ordersList.map(order => {
    const zone = order.location ? String(order.location).trim() : '';
    const rawLead = (zone && zone in leadTimes) ? leadTimes[zone] : defaultHoursVal;
    const hours = normalizeHours(rawLead);
    const calculatedDeadline = addHours(order.createdAt, hours);
    return {
      ...order,
      deliveryDeadline: calculatedDeadline
    };
  });
}

// Helper functions for localStorage persistence
const loadOrders = (): Order[] => {
  try {
    const saved = localStorage.getItem('calico_orders');
    if (!saved) return [];
    
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    
    let leadTimes: Record<string, number> = {
      'CABA': 48,
      'GBA Zona Norte': 72,
      'GBA Zona Sur': 72,
      'GBA Zona Oeste': 72,
      'Tucumán': 48,
      'Córdoba': 96,
      'Mendoza': 120,
      'Santa Fe': 96
    };
    try {
      const savedLeadTimes = localStorage.getItem('calico_zone_lead_times');
      if (savedLeadTimes) leadTimes = JSON.parse(savedLeadTimes);
    } catch {}

    let defaultLeadTime = 72;
    try {
      const savedDefaultLeadTime = localStorage.getItem('calico_default_lead_time');
      if (savedDefaultLeadTime) defaultLeadTime = Number(savedDefaultLeadTime) || 72;
    } catch {}

    const rawOrders: Order[] = parsed.map((order: any) => ({
      ...order,
      createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
      deliveryDeadline: order.deliveryDeadline ? new Date(order.deliveryDeadline) : new Date(),
      actualDeliveryDate: order.actualDeliveryDate ? new Date(order.actualDeliveryDate) : undefined,
    }));

    return applySLAToOrders(rawOrders, leadTimes, defaultLeadTime);
  } catch (error) {
    console.error("Error loading orders from localStorage:", error);
    return [];
  }
};

export default function App() {
  const [orders, setOrders] = useState<Order[]>(() => loadOrders());
  const [activeTab, setActiveTab] = useState<'table' | 'dashboard'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedTmsStatuses, setSelectedTmsStatuses] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [lastImported, setLastImported] = useState<string | null>(() => localStorage.getItem('calico_last_imported'));
  const [lastImportReport, setLastImportReport] = useState<{
    totalRawColumns: number;
    keptCount: number;
    deletedCount: number;
    deletedList: string[];
  } | null>(() => {
    try {
      const stored = localStorage.getItem('calico_last_import_report');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Configuración de Lead Time por Zona / Localidad (SLA en horas)
  const [zoneLeadTimes, setZoneLeadTimes] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('calico_zone_lead_times');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error loading zone lead times:", e);
    }
    return {
      'CABA': 48,
      'GBA Zona Norte': 72,
      'GBA Zona Sur': 72,
      'GBA Zona Oeste': 72,
      'Tucumán': 48,
      'Córdoba': 96,
      'Mendoza': 120,
      'Santa Fe': 96
    };
  });

  const [defaultLeadTime, setDefaultLeadTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('calico_default_lead_time');
      if (saved) return Number(saved) || 72;
    } catch (e) {
      console.error("Error loading default lead time:", e);
    }
    return 72;
  });

  const [showLeadTimeModal, setShowLeadTimeModal] = useState(false);

  // Available locations extracted dynamically from orders
  const availableLocations = useMemo(() => {
    const locs = new Set<string>();
    orders.forEach(o => {
      if (o.location && o.location !== 'N/A' && o.location.trim() !== '') {
        locs.add(o.location.trim());
      }
    });
    return Array.from(locs).sort();
  }, [orders]);

  const calculateSLAForOrder = (order: Order, leadTimes: Record<string, number>, defaultHoursVal: number): Order => {
    const zone = order.location ? order.location.trim() : '';
    const rawLead = (zone && zone in leadTimes) ? leadTimes[zone] : defaultHoursVal;
    const hours = normalizeHours(rawLead);
    const newDeadline = addHours(order.createdAt, hours);
    return {
      ...order,
      deliveryDeadline: newDeadline
    };
  };

  const handleSaveLeadTimes = (
    newZoneLeadTimes: Record<string, number>,
    newDefaultLeadTime: number,
    recalculateOrders: boolean
  ) => {
    setZoneLeadTimes(newZoneLeadTimes);
    setDefaultLeadTime(newDefaultLeadTime);
    localStorage.setItem('calico_zone_lead_times', JSON.stringify(newZoneLeadTimes));
    localStorage.setItem('calico_default_lead_time', String(newDefaultLeadTime));

    if (recalculateOrders && orders.length > 0) {
      const updatedOrders = orders.map(order => calculateSLAForOrder(order, newZoneLeadTimes, newDefaultLeadTime));
      setOrders(updatedOrders);
      localStorage.setItem('calico_orders', JSON.stringify(updatedOrders));
      toast.success(`Lead Times actualizados. Se recalcularon los vencimientos de ${updatedOrders.length} pedidos.`);
    } else {
      toast.success("Configuración de Lead Times guardada correctamente.");
    }
  };
  const [monitoredDirectory, setMonitoredDirectory] = useState<any | null>(null);
  const [isFolderSyncing, setIsFolderSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem('calico_last_sync_time'));
  const [lastSyncFileName, setLastSyncFileName] = useState<string | null>(() => localStorage.getItem('calico_last_sync_filename'));
  const [showIframeModal, setShowIframeModal] = useState(false);
  const folderInputRef = React.useRef<HTMLInputElement>(null);

  const handleFolderInputSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let newestFile: File | null = null;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) {
        if (!newestFile || f.lastModified > newestFile.lastModified) {
          newestFile = f;
        }
      }
    }

    if (newestFile) {
      try {
        setIsImporting(true);
        const { orders: parsedOrders, detectedRequired, deletedExtra } = await parseExcelFile(newestFile);
        const newOrders = applySLAToOrders(parsedOrders, zoneLeadTimes, defaultLeadTime);
        setOrders(newOrders);

        const syncTimeStr = format(new Date(), "dd/MM/yyyy HH:mm:ss");
        localStorage.setItem('calico_orders', JSON.stringify(newOrders));
        localStorage.setItem('calico_last_imported', `Carpeta Local: ${syncTimeStr}`);
        localStorage.setItem('calico_last_sync_time', syncTimeStr);
        localStorage.setItem('calico_last_sync_filename', newestFile.name);

        setLastImported(`Carpeta Local: ${syncTimeStr}`);
        setLastSyncTime(syncTimeStr);
        setLastSyncFileName(newestFile.name);

        const report = {
          totalRawColumns: detectedRequired.length + deletedExtra.length,
          keptCount: detectedRequired.length,
          deletedCount: deletedExtra.length,
          deletedList: deletedExtra
        };
        localStorage.setItem('calico_last_import_report', JSON.stringify(report));
        setLastImportReport(report);

        toast.success('Carpeta Importada Exitosamente', {
          description: `Se detectó y procesó "${newestFile.name}" con ${newOrders.length} pedidos. Se eliminaron ${deletedExtra.length} columnas no requeridas.`,
          duration: 6000,
        });
      } catch (err: any) {
        toast.error('Error al procesar el archivo Excel', {
          description: err.message || 'No se pudo leer el archivo seleccionado.',
        });
      } finally {
        setIsImporting(false);
        setShowIframeModal(false);
        if (e.target) e.target.value = '';
      }
    } else {
      toast.warning('Sin Archivo Excel Válido', {
        description: 'No se encontraron archivos .xlsx o .xls dentro de la carpeta seleccionada.',
      });
    }
  };

  // Aplicar tema oscuro
  useEffect(() => {
    document.documentElement.classList.add('dark');
    
    // Auto-ocultar splash a los 3s
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const sincronizarCarpetaInterno = async (directoryHandle: any, isAutomatic = false) => {
    if (isFolderSyncing) return;
    try {
      setIsFolderSyncing(true);
      
      // Consultar y requerir permiso
      const options = { mode: 'read' as const };
      const hasPermission = await directoryHandle.queryPermission(options);
      if (hasPermission !== 'granted') {
        const newPermission = await directoryHandle.requestPermission(options);
        if (newPermission !== 'granted') {
          if (!isAutomatic) {
            toast.error('Permiso Denegado', {
              description: 'No se otorgaron permisos de lectura para la carpeta seleccionada.',
            });
          }
          setIsFolderSyncing(false);
          return;
        }
      }

      let newestFile: { file: File; name: string; lastModified: number } | null = null;

      // Escanear el directorio
      for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'file' && (entry.name.endsWith('.xlsx') || entry.name.endsWith('.xls'))) {
          try {
            const fileHandle = entry as any;
            const file = await fileHandle.getFile();
            if (!newestFile || file.lastModified > newestFile.lastModified) {
              newestFile = { file, name: entry.name, lastModified: file.lastModified };
            }
          } catch (fileErr) {
            console.error("Error leyendo archivo individual:", fileErr);
          }
        }
      }

      if (newestFile) {
        // Evitar procesar el mismo archivo si no ha cambiado y es una sincronización automática
        const storedLastModified = localStorage.getItem(`calico_file_mtime_${newestFile.name}`);
        const mtimeStr = newestFile.lastModified.toString();
        
        if (isAutomatic && storedLastModified === mtimeStr) {
          setIsFolderSyncing(false);
          return;
        }

        if (!isAutomatic) {
          toast.info('Archivo Detectado', {
            description: `Procesando "${newestFile.name}" (el más reciente de la carpeta)...`,
          });
        }

        const { orders: parsedOrders, detectedRequired, deletedExtra } = await parseExcelFile(newestFile.file);
        const newOrders = applySLAToOrders(parsedOrders, zoneLeadTimes, defaultLeadTime);
        setOrders(newOrders);
        
        // Persistir en localStorage
        localStorage.setItem('calico_orders', JSON.stringify(newOrders));
        
        const report = {
          totalRawColumns: detectedRequired.length + deletedExtra.length,
          keptCount: detectedRequired.length,
          deletedCount: deletedExtra.length,
          deletedList: deletedExtra
        };
        localStorage.setItem('calico_last_import_report', JSON.stringify(report));
        setLastImportReport(report);
        
        const syncTimeStr = format(new Date(), "dd/MM/yyyy HH:mm:ss");
        localStorage.setItem('calico_last_imported', `Carpeta Local: ${syncTimeStr}`);
        localStorage.setItem('calico_last_sync_time', syncTimeStr);
        localStorage.setItem('calico_last_sync_filename', newestFile.name);
        localStorage.setItem(`calico_file_mtime_${newestFile.name}`, mtimeStr);
        
        setLastImported(`Carpeta Local: ${syncTimeStr}`);
        setLastSyncTime(syncTimeStr);
        setLastSyncFileName(newestFile.name);

        toast.success(isAutomatic ? 'Sincronización Automática Exitosa' : 'Carpeta Sincronizada', {
          description: `Se cargó "${newestFile.name}" con ${newOrders.length} pedidos. Se eliminaron ${deletedExtra.length} columnas irrelevantes automáticamente.`,
          duration: 5000,
        });
      } else {
        if (!isAutomatic) {
          toast.warning('Sin archivos Excel', {
            description: 'No se encontraron archivos Excel (.xlsx, .xls) válidos en la carpeta vinculada.',
          });
        }
      }
    } catch (error: any) {
      console.error("Error sincronizando carpeta:", error);
      if (!isAutomatic) {
        toast.error('Error de Sincronización', {
          description: error.message || 'Ocurrió un error al leer la carpeta local.',
        });
      }
    } finally {
      setIsFolderSyncing(false);
    }
  };

  const vincularCarpetaLocal = async () => {
    // Detectar si la app está corriendo dentro de un iframe
    const isIframe = window.self !== window.top;
    if (isIframe) {
      setShowIframeModal(true);
      return;
    }

    try {
      if (typeof (window as any).showDirectoryPicker === 'undefined') {
        toast.error('API No Soportada', {
          description: 'Su navegador no soporta el acceso directo a carpetas locales. Utilice un navegador basado en Chromium como Chrome o Edge.',
        });
        return;
      }
      
      const handle = await (window as any).showDirectoryPicker();
      setMonitoredDirectory(handle);
      await saveMonitoredDirectoryHandle(handle);
      
      toast.success('Carpeta Vinculada', {
        description: `Monitoreando la carpeta "${handle.name}" correctamente.`,
      });
      
      await sincronizarCarpetaInterno(handle, false);
    } catch (err: any) {
      console.error("Error al vincular carpeta:", err);
      if (err.name === 'AbortError') {
        return; // El usuario canceló la acción en el diálogo nativo
      }
      if (err.name === 'SecurityError' || err.message?.includes('sub frame') || err.message?.includes('Cross origin')) {
        setShowIframeModal(true);
        return;
      }
      toast.error('Acceso a Carpeta Restringido', {
        description: err.message || 'No se pudo acceder a la carpeta. Si está en vista integrada, use la opción de Abrir en Nueva Pestaña.',
        duration: 8000,
      });
    }
  };

  const desvincularCarpetaLocal = async () => {
    try {
      await clearMonitoredDirectoryHandle();
      setMonitoredDirectory(null);
      setLastSyncTime(null);
      setLastSyncFileName(null);
      toast.success('Monitoreo Desactivado', {
        description: 'Se ha removido el enlace a la carpeta local de su PC.',
      });
    } catch (error) {
      console.error("Error al desvincular:", error);
      toast.error('No se pudo desvincular la carpeta.');
    }
  };

  // Cargar carpeta vinculada en IndexedDB al montar
  useEffect(() => {
    const initDirectory = async () => {
      try {
        const handle = await getMonitoredDirectoryHandle();
        if (handle) {
          setMonitoredDirectory(handle);
          sincronizarCarpetaInterno(handle, true).catch(e => console.log("Silent sync skipped:", e));
        }
      } catch (err) {
        console.error("Error cargando carpeta en IndexedDB:", err);
      }
    };
    initDirectory();
  }, []);

  // Escuchar el evento focused de la ventana y sincronizar
  useEffect(() => {
    if (!monitoredDirectory) return;

    const handleFocus = () => {
      sincronizarCarpetaInterno(monitoredDirectory, true).catch(e => console.log("Focus sync skipped:", e));
    };

    window.addEventListener('focus', handleFocus);
    
    // Interval de respaldo cada 20 segundos
    const interval = setInterval(() => {
      sincronizarCarpetaInterno(monitoredDirectory, true).catch(e => console.log("Interval sync skipped:", e));
    }, 20000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [monitoredDirectory]);

  // State for sorting 'Días Transcurridos'
  const [elapsedSortOrder, setElapsedSortOrder] = useState<'desc' | 'asc' | null>('desc');

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
      const isLate = isOrderLate(order);
      const daysLeft = differenceInDays(order.deliveryDeadline, now);
      const isExpiringSoon = order.status === 'pending' && !isLate && daysLeft >= 0 && daysLeft <= 5;

      if (isLate) {
        stats.late++;
      } else if (isExpiringSoon) {
        stats.expiringSoon++;
      } else {
        stats.onTime++;
      }

      if (order.status === 'pending') {
        stats.pending++;
      }
    });

    return stats;
  }, [orders]);

  const customers = useMemo(() => {
    const list = Array.from(new Set(orders.map(o => o.customerName)));
    return (list as string[]).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const tmsStatuses = useMemo(() => {
    const list = Array.from(new Set(orders.map(o => o.tmsStatus)));
    return (list as string[]).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // 1. Search term filter
      const matchesSearch = 
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.tmsStatus.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.shift.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // 2. KPI Filter
      const now = new Date();
      let matchesKPI = true;
      
      const isLate = isOrderLate(order);
      
      const daysLeft = differenceInDays(order.deliveryDeadline, now);
      const isExpiringSoon = order.status === 'pending' && !isLate && daysLeft >= 0 && daysLeft <= 5;
      const isOnTime = !isLate && !isExpiringSoon;

      if (activeFilter === 'onTime') {
        matchesKPI = isOnTime;
      } else if (activeFilter === 'late') {
        matchesKPI = isLate;
      } else if (activeFilter === 'pending') {
        matchesKPI = order.status === 'pending';
      } else if (activeFilter === 'expiringSoon') {
        matchesKPI = isExpiringSoon;
      }

      if (!matchesKPI) return false;

      // 3. Customer Filter
      if (selectedCustomer !== 'all' && order.customerName !== selectedCustomer) {
        return false;
      }

      // 4. TMS Status Filter (Multi-select)
      if (selectedTmsStatuses.length > 0 && !selectedTmsStatuses.includes(order.tmsStatus)) {
        return false;
      }

      return true;
    });
  }, [orders, searchTerm, activeFilter, selectedCustomer, selectedTmsStatuses]);

  // Sorted orders according to 'Días Transcurridos' controller
  const sortedAndFilteredOrders = useMemo(() => {
    if (!elapsedSortOrder) return filteredOrders;

    const now = new Date();
    return [...filteredOrders].sort((a, b) => {
      const daysA = Math.max(0, differenceInDays(now, a.createdAt));
      const daysB = Math.max(0, differenceInDays(now, b.createdAt));

      if (elapsedSortOrder === 'desc') {
        return daysB - daysA; // Mayor a menor
      } else {
        return daysA - daysB; // Menor a mayor
      }
    });
  }, [filteredOrders, elapsedSortOrder]);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const { orders: parsedOrders, detectedRequired, deletedExtra } = await parseExcelFile(file);
      const newOrders = applySLAToOrders(parsedOrders, zoneLeadTimes, defaultLeadTime);
      setOrders(newOrders);
      
      // Persist orders in localStorage
      localStorage.setItem('calico_orders', JSON.stringify(newOrders));
      const importTimeStr = format(new Date(), "dd/MM/yyyy 'a las' HH:mm:ss 'hs'");
      localStorage.setItem('calico_last_imported', importTimeStr);
      setLastImported(importTimeStr);

      const report = {
        totalRawColumns: detectedRequired.length + deletedExtra.length,
        keptCount: detectedRequired.length,
        deletedCount: deletedExtra.length,
        deletedList: deletedExtra
      };
      localStorage.setItem('calico_last_import_report', JSON.stringify(report));
      setLastImportReport(report);

      toast.success('Columnas Depuradas e Importación Exitosa', {
        description: `Se cargaron ${newOrders.length} pedidos. Se eliminaron automáticamente ${deletedExtra.length} columnas irrelevantes, conservando únicamente las 11 requeridas por la aplicación.`,
        duration: 8000,
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
    const isLate = isOrderLate(order);

    if (order.status === 'delivered') {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-emerald-500 font-medium text-sm">
            <CheckCircle2 className="w-4 h-4" /> Entregado
          </div>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full w-fit border font-medium uppercase tracking-wider",
            !isLate ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" : "text-rose-500 border-rose-500/30 bg-rose-500/10"
          )}>
            {!isLate ? 'A Tiempo' : 'Fuera de Tiempo'}
          </span>
        </div>
      );
    }

    const daysLeft = differenceInDays(order.deliveryDeadline, new Date());
    const isExpiring = !isLate && daysLeft >= 0 && daysLeft <= 5;

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-blue-400 font-medium text-sm">
          <Clock className="w-4 h-4" /> Pendiente
        </div>
        {isLate ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full w-fit border border-rose-500/30 bg-rose-500/10 text-rose-500 font-medium uppercase tracking-wider">
            Fuera de Tiempo
          </span>
        ) : isExpiring ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full w-fit border border-amber-500/30 bg-amber-500/10 text-amber-500 font-medium uppercase tracking-wider">
            Próximo a Vencer
          </span>
        ) : (
          <span className="text-[10px] px-2 py-0.5 rounded-full w-fit border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 font-medium uppercase tracking-wider">
            En Tiempo
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#e6edf3] font-sans p-6 overflow-x-hidden selection:bg-blue-500/30">
      <Toaster theme="dark" position="top-right" richColors />
      
      <AnimatePresence>
        {showSplash && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1117]"
          >
            <div className="flex flex-col items-center gap-6">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative"
              >
                <div className="w-24 h-24 border-4 border-[#3fb950] border-t-transparent rounded-full animate-spin" />
                <Package className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-[#3fb950]" />
              </motion.div>
              
              <div className="overflow-hidden flex flex-col items-center text-center">
                <motion.h1 
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="text-4xl font-bold tracking-tighter text-[#e6edf3]"
                >
                  <span className="text-[#3fb950]">Calico</span> S.A.
                </motion.h1>
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                  className="text-[#8b949e] text-sm mt-1 uppercase tracking-widest"
                >
                  Logística Integral
                </motion.p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#3fb950] rounded-lg flex items-center justify-center font-bold text-white shadow-lg">
            C
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight text-[#e6edf3]">
              Gestor de Entregas
            </h1>
            <span className="text-[#8b949e] text-sm">Calico S.A.</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            type="button"
            onClick={() => setShowLeadTimeModal(true)}
            variant="outline"
            className="bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] border-[#30363d] border gap-2 px-3.5 font-medium rounded-md h-9 text-xs cursor-pointer shadow-sm transition-all"
          >
            <Clock className="w-4 h-4 text-[#a371f7]" /> 
            <span>Lead Time Zonas</span>
            <Badge variant="outline" className="bg-[#a371f7]/15 text-[#a371f7] border-[#a371f7]/30 text-[10px] px-1.5 py-0 font-mono">
              {Object.keys(zoneLeadTimes).length}
            </Badge>
          </Button>

          <Button 
            onClick={() => exportToExcel(filteredOrders, `Pendientes_Calico_${format(new Date(), 'dd-MM-yyyy')}`)}
            className="bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border-[#30363d] border gap-2 px-4 font-medium rounded-md h-9 text-xs cursor-pointer"
            disabled={filteredOrders.length === 0}
          >
            <FileDown className="w-4 h-4" /> Exportar
          </Button>

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
              <DialogTitle className="text-lg font-bold text-[#e6edf3]">Actualizar Datos / Importar Excel</DialogTitle>
              <DialogDescription className="text-[#8b949e] text-xs">
                Para actualizar el sistema, carga un archivo que contenga las columnas requeridas. El procesador inteligente solo analizará estas columnas clave, ignorando cualquier columna adicional.
              </DialogDescription>
              
              {/* Columns instruction */}
              <div className="grid grid-cols-2 gap-x-4 mt-3 text-[11px] font-mono bg-[#0b0e14]/60 p-3 rounded-lg border border-[#30363d]/60 text-[#c9d1d9]">
                <span className="text-[#3fb950] font-bold">A: ID Pedido</span>
                <span>B: Fecha Creación</span>
                <span>C: Cliente</span>
                <span className="text-[#3fb950] font-bold">D: Destinatario</span>
                <span>E: Estado TMS / Detalle</span>
                <span>F: Localidad</span>
                <span>G: Bultos</span>
                <span>H: Kilos</span>
                <span>I: Fecha Vencimiento</span>
                <span>J: Turno</span>
                <span className="col-span-2 text-amber-500/90 mt-1">K: Fecha Real Entrega (Opcional)</span>
              </div>
            </DialogHeader>

            {/* Download Template Action Box */}
            <div className="flex items-center justify-between bg-[#1f242c] p-3 rounded-xl border border-[#30363d] gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-[#e6edf3]">¿No tienes la plantilla estructurada?</p>
                <p className="text-[11px] text-[#8b949e]">Descárgala en tu carpeta y edítala.</p>
              </div>
              <Button
                type="button"
                onClick={exportTemplateExcel}
                variant="outline"
                className="bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] border-[#30363d] text-xs px-3 py-1.5 h-8 gap-1.5 flex items-center font-medium"
                id="btn-download-dialog-template"
              >
                <FileDown className="w-3.5 h-3.5 text-[#30a14e]" />
                Descargar Plantilla
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#30363d] rounded-xl bg-[#0b0e14]/50 hover:border-[#3fb950]/50 transition-colors cursor-pointer group relative">
              <FileUp className="w-12 h-12 text-[#30363d] mb-4 group-hover:text-[#3fb950] transition-colors" />
              <p className="text-sm text-[#e6edf3] font-medium">Arrastre o seleccione el archivo Excel</p>
              <p className="text-xs text-[#8b949e] mt-1">Los datos se sobrescribirán de forma segura</p>
              <input 
                type="file" 
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
                id="file-upload-input-dialog"
              />
            </div>
            {isImporting && (
              <div className="flex items-center justify-center gap-2 text-sm text-[#8b949e]">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <Clock className="w-4 h-4 text-[#3fb950]" />
                </motion.div>
                Procesando datos e integrando registros...
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {orders.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-[#161b22] border border-[#30363d] rounded-2xl p-8 md:p-12 text-center space-y-8 shadow-xl max-w-4xl mx-auto mt-6"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-[#3fb950]/10 rounded-2xl flex items-center justify-center border border-[#3fb950]/20 text-[#3fb950] relative">
                <Package className="w-10 h-10 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-[#e6edf3]">
                  Bienvenido al Gestor de Entregas de Calico S.A.
                </h2>
                <p className="text-sm text-[#8b949e] max-w-lg mx-auto">
                  La plataforma está lista para procesar los datos de operaciones y calcular las métricas tácticas de cumplimiento del SLA. Comience importando su archivo de pedidos Excel.
                </p>
              </div>
            </div>

            {/* Instruction Box */}
            <div className="bg-[#0d1117] border border-[#30363d]/60 rounded-xl p-5 text-left max-w-xl mx-auto">
              <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-[#3fb950]" />
                Columnas requeridas en su archivo Excel:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 text-[12px] text-[#c9d1d9] font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-[#3fb950] font-bold">A:</span>
                  <span className="text-[#3fb950] font-semibold">ID Pedido</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#3fb950] font-bold">B:</span>
                  <span>Fecha Creación</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#3fb950] font-bold">C:</span>
                  <span>Cliente</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#3fb950] font-bold">D:</span>
                  <span className="text-[#3fb950] font-semibold">Destinatario</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#3fb950] font-bold">E:</span>
                  <span>Estado TMS / Detalle</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#3fb950] font-bold">F:</span>
                  <span>Localidad</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#3fb950] font-bold">G:</span>
                  <span>Bultos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#3fb950] font-bold">H:</span>
                  <span>Kilos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#3fb950] font-bold">I:</span>
                  <span>Fecha Vencimiento</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#3fb950] font-bold">J:</span>
                  <span>Turno</span>
                </div>
                <div className="flex items-center gap-2 col-span-1 sm:col-span-2 border-t border-[#30363d]/40 pt-2 mt-1">
                  <span className="text-amber-500 font-bold">K (Opcional):</span>
                  <span className="text-[#8b949e]">Fecha Real de Entrega</span>
                </div>
              </div>
            </div>

            {/* Selector box */}
            <div className="max-w-xl mx-auto space-y-4">
              <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-[#30363d] rounded-xl bg-[#0b0e14]/50 hover:border-[#3fb950]/50 transition-colors cursor-pointer group relative animate-smooth">
                <FileUp className="w-12 h-12 text-[#30363d] mb-4 group-hover:text-[#3fb950] transition-colors" />
                <p className="text-sm font-medium text-[#e6edf3]">Seleccionar o arrastrar archivo Excel</p>
                <p className="text-xs text-[#8b949e] mt-1 font-mono">Formatos admitidos: .xlsx, .xls</p>
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  id="file-upload-input-empty"
                />
              </div>

              {lastImportReport && (
                <div className="bg-[#161b22]/50 border border-[#30363d]/60 rounded-xl p-4 text-left space-y-2.5 animate-smooth">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#e6edf3] uppercase tracking-wider font-sans bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#3fb950]" /> Depuración Automática Exitosa
                    </span>
                    <span className="text-[10px] text-[#8b949e] font-sans">Aislamiento de Columnas</span>
                  </div>
                  <p className="text-[12px] text-[#8b949e] leading-relaxed">
                    Se analizaron <span className="font-semibold text-emerald-400">{lastImportReport.totalRawColumns} columnas</span> en total del archivo. El sistema aisló las <span className="font-semibold text-emerald-400">{lastImportReport.keptCount} columnas indispensables</span> requeridas, y eliminó de manera segura <span className="font-semibold text-rose-400">{lastImportReport.deletedCount} columnas extra o irrelevantes</span> de forma transparente para que usted no tenga que editar el Excel.
                  </p>
                  {lastImportReport.deletedList.length > 0 && (
                    <div className="pt-1.5 border-t border-[#30363d]/40">
                      <span className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider block mb-1.5 font-sans">
                        Columnas descartadas del archivo sin modificar:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {lastImportReport.deletedList.map((col, idx) => (
                          <span key={idx} className="text-[10px] bg-rose-500/5 text-rose-400 border border-rose-500/10 rounded px-1.5 py-0.5 font-mono">
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Opción de Carpeta de Monitoreo Local en PC */}
              <div className="p-4 bg-[#161b22] border border-[#30363d] rounded-xl text-left space-y-3 shadow-lg">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 mt-0.5",
                    monitoredDirectory 
                      ? "bg-[#3fb950]/10 border-[#3fb950]/30 text-[#3fb950]" 
                      : "bg-[#21262d] border-[#30363d] text-[#8b949e]"
                  )}>
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-[#e6edf3] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                      Monitorear Carpeta de tu PC
                      {monitoredDirectory && (
                        <span className="inline-flex w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
                      )}
                    </h4>
                    <p className="text-[11px] text-[#8b949e] leading-relaxed">
                      {monitoredDirectory ? (
                        <span>
                          Monitoreando: <span className="font-semibold text-[#c9d1d9] font-mono">"{monitoredDirectory.name}"</span>. 
                          La app se actualizará sola cuando dejes un Excel en esta carpeta y vuelvas a esta pestaña.
                        </span>
                      ) : (
                        "Permite que el sistema busque permanentemente el Excel de SLA más reciente dentro de una carpeta local de tu PC para que no tengas que subirlo manualmente."
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-[#30363d]/50 pt-3">
                  {monitoredDirectory ? (
                    <>
                      <Button
                        type="button"
                        onClick={() => sincronizarCarpetaInterno(monitoredDirectory, false)}
                        disabled={isFolderSyncing}
                        variant="outline"
                        className="bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] border-[#30363d] text-xs h-8 px-3.5 w-full sm:w-auto flex items-center justify-center gap-1.5 font-medium"
                      >
                        <RefreshCw className={cn("w-3 h-3 text-[#3fb950]", isFolderSyncing && "animate-spin")} />
                        Buscar e Importar Ahora
                      </Button>
                      <Button
                        type="button"
                        onClick={desvincularCarpetaLocal}
                        variant="ghost"
                        className="hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 text-xs h-8 px-3 w-full sm:w-auto"
                      >
                        Desvincular Carpeta
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      onClick={vincularCarpetaLocal}
                      className="bg-[#1f6feb] hover:bg-[#388bfd] text-white border-none text-xs h-8 px-4 w-full sm:w-auto flex items-center justify-center gap-1.5 font-medium transition-all active:scale-95 shadow-md"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Vincular Carpeta de la PC
                    </Button>
                  )}
                </div>
              </div>

              {/* Download Template Action */}
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-[#0d1117]/80 rounded-xl border border-[#30363d]/60 gap-4 text-left">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-[#e6edf3]">¿Necesitas la plantilla oficial de columnas?</h4>
                  <p className="text-[11px] text-[#8b949e]">Contiene únicamente las columnas requeridas; el sistema buscará justo estos campos al procesar.</p>
                </div>
                <Button
                  type="button"
                  onClick={exportTemplateExcel}
                  variant="outline"
                  className="bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border-[#30363d] text-xs h-9 px-4 shrink-0 flex items-center gap-2 rounded-md"
                  id="btn-download-empty-template"
                >
                  <FileDown className="w-3.5 h-3.5 text-[#30a14e]" />
                  Descargar Plantilla
                </Button>
              </div>

              {isImporting && (
                <div className="flex items-center justify-center gap-2 text-sm text-[#8b949e] mt-4">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <Clock className="w-4 h-4 text-[#3fb950]" />
                  </motion.div>
                  Procesando datos e inicializando tablero...
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <>
            {/* Widget de Carpetas de Monitoreo Local */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md max-w-7xl mx-auto mb-6 animate-smooth">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center border shrink-0",
                  monitoredDirectory 
                    ? "bg-[#3fb950]/10 border-[#3fb950]/30 text-[#3fb950]" 
                    : "bg-[#21262d] border-[#30363d] text-zinc-400"
                )}>
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap text-left">
                    <h4 className="text-xs font-bold text-[#e6edf3] uppercase tracking-wider font-sans">
                      Monitoreo de Carpeta Local en PC
                    </h4>
                    {monitoredDirectory ? (
                      <Badge className="bg-[#238636]/20 text-[#3fb950] border-[#238636]/30 text-[10px] py-0 px-2 flex items-center gap-1 font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
                        Monitoreo Activo (Focus/Frecuente)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-zinc-400 border-[#30363d] text-[10px] py-0 px-2 font-sans">
                        Inactivo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-[#8b949e] text-left leading-relaxed">
                    {monitoredDirectory ? (
                      <span>
                        Carpeta vinculada: <span className="font-semibold text-emerald-400 font-mono">"{monitoredDirectory.name}"</span>
                        {lastSyncFileName && (
                          <span> · Última modificación leída: <span className="text-[#3fb950] font-mono font-semibold text-[11px]">{lastSyncFileName}</span> ({lastSyncTime})</span>
                        )}
                      </span>
                    ) : (
                      "Vincule una carpeta local de su PC. Al descargar o guardar el Excel de SLA allí, la app se actualizará automáticamente al regresar."
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start md:self-center">
                {monitoredDirectory ? (
                  <>
                    <Button
                      onClick={() => sincronizarCarpetaInterno(monitoredDirectory, false)}
                      disabled={isFolderSyncing}
                      variant="outline"
                      className="bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] border-[#30363d] text-xs h-8 px-3 flex items-center gap-1.5 font-medium"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5 text-[#3fb950]", isFolderSyncing && "animate-spin")} />
                      Sincronizar ahora
                    </Button>
                    <Button
                      onClick={desvincularCarpetaLocal}
                      variant="ghost"
                      className="hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 text-xs h-8 px-2.5 flex items-center gap-1"
                    >
                      Desvincular
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={vincularCarpetaLocal}
                    className="bg-[#1f6feb] hover:bg-[#388bfd] text-white border-none text-xs h-8 px-4 flex items-center gap-1.5 font-medium shadow-md transition-all active:scale-95"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Vincular Carpeta en PC
                  </Button>
                )}
              </div>
            </div>

            {/* Metrics Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <KPICard 
                title="Total Pedidos" 
                value={kpis.total} 
                isActive={activeFilter === 'all' && searchTerm === '' && selectedCustomer === 'all' && selectedTmsStatuses.length === 0}
                onClick={() => {
                  setActiveFilter('all');
                  setSearchTerm('');
                  setSelectedCustomer('all');
                  setSelectedTmsStatuses([]);
                }}
                color="blue"
                subtext="Total base cargada"
              />
              <KPICard 
                title="Líneas Filtradas" 
                value={filteredOrders.length} 
                isActive={filteredOrders.length !== orders.length || searchTerm !== '' || selectedCustomer !== 'all' || selectedTmsStatuses.length > 0 || activeFilter !== 'all'}
                onClick={() => {
                  setActiveTab('table');
                }}
                color="purple"
                subtext={
                  filteredOrders.length === orders.length 
                    ? "100% visible sin filtros" 
                    : `${Math.round((filteredOrders.length / (orders.length || 1)) * 100)}% de los pedidos`
                }
                icon={<Filter className="w-4 h-4 text-[#a371f7]" />}
              />
              <KPICard 
                title="En Tiempo" 
                value={kpis.onTime} 
                isActive={activeFilter === 'onTime'}
                onClick={() => setActiveFilter('onTime')}
                color="green"
                subtext="Entregas sin atraso"
              />
              <KPICard 
                title="Fuera de Tiempo" 
                value={kpis.late} 
                isActive={activeFilter === 'late'}
                onClick={() => setActiveFilter('late')}
                color="red"
                subtext="Entregas demoradas"
              />
              <KPICard 
                title="Vencimiento < 5 Días" 
                value={kpis.expiringSoon} 
                isActive={activeFilter === 'expiringSoon'}
                onClick={() => setActiveFilter('expiringSoon')}
                color="orange"
                subtext="Alerta SLA cercano"
              />
            </section>

            {/* Navigation Tabs */}
            <div className="flex border-b border-[#30363d]/80 mb-6 w-full">
              <button
                onClick={() => setActiveTab('table')}
                className={cn(
                  "px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all relative cursor-pointer",
                  activeTab === 'table' 
                    ? "border-[#3fb950] text-[#3fb950] bg-[#3fb950]/5" 
                    : "border-transparent text-[#8b949e] hover:text-[#e6edf3] hover:bg-white/5"
                )}
              >
                <ClipboardList className="w-4 h-4" />
                Tabla de Pedidos
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={cn(
                  "px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all relative cursor-pointer",
                  activeTab === 'dashboard' 
                    ? "border-[#3fb950] text-[#3fb950] bg-[#3fb950]/5" 
                    : "border-transparent text-[#8b949e] hover:text-[#e6edf3] hover:bg-white/5"
                )}
              >
                <BarChart3 className="w-4 h-4" />
                Tablero de Eficiencia
                <Badge variant="outline" className="ml-1 bg-[#3fb950]/10 border-[#3fb950]/20 text-[#3fb950] text-[9px] px-1.5 py-0">Nuevo</Badge>
              </button>
            </div>

            {activeTab === 'dashboard' ? (
              <EfficiencyDashboard orders={orders} />
            ) : (
              <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative group flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b949e]" />
                  <Input 
                    placeholder="Buscar pedidos o clientes..." 
                    className="pl-10 bg-[#161b22] border-[#30363d] focus:border-[#8b949e] focus:ring-0 text-[#e6edf3] placeholder:text-[#8b949e]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="w-full sm:w-[200px]">
                    <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                      <SelectTrigger className="bg-[#161b22] border-[#30363d] text-[#e6edf3] focus:ring-0 focus:border-[#8b949e] h-10">
                        <div className="flex items-center gap-2 truncate">
                          <Filter className="w-4 h-4 shrink-0 text-[#8b949e]" />
                          <SelectValue placeholder="Cliente" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-[#161b22] border-[#30363d] text-[#e6edf3]">
                        <SelectItem value="all">Todos los Clientes</SelectItem>
                        {customers.map(customer => (
                          <SelectItem key={customer} value={customer}>
                            {customer}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Multi-Select Status Filter */}
                  <MultiSelectStatusFilter
                    statuses={tmsStatuses}
                    selectedStatuses={selectedTmsStatuses}
                    onChange={setSelectedTmsStatuses}
                    orders={orders}
                  />
                </div>
              </div>

              {/* Active Filters Bar */}
              {(searchTerm || selectedCustomer !== 'all' || selectedTmsStatuses.length > 0 || activeFilter !== 'all') && (
                <div className="flex items-center gap-2 flex-wrap text-xs bg-[#161b22]/90 border border-[#30363d] px-3.5 py-2 rounded-xl text-[#8b949e] animate-smooth">
                  <span className="font-semibold text-[#e6edf3] flex items-center gap-1.5 font-sans text-[11px] uppercase tracking-wider">
                    <Filter className="w-3.5 h-3.5 text-[#a371f7]" /> Filtros Activos:
                  </span>

                  {activeFilter !== 'all' && (
                    <Badge variant="outline" className="bg-[#1f6feb]/15 text-[#58a6ff] border-[#1f6feb]/30 text-[11px] font-normal gap-1 font-sans">
                      KPI: {activeFilter === 'onTime' ? 'En Tiempo' : activeFilter === 'late' ? 'Fuera de Tiempo' : activeFilter === 'pending' ? 'Pendiente' : 'Vencimiento < 5 Días'}
                      <button onClick={() => setActiveFilter('all')} className="hover:text-white ml-0.5 cursor-pointer">×</button>
                    </Badge>
                  )}

                  {searchTerm && (
                    <Badge variant="outline" className="bg-[#1f6feb]/15 text-[#58a6ff] border-[#1f6feb]/30 text-[11px] font-normal gap-1 font-sans">
                      Texto: "{searchTerm}"
                      <button onClick={() => setSearchTerm('')} className="hover:text-white ml-0.5 cursor-pointer">×</button>
                    </Badge>
                  )}

                  {selectedCustomer !== 'all' && (
                    <Badge variant="outline" className="bg-[#1f6feb]/15 text-[#58a6ff] border-[#1f6feb]/30 text-[11px] font-normal gap-1 font-sans">
                      Cliente: {selectedCustomer}
                      <button onClick={() => setSelectedCustomer('all')} className="hover:text-white ml-0.5 cursor-pointer">×</button>
                    </Badge>
                  )}

                  {selectedTmsStatuses.length > 0 && (
                    <Badge variant="outline" className="bg-[#1f6feb]/15 text-[#58a6ff] border-[#1f6feb]/30 text-[11px] font-normal gap-1 font-sans">
                      Estado TMS ({selectedTmsStatuses.length}): {selectedTmsStatuses.join(', ')}
                      <button onClick={() => setSelectedTmsStatuses([])} className="hover:text-white ml-0.5 cursor-pointer">×</button>
                    </Badge>
                  )}

                  <button
                    onClick={() => {
                      setActiveFilter('all');
                      setSearchTerm('');
                      setSelectedCustomer('all');
                      setSelectedTmsStatuses([]);
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline ml-auto font-medium cursor-pointer"
                  >
                    Limpiar todos los filtros
                  </button>
                </div>
              )}

              <Card className="bg-[#161b22] border-[#30363d] rounded-xl overflow-hidden shadow-none">
                <div className="px-6 py-4 border-b border-[#30363d] flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-[#161b22]">
                  <h2 className="text-base font-medium text-[#e6edf3]">Gestión de Entregas Pendientes</h2>
                  <div className="flex items-center gap-3 text-[#8b949e] text-[12px]">
                    <span>Mostrando: <strong className="text-[#e6edf3]">{filteredOrders.length}</strong> resultados</span>
                    <span className="w-px h-3 bg-[#30363d] hidden sm:block" />
                    <span>Última importación: {lastImported ? lastImported : 'Sin registros'}</span>
                  </div>
                </div>
                <div className="overflow-x-auto w-full border-[#30363d] border rounded-lg">
                  <Table className="border-collapse table-fixed w-full min-w-[1100px]">
                    <TableHeader>
                      <TableRow className="border-[#30363d] hover:bg-transparent bg-[#161b22]/50">
                        <TableHead className="text-[#8b949e] uppercase text-[10px] h-9 px-2 whitespace-nowrap w-[110px]">ID Pedido</TableHead>
                        <TableHead className="text-[#8b949e] uppercase text-[10px] h-9 px-2 whitespace-nowrap w-[95px]">Estado TMS</TableHead>
                        <TableHead className="text-[#8b949e] uppercase text-[10px] h-9 px-2 whitespace-nowrap w-[130px]">Cliente</TableHead>
                        <TableHead className="text-[#8b949e] uppercase text-[10px] h-9 px-2 whitespace-nowrap w-[130px]">Destinatario</TableHead>
                        <TableHead className="text-[#8b949e] uppercase text-[10px] h-9 px-2 whitespace-nowrap w-[110px]">Localidad</TableHead>
                        <TableHead className="text-[#8b949e] uppercase text-[10px] h-9 px-2 whitespace-nowrap w-[80px]">Creación</TableHead>
                        <TableHead 
                          className="text-[#8b949e] uppercase text-[10px] h-9 px-2 text-center whitespace-nowrap w-[135px] cursor-pointer select-none hover:text-[#e6edf3] hover:bg-[#21262d]/50 transition-colors rounded-md"
                          title="Clic para ordenar Días Transcurridos (Mayor a Menor / Menor a Mayor)"
                          onClick={() => {
                            if (elapsedSortOrder === null) {
                              setElapsedSortOrder('desc');
                            } else if (elapsedSortOrder === 'desc') {
                              setElapsedSortOrder('asc');
                            } else {
                              setElapsedSortOrder(null);
                            }
                          }}
                        >
                          <div className="flex items-center justify-center gap-1 font-semibold">
                            <span>Días Transcurridos</span>
                            {elapsedSortOrder === 'desc' && (
                              <Badge variant="outline" className="bg-[#3fb950]/10 border-[#3fb950]/30 text-[#3fb950] text-[8px] px-1 py-0 gap-0.5 font-mono shrink-0">
                                Mayor <ArrowDown className="w-2.5 h-2.5 text-[#3fb950]" />
                              </Badge>
                            )}
                            {elapsedSortOrder === 'asc' && (
                              <Badge variant="outline" className="bg-[#58a6ff]/10 border-[#58a6ff]/30 text-[#58a6ff] text-[8px] px-1 py-0 gap-0.5 font-mono shrink-0">
                                Menor <ArrowUp className="w-2.5 h-2.5 text-[#58a6ff]" />
                              </Badge>
                            )}
                            {elapsedSortOrder === null && (
                              <ArrowUpDown className="w-3 h-3 text-[#8b949e]/60 group-hover:text-[#e6edf3]" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="text-[#8b949e] uppercase text-[10px] h-9 px-2 whitespace-nowrap w-[95px]">Vencimiento</TableHead>
                        <TableHead className="text-[#8b949e] uppercase text-[10px] h-9 px-2 whitespace-nowrap w-[65px]">Turno</TableHead>
                        <TableHead className="text-[#8b949e] uppercase text-[10px] h-9 px-2 whitespace-nowrap w-[75px] text-right">Bultos/Kg</TableHead>
                        <TableHead className="text-[#8b949e] uppercase text-[10px] h-9 px-2 text-center whitespace-nowrap w-[95px]">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAndFilteredOrders.map((order) => {
                        const elapsedDays = Math.max(0, differenceInDays(new Date(), order.createdAt));
                        return (
                          <TableRow 
                            key={order.uniqueId}
                            className="border-[#21262d] hover:bg-[#1c2128] transition-colors"
                          >
                            <TableCell className="px-2 py-1.5 font-mono text-[#58a6ff] text-[11px] whitespace-nowrap">#{order.id}</TableCell>
                            <TableCell className="px-2 py-1.5 whitespace-nowrap">
                              <Badge variant="outline" className="bg-[#161b22] border-[#30363d] text-[#8b949e] text-[9px] whitespace-nowrap">
                                {order.tmsStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-2 py-1.5 font-medium text-[#e6edf3] text-[10px] whitespace-nowrap truncate max-w-[130px]" title={order.customerName}>
                              {order.customerName}
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-[#e6edf3] text-[10px] whitespace-nowrap truncate max-w-[130px]" title={order.recipient}>
                              {order.recipient}
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-[#8b949e] text-[11px] whitespace-nowrap truncate max-w-[110px]" title={order.location}>
                              {order.location}
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-[#8b949e] text-[11px] whitespace-nowrap">
                              {format(order.createdAt, 'dd/MM/yyyy', { locale: es })}
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-center whitespace-nowrap">
                              <Badge variant="outline" className={cn(
                                "text-[9px] font-mono font-semibold px-1.5 py-0.5 border",
                                elapsedDays === 0 && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                                elapsedDays > 0 && elapsedDays <= 3 && "bg-[#1f6feb]/10 text-[#58a6ff] border-[#1f6feb]/20",
                                elapsedDays > 3 && elapsedDays <= 6 && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                                elapsedDays > 6 && "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              )}>
                                {elapsedDays} {elapsedDays === 1 ? 'día' : 'días'}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-2 py-1.5 whitespace-nowrap">
                              <div className="flex flex-col whitespace-nowrap leading-tight">
                                <span className="text-[#e6edf3] text-[11px]">{format(order.deliveryDeadline, 'dd/MM/yyyy', { locale: es })}</span>
                                <span className="text-[9px] text-[#8b949e] font-mono">{getTimeLeft(order.deliveryDeadline)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-[11px] whitespace-nowrap">{order.shift}</TableCell>
                            <TableCell className="px-2 py-1.5 whitespace-nowrap text-right">
                              <div className="flex flex-col text-[10px] text-[#8b949e] whitespace-nowrap leading-tight">
                                <span>{order.packages} bultos</span>
                                <span>{order.weight} kg</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-center whitespace-nowrap">
                              {getStatusTag(order)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
            )}
          </>
        )}
      </main>

      {/* Hidden Folder Picker Input for Iframe Fallback */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderInputSelect}
        className="hidden"
        {...({ webkitdirectory: "", directory: "", multiple: true } as any)}
      />

      {/* Modal explicativo para acceso a carpetas en vista integrada (Iframe) */}
      <Dialog open={showIframeModal} onOpenChange={setShowIframeModal}>
        <DialogContent className="bg-[#161b22] border-[#30363d] text-[#e6edf3] max-w-lg rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400 text-base font-bold">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              Acceso a Carpeta Local en Vista Integrada
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8b949e] pt-1.5 leading-relaxed text-left">
              Los navegadores web (Chrome / Edge) restringen el uso de la API directa de carpetas en vivo dentro de previsualizaciones o marcos integrados (iframes) por razones de seguridad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-2 text-left">
            <div className="p-4 bg-[#0d1117] border border-[#30363d] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-[#e6edf3] flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-[#58a6ff]" />
                  Opción 1: Abrir en Nueva Pestaña (Recomendado)
                </h5>
                <span className="text-[10px] font-bold text-[#3fb950] bg-[#3fb950]/10 px-2 py-0.5 rounded-full border border-[#3fb950]/20">
                  Sincronización Continua
                </span>
              </div>
              <p className="text-[11px] text-[#8b949e] leading-relaxed">
                Abre la aplicación en su propia ventana para habilitar el monitoreo automático en tiempo real de tu carpeta de PC.
              </p>
              <Button
                type="button"
                onClick={() => {
                  window.open(window.location.href, '_blank');
                  setShowIframeModal(false);
                }}
                className="bg-[#1f6feb] hover:bg-[#388bfd] text-white text-xs h-9 px-4 w-full flex items-center justify-center gap-2 font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir App en Nueva Pestaña
              </Button>
            </div>

            <div className="p-4 bg-[#0d1117] border border-[#30363d] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-[#e6edf3] flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-[#3fb950]" />
                  Opción 2: Cargar Carpeta en la Vista Actual
                </h5>
                <span className="text-[10px] text-[#8b949e] bg-[#21262d] px-2 py-0.5 rounded-full border border-[#30363d]">
                  Sin Salir del Marco
                </span>
              </div>
              <p className="text-[11px] text-[#8b949e] leading-relaxed">
                Selecciona la carpeta local de tu PC para que el sistema busque e importe inmediatamente el Excel de SLA más reciente.
              </p>
              <Button
                type="button"
                onClick={() => {
                  folderInputRef.current?.click();
                }}
                variant="outline"
                className="bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] border-[#30363d] text-xs h-9 px-4 w-full flex items-center justify-center gap-2 font-medium"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#3fb950]" />
                Seleccionar Carpeta de la PC
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Configuración de Lead Time por Zona */}
      <LeadTimeConfigModal
        isOpen={showLeadTimeModal}
        onClose={() => setShowLeadTimeModal(false)}
        zoneLeadTimes={zoneLeadTimes}
        defaultLeadTime={defaultLeadTime}
        availableLocations={availableLocations}
        onSave={handleSaveLeadTimes}
      />
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
  const isLate = isOrderLate(order);

  if (order.status === 'delivered') {
    return !isLate 
      ? <span className="px-2 py-1 rounded bg-[#3fb95015] text-[#3fb950] text-[10px] font-bold uppercase">A Tiempo</span>
      : <span className="px-2 py-1 rounded bg-[#f8514915] text-[#f85149] text-[10px] font-bold uppercase">Fuera de Tiempo</span>;
  }

  if (isLate) {
    return <span className="px-2 py-1 rounded bg-[#f8514915] text-[#f85149] text-[10px] font-bold uppercase">Fuera de Tiempo</span>;
  }

  const daysLeft = differenceInDays(order.deliveryDeadline, new Date());
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
  color: 'blue' | 'green' | 'red' | 'orange' | 'purple';
  subtext?: string;
  icon?: ReactNode;
}

function KPICard({ title, value, isActive, onClick, color, subtext, icon }: KPICardProps) {
  const valueColors = {
    blue: "text-[#58a6ff]",
    green: "text-[#3fb950]",
    red: "text-[#f85149]",
    orange: "text-[#d29922]",
    purple: "text-[#a371f7]",
  };

  return (
    <motion.button
      whileHover={{ backgroundColor: '#1c2128' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex flex-col p-4 sm:p-5 rounded-xl border transition-all text-left relative overflow-hidden cursor-pointer",
        "bg-[#161b22] border-[#30363d]",
        isActive && "border-[#a371f7] bg-[#1f2937]"
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] sm:text-[12px] text-[#8b949e] uppercase tracking-wider font-medium font-sans">
          {title}
        </span>
        {icon && <span className="text-[#8b949e]">{icon}</span>}
      </div>
      <div className={cn("text-2xl sm:text-3xl font-bold font-sans", valueColors[color])}>
        {value}
      </div>
      {subtext && (
        <div className="text-[10px] text-[#8b949e] mt-1 font-mono truncate">
          {subtext}
        </div>
      )}
    </motion.button>
  );
}

interface MultiSelectStatusFilterProps {
  statuses: string[];
  selectedStatuses: string[];
  onChange: (statuses: string[]) => void;
  orders: Order[];
}

function MultiSelectStatusFilter({
  statuses,
  selectedStatuses,
  onChange,
  orders
}: MultiSelectStatusFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      if (o.tmsStatus) {
        counts[o.tmsStatus] = (counts[o.tmsStatus] || 0) + 1;
      }
    });
    return counts;
  }, [orders]);

  const toggleStatus = (status: string) => {
    if (selectedStatuses.length === 0) {
      onChange([status]);
    } else if (selectedStatuses.includes(status)) {
      const next = selectedStatuses.filter(s => s !== status);
      onChange(next);
    } else {
      const next = [...selectedStatuses, status];
      if (next.length === statuses.length) {
        onChange([]);
      } else {
        onChange(next);
      }
    }
  };

  const isAllSelected = selectedStatuses.length === 0 || selectedStatuses.length === statuses.length;

  return (
    <div className="relative w-full sm:w-[240px]" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-[#161b22] border border-[#30363d] text-[#e6edf3] focus:outline-none focus:border-[#8b949e] h-10 px-3 rounded-md flex items-center justify-between text-xs transition-colors cursor-pointer",
          selectedStatuses.length > 0 && "border-[#388bfd]/60 bg-[#1f2937]/50"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <Package className="w-4 h-4 shrink-0 text-[#8b949e]" />
          <span className="truncate font-medium">
            {isAllSelected 
              ? "Estado TMS: Todos" 
              : selectedStatuses.length === 1 
                ? `TMS: ${selectedStatuses[0]}`
                : `Estado TMS (${selectedStatuses.length} sel.)`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedStatuses.length > 0 && (
            <span className="bg-[#1f6feb] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {selectedStatuses.length}
            </span>
          )}
          <ChevronDown className={cn("w-3.5 h-3.5 text-[#8b949e] transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[260px] bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 overflow-hidden animate-smooth">
          <div className="p-2.5 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]/80">
            <span className="text-[11px] font-bold text-[#8b949e] uppercase tracking-wider font-sans">
              Estados TMS (Múltiple)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] text-[#58a6ff] hover:underline font-medium cursor-pointer"
              >
                {isAllSelected ? "Ver Todos" : "Seleccionar Todos"}
              </button>
              {selectedStatuses.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[11px] text-rose-400 hover:underline font-medium cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
            <div
              onClick={() => onChange([])}
              className={cn(
                "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                isAllSelected ? "bg-[#1f2937] text-white font-semibold" : "text-[#c9d1d9] hover:bg-[#21262d]"
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                  isAllSelected ? "bg-[#1f6feb] border-[#1f6feb] text-white" : "border-[#30363d]"
                )}>
                  {isAllSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>Todos los Estados</span>
              </div>
              <span className="text-[10px] font-mono text-[#8b949e] bg-[#21262d] px-1.5 py-0.5 rounded">
                {orders.length}
              </span>
            </div>

            <div className="my-1 border-t border-[#30363d]/50" />

            {statuses.map(status => {
              const isChecked = selectedStatuses.includes(status);
              const count = statusCounts[status] || 0;
              return (
                <div
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                    isChecked 
                      ? "bg-[#1f6feb]/15 text-[#58a6ff] font-medium" 
                      : "text-[#c9d1d9] hover:bg-[#21262d]"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      isChecked 
                        ? "bg-[#1f6feb] border-[#1f6feb] text-white" 
                        : "border-[#30363d]"
                    )}>
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="truncate">{status}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8b949e] bg-[#21262d] px-1.5 py-0.5 rounded shrink-0">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
