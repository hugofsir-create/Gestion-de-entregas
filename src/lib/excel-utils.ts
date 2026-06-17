import * as XLSX from 'xlsx';
import { Order, OrderStatus } from '../types';
import { parse, isValid, format } from 'date-fns';

export const parseExcelFile = (file: File): Promise<Order[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        // Convert worksheet to an array of arrays so we can easily scan rows and search for headers
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (rows.length === 0) {
          resolve([]);
          return;
        }

        // Find the header row (the one containing most of our keywords)
        let headerRowIndex = 0;
        let maxMatches = -1;
        
        const headerCandidates = rows.slice(0, Math.min(15, rows.length));
        headerCandidates.forEach((row, rowIndex) => {
          if (!row || !Array.isArray(row)) return;
          let matches = 0;
          row.forEach(cell => {
            if (!cell) return;
            const str = String(cell).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // strip accents
            if (
              str.includes('pedido') || 
              str.includes('cliente') || 
              str.includes('tms') || 
              str.includes('bultos') || 
              str.includes('kilos') || 
              str.includes('vencimiento') || 
              str.includes('turno')
            ) {
              matches++;
            }
          });
          if (matches > maxMatches) {
            maxMatches = matches;
            headerRowIndex = rowIndex;
          }
        });

        // Clean and prepare the list of headers for fuzzy synonym lookups
        const headers = (rows[headerRowIndex] || []).map(h => 
          h ? String(h).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ""
        );

        // Helper to find a column index given a set of synonyms, falls back to a default index if none matches
        const findColumnIndex = (synonyms: string[], defaultIdx: number): number => {
          const cleanSyns = synonyms.map(s => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          
          // 1. Exact match or synonym list match
          for (let i = 0; i < headers.length; i++) {
            const h = headers[i];
            if (!h) continue;
            if (cleanSyns.includes(h)) return i;
          }
          
          // 2. Substring or soft match
          for (let i = 0; i < headers.length; i++) {
            const h = headers[i];
            if (!h) continue;
            for (const syn of cleanSyns) {
              if (h.includes(syn) || syn.includes(h)) {
                return i;
              }
            }
          }
          
          return defaultIdx;
        };

        // Resolve dynamic indices based on header labels
        const idxStatus = findColumnIndex(['estado tms', 'tms', 'estado', 'status tms', 'status'], 0);
        const idxCreated = findColumnIndex(['fecha creacion', 'creacion', 'fecha_creacion', 'creado', 'fecha creado', 'fecha de creacion', 'fecha'], 1);
        const idxCustomer = findColumnIndex(['cliente', 'customer', 'nombre cliente', 'nombre_cliente', 'razon social'], 2);
        const idxId = findColumnIndex(['id pedido', 'pedido', 'numero pedido', 'nro pedido', 'nro_pedido', 'numero de pedido', 'nro de pedido', 'id', 'id_pedido', 'nro_remito', 'remito'], 3);
        const idxRecipient = findColumnIndex(['destinatario', 'recipient', 'entregar a', 'recibe', 'nombre de entrega', 'nombre'], 4);
        const idxLocation = findColumnIndex(['localidad', 'ciudad', 'provincia', 'destino', 'location', 'localidades', 'municipio'], 5);
        const idxPackages = findColumnIndex(['bultos', 'bulto', 'cantidad bultos', 'cant bultos', 'packages', 'unidades', 'piezas', 'cant'], 6);
        const idxWeight = findColumnIndex(['kilos', 'kilo', 'kg', 'kgs', 'peso', 'weight', 'kilogramos'], 7);
        const idxDeadline = findColumnIndex(['fecha vencimiento', 'vencimiento', 'fecha limite', 'deadline', 'vence', 'fecha_vencimiento', 'vto'], 8);
        const idxShift = findColumnIndex(['turno', 'shift', 'franja', 'franja horaria', 'turnos'], 9);
        const idxActual = findColumnIndex(['fecha real de entrega', 'fecha real entrega', 'real de entrega', 'fecha real', 'fecha de entrega real', 'fecha_real_entrega', 'entregado el', 'actual delivery', 'fecha entrega real'], 10);

        // Slice data rows below the header
        const dataRows = rows.slice(headerRowIndex + 1);

        const orders: Order[] = dataRows
          .filter(row => {
            if (!row || !Array.isArray(row)) return false;
            // Check if there is at least some cells filled in the row
            return row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
          })
          .map((row: any[], index) => {
            const tmsStatus = String(row[idxStatus] !== undefined ? row[idxStatus] : 'N/A').trim();
            const createdAtRaw = row[idxCreated];
            const customerName = String(row[idxCustomer] !== undefined ? row[idxCustomer] : 'N/A').trim();
            const id = String(row[idxId] !== undefined ? row[idxId] : `ORD-${index + 1000}`).trim();
            const recipient = String(row[idxRecipient] !== undefined ? row[idxRecipient] : 'N/A').trim();
            const location = String(row[idxLocation] !== undefined ? row[idxLocation] : 'N/A').trim();
            const packages = Number(row[idxPackages]) || 0;
            const weight = Number(row[idxWeight]) || 0;
            const deadlineRaw = row[idxDeadline];
            const shiftRaw = row[idxShift];
            const actualRaw = row[idxActual];

            const parseShiftDate = (val: any): string => {
              if (!val) return 'N/A';
              if (val instanceof Date) {
                return isValid(val) ? format(val, 'dd/MM/yy') : 'N/A';
              }
              if (typeof val === 'number') {
                const d = new Date((val - 25569) * 86400 * 1000);
                return isValid(d) ? format(d, 'dd/MM/yy') : String(val);
              }

              const strVal = String(val).trim();
              if (!strVal || strVal.toLowerCase() === 'n/a') return 'N/A';

              // Check if it's an Excel serial number as a string (e.g. "46166")
              const numVal = Number(strVal);
              if (!isNaN(numVal) && isFinite(numVal) && numVal > 10000 && numVal < 100000) {
                const d = new Date((numVal - 25569) * 86400 * 1000);
                if (isValid(d)) return format(d, 'dd/MM/yy');
              }

              // Let's try parsing as a date using common formats
              const formats = [
                'dd/MM/yyyy',
                'dd/MM/yy',
                'd/M/yyyy',
                'd/M/yy',
                'dd-MM-yyyy',
                'dd-MM-yy',
                'd-M-yyyy',
                'd-M-yy',
                'yyyy-MM-dd',
                'MM/dd/yyyy',
                'yy/MM/dd',
                'yyyy/MM/dd',
                'HH:mm:ss'
              ];
              
              for (const f of formats) {
                const d = parse(strVal, f, new Date());
                if (isValid(d)) return format(d, 'dd/MM/yy');
              }

              const nativeD = new Date(strVal);
              if (isValid(nativeD)) {
                return format(nativeD, 'dd/MM/yy');
              }

              return strVal;
            };

            const shift = parseShiftDate(shiftRaw);
            
            const parseDate = (val: any) => {
              if (!val) return new Date();
              if (val instanceof Date) {
                return isValid(val) ? val : new Date();
              }
              if (typeof val === 'number') {
                const d = new Date((val - 25569) * 86400 * 1000);
                return isValid(d) ? d : new Date();
              }

              const strVal = String(val).trim();
              if (!strVal) return new Date();

              // Handle stringified Excel serial numbers (e.g. "45423" or similar)
              const numVal = Number(strVal);
              if (!isNaN(numVal) && isFinite(numVal) && numVal > 10000 && numVal < 100000) {
                const d = new Date((numVal - 25569) * 86400 * 1000);
                if (isValid(d)) return d;
              }

              // Common formats, checking dd/MM/yy, dd/MM/yyyy, d/M/yy first which are the most common Spanish/Argentine styles
              const formats = [
                'dd/MM/yyyy',
                'dd/MM/yy',
                'd/M/yyyy',
                'd/M/yy',
                'dd-MM-yyyy',
                'dd-MM-yy',
                'd-M-yyyy',
                'd-M-yy',
                'yyyy-MM-dd',
                'MM/dd/yyyy',
                'yy/MM/dd',
                'yyyy/MM/dd',
                'HH:mm:ss'
              ];
              
              for (const f of formats) {
                const d = parse(strVal, f, new Date());
                if (isValid(d)) return d;
              }

              const nativeD = new Date(strVal);
              if (isValid(nativeD)) return nativeD;

              return new Date();
            };

            const createdAt = parseDate(createdAtRaw);
            const deliveryDeadline = parseDate(deadlineRaw);
            const actualDeliveryDate = actualRaw ? parseDate(actualRaw) : undefined;
            
            // Heuristic for status based on tms data or generic
            let status: OrderStatus = 'pending';
            const statusRaw = String(tmsStatus).toLowerCase();
            if (statusRaw.includes('entregado') || statusRaw.includes('finalizado') || statusRaw.includes('delivered') || actualDeliveryDate) {
              status = 'delivered';
            }

            return {
              id: String(id),
              uniqueId: `${id}-${index}-${Date.now()}`,
              customerName: String(customerName),
              createdAt,
              deliveryDeadline,
              actualDeliveryDate,
              status,
              tmsStatus: String(tmsStatus),
              recipient: String(recipient),
              location: String(location),
              packages,
              weight,
              shift: String(shift),
              items: '', 
              priority: 'medium',
            };
          });

        resolve(orders);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const exportToExcel = (orders: Order[], fileName: string) => {
  const data = orders.map(order => ({
    'ID Pedido': order.id,
    'Estado TMS': order.tmsStatus,
    'Cliente': order.customerName,
    'Destinatario': order.recipient,
    'Localidad': order.location,
    'Creación': format(order.createdAt, 'dd/MM/yyyy'),
    'Vencimiento': format(order.deliveryDeadline, 'dd/MM/yyyy'),
    'Turno': order.shift,
    'Bultos': order.packages,
    'Kilos': order.weight,
    'Estado Interno': order.status === 'delivered' ? 'Entregado' : 'Pendiente',
    'Fecha Real de Entrega': order.actualDeliveryDate ? format(order.actualDeliveryDate, 'dd/MM/yyyy') : ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pendientes');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportTemplateExcel = () => {
  // Column titles corresponding exactly to columns A to K
  const headers = [
    'Estado TMS',
    'Fecha Creación',
    'Cliente',
    'ID Pedido',
    'Destinatario',
    'Localidad',
    'Bultos',
    'Kilos',
    'Fecha Vencimiento',
    'Turno',
    'Fecha Real de Entrega (Opcional)'
  ];

  const sampleRows = [
    [
      'En Proceso',
      '15/06/2026',
      'COMPAÑIA INDUSTRIAL S.A.',
      '70014022',
      'ALMACEN CENTRAL',
      'CABA',
      12,
      180,
      '20/06/2026',
      'Mañana',
      ''
    ],
    [
      'Entregado',
      '14/06/2026',
      'LABORATORIO ARGENTINO',
      '70014023',
      'SANTIAGO GOMEZ',
      'CORDOBA',
      5,
      45,
      '18/06/2026',
      'Tarde',
      '17/06/2026'
    ]
  ];

  const data = [headers, ...sampleRows];

  // Create worksheet from arrays
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths so headers are perfectly visible
  worksheet['!cols'] = [
    { wch: 18 }, // Estado TMS
    { wch: 16 }, // Fecha Creación
    { wch: 28 }, // Cliente
    { wch: 15 }, // ID Pedido
    { wch: 24 }, // Destinatario
    { wch: 18 }, // Localidad
    { wch: 10 }, // Bultos
    { wch: 10 }, // Kilos
    { wch: 18 }, // Fecha Vencimiento
    { wch: 12 }, // Turno
    { wch: 32 }  // Fecha Real de Entrega
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Calico');
  XLSX.writeFile(workbook, 'Plantilla_Calico_SLA.xlsx');
};

