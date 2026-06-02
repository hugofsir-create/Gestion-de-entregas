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
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 'A' });

        // Skip header row (index 0) if it exists, sheet_to_json with header: 'A' includes the first row
        const dataRows = jsonData.length > 0 ? jsonData.slice(1) : [];

        const orders: Order[] = dataRows.map((row: any, index) => {
          const tmsStatus = String(row['A'] || 'N/A').trim();
          const createdAtRaw = row['B'];
          const customerName = String(row['C'] || 'N/A').trim();
          const id = String(row['D'] || `ORD-${index + 1000}`).trim();
          const recipient = String(row['E'] || 'N/A').trim();
          const location = String(row['F'] || 'N/A').trim();
          const packages = Number(row['G']) || 0;
          const weight = Number(row['H']) || 0;
          const deadlineRaw = row['I'];
          const shiftRaw = row['J'];

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
          
          // Heuristic for status based on tms data or generic
          let status: OrderStatus = 'pending';
          const statusRaw = String(tmsStatus).toLowerCase();
          if (statusRaw.includes('entregado') || statusRaw.includes('finalizado') || statusRaw.includes('delivered')) {
            status = 'delivered';
          }

          return {
            id: String(id),
            uniqueId: `${id}-${index}-${Date.now()}`,
            customerName: String(customerName),
            createdAt,
            deliveryDeadline,
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
    'Estado Interno': order.status === 'delivered' ? 'Entregado' : 'Pendiente'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pendientes');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
