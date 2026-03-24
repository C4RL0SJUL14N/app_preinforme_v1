import { config } from './config.js';
import { ACADEMICA_QUESTIONS, CONVIVENCIA_QUESTIONS, SHEET_NAMES } from './constants.js';
import { authenticateUser, createSession } from './auth.js';
import { buildPreReportsPdf } from './pdf.js';
import { createZip } from './zip.js';
import {
  deletePreReportsByPeriod,
  deleteRecord,
  getDomainData,
  getSheetRecords,
  inflatePreReport,
  normalizeGradeRecord,
  normalizeGradeSubjectRecord,
  normalizeInstitutionRecord,
  normalizePeriodRecord,
  normalizePreReportRecord,
  normalizeSedeRecord,
  normalizeSimpleRecord,
  normalizeStudentRecord,
  normalizeTeacherRecord,
  saveSheetRecords,
  upsertRecord
} from './repository.js';
import { dedupeBy, hashPassword, normalizeCell } from './utils.js';

function formatSubjectName(subject) {
  if (!subject) return '';
  return subject.shortName ? `${subject.name} (${subject.shortName})` : subject.name;
}

function buildDetailedReportRows(data, filters = {}) {
  return data.preReports
    .filter((report) => {
      if (report.status === 'deleted') return false;
      if (filters.periodId && report.periodId !== filters.periodId) return false;
      if (filters.gradeId && report.gradeId !== filters.gradeId) return false;
      if (filters.teacherId && report.teacherId !== filters.teacherId) return false;
      return true;
    })
    .map((report) => {
      const student = data.students.find((item) => item.id === report.studentId);
      const grade = data.grades.find((item) => item.id === report.gradeId);
      const sede = data.sedes.find((item) => item.id === grade?.sedeId);
      const subject = data.subjects.find((item) => item.id === report.subjectId);
      const teacher = data.teachers.find((item) => item.id === report.teacherId);
      const period = data.periods.find((item) => item.id === report.periodId);
      return {
        preReportId: report.id,
        periodId: report.periodId,
        periodName: period?.name || '',
        sedeId: sede?.id || '',
        sedeName: sede?.name || '',
        gradeId: report.gradeId,
        gradeName: grade?.name || '',
        subjectId: report.subjectId,
        subjectName: formatSubjectName(subject),
        teacherId: report.teacherId,
        teacherName: `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim(),
        studentId: report.studentId,
        studentName: `${student?.firstName || ''} ${student?.lastName || ''}`.trim(),
        convivenciaCount: String((report.convivencia || []).length),
        academicaCount: String((report.academica || []).length),
        observations: report.observations,
        updatedAt: report.updatedAt
      };
    });
}

function ensureUniqueActiveAssignment(records, payload, existing = {}) {
  const nextGradeId = normalizeCell(payload.gradeId || existing.gradeId);
  const nextSubjectId = normalizeCell(payload.subjectId || existing.subjectId);
  const nextId = normalizeCell(payload.id || existing.id);
  const nextActive = normalizeCell(payload.active ?? existing.active ?? 'TRUE') !== 'FALSE';

  if (!nextGradeId || !nextSubjectId || !nextActive) {
    return;
  }

  const alreadyExists = records.some(
    (item) =>
      item.id !== nextId &&
      item.active !== 'FALSE' &&
      normalizeCell(item.gradeId) === nextGradeId &&
      normalizeCell(item.subjectId) === nextSubjectId
  );

  if (alreadyExists) {
    const error = new Error('Ya existe una asignacion activa para este grado y asignatura');
    error.statusCode = 409;
    throw error;
  }
}

function isTraditionalEducationModel(value) {
  return normalizeCell(value || 'EDUCACION_TRADICIONAL') !== 'ESCUELA_NUEVA';
}

function groupBy(items, getKey, buildBase) {
  const map = new Map();
  for (const item of items) {
    const key = getKey(item);
    const current = map.get(key) || { ...buildBase(item), total: 0 };
    current.total += 1;
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => a.total - b.total).reverse();
}

function mapTeacherView(data, session) {
  const assignments = session.isAdmin
    ? data.gradeSubjects
    : data.gradeSubjects.filter((item) => item.teacherId === session.userId);
  const gradeIds = new Set(assignments.map((item) => item.gradeId));
  const subjectIds = new Set(assignments.map((item) => item.subjectId));
  const directedGrades = session.isAdmin
    ? data.grades
    : data.grades.filter((item) => item.directorTeacherId === session.userId);
  directedGrades.forEach((item) => gradeIds.add(item.id));

  return {
    profile: session,
    institutions: data.institutions,
    sedes: data.sedes,
    grades: session.isAdmin ? data.grades : data.grades.filter((item) => gradeIds.has(item.id)),
    directedGrades,
    subjects: session.isAdmin ? data.subjects : data.subjects.filter((item) => subjectIds.has(item.id)),
    gradeSubjects: assignments,
    students: session.isAdmin ? data.students : data.students.filter((item) => gradeIds.has(item.gradeId)),
    periods: data.periods,
    preReports: session.isAdmin ? data.preReports : data.preReports.filter((item) => item.teacherId === session.userId),
    questions: {
      convivencia: CONVIVENCIA_QUESTIONS,
      academica: ACADEMICA_QUESTIONS
    }
  };
}

function getVisibleGradesForSession(data, session) {
  if (session.isAdmin) {
    return data.grades;
  }
  const directedGradeIds = new Set(
    data.grades.filter((item) => item.directorTeacherId === session.userId).map((item) => item.id)
  );
  return data.grades.filter((item) => directedGradeIds.has(item.id));
}

function buildReportScope(data, session, filters = {}) {
  const visibleGrades = getVisibleGradesForSession(data, session);
  const scopedGrades = filters.gradeId ? visibleGrades.filter((item) => item.id === filters.gradeId) : visibleGrades;
  const visibleGradeIds = new Set(scopedGrades.map((item) => item.id));

  if (!session.isAdmin && visibleGradeIds.size === 0) {
    const error = new Error('Solo el administrador o el director de grupo pueden acceder a estos reportes');
    error.statusCode = 403;
    throw error;
  }

  const detailRows = buildDetailedReportRows(data, filters).filter((row) => {
    if (session.isAdmin) {
      return !filters.gradeId || row.gradeId === filters.gradeId;
    }
    return visibleGradeIds.has(row.gradeId);
  });

  const visibleStudents = data.students.filter((item) => {
    if (filters.gradeId) return item.gradeId === filters.gradeId;
    if (session.isAdmin) return true;
    return visibleGradeIds.has(item.gradeId);
  });

  const reportedByStudent = detailRows.reduce((accumulator, row) => {
    accumulator.set(row.studentId, (accumulator.get(row.studentId) || 0) + 1);
    return accumulator;
  }, new Map());

  const studentsReported = visibleStudents
    .filter((student) => reportedByStudent.has(student.id))
    .map((student) => ({
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      gradeId: student.gradeId,
      gradeName: data.grades.find((item) => item.id === student.gradeId)?.name || '',
      totalReports: reportedByStudent.get(student.id) || 0
    }))
    .sort((a, b) => a.gradeName.localeCompare(b.gradeName) || a.studentName.localeCompare(b.studentName));

  const studentsPending = visibleStudents
    .filter((student) => !reportedByStudent.has(student.id))
    .map((student) => ({
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      gradeId: student.gradeId,
      gradeName: data.grades.find((item) => item.id === student.gradeId)?.name || ''
    }))
    .sort((a, b) => a.gradeName.localeCompare(b.gradeName) || a.studentName.localeCompare(b.studentName));

  const teachersWithoutReports = session.isAdmin
    ? Array.from(
        data.gradeSubjects
          .filter((assignment) => {
            if (assignment.active === 'FALSE') return false;
            if (filters.gradeId && assignment.gradeId !== filters.gradeId) return false;
            if (filters.teacherId && assignment.teacherId !== filters.teacherId) return false;
            return true;
          })
          .reduce((accumulator, assignment) => {
            const hasReports = data.preReports.some(
              (report) =>
                report.status !== 'deleted' &&
                report.gradeId === assignment.gradeId &&
                report.subjectId === assignment.subjectId &&
                report.teacherId === assignment.teacherId &&
                (!filters.periodId || report.periodId === filters.periodId)
            );

            if (hasReports) return accumulator;

            const teacher = data.teachers.find((item) => item.id === assignment.teacherId);
            const grade = data.grades.find((item) => item.id === assignment.gradeId);
            const subject = data.subjects.find((item) => item.id === assignment.subjectId);
            const current =
              accumulator.get(assignment.teacherId) || {
                teacherId: assignment.teacherId,
                teacherName: `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim(),
                grades: new Set(),
                subjects: new Set(),
                missingAssignments: 0
              };

            current.grades.add(grade?.name || assignment.gradeId);
            current.subjects.add(formatSubjectName(subject) || assignment.subjectId);
            current.missingAssignments += 1;
            accumulator.set(assignment.teacherId, current);
            return accumulator;
          }, new Map()).values()
      )
        .map((item) => ({
          teacherId: item.teacherId,
          teacherName: item.teacherName,
          gradeNames: Array.from(item.grades).sort(),
          subjectNames: Array.from(item.subjects).sort(),
          missingAssignments: item.missingAssignments
        }))
        .sort((a, b) => b.missingAssignments - a.missingAssignments || a.teacherName.localeCompare(b.teacherName))
    : [];

  return {
    detailRows,
    studentsReported,
    studentsPending,
    teachersWithoutReports
  };
}

