import fs from 'fs';

const shareName = '\\\\127.0.0.1\\POS80 Printer';

try {
    console.log("Attempting to write to", shareName);
    fs.writeFileSync(shareName, 'Raw test print\n\n\n\n\x1dV\x00');
    console.log("Success! Wrote raw bytes to printer.");
} catch (e) {
    console.error("Failed writing to printer directly:", e.message);
}
