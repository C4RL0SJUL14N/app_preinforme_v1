import { config, validateConfig } from '../lib/config.js';
import { SHEET_NAMES } from '../lib/constants.js';
import { getSheetRecords } from '../lib/repository.js';

async function main() {
  validateConfig();
  console.log(`Supabase: ${config.supabaseUrl}`);
  for (const sheetName of Object.values(SHEET_NAMES)) {
    const records = await getSheetRecords(sheetName);
    console.log(`OK: ${sheetName} (${records.length})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
