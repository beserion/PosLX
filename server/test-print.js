import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer';

async function test() {
    try {
        let printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: '\\\\localhost\\POS80 Printer',
            characterSet: CharacterSet.PC857_TURKISH
        });

        printer.println("TEST PRINT SUCCESS");
        printer.cut();
        await printer.execute();
        console.log("Print command executed.");
    } catch (e) {
        console.error("Exception caught:");
        console.error(e);
    }
}
test();
