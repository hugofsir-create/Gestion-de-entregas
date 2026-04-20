import * as XLSX from 'xlsx';
import { Order, OrderStatus } from '../types';
import { parse, isValid } from 'date-fns';

export const parseExcelFile = (file: File): Promise<Order[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
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
          const shift = String(row['J'] || 'N/A').trim();
          
          const parseDate = (val: any) => {
            if (!val) return new Date();
            if (val instanceof Date) return val;
            if (typeof val === 'number') {
              return new Date((val - 25569) * 86400 * 1000);
            }
            const formats = ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy', 'HH:mm:ss'];
            for (const f of formats) {
              const d = parse(String(val), f, new Date());
              if (isValid(d)) return d;
            }
            return new Date(val);
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
