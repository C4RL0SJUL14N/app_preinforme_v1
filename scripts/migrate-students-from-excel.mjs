import path from 'node:path';
import XLSX from 'xlsx';
import { SHEET_NAMES } from '../lib/constants.js';
import { getSheetRecords, saveSheetRecords } from '../lib/repository.js';
import { normalizeCell } from '../lib/utils.js';

const DEFAULT_FILE = 'C:/Users/profe/OneDrive/Desktop/Estudiantes.xlsx';

function normalizeKey(value) {
  return normalizeCell(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .trim();
}

function buildSedeAliases(sedeName) {
  const normalized = normalizeKey(sedeName);
  const aliases = new Set([normalized]);
  aliases.add(normalized.replace(/\bY\b/g, '').replace(/\s+/g, ' ').trim());
  aliases.add(normalized.replace(/\s+/g, ''));
  return Array.from(aliases).filter(Boolean);
}

function studentMatchKey(student, grade, sede) {
  return [
    normalizeKey(sede?.name),
    normalizeKey(grade?.name),
    normalizeKey(student.firstName),
    normalizeKey(student.lastName)
  ].join('::');
}

function buildGradeKey(sedeName, gradeName) {
  return `${normalizeKey(sedeName)}::${normalizeKey(gradeName)}`;
}

function readWorkbookRows(filePath) {
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    defval: '',
    raw: false
  });
}

async function main() {
  const filePath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_FILE;
  console.log(`Archivo origen: ${filePath}`);

  const [sedes, grades, students, preReports] = await Promise.all([
    getSheetRecords(SHEET_NAMES.sedes),
    getSheetRecords(SHEET_NAMES.grades),
    getSheetRecords(SHEET_NAMES.students),
    getSheetRecords(SHEET_NAMES.preReports)
  ]);

  const rows = readWorkbookRows(filePath);
  const gradeBySedeAndName = new Map();
  grades.forEach((grade) => {
      const sede = sedes.find((item) => item.id === grade.sedeId);
      buildSedeAliases(sede?.name || '').forEach((sedeAlias) => {
        gradeBySedeAndName.set(`${sedeAlias}::${normalizeKey(grade.name)}`, grade);
      });
    });

  const gradeById = new Map(grades.map((grade) => [grade.id, grade]));
  const sedeById = new Map(sedes.map((sede) => [sede.id, sede]));
  const studentByCompositeKey = new Map(
    students.map((student) => {
      const grade = gradeById.get(student.gradeId);
      const sede = sedeById.get(grade?.sedeId || '');
      return [studentMatchKey(student, grade, sede), student];
    })
  );

  const occupiedIds = new Map(students.map((student) => [normalizeCell(student.id), student]));
  const originalStudents = [...students];
  const nextStudents = [...students];
  const nextPreReports = [...preReports];
  const studentIdChanges = new Map();

  let inserted = 0;
  let updatedIds = 0;
  let unchanged = 0;
  let updatedPreReports = 0;
  const warnings = [];

  for (const row of rows) {
    const sedeName = row.SEDE || row.Sede || row.sede || '';
    const gradeName = row.GRADO || row.Grado || row.grado || '';
    const incomingId = normalizeCell(row.DOC || row.Doc || row.doc || row.ID || row.id);
    const firstName = normalizeCell(row.Nombres || row.nombres || row.NOMBRE || row.nombre);
    const lastName = normalizeCell(row.Apellidos || row.apellidos || row.APELLIDOS || row.apellido);

    if (!sedeName || !gradeName || !incomingId || !firstName || !lastName) {
      warnings.push(`Fila omitida por datos incompletos: ${JSON.stringify(row)}`);
      continue;
    }

    const grade = gradeBySedeAndName.get(buildGradeKey(sedeName, gradeName));
    if (!grade) {
      warnings.push(`No se encontro grado para sede "${sedeName}" y grado "${gradeName}".`);
      continue;
    }

    const sede = sedeById.get(grade.sedeId);
    const matchKey = [normalizeKey(sedeName), normalizeKey(gradeName), normalizeKey(firstName), normalizeKey(lastName)].join('::');
    const existingStudent = studentByCompositeKey.get(matchKey);

    if (existingStudent) {
      const conflictingStudent = occupiedIds.get(incomingId);
      if (conflictingStudent && conflictingStudent !== existingStudent) {
        warnings.push(
          `No se actualizo ID para ${firstName} ${lastName} en ${sedeName} / ${gradeName} porque el ID ${incomingId} ya pertenece a otro estudiante.`
        );
        continue;
      }

      const studentIndex = nextStudents.findIndex((student) => student.id === existingStudent.id);
      if (studentIndex === -1) {
        warnings.push(`No se encontro en memoria el estudiante ${firstName} ${lastName} para actualizar.`);
        continue;
      }

      if (normalizeCell(existingStudent.id) === incomingId) {
        unchanged += 1;
        continue;
      }

      occupiedIds.delete(normalizeCell(existingStudent.id));
      studentIdChanges.set(normalizeCell(existingStudent.id), incomingId);
      nextStudents[studentIndex] = {
        ...nextStudents[studentIndex],
        id: incomingId,
        firstName,
        lastName,
        gradeId: grade.id,
        active: 'TRUE'
      };
      occupiedIds.set(incomingId, nextStudents[studentIndex]);
      studentByCompositeKey.set(studentMatchKey(nextStudents[studentIndex], grade, sede), nextStudents[studentIndex]);
      updatedIds += 1;
      continue;
    }

    const conflictingStudent = occupiedIds.get(incomingId);
    if (conflictingStudent) {
      warnings.push(
        `No se inserto ${firstName} ${lastName} en ${sedeName} / ${gradeName} porque el ID ${incomingId} ya existe en la base.`
      );
      continue;
    }

    const newStudent = {
      id: incomingId,
      firstName,
      lastName,
      gradeId: grade.id,
      active: 'TRUE'
    };
    nextStudents.push(newStudent);
    occupiedIds.set(incomingId, newStudent);
    studentByCompositeKey.set(studentMatchKey(newStudent, grade, sede), newStudent);
    inserted += 1;
  }

  if (studentIdChanges.size > 0) {
    for (let index = 0; index < nextPreReports.length; index += 1) {
      const currentPreReport = nextPreReports[index];
      const nextStudentId = studentIdChanges.get(normalizeCell(currentPreReport.studentId));
      if (!nextStudentId) continue;
      nextPreReports[index] = {
        ...currentPreReport,
        studentId: nextStudentId
      };
      updatedPreReports += 1;
    }
  }

  if (studentIdChanges.size > 0) {
    const temporaryStudents = [...originalStudents];
    for (const [oldId, newId] of studentIdChanges.entries()) {
      const migratedStudent = nextStudents.find((student) => normalizeCell(student.id) === newId);
      if (!migratedStudent) continue;
      const existingTemporary = temporaryStudents.find((student) => normalizeCell(student.id) === newId);
      if (!existingTemporary) {
        temporaryStudents.push({ ...migratedStudent });
      }
    }

    await saveSheetRecords(SHEET_NAMES.students, temporaryStudents);
    await saveSheetRecords(SHEET_NAMES.preReports, nextPreReports);
  }

  await saveSheetRecords(SHEET_NAMES.students, nextStudents);

  console.log(
    JSON.stringify(
      {
        processed: rows.length,
        inserted,
        updatedIds,
        updatedPreReports,
        unchanged,
        totalStudentsAfter: nextStudents.length,
        warnings
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