function buildPdfReportItems(data, session, filters = {}) {
  const visibleGradeIds = new Set(getVisibleGradesForSession(data, session).map((item) => item.id));
  const visibleReports = data.preReports.filter((report) => {
    if (report.status === 'deleted') return false;
    if (filters.periodId && report.periodId !== filters.periodId) return false;
    if (filters.gradeId && report.gradeId !== filters.gradeId) return false;
    if (filters.teacherId && report.teacherId !== filters.teacherId) return false;
    if (filters.studentId && report.studentId !== filters.studentId) return false;
    if (!session.isAdmin && !visibleGradeIds.has(report.gradeId)) return false;
    return true;
  });

  const grouped = new Map();
  for (const report of visibleReports) {
    const key = `${report.periodId}::${report.gradeId}::${report.studentId}`;
    const current = grouped.get(key) || [];
    current.push(report);
    grouped.set(key, current);
  }

  const today = new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  return Array.from(grouped.values()).map((reports) => {
    const first = reports[0];
    const student = data.students.find((item) => item.id === first.studentId);
    const grade = data.grades.find((item) => item.id === first.gradeId);
    const sede = data.sedes.find((item) => item.id === grade?.sedeId);
    const period = data.periods.find((item) => item.id === first.periodId);
    const director = data.teachers.find((item) => item.id === grade?.directorTeacherId);
    const assignments = dedupeBy(
      data.gradeSubjects
        .filter((item) => item.gradeId === first.gradeId && item.active !== 'FALSE')
        .map((item) => ({
          ...item,
          shortName: data.subjects.find((subject) => subject.id === item.subjectId)?.shortName || '',
          subjectName: formatSubjectName(data.subjects.find((subject) => subject.id === item.subjectId)) || item.subjectId,
          teacherName: `${data.teachers.find((teacher) => teacher.id === item.teacherId)?.firstName || ''} ${
            data.teachers.find((teacher) => teacher.id === item.teacherId)?.lastName || ''
          }`.trim()
        })),
      (item) => item.subjectId
    );
    const subjects = assignments.length
      ? assignments
      : dedupeBy(
          reports.map((report) => ({
            subjectId: report.subjectId,
            shortName: data.subjects.find((subject) => subject.id === report.subjectId)?.shortName || '',
            subjectName: formatSubjectName(data.subjects.find((subject) => subject.id === report.subjectId)) || report.subjectId,
            teacherName: `${data.teachers.find((teacher) => teacher.id === report.teacherId)?.firstName || ''} ${
              data.teachers.find((teacher) => teacher.id === report.teacherId)?.lastName || ''
            }`.trim()
          })),
          (item) => item.subjectId
        );
    const reportBySubject = new Map(reports.map((report) => [report.subjectId, report]));
    const rows = [
      { type: 'section', label: 'Dificultades en convivencia' },
      ...CONVIVENCIA_QUESTIONS.map((question) => ({
        type: 'question',
        label: question,
        marks: subjects.map((subject) => Boolean(reportBySubject.get(subject.subjectId)?.convivencia?.includes(question)))
      })),
      { type: 'section', label: 'Dificultades academicas' },
      ...ACADEMICA_QUESTIONS.map((question) => ({
        type: 'question',
        label: question,
        marks: subjects.map((subject) => Boolean(reportBySubject.get(subject.subjectId)?.academica?.includes(question)))
      }))
    ];
    const observationEntries = subjects
      .map((subject) => {
        const report = reportBySubject.get(subject.subjectId);
        const observations = String(report?.observations || '').trim();
        if (!observations) return null;
        return {
          subjectName: subject.subjectName || '',
          teacherName: subject.teacherName || '',
          observations
        };
      })
      .filter(Boolean);

    return {
      institutionName: data.institutions[0]?.name || '',
      sede: sede?.name || '',
      dateLabel: today,
      directorName: `${director?.firstName || ''} ${director?.lastName || ''}`.trim(),
      gradeName: grade?.name || '',
      periodName: period?.name || '',
      studentName: `${student?.firstName || ''} ${student?.lastName || ''}`.trim(),
      subjects,
      rows,
      observationEntries
    };
  });
}

