const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/pages/AccountDetailPage.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add accountId prop to LedgerDetailModal call
content = content.replace(
    /\{selectedLedgerEntry && <LedgerDetailModal entry=\{selectedLedgerEntry\} onClose=\{\(\) => setSelectedLedgerEntry\(null\)\} \/>\}/g,
    '{selectedLedgerEntry && <LedgerDetailModal entry={selectedLedgerEntry} accountId={id} onClose={() => setSelectedLedgerEntry(null)} />}'
);

// 2. Update LedgerDetailModal signature
content = content.replace(
    /function LedgerDetailModal\(\{ entry, onClose \}\) \{/,
    'function LedgerDetailModal({ entry, accountId, onClose }) {'
);

// 3. Update useEffect inside LedgerDetailModal
const newEffect = `    useEffect(() => {
        setLoading(true);
        import('../lib/api').then(({ default: api }) => {
            api.get(\`/accounts/\${accountId}/ledger/\${entry.ID}/details\`)
                .then(res => setDetails(res.data))
                .catch(err => toast.error(err.response?.data?.error || 'Detaylar alınamadı'))
                .finally(() => setLoading(false));
        });
    }, [entry, accountId]);`;

content = content.replace(/    useEffect\(\(\) => \{\n        if \(entry\.RefType === 'Invoice' && entry\.RefID\) \{\n            setLoading\(true\);\n            import\('\.\.\/lib\/api'\)\.then\(\(\{ default: api \}\) => \{\n                api\.get\(`\/invoices\/\$\{entry\.RefID\}`\)\n                    \.then\(res => setDetails\(res\.data\)\)\n                    \.catch\(err => toast\.error\(err\.response\?\.data\?\.error \|\| 'Detaylar alınamadı'\)\)\n                    \.finally\(\(\) => setLoading\(false\)\);\n            \}\);\n        \}\n    \}, \[entry\]\);/, newEffect);

// 4. Update the "Tür" display
content = content.replace(
    /<div className="text-sm text-text-primary">\{entry\.RefType \|\| 'Manuel İşlem'\}<\/div>/,
    `<div className="text-sm text-text-primary">
                                {details && details.isMatched ? 'Eşleşen Fatura İşlemi' : (entry.RefType || 'Manuel İşlem')}
                            </div>`
);

// 5. Update the Invoice rendering condition
content = content.replace(
    /\{entry\.RefType === 'Invoice' && \(/,
    `{(loading || (details && !details.noDetails && details.items)) && (`
);

// 6. Update the "Sipariş / Fatura Kalemleri" title to include the "Tahmini Eşleşme" tag
content = content.replace(
    /<h3 className="text-sm font-bold text-text-primary flex items-center gap-2">\s*Sipariş \/ Fatura Kalemleri\s*<\/h3>/,
    `<h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                Sipariş / Fatura Kalemleri {details && details.isMatched && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-md ml-2 border border-yellow-500/30">Tahmini Eşleşme</span>}
                            </h3>`
);

fs.writeFileSync(filePath, content);
console.log('Update successful');
