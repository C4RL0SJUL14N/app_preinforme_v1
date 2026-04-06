import { ACADEMICA_QUESTIONS, CONVIVENCIA_QUESTIONS, SHEET_NAMES } from '../lib/constants.js';
import { getSheetRecords, inflatePreReport } from '../lib/repository.js';
import { supabaseRequest } from '../lib/supabase.js';
import { normalizeComparableText } from '../lib/utils.js';

function buildCanonicalMap(questions) {
  return new Map(questions.map((question) => [normalizeComparableText(question), question]));
}

function normalizeQuestionList(values, canonicalMap) {
  const normalizedValues = [];
  let changed = false;

  for (const value of Array.isArray(values) ? values : []) {
    const raw = String(value || '').trim();
    if (!raw) continue;
    const canonical = canonicalMap.get(normalizeComparableText(raw)) || raw;
    if (canonical !== raw) changed = true;
    if (!normalizedValues.includes(canonical)) {
      normalizedValues.push(canonical);
    }
  }

  if (normalizedValues.length !== (Array.isArray(values) ? values.filter(Boolean).length : 0)) {
    changed = true;
  }

  return { values: normalizedValues, changed };
}

async function main() {
  const convivenciaMap = buildCanonicalMap(CONVIVENCIA_QUESTIONS);
  const academicaMap = buildCanonicalMap(ACADEMICA_QUESTIONS);
  const records = await getSheetRecords(SHEET_NAMES.preReports);
  const rowsToUpdate = [];

  let scanned = 0;

  for (const rawRecord of records) {
    if (rawRecord.status === 'deleted') continue;
    scanned += 1;

    const record = inflatePreReport(rawRecord);
    const normalizedConvivencia = normalizeQuestionList(record.convivencia, convivenciaMap);
    const normalizedAcademica = normalizeQuestionList(record.academica, academicaMap);

    if (!normalizedConvivencia.changed && !normalizedAcademica.changed) {
      continue;
    }

    rowsToUpdate.push({
      id: rawRecord.id,
      period_id: rawRecord.periodId,
      grade_id: rawRecord.gradeId,
      subject_id: rawRecord.subjectId,
      teacher_id: rawRecord.teacherId,
      student_id: rawRecord.studentId,
      convivencia: normalizedConvivencia.values,
      academica: normalizedAcademica.values,
      observations: rawRecord.observations || '',
      director_observations: rawRecord.directorObservations || '',
      status: rawRecord.status || 'active',
      created_at: rawRecord.createdAt || '',
      updated_at: rawRecord.updatedAt || '',
      deleted_at: rawRecord.deletedAt || null
    });
  }

  const chunkSize = 200;
  for (let index = 0; index < rowsToUpdate.length; index += chunkSize) {
    const chunk = rowsToUpdate.slice(index, index + chunkSize);
    await supabaseRequest('pre_reports', {
      method: 'POST',
      query: {
        on_conflict: 'id'
      },
      body: chunk,
      prefer: 'resolution=merge-duplicates'
    });
  }

  console.log(
    JSON.stringify(
      {
        scanned,
        updated: rowsToUpdate.length
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
