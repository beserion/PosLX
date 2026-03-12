const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client/src/pages/AccountDetailPage.jsx');
let code = fs.readFileSync(file, 'utf8');

const oldCode = `    useEffect(() => {
        if (entry.RefType === 'Invoice' && entry.RefID) {
            setLoading(true);
            import('../lib/api').then(({ default: api }) => {
                api.get(\`/invoices/\${entry.RefID}\`)
                    .then(res => setDetails(res.data))
                    .catch(err => toast.error(err.response?.data?.error || 'Detaylar alınamadı'))
                    .finally(() => setLoading(false));
            });
        }
    }, [entry]);`;

const oldCodeRegex = /    useEffect\(\(\) => \{\s+if \(entry.RefType === 'Invoice' && entry.RefID\) \{\s+setLoading\(true\);\s+import\('\.\.\/lib\/api'\)\.then\(\(\{ default: api \}\) => \{\s+api\.get\(`\/invoices\/\$\{entry\.RefID\}`\)\s+\.then\(res => setDetails\(res\.data\)\)\s+\.catch\(err => toast\.error\(err\.response\?\.data\?\.error \|\| 'Detaylar alınamadı'\)\)\s+\.finally\(\(\) => setLoading\(false\)\);\s+\}\);\s+\}\s+\}, \[entry\]\);/g;

const newCode = `    useEffect(() => {
        setLoading(true);
        import('../lib/api').then(({ default: api }) => {
            api.get(\`/accounts/\${accountId}/ledger/\${entry.ID}/details\`)
                .then(res => setDetails(res.data))
                .catch(err => toast.error(err.response?.data?.error || 'Detaylar alınamadı'))
                .finally(() => setLoading(false));
        });
    }, [entry, accountId]);`;

code = code.replace(oldCodeRegex, newCode);

fs.writeFileSync(file, code, 'utf8');
console.log('Fixed AccountDetailPage.jsx');
