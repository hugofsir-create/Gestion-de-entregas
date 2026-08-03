import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw, 
  AlertCircle,
  HelpCircle,
  Check
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LeadTimeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  zoneLeadTimes: Record<string, number>;
  defaultLeadTime: number;
  availableLocations: string[];
  onSave: (
    newZoneLeadTimes: Record<string, number>, 
    newDefaultLeadTime: number, 
    recalculateOrders: boolean
  ) => void;
}

export const normalizeHours = (val: number): number => {
  if (!val || val <= 0) return 72;
  if (val <= 15) return val * 24; // Convert days to hours if legacy small number
  return val;
};

export const formatLeadTimeDisplay = (hours: number): string => {
  const normalized = normalizeHours(hours);
  const days = normalized / 24;
  if (days % 1 === 0) {
    return `${normalized} hs (${days} ${days === 1 ? 'día' : 'días'})`;
  }
  return `${normalized} hs (${days.toFixed(1)} días)`;
};

export default function LeadTimeConfigModal({
  isOpen,
  onClose,
  zoneLeadTimes,
  defaultLeadTime,
  availableLocations,
  onSave
}: LeadTimeConfigModalProps) {
  const [localLeadTimes, setLocalLeadTimes] = useState<Record<string, number>>({});
  const [localDefaultHours, setLocalDefaultHours] = useState<number>(72);
  
  // Form states for adding custom zone
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneValue, setNewZoneValue] = useState<number>(48);
  const [newZoneUnit, setNewZoneUnit] = useState<'hours' | 'days'>('hours');
  
  const [recalculateSLA, setRecalculateSLA] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Default presets
  const defaultPresets: Record<string, number> = {
    'CABA': 48,
    'GBA Zona Norte': 72,
    'GBA Zona Sur': 72,
    'GBA Zona Oeste': 72,
    'Tucumán': 48,
    'Córdoba': 96,
    'Mendoza': 120,
    'Santa Fe': 96
  };

  useEffect(() => {
    if (isOpen) {
      const merged: Record<string, number> = {};
      
      // Load existing from props or default presets
      const source = Object.keys(zoneLeadTimes).length > 0 ? zoneLeadTimes : defaultPresets;
      Object.entries(source).forEach(([zone, val]) => {
        merged[zone] = normalizeHours(val);
      });

      // Ensure Tucumán is present by default
      if (!('Tucumán' in merged) && !('TUCUMAN' in merged) && !('tucuman' in merged)) {
        merged['Tucumán'] = 48;
      }

      // Ensure all locations present in loaded orders are populated
      availableLocations.forEach(loc => {
        if (loc && loc !== 'N/A' && !(loc in merged)) {
          merged[loc] = normalizeHours(defaultLeadTime);
        }
      });

      setLocalLeadTimes(merged);
      setLocalDefaultHours(normalizeHours(defaultLeadTime || 72));
      setNewZoneName('');
      setNewZoneValue(48);
      setNewZoneUnit('hours');
    }
  }, [isOpen, zoneLeadTimes, defaultLeadTime, availableLocations]);

  const handleValueChange = (zone: string, rawVal: number, unit: 'hours' | 'days') => {
    const hours = unit === 'days' ? rawVal * 24 : rawVal;
    const validHours = Math.max(1, Math.min(720, hours)); // max 30 days = 720 hours
    setLocalLeadTimes(prev => ({
      ...prev,
      [zone]: validHours
    }));
  };

  const handleAddCustomZone = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newZoneName.trim();
    if (!trimmed) return;

    const hours = newZoneUnit === 'days' ? newZoneValue * 24 : newZoneValue;
    setLocalLeadTimes(prev => ({
      ...prev,
      [trimmed]: Math.max(1, hours)
    }));

    setNewZoneName('');
    setNewZoneValue(48);
    setNewZoneUnit('hours');
  };

  const handleRemoveZone = (zone: string) => {
    setLocalLeadTimes(prev => {
      const next = { ...prev };
      delete next[zone];
      return next;
    });
  };

  const handleSave = () => {
    onSave(localLeadTimes, localDefaultHours, recalculateSLA);
    onClose();
  };

  const filteredZones = Object.keys(localLeadTimes).filter(zone =>
    zone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#161b22] border-[#30363d] text-[#e6edf3] sm:max-w-5xl w-[92vw] rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-3 border-b border-[#30363d] shrink-0 pr-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-[#e6edf3]">
              <Clock className="w-5 h-5 text-[#a371f7]" />
              Configuración de Lead Time por Zona / Localidad (SLA)
            </DialogTitle>
            <Badge variant="outline" className="bg-[#a371f7]/10 text-[#d2a8ff] border-[#a371f7]/30 text-xs px-2.5 py-1 font-mono">
              {Object.keys(localLeadTimes).length} Zonas Configuradas
            </Badge>
          </div>
          <DialogDescription className="text-xs text-[#8b949e] pt-1 leading-relaxed text-left">
            Configura el tiempo de entrega en <strong className="text-[#e6edf3]">Horas (hs)</strong> o <strong className="text-[#e6edf3]">Días</strong> por localidad (ej. Tucumán = 48 hs / 2 días). Se utiliza para calcular automáticamente la fecha y hora de vencimiento de cada pedido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4 overflow-y-auto custom-scrollbar pr-1 flex-1 text-left">
          {/* Top Section: General Default Lead Time & Add Custom Zone Form */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* General Default Lead Time Card */}
            <div className="lg:col-span-5 p-4 bg-[#0d1117] border border-[#30363d] rounded-xl flex flex-col justify-between gap-3 shadow-inner">
              <div>
                <h4 className="text-xs font-bold text-[#e6edf3] flex items-center gap-1.5 uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-[#58a6ff]" />
                  Lead Time General por Defecto
                </h4>
                <p className="text-[11px] text-[#8b949e] mt-1">
                  Plazo estándar aplicado a los pedidos cuya localidad no posea una regla específica.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] p-1 rounded-lg w-full justify-between">
                  {[24, 48, 72, 96, 120].map(hs => (
                    <button
                      key={hs}
                      type="button"
                      onClick={() => setLocalDefaultHours(hs)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-mono rounded font-medium transition-all cursor-pointer flex-1 text-center",
                        localDefaultHours === hs
                          ? "bg-[#1f6feb] text-white shadow-md font-bold"
                          : "text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]"
                      )}
                    >
                      {hs}h
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Add New Custom Zone Form */}
            <form onSubmit={handleAddCustomZone} className="lg:col-span-7 p-4 bg-[#0d1117]/80 border border-[#30363d] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#e6edf3] flex items-center gap-1.5 uppercase tracking-wider">
                  <Plus className="w-4 h-4 text-[#3fb950]" />
                  Agregar o Modificar Zona (ej. Tucumán = 48 hs)
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <Input
                  type="text"
                  placeholder="Nombre de la localidad (ej. Tucumán, Salta, Rosario)..."
                  value={newZoneName}
                  onChange={e => setNewZoneName(e.target.value)}
                  className="sm:col-span-6 bg-[#161b22] border-[#30363d] text-xs h-9 text-[#e6edf3] placeholder:text-[#8b949e] focus-visible:border-[#58a6ff]"
                />

                <div className="sm:col-span-4 flex items-center gap-1 bg-[#161b22] border border-[#30363d] px-2 h-9 rounded-md">
                  <Input
                    type="number"
                    min={1}
                    max={720}
                    value={newZoneValue}
                    onChange={e => setNewZoneValue(parseInt(e.target.value) || 1)}
                    className="bg-transparent border-0 text-xs font-mono font-bold text-white w-14 p-0 focus-visible:ring-0 text-center"
                  />
                  <div className="flex bg-[#0d1117] p-0.5 rounded border border-[#30363d]">
                    <button
                      type="button"
                      onClick={() => setNewZoneUnit('hours')}
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer",
                        newZoneUnit === 'hours' ? "bg-[#a371f7] text-white font-bold" : "text-[#8b949e]"
                      )}
                    >
                      hs
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewZoneUnit('days')}
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer",
                        newZoneUnit === 'days' ? "bg-[#a371f7] text-white font-bold" : "text-[#8b949e]"
                      )}
                    >
                      días
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={!newZoneName.trim()}
                  className="sm:col-span-2 bg-[#238636] hover:bg-[#2ea043] text-white text-xs h-9 px-3 flex items-center justify-center gap-1 font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </Button>
              </div>

              {/* Quick Chips for Zone Creation */}
              <div className="flex items-center gap-2 pt-0.5 overflow-x-auto pb-0.5">
                <span className="text-[10px] text-[#8b949e] font-mono shrink-0">Presets rápidos:</span>
                {[
                  { label: '24 hs (1 día)', val: 24 },
                  { label: '48 hs (2 días)', val: 48 },
                  { label: '72 hs (3 días)', val: 72 },
                  { label: '96 hs (4 días)', val: 96 },
                  { label: '120 hs (5 días)', val: 120 }
                ].map(chip => (
                  <button
                    key={chip.val}
                    type="button"
                    onClick={() => {
                      setNewZoneValue(chip.val);
                      setNewZoneUnit('hours');
                    }}
                    className={cn(
                      "px-2.5 py-0.5 text-[10px] rounded-full border border-[#30363d] font-mono transition-colors cursor-pointer shrink-0",
                      newZoneValue === chip.val && newZoneUnit === 'hours'
                        ? "bg-[#a371f7]/20 border-[#a371f7] text-[#d2a8ff] font-bold"
                        : "bg-[#161b22] text-[#8b949e] hover:text-[#e6edf3]"
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </form>
          </div>

          {/* Registered Zones Table Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h4 className="text-xs font-bold text-[#e6edf3] uppercase tracking-wider font-sans flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#a371f7]" />
                Lista de Lead Time por Localidad ({filteredZones.length} de {Object.keys(localLeadTimes).length})
              </h4>
              <Input
                type="text"
                placeholder="Buscar localidad (ej. Tucumán, CABA)..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-[#0d1117] border-[#30363d] text-xs h-8.5 w-full sm:w-72 text-[#e6edf3] placeholder:text-[#8b949e] focus-visible:border-[#a371f7]"
              />
            </div>

            {/* Table layout for maximum legibility */}
            <div className="border border-[#30363d] rounded-xl overflow-hidden bg-[#0d1117]/60 shadow-inner">
              <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-[#161b22] border-b border-[#30363d] text-[11px] font-mono text-[#8b949e] uppercase tracking-wider sticky top-0 z-10">
                      <th className="py-2.5 px-4 font-semibold w-[220px]">Localidad / Zona</th>
                      <th className="py-2.5 px-3 font-semibold w-[160px]">SLA Calculado</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Presets Rápidos</th>
                      <th className="py-2.5 px-3 font-semibold text-center w-[140px]">Horas Exactas</th>
                      <th className="py-2.5 px-4 text-right font-semibold w-[80px]">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363d]/50 text-xs">
                    {filteredZones.length > 0 ? (
                      filteredZones.map((zone, idx) => {
                        const hours = localLeadTimes[zone];
                        const days = hours / 24;
                        const isFromOrders = availableLocations.includes(zone);

                        return (
                          <tr 
                            key={zone} 
                            className={cn(
                              "hover:bg-[#161b22] transition-colors",
                              idx % 2 === 0 ? "bg-transparent" : "bg-[#161b22]/30"
                            )}
                          >
                            {/* Localidad Name */}
                            <td className="py-2.5 px-4 font-semibold text-[#e6edf3]">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-[#a371f7] shrink-0" />
                                <span className="text-xs font-bold text-[#e6edf3]">{zone}</span>
                                {isFromOrders && (
                                  <Badge variant="outline" className="bg-[#1f6feb]/10 text-[#58a6ff] border-[#1f6feb]/20 text-[9px] px-1.5 py-0 font-normal">
                                    En base de datos
                                  </Badge>
                                )}
                              </div>
                            </td>

                            {/* SLA Display Badge */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <Badge variant="outline" className="bg-[#161b22] border-[#30363d] text-[#d2a8ff] font-mono text-xs px-2.5 py-1">
                                {days % 1 === 0 ? `${days} ${days === 1 ? 'día' : 'días'}` : `${days.toFixed(1)} días`} ({hours} hs)
                              </Badge>
                            </td>

                            {/* Preset Buttons */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {[24, 48, 72, 96, 120].map(h => (
                                  <button
                                    key={h}
                                    type="button"
                                    onClick={() => handleValueChange(zone, h, 'hours')}
                                    className={cn(
                                      "px-2.5 py-1 text-[11px] font-mono rounded-md border transition-all cursor-pointer",
                                      hours === h
                                        ? "bg-[#a371f7] border-[#a371f7] text-white font-bold shadow-sm"
                                        : "bg-[#161b22] border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] hover:border-[#58a6ff]"
                                    )}
                                  >
                                    {h}h
                                  </button>
                                ))}
                              </div>
                            </td>

                            {/* Exact Hours Input */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1 bg-[#161b22] border border-[#30363d] px-2.5 h-8 rounded-md w-28 mx-auto">
                                <Input
                                  type="number"
                                  min={1}
                                  max={720}
                                  value={hours}
                                  onChange={e => handleValueChange(zone, parseInt(e.target.value) || 1, 'hours')}
                                  className="bg-transparent border-0 text-xs font-mono font-bold text-center w-12 h-6 p-0 text-[#a371f7] focus-visible:ring-0"
                                />
                                <span className="text-[11px] text-[#8b949e] font-mono">hs</span>
                              </div>
                            </td>

                            {/* Delete Button */}
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveZone(zone)}
                                className="h-8 w-8 p-0 text-[#8b949e] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer rounded-md"
                                title="Eliminar regla para esta localidad"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-[#8b949e] italic">
                          {searchTerm ? `No se encontraron localidades que coincidan con "${searchTerm}".` : 'No hay localidades configuradas.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recalculate SLA Checkbox */}
          <div className="p-3.5 bg-[#0d1117] border border-[#30363d] rounded-xl flex items-center gap-3">
            <input
              type="checkbox"
              id="recalculate-sla"
              checked={recalculateSLA}
              onChange={e => setRecalculateSLA(e.target.checked)}
              className="w-4 h-4 rounded border-[#30363d] text-[#1f6feb] focus:ring-0 bg-[#161b22] cursor-pointer"
            />
            <label htmlFor="recalculate-sla" className="text-xs text-[#c9d1d9] cursor-pointer leading-tight">
              <strong className="text-white font-semibold">Recalcular vencimientos (SLA) de pedidos existentes</strong>
              <span className="text-[#8b949e] ml-2">Actualiza automáticamente las fechas límite de todos los pedidos cargados utilizando estas horas de Lead Time.</span>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-[#30363d] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#8b949e] flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-[#58a6ff]" /> Se guardará automáticamente en las preferencias de la aplicación
          </span>
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-[#21262d] border-[#30363d] hover:bg-[#30363d] text-[#e6edf3] text-xs h-9.5 px-5 font-medium cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="bg-[#1f6feb] hover:bg-[#388bfd] text-white text-xs h-9.5 px-6 flex items-center gap-1.5 font-semibold cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" />
              Guardar Configuración
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
