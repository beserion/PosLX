import sql from 'mssql';
import { getDb, getCloudDb } from '../config/db.js';

const tablesToSync = [
    'Categories', 'Products', 'Accounts', 'AccountLedger', 'Couriers',
    'Sales', 'SaleItems', 'AccountTransactions', 'Invoices', 'InvoiceItems',
    'CashRegisters', 'CashMovements', 'PurchaseOrders', 'PurchaseOrderItems',
    'SpecialPrices', 'Staff'
];

let isSyncing = false;
let syncInterval = null;

async function performSync() {
    if (isSyncing) return;
    isSyncing = true;

    try {
        const localDb = await getDb();
        const cloudDb = await getCloudDb();

        if (!localDb || !cloudDb) {
            isSyncing = false;
            return; // Cannot sync if cloud is disconnected or not configured
        }

        // 1. Push Local changes to Cloud
        for (const table of tablesToSync) {
            const unsyncedResult = await localDb.request().query(`SELECT * FROM ${table} WHERE SyncStatus = 0`);
            const unsyncedRecords = unsyncedResult.recordset;

            if (unsyncedRecords.length > 0) {
                console.log(`[SyncManager] Pushing ${unsyncedRecords.length} records to Cloud for table: ${table}`);

                for (const record of unsyncedRecords) {
                    try {
                        const globalId = record.GlobalID;
                        if (!globalId) continue;

                        const cloudCheck = await cloudDb.request()
                            .input('GlobalID', sql.UniqueIdentifier, globalId)
                            .query(`SELECT GlobalID FROM ${table} WHERE GlobalID = @GlobalID`);

                        const columns = Object.keys(record).filter(col => col !== 'ID' && col !== 'SyncStatus');

                        if (cloudCheck.recordset.length > 0) {
                            // UPDATE in Cloud
                            const setClause = columns.map(c => `[${c}] = @${c}`).join(', ');
                            const updateReq = cloudDb.request();
                            columns.forEach(c => updateReq.input(c, record[c]));
                            updateReq.input('GlobalID_WHERE', sql.UniqueIdentifier, globalId);

                            await updateReq.query(`UPDATE ${table} SET ${setClause}, SyncStatus = 1 WHERE GlobalID = @GlobalID_WHERE`);
                        } else {
                            // INSERT in Cloud
                            const insertColumns = [...columns, 'SyncStatus'];
                            const colsStr = insertColumns.map(c => `[${c}]`).join(', ');
                            const valsStr = insertColumns.map(c => `@${c}`).join(', ');

                            const insertReq = cloudDb.request();
                            columns.forEach(c => insertReq.input(c, record[c]));
                            insertReq.input('SyncStatus', sql.Int, 1);

                            await insertReq.query(`INSERT INTO ${table} (${colsStr}) VALUES (${valsStr})`);
                        }

                        // Mark as synced locally
                        await localDb.request()
                            .input('GlobalID', sql.UniqueIdentifier, globalId)
                            .query(`UPDATE ${table} SET SyncStatus = 1 WHERE GlobalID = @GlobalID`);

                    } catch (err) {
                        console.error(`[SyncManager] Error pushing record ${record.GlobalID} in ${table}:`, err.message);
                    }
                }
            }
        }

        // 2. Pull Cloud changes to Local
        for (const table of tablesToSync) {
            const maxResult = await localDb.request().query(`SELECT MAX(LastUpdated) as LastSync FROM ${table} WHERE SyncStatus = 1`);
            const lastSync = maxResult.recordset[0].LastSync || new Date('2000-01-01');

            const newCloudResult = await cloudDb.request()
                .input('LastSync', sql.DateTime, lastSync)
                .query(`SELECT * FROM ${table} WHERE LastUpdated > @LastSync`);

            const newRecords = newCloudResult.recordset;
            if (newRecords.length > 0) {
                console.log(`[SyncManager] Pulling ${newRecords.length} updated records from Cloud for table: ${table}`);

                for (const record of newRecords) {
                    try {
                        const globalId = record.GlobalID;
                        if (!globalId) continue;

                        const localCheck = await localDb.request()
                            .input('GlobalID', sql.UniqueIdentifier, globalId)
                            .query(`SELECT GlobalID FROM ${table} WHERE GlobalID = @GlobalID`);

                        const columns = Object.keys(record).filter(col => col !== 'ID' && col !== 'SyncStatus');

                        if (localCheck.recordset.length > 0) {
                            // UPDATE locally
                            const setClause = columns.map(c => `[${c}] = @${c}`).join(', ');
                            const updateReq = localDb.request();
                            columns.forEach(c => updateReq.input(c, record[c]));
                            updateReq.input('GlobalID_WHERE', sql.UniqueIdentifier, globalId);

                            await updateReq.query(`UPDATE ${table} SET ${setClause}, SyncStatus = 1 WHERE GlobalID = @GlobalID_WHERE`);
                        } else {
                            // INSERT locally
                            const insertColumns = [...columns, 'SyncStatus'];
                            const colsStr = insertColumns.map(c => `[${c}]`).join(', ');
                            const valsStr = insertColumns.map(c => `@${c}`).join(', ');

                            const insertReq = localDb.request();
                            columns.forEach(c => insertReq.input(c, record[c]));
                            insertReq.input('SyncStatus', sql.Int, 1);

                            await insertReq.query(`INSERT INTO ${table} (${colsStr}) VALUES (${valsStr})`);
                        }
                    } catch (err) {
                        console.error(`[SyncManager] Error pulling record ${record.GlobalID} in ${table}:`, err.message);
                    }
                }
            }
        }

    } catch (err) {
        console.error('[SyncManager] General Sync Error:', err.message);
    } finally {
        isSyncing = false;
    }
}

export function startSyncManager() {
    if (syncInterval) return;
    console.log('🔄 SyncManager started. Will sync with Cloud every 10 seconds.');
    syncInterval = setInterval(performSync, 10000);
    // Initial sync shortly after boot
    setTimeout(performSync, 5000);
}

export function stopSyncManager() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
        console.log('⏹️ SyncManager stopped.');
    }
}
