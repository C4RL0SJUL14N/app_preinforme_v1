import { SHEET_NAMES } from '../lib/constants.js';
import { getDomainData, getSheetRecords, inflatePreReport } from '../lib/repository.js';
import { supabaseRequest } from '../lib/supabase.js';

function isEmptyPreReport(record) {
  const noMarks = !(record.convivencia || []).length && !(record.academica || []).length;
  const noObs = !String(record.observations || '').trim() && !String(record.directorObservations || '').trim();
  return record.status !== 'deleted' && noMarks && noObs;
}

async function main() {
  const [rawRecords, data] = await Promise.all([getSheetRecords(SHEET_NAMES.preReports), getDomainData()]);
  const grades = Object.fromEntries(data.grades.map((grade) => [grade.id, grade.name]));
  const subjects = Object.fromEntries(data.subjects.map((subject) => [subject.id, subject.name]));
  const teachers = Object.fromEntries(data.teachers.map((teacher) => [teacher.id, `${teacher.firstName} ${teacher.lastName}`.trim()]));

  const emptyRows = rawRecords
    .filter((rawRecord) => rawRecord.status !== 'deleted')
    .map((rawRecord) => ({ rawRecord, record: inflatePreReport(rawRecord) }))
    .filter(({ record }) => isEmptyPreReport(record));

  const now = new Date().toISOString();
  const payload = emptyRows.map(({ rawRecord }) => ({
    id: rawRecord.id,
    period_id: rawRecord.periodId,
    grade_id: rawRecord.gradeId,
    subject_id: rawRecord.subjectId,
    teacher_id: rawRecord.teacherId,
    student_id: rawRecord.studentId,
    convivencia: rawRecord.convivencia || [],
    academica: rawRecord.academica || [],
    observations: rawRecord.observations || '',
    director_observations: rawRecord.directorObservations || '',
    status: 'deleted',
    created_at: rawRecord.createdAt || now,
    updated_at: now,
    deleted_at: now
  }));

  const chunkSize = 200;
  for (let index = 0; index < payload.length; index += chunkSize) {
    const chunk = payload.slice(index, index + chunkSize);
    await supabaseRequest('pre_reports', {
      method: 'POST',
      query: {
        on_conflict: 'id'
      },
      body: chunk,
      prefer: 'resolution=merge-duplicates'
    });
  }

  const grouped = Object.values(
    emptyRows.reduce((accumulator, { rawRecord }) => {
      const key = `${rawRecord.gradeId}::${rawRecord.subjectId}::${rawRecord.teacherId}`;
      accumulator[key] ||= {
        gradeId: rawRecord.gradeId,
        gradeName: grades[rawRecord.gradeId] || rawRecord.gradeId,
        subjectId: rawRecord.subjectId,
        subjectName: subjects[rawRecord.subjectId] || rawRecord.subjectId,
        teacherId: rawRecord.teacherId,
        teacherName: teachers[rawRecord.teacherId] || rawRecord.teacherId,
        total: 0
      };
      accumulator[key].total += 1;
      return accumulator;
    }, {})
  ).sort((a, b) => b.total - a.total || a.gradeName.localeCompare(b.gradeName));

  console.log(
    JSON.stringify(
      {
        deleted: payload.length,
        groups: grouped
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
