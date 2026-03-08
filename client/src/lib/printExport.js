import api from './api';

export async function printReport(data, columns, options = {}) {
    // Popup engelleyiciyi aşmak için butona basıldığı an hemen boş bir pencere açıyoruz
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Yazdırılacak pencere pop-up engelleyicisine takıldı. Lütfen izin verin.");
        return;
    }

    printWindow.document.write('<div style="font-family: sans-serif; padding: 20px;">Rapor hazırlanıyor, lütfen bekleyin...</div>');

    let settingsStoreName = 'PosLX Mağazası';
    try {
        const { data: settingsData } = await api.get('/settings');
        if (settingsData && settingsData.storeName) {
            settingsStoreName = settingsData.storeName;
        }
    } catch (e) {
        console.warn("Could not fetch storeName for print report", e);
    }

    const {
        title = 'Rapor',
        storeName = settingsStoreName
    } = options;

    const today = new Date();
    const formattedDate = today.toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    const thead = columns.map(c => `<th style="text-align: left; padding: 12px 8px; border-bottom: 2px solid #cbd5e1; color: #334155; font-weight: 600; font-size: 13px;">${c.header}</th>`).join('');

    const tbody = data.map((row, rowIndex) => {
        const tr = columns.map(col => {
            const val = row[col.key];
            const formattedVal = col.formatter ? col.formatter(val, row, rowIndex) : (val ?? '');
            return `<td style="padding: 10px 8px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 13px;">${formattedVal}</td>`;
        }).join('');
        return `<tr>${tr}</tr>`;
    }).join('');

    const html = `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    padding: 20px;
                    color: #0f172a;
                    background: #fff;
                    margin: 0;
                }
                .header {
                    margin-bottom: 20px;
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }
                .header-left h1 {
                    font-size: 24px;
                    margin: 0 0 4px 0;
                    letter-spacing: -0.5px;
                }
                .header-left h2 {
                    font-size: 16px;
                    color: #475569;
                    margin: 0;
                    font-weight: 500;
                }
                .header-right {
                    text-align: right;
                    font-size: 12px;
                    color: #64748b;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                    page-break-inside: auto;
                }
                tr { page-break-inside: avoid; page-break-after: auto; }
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }
                @media print {
                    @page { margin: 10mm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-left">
                    <h1>${storeName}</h1>
                    <h2>${title}</h2>
                </div>
                <div class="header-right">
                    <div>Tarih: ${formattedDate}</div>
                    <button class="no-print" onclick="window.print()" style="margin-top: 10px; padding: 8px 16px; background-color: #0ea5e9; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">Belgeyi Yazdır</button>
                </div>
            </div>
            <table>
                <thead>
                    <tr>${thead}</tr>
                </thead>
                <tbody>
                    ${tbody}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob(['\uFEFF', html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    printWindow.location.href = url;

    // A slight delay ensures the browser focuses on the newly loaded content
    setTimeout(() => {
        printWindow.focus();
    }, 100);
}
