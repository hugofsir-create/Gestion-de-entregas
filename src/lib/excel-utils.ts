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
          const id = row['G'] || `ORD-${index + 1000}`;
          const customerName = row['F'] || 'N/A';
          const tmsStatus = row['A'] || 'N/A';
          
          const parseDate = (val: any) => {
            if (!val) return new Date();
            if (val instanceof Date) return val;
            if (typeof val === 'number') {
              return new Date((val - 25569) * 86400 * 1000);
            }
            const formats = ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy'];
            for (const f of formats) {
              const d = parse(String(val), f, new Date());
              if (isValid(d)) return d;
            }
            return new Date(val);
          };

          const deliveryDeadline = parseDate(row['Y']);
          // For orderDate, let's keep it as current if not provided or use another col if common
          const orderDate = new Date(); 
          
          // Heuristic for status based on tms data or generic
          let status: OrderStatus = 'pending';
          const statusRaw = String(row['A'] || '').toLowerCase();
          if (statusRaw.includes('entregado') || statusRaw.includes('finalizado') || statusRaw.includes('delivered')) {
            status = 'delivered';
          }

          return {
            id: String(id),
            customerName: String(customerName),
            orderDate,
            deliveryDeadline,
            status,
            tmsStatus: String(tmsStatus),
            items: '', // Default as it's not requested specifically now
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
