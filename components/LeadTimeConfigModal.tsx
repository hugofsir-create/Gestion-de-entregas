import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw, 
  AlertCircle,
  HelpCircle
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zoneLeadTimes: Record<string, number>;
  defaultLeadTime: number;
  onSaveLeadTimes: (
    newZoneLeadTimes: Record<string, number>, 
    newDefaultLeadTime: number, 
    recalculateOrders: boolean
  ) => void;
  availableLocations: string[];
}

export default function LeadTimeConfigModal({
  open,
  onOpenChange,
  zoneLeadTimes,
  defaultLeadTime,
  onSaveLeadTimes,
  availableLocations
}: LeadTimeConfigModalProps) {
  const [localLeadTimes, setLocalLeadTimes] = useState<Record<string, number>>({});
  const [localDefaultDays, setLocalDefaultDays] = useState<number>(3);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneDays, setNewZoneDays] = useState<number>(3);
  const [recalculateSLA, setRecalculateSLA] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Sync state when dialog opens
  useEffect(() => {
    if (open) {
      const merged: Record<string, number> = { ...zoneLeadTimes };
      
      // Ensure all locations from current orders are populated
      availableLocations.forEach(loc => {
        if (loc && loc !== 'N/A' && !(loc in merged)) {
          merged[loc] = defaultLeadTime;
        }
      });

      setLocalLeadTimes(merged);
      setLocalDefaultDays(defaultLeadTime || 3);
      setNewZoneName('');
      setNewZoneDays(3);
    }
  }, [open, zoneLeadTimes, defaultLeadTime, availableLocations]);

  const handleDayChange = (zone: string, days: number) => {
    const validDays = Math.max(1, Math.min(30, days));
    setLocalLeadTimes(prev => ({
      ...prev,
      [zone]: validDays
    }));
  };

  const handleAddCustomZone = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newZoneName.trim();
    if (!trimmed) return;

    setLocalLeadTimes(prev => ({
      ...prev,
      [trimmed]: Math.max(1, newZoneDays)
    }));
    setNewZoneName('');
    setNewZoneDays(localDefaultDays);
  };

  const handleRemoveZone = (zone: string) => {
    setLocalLeadTimes(prev => {
      const next = { ...prev };
      delete next[zone];
      return next;
    });
  };

  const handleSave = () => {
    onSaveLeadTimes(localLeadTimes, localDefaultDays, recalculateSLA);
    onOpenChange(false);
  };

  const filteredZones = Object.keys(localLeadTimes).filter(zone =>
    zone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#161b22] border-[#30363d] text-[#e6edf3] max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-3 border-b border-[#30363d] shrink-0">
          <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-[#e6edf3]">
            <Clock className="w-5 h-5 text-[#a371f7]" />
            Configuración de Lead Time por Zona / Localidad
          </DialogTitle>
          <DialogDescription className="text-xs text-[#8b949e] pt-1 leading-relaxed text-left">
            Define el plazo en días hábiles asignado a cada destino para calcular de manera automática la fecha límite de vencimiento (SLA) de las entregas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4 overflow-y-auto custom-scrollbar pr-1 flex-1 text-left">
          {/* General Default Lead Time Card */}
          <div className="p-4 bg-[#0d1117] border border-[#30363d] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-[#e6edf3] flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#58a6ff]" />
                Lead Time General por Defecto
              </h4>
              <p className="text-[11px] text-[#8b949e] mt-0.5">
                Días de entrega aplicados para localidades sin una regla específica asignada.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLocalDefaultDays(d => Math.max(1, d - 1))}
                className="h-8 w-8 p-0 bg-[#21262d] border-[#30363d] text-white hover:bg-[#30363d]"
              >
                -
              </Button>
              <div className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] px-3 py-1 rounded-md">
                <span className="font-mono text-sm font-bold text-[#58a6ff]">{localDefaultDays}</span>
                <span className="text-[11px] text-[#8b949e]">días</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLocalDefaultDays(d => d + 1)}
                className="h-8 w-8 p-0 bg-[#21262d] border-[#30363d] text-white hover:bg-[#30363d]"
              >
                +
              </Button>
            </div>
          </div>

          {/* Add New Custom Zone Form */}
          <form onSubmit={handleAddCustomZone} className="p-4 bg-[#0d1117]/60 border border-[#30363d] rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-[#e6edf3] flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#3fb950]" />
              Agregar Nueva Zona o Localidad
            </h4>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Input
                type="text"
                placeholder="Nombre de la zona / localidad (ej. CABA, Córdoba)"
                value={newZoneName}
                onChange={e => setNewZoneName(e.target.value)}
                className="bg-[#161b22] border-[#30363d] text-xs h-9 text-[#e6edf3] placeholder:text-[#8b949e] flex-1"
              />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-[#161b22] border border-[#30363d] px-2.5 h-9 rounded-md shrink-0">
                  <span className="text-[11px] text-[#8b949e]">Días:</span>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={newZoneDays}
                    onChange={e => setNewZoneDays(parseInt(e.target.value) || 1)}
                    className="bg-transparent border-0 text-xs font-mono font-bold text-white w-12 p-0 focus-visible:ring-0 text-center"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!newZoneName.trim()}
                  className="bg-[#238636] hover:bg-[#2ea043] text-white text-xs h-9 px-3.5 shrink-0 flex items-center gap-1.5 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </Button>
              </div>
            </div>
          </form>

          {/* Zones List with Search */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#e6edf3] uppercase tracking-wider font-sans flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#a371f7]" />
                Lead Time por Zonas Registradas ({Object.keys(localLeadTimes).length})
              </h4>
              <Input
                type="text"
                placeholder="Buscar localidad..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-[#0d1117] border-[#30363d] text-xs h-7 w-48 text-[#e6edf3] placeholder:text-[#8b949e]"
              />
            </div>

            <div className="border border-[#30363d] rounded-xl overflow-hidden bg-[#0d1117]/40 max-h-56 overflow-y-auto custom-scrollbar">
              {filteredZones.length > 0 ? (
                <div className="divide-y divide-[#30363d]/60">
                  {filteredZones.map(zone => {
                    const days = localLeadTimes[zone];
                    const isFromOrders = availableLocations.includes(zone);

                    return (
                      <div 
                        key={zone} 
                        className="p-3 flex items-center justify-between hover:bg-[#161b22]/70 transition-colors gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-[#8b949e] shrink-0" />
                          <span className="text-xs font-medium text-[#e6edf3] truncate" title={zone}>
                            {zone}
                          </span>
                          {isFromOrders && (
                            <Badge variant="outline" className="bg-[#1f6feb]/10 text-[#58a6ff] border-[#1f6feb]/20 text-[9px] px-1.5 py-0 shrink-0">
                              En base
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDayChange(zone, days - 1)}
                              className="h-7 w-7 p-0 bg-[#21262d] border-[#30363d] text-white hover:bg-[#30363d] text-xs"
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              max={30}
                              value={days}
                              onChange={e => handleDayChange(zone, parseInt(e.target.value) || 1)}
                              className="bg-[#161b22] border-[#30363d] text-xs font-mono font-bold text-center w-12 h-7 p-0 text-[#58a6ff]"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDayChange(zone, days + 1)}
                              className="h-7 w-7 p-0 bg-[#21262d] border-[#30363d] text-white hover:bg-[#30363d] text-xs"
                            >
                              +
                            </Button>
                            <span className="text-[11px] text-[#8b949e] ml-1">días</span>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveZone(zone)}
                            className="h-7 w-7 p-0 text-[#8b949e] hover:text-rose-400 hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-[#8b949e] italic">
                  {searchTerm ? 'No se encontraron zonas coincidentes.' : 'No hay zonas registradas.'}
                </div>
              )}
            </div>
          </div>

          {/* Recalculate SLA Checkbox */}
          <div className="p-3.5 bg-[#161b22] border border-[#30363d] rounded-xl flex items-center gap-3">
            <input
              type="checkbox"
              id="recalculate-sla"
              checked={recalculateSLA}
              onChange={e => setRecalculateSLA(e.target.checked)}
              className="w-4 h-4 rounded border-[#30363d] text-[#1f6feb] focus:ring-0 bg-[#0d1117] cursor-pointer"
            />
            <label htmlFor="recalculate-sla" className="text-xs text-[#c9d1d9] cursor-pointer leading-tight">
              <strong className="text-white block font-medium">Recalcular fechas de vencimiento (SLA)</strong>
              Actualizar la fecha límite de los pedidos cargados según su zona y su fecha de creación.
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-[#30363d] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#8b949e] flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" /> Se guardará en la configuración de la app
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-[#21262d] border-[#30363d] hover:bg-[#30363d] text-[#e6edf3] text-xs h-9 px-4 font-medium"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="bg-[#1f6feb] hover:bg-[#388bfd] text-white text-xs h-9 px-4 flex items-center gap-1.5 font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar Configuración
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
