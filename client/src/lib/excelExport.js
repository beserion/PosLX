import * as XLSX from 'xlsx';

/**
 * Tablo verilerini Excel (.xlsx) dosyası olarak indirir.
 *
 * @param {Array<Object>} data     — Tablo satırları
 * @param {Array<{header: string, key: string, formatter?: (val: any, row: Object) => any}>} columns — Sütun tanımları
 * @param {string} filename        — İndirilecek dosya adı (uzantısız)
 * @param {Object} options         — Ekstra ayarlar (title, storeName vb.)
 */
export function exportToExcel(data, columns, filename, options = {}) {
    // Sadece Tablo Başlıkları
    const tableHeaders = columns.map(c => c.header);

    // Sadece Tablo Verileri
    const rows = data.map((row, rowIndex) =>
        columns.map(col => {
            const val = row[col.key];
            return col.formatter ? col.formatter(val, row, rowIndex) : (val ?? '');
        })
    );

    // Worksheet oluştur
    const ws = XLSX.utils.aoa_to_sheet([tableHeaders, ...rows]);

    // Sütun Genişliklerini Ayarla
    const colWidths = columns.map((col, idx) => {
        const maxLen = Math.max(
            col.header.length,
            ...rows.map(r => String(r[idx] ?? '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 2, 10), 100) };
    });
    ws['!cols'] = colWidths;

    // Workbook oluştur ve indir
    const wb = XLSX.utils.book_new();
    const sheetName = options.title ? options.title.substring(0, 31) : 'Rapor';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${filename}_${today}.xlsx`);
}
