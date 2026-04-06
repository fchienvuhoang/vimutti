import * as xlsx from 'xlsx';
import { ParsedRecord } from './types';

export async function parseExcelBankStatement(file: File): Promise<ParsedRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = xlsx.read(data, { type: 'array' });
        
        // Grab the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON using array format to easily map standard columns
        const rawJsonData = xlsx.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
        
        // Skip first 10 rows (header/metadata)
        const dataRows = rawJsonData.slice(10);
        
        const records: ParsedRecord[] = dataRows
          .map((row) => {
            const chiTietGiaoDich = String(row[6] || "").trim();
            return {
              soThamChieu: String(row[0] || "").trim(),
              ngayGioGiaoDich: String(row[1] || "").trim(),
              loaiGiaoDich: String(row[2] || "").trim(),
              nganHang: String(row[3] || "").trim(),
              soTaiKhoan: String(row[4] || "").trim(),
              tenChuTaiKhoan: String(row[5] || "").trim(),
              chiTietGiaoDich,
              tienRa: row[7] !== "" && row[7] !== undefined ? row[7] : "",
              tienVao: row[8] !== "" && row[8] !== undefined ? row[8] : "",
              ghiChu: String(row[9] || "").trim(),
              searchText: chiTietGiaoDich,
            };
          })
          .filter((r) => r.ngayGioGiaoDich || r.chiTietGiaoDich || r.tienRa || r.tienVao); // filter completely empty rows

        
        resolve(records);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsArrayBuffer(file);
  });
}
