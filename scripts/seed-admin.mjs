import { SHEET_NAMES } from '../lib/constants.js';
import { getSheetRecords, normalizeTeacherRecord, saveSheetRecords } from '../lib/repository.js';
import { hashPassword, normalizeCell } from '../lib/utils.js';
import { config } from '../lib/config.js';

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const entry = process.argv.find((item) => item.startsWith(prefix));
  if (!entry) return fallback;
  return entry.slice(prefix.length).trim();
}

async function main() {
  const id = normalizeCell(getArg('id', 'admin'));
  const firstName = normalizeCell(getArg('firstName', 'Administrador'));
  const lastName = normalizeCell(getArg('lastName', 'Institucion'));
  const password = normalizeCell(getArg('password', 'admin123'));

  if (!id || !password) {
    throw new Error('Debe indicar al menos --id y --password');
  }

  const teachers = await getSheetRecords(SHEET_NAMES.teachers);
  const existing = teachers.find((item) => item.id === id) || {};
  const normalized = normalizeTeacherRecord(
    {
      ...existing,
      id,
      firstName,
      lastName,
      passwordHash: hashPassword(password, config.passwordSalt),
      isAdmin: 'TRUE',
      active: 'TRUE'
    },
    existing
  );

  const nextTeachers = teachers.some((item) => item.id === id)
    ? teachers.map((item) => (item.id === id ? normalized : item))
    : [...teachers, normalized];

  await saveSheetRecords(SHEET_NAMES.teachers, nextTeachers);

  console.log(`Administrador listo: ${id}`);
  console.log(`Nombre: ${firstName} ${lastName}`.trim());
  console.log('Permisos: admin=TRUE, active=TRUE');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