function sanitizeFileNamePart(value) {
  return normalizeCell(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

async function deactivateSedeCascade(sedeId) {
  const [teachers, grades, students, gradeSubjects, preReports] = await Promise.all([
    getSheetRecords(SHEET_NAMES.teachers),
    getSheetRecords(SHEET_NAMES.grades),
    getSheetRecords(SHEET_NAMES.students),
    getSheetRecords(SHEET_NAMES.gradeSubjects),
    getSheetRecords(SHEET_NAMES.preReports)
  ]);

  const gradeIds = new Set(grades.filter((item) => item.sedeId === sedeId).map((item) => item.id));
  const teacherIds = new Set(teachers.filter((item) => item.sedeId === sedeId).map((item) => item.id));

  await saveSheetRecords(
    SHEET_NAMES.teachers,
    teachers.map((item) => (item.sedeId === sedeId ? { ...item, active: 'FALSE' } : item))
  );
  await saveSheetRecords(
    SHEET_NAMES.grades,
    grades.map((item) => (item.sedeId === sedeId ? { ...item, active: 'FALSE' } : item))
  );
  await saveSheetRecords(
    SHEET_NAMES.students,
    students.map((item) => (gradeIds.has(item.gradeId) ? { ...item, active: 'FALSE' } : item))
  );
  await saveSheetRecords(
    SHEET_NAMES.gradeSubjects,
    gradeSubjects.map((item) =>
      gradeIds.has(item.gradeId) || teacherIds.has(item.teacherId) ? { ...item, active: 'FALSE' } : item
    )
  );
  await saveSheetRecords(
    SHEET_NAMES.preReports,
    preReports.map((item) =>
      gradeIds.has(item.gradeId) || teacherIds.has(item.teacherId)
        ? normalizePreReportRecord({ ...item, status: 'deleted' }, item)
        : item
    )
  );
}

export async function loginService(login, password) {
  const teachers = await getSheetRecords(SHEET_NAMES.teachers);
  const teacher = authenticateUser(teachers, login, password);
  if (!teacher) {
    const error = new Error('Credenciales invalidas');
    error.statusCode = 401;
    throw error;
  }
  return {
    token: createSession(teacher),
    session: {
      userId: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      isAdmin: teacher.isAdmin === 'TRUE'
    }
  };
}

export async function getBootstrapData(session) {
  const data = await getDomainData();
  const visibleGrades = getVisibleGradesForSession(data, session);
  const adminRecords = session.isAdmin
    ? await Promise.all([
        getSheetRecords(SHEET_NAMES.institutions),
        getSheetRecords(SHEET_NAMES.sedes),
        getSheetRecords(SHEET_NAMES.teachers),
        getSheetRecords(SHEET_NAMES.subjects),
        getSheetRecords(SHEET_NAMES.grades),
        getSheetRecords(SHEET_NAMES.gradeSubjects),
        getSheetRecords(SHEET_NAMES.students),
        getSheetRecords(SHEET_NAMES.periods),
        getSheetRecords(SHEET_NAMES.preReports)
      ])
    : null;
  return {
    session: {
      ...session,
      isAdmin: Boolean(session.isAdmin),
      isDirector: visibleGrades.length > 0
    },
    teacherView: mapTeacherView(data, session),
    adminView: session.isAdmin
      ? {
          institutions: adminRecords[0],
          sedes: adminRecords[1],
          teachers: adminRecords[2],
          subjects: adminRecords[3],
          grades: adminRecords[4],
          gradeSubjects: adminRecords[5],
          students: adminRecords[6],
          periods: adminRecords[7],
          preReports: adminRecords[8].filter((item) => item.status !== 'deleted').map(inflatePreReport)
        }
      : null
  };
}

export async function saveEntityService(entityName, payload) {
  const records = await getSheetRecords(entityName);
  const firstRecord = records[0] || {};
  const recordId = normalizeCell(payload.id);
  const existing =
    entityName === SHEET_NAMES.institutions && !recordId && records.length === 1
      ? firstRecord
      : recordId
        ? records.find((item) => item.id === recordId) || {}
        : {};
  let normalized;

  switch (entityName) {
    case SHEET_NAMES.institutions:
      if (records.length > 0 && recordId && !records.some((item) => item.id === recordId)) {
        const error = new Error('Solo se permite configurar la institucion existente');
        error.statusCode = 409;
        throw error;
      }
      if (records.length > 1) {
        const error = new Error('La configuracion actual solo admite una institucion');
        error.statusCode = 409;
        throw error;
      }
      normalized = normalizeInstitutionRecord({ ...payload, id: existing.id || payload.id }, existing);
      break;
    case SHEET_NAMES.sedes:
      normalized = normalizeSedeRecord(payload, existing);
      break;
    case SHEET_NAMES.teachers:
      normalized = normalizeTeacherRecord(
        {
          ...payload,
          passwordHash: payload.password ? hashPassword(payload.password, config.passwordSalt) : existing.passwordHash
        },
        existing
      );
      break;
    case SHEET_NAMES.subjects:
      normalized = normalizeSimpleRecord(payload, existing, 'subject');
      break;
    case SHEET_NAMES.grades:
      if (
        normalizeCell(payload.directorTeacherId) &&
        isTraditionalEducationModel(payload.educationModel || existing.educationModel) &&
        records.some(
          (item) =>
            item.id !== normalizeCell(payload.id || existing.id) &&
            normalizeCell(item.directorTeacherId) === normalizeCell(payload.directorTeacherId) &&
            item.active !== 'FALSE'
        )
      ) {
        const error = new Error('Este docente ya es director de grupo de otro grado');
        error.statusCode = 409;
        throw error;
      }
      normalized = normalizeGradeRecord(payload, existing);
      break;
    case SHEET_NAMES.gradeSubjects:
      ensureUniqueActiveAssignment(records, payload, existing);
      normalized = normalizeGradeSubjectRecord(payload, existing);
      break;
    case SHEET_NAMES.students:
      normalized = normalizeStudentRecord(payload, existing);
      break;
    case SHEET_NAMES.periods:
      normalized = normalizePeriodRecord(payload, existing);
      break;
    default:
      throw new Error(`Entidad no soportada: ${entityName}`);
  }

  const saved = await upsertRecord(entityName, normalized.id, normalized);

  if (
    entityName === SHEET_NAMES.sedes &&
    existing.id &&
    existing.active !== 'FALSE' &&
    normalized.active === 'FALSE'
  ) {
    await deactivateSedeCascade(existing.id);
  }

  return saved;
}

export async function deleteEntityService(entityName, recordId) {
  const records = await getSheetRecords(entityName);
  const existing = records.find((item) => item.id === recordId);
  if (!existing) {
    const error = new Error('Registro no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const [data, allSedes, allTeachers, allGrades] = await Promise.all([
    getDomainData(),
    entityName === SHEET_NAMES.sedes || entityName === SHEET_NAMES.institutions ? getSheetRecords(SHEET_NAMES.sedes) : [],
    entityName === SHEET_NAMES.sedes ? getSheetRecords(SHEET_NAMES.teachers) : [],
    entityName === SHEET_NAMES.sedes ? getSheetRecords(SHEET_NAMES.grades) : []
  ]);
  const blockers = [];

  if (entityName === SHEET_NAMES.institutions) {
    const error = new Error('La institucion no puede eliminarse desde la aplicacion');
    error.statusCode = 409;
    throw error;
  }

  if (entityName === SHEET_NAMES.sedes) {
    if (allSedes.filter((item) => item.id !== recordId).length === 0) blockers.push('debe existir al menos una sede');
    if (allTeachers.some((item) => item.sedeId === recordId)) blockers.push('tiene docentes asociados');
    if (allGrades.some((item) => item.sedeId === recordId)) blockers.push('tiene grados asociados');
  }

  if (entityName === SHEET_NAMES.teachers) {
    if (data.grades.some((item) => item.directorTeacherId === recordId)) blockers.push('es director de grupo en uno o mas grados');
    if (data.gradeSubjects.some((item) => item.teacherId === recordId)) blockers.push('tiene asignaciones academicas activas');
    if (data.preReports.some((item) => item.teacherId === recordId)) blockers.push('tiene preinformes registrados');
  }

  if (entityName === SHEET_NAMES.subjects) {
    if (data.gradeSubjects.some((item) => item.subjectId === recordId)) blockers.push('esta asociada a una o mas asignaciones');
    if (data.preReports.some((item) => item.subjectId === recordId)) blockers.push('tiene preinformes asociados');
  }

  if (entityName === SHEET_NAMES.grades) {
    if (data.students.some((item) => item.gradeId === recordId)) blockers.push('tiene estudiantes asociados');
    if (data.gradeSubjects.some((item) => item.gradeId === recordId)) blockers.push('tiene asignaciones academicas');
    if (data.preReports.some((item) => item.gradeId === recordId)) blockers.push('tiene preinformes asociados');
  }

  if (entityName === SHEET_NAMES.students) {
    if (data.preReports.some((item) => item.studentId === recordId)) blockers.push('tiene preinformes asociados');
  }

  if (entityName === SHEET_NAMES.periods) {
    if (data.preReports.some((item) => item.periodId === recordId)) blockers.push('tiene preinformes asociados');
  }

  if (entityName === SHEET_NAMES.gradeSubjects) {
    const assignment = data.gradeSubjects.find((item) => item.id === recordId);
    if (
      assignment &&
      data.preReports.some(
        (item) =>
          item.gradeId === assignment.gradeId &&
          item.subjectId === assignment.subjectId &&
          item.teacherId === assignment.teacherId
      )
    ) {
      blockers.push('tiene preinformes asociados a esta asignacion');
    }
  }

  if (blockers.length) {
    const error = new Error(`No se puede eliminar el registro porque ${blockers.join(', ')}`);
    error.statusCode = 409;
    throw error;
  }

  return deleteRecord(entityName, recordId);
}

export async function deletePreReportsByPeriodService(session, periodId) {
  if (!session.isAdmin) {
    const error = new Error('Se requieren permisos de administrador');
    error.statusCode = 403;
    throw error;
  }

  const normalizedPeriodId = normalizeCell(periodId);
  if (!normalizedPeriodId) {
    const error = new Error('Debe seleccionar un periodo');
    error.statusCode = 400;
    throw error;
  }

  const periods = await getSheetRecords(SHEET_NAMES.periods);
  const period = periods.find((item) => item.id === normalizedPeriodId);
  if (!period) {
    const error = new Error('Periodo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const preReports = await getSheetRecords(SHEET_NAMES.preReports);
  const total = preReports.filter((item) => item.periodId === normalizedPeriodId).length;
  await deletePreReportsByPeriod(normalizedPeriodId);
  return {
    periodId: normalizedPeriodId,
    periodName: period.name,
    deleted: total
  };
}

export async function deleteAssignmentsByGradeService(session, gradeId) {
  if (!session.isAdmin) {
    const error = new Error('Se requieren permisos de administrador');
    error.statusCode = 403;
    throw error;
  }

  const normalizedGradeId = normalizeCell(gradeId);
  if (!normalizedGradeId) {
    const error = new Error('Debe seleccionar un grado');
    error.statusCode = 400;
    throw error;
  }

  const [grades, assignments, preReports] = await Promise.all([
    getSheetRecords(SHEET_NAMES.grades),
    getSheetRecords(SHEET_NAMES.gradeSubjects),
    getSheetRecords(SHEET_NAMES.preReports)
  ]);
  const grade = grades.find((item) => item.id === normalizedGradeId);
  if (!grade) {
    const error = new Error('Grado no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const gradeAssignments = assignments.filter((item) => item.gradeId === normalizedGradeId);
  if (!gradeAssignments.length) {
    return {
      gradeId: normalizedGradeId,
      gradeName: grade.name,
      deleted: 0
    };
  }

  const blockedAssignments = gradeAssignments.filter((assignment) =>
    preReports.some(
      (report) =>
        report.status !== 'deleted' &&
        report.gradeId === assignment.gradeId &&
        report.subjectId === assignment.subjectId &&
        report.teacherId === assignment.teacherId
    )
  );

  if (blockedAssignments.length) {
    const error = new Error('No se pueden eliminar las asignaciones de este grado porque algunas ya tienen preinformes asociados');
    error.statusCode = 409;
    throw error;
  }

  const nextAssignments = assignments.filter((item) => item.gradeId !== normalizedGradeId);
  await saveSheetRecords(SHEET_NAMES.gradeSubjects, nextAssignments);
  return {
    gradeId: normalizedGradeId,
    gradeName: grade.name,
    deleted: gradeAssignments.length
  };
}

export async function copyAssignmentsBetweenGradesService(session, sourceGradeId, targetGradeId, teacherOverrides = {}) {
  if (!session.isAdmin) {
    const error = new Error('Se requieren permisos de administrador');
    error.statusCode = 403;
    throw error;
  }

  const sourceId = normalizeCell(sourceGradeId);
  const targetId = normalizeCell(targetGradeId);
  if (!sourceId || !targetId) {
    const error = new Error('Debes seleccionar el grado origen y el grado destino');
    error.statusCode = 400;
    throw error;
  }
  if (sourceId === targetId) {
    const error = new Error('El grado origen y el grado destino deben ser diferentes');
    error.statusCode = 409;
    throw error;
  }

  const [grades, assignments, teachers] = await Promise.all([
    getSheetRecords(SHEET_NAMES.grades),
    getSheetRecords(SHEET_NAMES.gradeSubjects),
    getSheetRecords(SHEET_NAMES.teachers)
  ]);
  const sourceGrade = grades.find((item) => item.id === sourceId);
  const targetGrade = grades.find((item) => item.id === targetId);
  if (!sourceGrade || !targetGrade) {
    const error = new Error('No se encontraron los grados seleccionados');
    error.statusCode = 404;
    throw error;
  }

  const sourceAssignments = assignments.filter((item) => item.gradeId === sourceId && item.active !== 'FALSE');
  if (!sourceAssignments.length) {
    const error = new Error('El grado origen no tiene asignaciones activas para copiar');
    error.statusCode = 409;
    throw error;
  }

  const targetPairs = new Set(
    assignments
      .filter((item) => item.gradeId === targetId && item.active !== 'FALSE')
      .map((item) => `${item.gradeId}::${item.subjectId}`)
  );

  const rowsToCopy = sourceAssignments.filter((item) => !targetPairs.has(`${targetId}::${item.subjectId}`));
  if (!rowsToCopy.length) {
    return {
      sourceGradeId: sourceId,
      sourceGradeName: sourceGrade.name,
      targetGradeId: targetId,
      targetGradeName: targetGrade.name,
      copied: 0,
      skipped: sourceAssignments.length
    };
  }

  const teacherById = new Map(teachers.map((item) => [item.id, item]));
  const normalizedOverrides = Object.fromEntries(
    Object.entries(teacherOverrides || {}).map(([key, value]) => [normalizeCell(key), normalizeCell(value)])
  );
  const conflictingAssignments = rowsToCopy.filter((item) => teacherById.get(item.teacherId)?.sedeId !== targetGrade.sedeId);

  for (const assignment of conflictingAssignments) {
    const overrideTeacherId = normalizedOverrides[assignment.id];
    if (!overrideTeacherId) {
      const error = new Error('Debes indicar un docente de la sede destino para todas las asignaciones incompatibles');
      error.statusCode = 409;
      throw error;
    }
    const overrideTeacher = teacherById.get(overrideTeacherId);
    if (!overrideTeacher || overrideTeacher.active === 'FALSE' || overrideTeacher.sedeId !== targetGrade.sedeId) {
      const error = new Error(`El docente seleccionado para reemplazar la asignacion ${assignment.id} no pertenece a la sede del grado destino`);
      error.statusCode = 409;
      throw error;
    }
  }

  const nextAssignments = [
    ...assignments,
    ...rowsToCopy.map((item) =>
      normalizeGradeSubjectRecord({
        gradeId: targetId,
        subjectId: item.subjectId,
        teacherId: normalizedOverrides[item.id] || item.teacherId,
        active: item.active
      })
    )
  ];
  await saveSheetRecords(SHEET_NAMES.gradeSubjects, nextAssignments);
  return {
    sourceGradeId: sourceId,
    sourceGradeName: sourceGrade.name,
    targetGradeId: targetId,
    targetGradeName: targetGrade.name,
    copied: rowsToCopy.length,
    skipped: sourceAssignments.length - rowsToCopy.length
  };
}

export async function reassignAssignmentsTeacherService(session, assignmentIds, teacherId) {
  if (!session.isAdmin) {
    const error = new Error('Se requieren permisos de administrador');
    error.statusCode = 403;
    throw error;
  }

  const normalizedIds = Array.isArray(assignmentIds)
    ? [...new Set(assignmentIds.map((item) => normalizeCell(item)).filter(Boolean))]
    : [];
  const normalizedTeacherId = normalizeCell(teacherId);

  if (!normalizedIds.length || !normalizedTeacherId) {
    const error = new Error('Debes seleccionar al menos una asignacion y un docente');
    error.statusCode = 400;
    throw error;
  }

  const [assignments, teachers] = await Promise.all([
    getSheetRecords(SHEET_NAMES.gradeSubjects),
    getSheetRecords(SHEET_NAMES.teachers)
  ]);
  const teacher = teachers.find((item) => item.id === normalizedTeacherId && item.active !== 'FALSE');
  if (!teacher) {
    const error = new Error('Docente no encontrado o inactivo');
    error.statusCode = 404;
    throw error;
  }

  const selectedAssignments = assignments.filter((item) => normalizedIds.includes(item.id));
  if (!selectedAssignments.length) {
    const error = new Error('No se encontraron las asignaciones seleccionadas');
    error.statusCode = 404;
    throw error;
  }

  const nextAssignments = assignments.map((item) =>
    normalizedIds.includes(item.id) ? normalizeGradeSubjectRecord({ ...item, teacherId: normalizedTeacherId }, item) : item
  );
  await saveSheetRecords(SHEET_NAMES.gradeSubjects, nextAssignments);
  return {
    teacherId: normalizedTeacherId,
    teacherName: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim(),
    updated: selectedAssignments.length
  };
}

export async function importConfigWorkbookService(entityType, rows) {
  const records = await getSheetRecords(entityType);
  if (entityType === SHEET_NAMES.gradeSubjects) {
    const importedActivePairs = new Set();
    for (const row of rows) {
      const normalizedRow = normalizeGradeSubjectRecord(row, row.id ? records.find((item) => item.id === row.id) || {} : {});
      ensureUniqueActiveAssignment(records, normalizedRow, row.id ? records.find((item) => item.id === row.id) || {} : {});
      if (normalizedRow.active !== 'FALSE') {
        const pairKey = `${normalizedRow.gradeId}::${normalizedRow.subjectId}`;
        if (importedActivePairs.has(pairKey)) {
          const error = new Error('La importacion contiene asignaciones duplicadas para un mismo grado y asignatura');
          error.statusCode = 409;
          throw error;
        }
        importedActivePairs.add(pairKey);
      }
    }
  }
  const merged = dedupeBy(
    [
      ...records,
      ...rows.map((row) => {
        switch (entityType) {
          case SHEET_NAMES.teachers:
            return normalizeTeacherRecord({
              ...row,
              passwordHash: hashPassword(row.password || row.id || '123456', config.passwordSalt)
            });
          case SHEET_NAMES.subjects:
            return normalizeSimpleRecord(row, row.id ? records.find((item) => item.id === row.id) || {} : {}, 'subject');
          case SHEET_NAMES.grades:
            return normalizeGradeRecord(row, row.id ? records.find((item) => item.id === row.id) || {} : {});
          case SHEET_NAMES.gradeSubjects:
            return normalizeGradeSubjectRecord(row, row.id ? records.find((item) => item.id === row.id) || {} : {});
          case SHEET_NAMES.students:
            return normalizeStudentRecord(row, row.id ? records.find((item) => item.id === row.id) || {} : {});
          case SHEET_NAMES.periods:
            return normalizePeriodRecord(row, row.id ? records.find((item) => item.id === row.id) || {} : {});
          default:
            return row;
        }
      })
    ],
    (item) => item.id
  );
  await saveSheetRecords(entityType, merged);
  return { imported: rows.length, total: merged.length };
}

export async function createPreReportService(session, payload) {
  const data = await getDomainData();
  const assignment = data.gradeSubjects.find(
    (item) =>
      item.teacherId === session.userId &&
      item.gradeId === payload.gradeId &&
      item.subjectId === payload.subjectId &&
      item.active !== 'FALSE'
  );
  if (!assignment) {
    const error = new Error('No tiene permiso para registrar este preinforme');
    error.statusCode = 403;
    throw error;
  }

  const existing = data.preReports.find(
    (item) =>
      item.periodId === payload.periodId &&
      item.gradeId === payload.gradeId &&
      item.subjectId === payload.subjectId &&
      item.studentId === payload.studentId &&
      item.status !== 'deleted'
  );
  if (existing) {
    const error = new Error('Ya existe un preinforme activo para este estudiante en la asignatura y periodo');
    error.statusCode = 409;
    throw error;
  }

  const normalized = normalizePreReportRecord({ ...payload, teacherId: session.userId });
  return upsertRecord(SHEET_NAMES.preReports, normalized.id, normalized);
}

export async function createBulkPreReportsService(session, payload) {
  const periodId = normalizeCell(payload.periodId);
  const gradeId = normalizeCell(payload.gradeId);
  const subjectId = normalizeCell(payload.subjectId);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  const data = await getDomainData();
  const assignment = data.gradeSubjects.find(
    (item) =>
      item.teacherId === session.userId &&
      item.gradeId === gradeId &&
      item.subjectId === subjectId &&
      item.active !== 'FALSE'
  );
  if (!assignment) {
    const error = new Error('No tiene permiso para registrar este preinforme');
    error.statusCode = 403;
    throw error;
  }

  if (!periodId || !gradeId || !subjectId || rows.length === 0) {
    const error = new Error('Debe seleccionar periodo, grado, asignatura y al menos un estudiante');
    error.statusCode = 400;
    throw error;
  }

  const allowedStudentIds = new Set(data.students.filter((item) => item.gradeId === gradeId).map((item) => item.id));
  const existingKeys = new Set(
    data.preReports
      .filter((item) => item.periodId === periodId && item.gradeId === gradeId && item.subjectId === subjectId && item.status !== 'deleted')
      .map((item) => item.studentId)
  );
  const incomingStudentIds = new Set();
  const normalizedRows = [];

  for (const row of rows) {
    const studentId = normalizeCell(row.studentId);
    if (!studentId || !allowedStudentIds.has(studentId)) {
      const error = new Error('Uno o varios estudiantes no pertenecen al grado seleccionado');
      error.statusCode = 409;
      throw error;
    }
    if (existingKeys.has(studentId)) {
      const error = new Error('Uno o varios estudiantes ya tienen preinforme activo para esta asignatura y periodo');
      error.statusCode = 409;
      throw error;
    }
    if (incomingStudentIds.has(studentId)) {
      const error = new Error('La carga grupal contiene estudiantes repetidos');
      error.statusCode = 409;
      throw error;
    }
    incomingStudentIds.add(studentId);
    normalizedRows.push(
      normalizePreReportRecord({
        periodId,
        gradeId,
        subjectId,
        teacherId: session.userId,
        studentId,
        convivencia: Array.isArray(row.convivencia) ? row.convivencia : [],
        academica: Array.isArray(row.academica) ? row.academica : [],
        observations: row.observations || ''
      })
    );
  }

  const allRecords = await getSheetRecords(SHEET_NAMES.preReports);
  await saveSheetRecords(SHEET_NAMES.preReports, [...allRecords, ...normalizedRows]);
  return { created: normalizedRows.length };
}

export async function updatePreReportService(session, preReportId, payload) {
  const records = await getSheetRecords(SHEET_NAMES.preReports);
  const existing = records.find((item) => item.id === preReportId && item.status !== 'deleted');
  if (!existing) {
    const error = new Error('Preinforme no encontrado');
    error.statusCode = 404;
    throw error;
  }
  if (existing.teacherId !== session.userId) {
    const error = new Error('No tiene permiso para editar este preinforme');
    error.statusCode = 403;
    throw error;
  }
  const normalized = normalizePreReportRecord({ ...existing, ...payload, id: preReportId }, existing);
  return upsertRecord(SHEET_NAMES.preReports, preReportId, normalized);
}

export async function deletePreReportService(session, preReportId) {
  const records = await getSheetRecords(SHEET_NAMES.preReports);
  const existing = records.find((item) => item.id === preReportId && item.status !== 'deleted');
  if (!existing) {
    const error = new Error('Preinforme no encontrado');
    error.statusCode = 404;
    throw error;
  }
  if (existing.teacherId !== session.userId) {
    const error = new Error('No tiene permiso para borrar este preinforme');
    error.statusCode = 403;
    throw error;
  }
  const normalized = normalizePreReportRecord({ ...existing, status: 'deleted' }, existing);
  return upsertRecord(SHEET_NAMES.preReports, preReportId, normalized);
}

export async function getTeacherStudentsForAssignment(session, periodId, gradeId, subjectId) {
  const data = await getDomainData();
  const allowed = data.gradeSubjects.some(
    (item) =>
      item.teacherId === session.userId &&
      item.gradeId === normalizeCell(gradeId) &&
      item.subjectId === normalizeCell(subjectId)
  );
  if (!allowed) {
    const error = new Error('No tiene acceso a esta asignacion');
    error.statusCode = 403;
    throw error;
  }
  const reportedIds = new Set(
    data.preReports
      .filter(
        (item) =>
          item.periodId === normalizeCell(periodId) &&
          item.gradeId === normalizeCell(gradeId) &&
          item.subjectId === normalizeCell(subjectId) &&
          item.status !== 'deleted'
      )
      .map((item) => item.studentId)
  );
  return data.students.filter((item) => item.gradeId === normalizeCell(gradeId) && !reportedIds.has(item.id));
}

export async function getEditablePreReports(session, gradeId, subjectId) {
  const data = await getDomainData();
  return data.preReports.filter(
    (item) =>
      item.teacherId === session.userId &&
      item.gradeId === normalizeCell(gradeId) &&
      item.subjectId === normalizeCell(subjectId) &&
      item.status !== 'deleted'
  );
}

export async function generatePdfService(session, filters) {
  const data = await getDomainData();
  const mode = normalizeCell(filters?.mode || 'all');
  const items = buildPdfReportItems(data, session, filters);

  if (!items.length) {
    const error = new Error('No hay preinformes disponibles con los filtros seleccionados');
    error.statusCode = 404;
    throw error;
  }

  if (mode === 'grade_single_pdf') {
    if (!normalizeCell(filters?.gradeId)) {
      throw new Error('Debes seleccionar un grado para generar el PDF por grado');
    }
    const grade = data.grades.find((item) => item.id === filters.gradeId);
    return {
      buffer: await buildPreReportsPdf(items),
      contentType: 'application/pdf',
      filename: `preinformes-${sanitizeFileNamePart(grade?.name || filters.gradeId)}.pdf`
    };
  }

  if (mode === 'individual') {
    if (!normalizeCell(filters?.studentId)) {
      throw new Error('Debes seleccionar un estudiante para generar el preinforme individual');
    }
    const student = data.students.find((item) => item.id === filters.studentId);
    return {
      buffer: await buildPreReportsPdf(items),
      contentType: 'application/pdf',
      filename: `preinforme-${sanitizeFileNamePart(`${student?.firstName || ''}-${student?.lastName || ''}`)}.pdf`
    };
  }

  if (mode === 'grade_student_zip') {
    if (!normalizeCell(filters?.gradeId)) {
      throw new Error('Debes seleccionar un grado para generar PDFs separados por estudiante');
    }
    const grade = data.grades.find((item) => item.id === filters.gradeId);
    const files = [];
    for (const item of items) {
      const pdfBuffer = await buildPreReportsPdf([item]);
      const safeStudent = sanitizeFileNamePart(item.studentName || 'estudiante');
      const safeGrade = sanitizeFileNamePart(item.gradeName || grade?.name || 'grado');
      files.push({
        name: `${safeGrade}/${safeStudent}.pdf`,
        data: pdfBuffer
      });
    }
    return {
      buffer: createZip(files),
      contentType: 'application/zip',
      filename: `preinformes-${sanitizeFileNamePart(grade?.name || filters.gradeId)}.zip`
    };
  }

  return {
    buffer: await buildPreReportsPdf(items),
    contentType: 'application/pdf',
    filename: 'preinformes.pdf'
  };
}

export async function getAdminSummaryService(session, filters = {}) {
  const data = await getDomainData();
  const scope = buildReportScope(data, session, filters);
  return {
    totals: {
      teachers: data.teachers.length,
      students: data.students.length,
      grades: data.grades.length,
      subjects: data.subjects.length,
      periods: data.periods.length,
      preReports: scope.detailRows.length,
      studentsReported: scope.studentsReported.length,
      studentsPending: scope.studentsPending.length,
      teachersWithoutReports: scope.teachersWithoutReports.length
    },
    byGrade: groupBy(scope.detailRows, (item) => item.gradeId, (item) => ({
      gradeId: item.gradeId,
      gradeName: item.gradeName
    })),
    bySubject: groupBy(scope.detailRows, (item) => item.subjectId, (item) => ({
      subjectId: item.subjectId,
      subjectName: item.subjectName
    })),
    byTeacher: groupBy(scope.detailRows, (item) => item.teacherId, (item) => ({
      teacherId: item.teacherId,
      teacherName: item.teacherName
    })),
    studentsReported: scope.studentsReported,
    studentsPending: scope.studentsPending,
    teachersWithoutReports: scope.teachersWithoutReports,
    detailRows: scope.detailRows
  };
}

export async function exportAdminDetailCsvService(session, filters = {}) {
  const data = await getDomainData();
  return buildReportScope(data, session, filters).detailRows;
}
