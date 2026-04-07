import { config } from './config.js';
import { ACADEMICA_QUESTIONS, CONVIVENCIA_QUESTIONS, SHEET_NAMES } from './constants.js';
import { authenticateUser, createSession } from './auth.js';
import { buildAdminSummaryPdf, buildPreReportsPdf, buildTeachersReportedSummaryPdf } from './pdf.js';
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
  normalizeSubjectGroupRecord,
  normalizeTeacherRecord,
  replaceSubjectGroupMembers,
  appendRecords,
  saveSheetRecords,
  upsertRecord
} from './repository.js';
import { dedupeBy, hashPassword, includesComparableText, normalizeCell, normalizeRichText } from './utils.js';

const PRESENCE_KEY_PREFIX = 'presence:teacher:';
const PRESENCE_TTL_MS = 3 * 60 * 1000;

function isTeacherScopedSession(session) {
  return normalizeCell(session?.viewMode) === 'teacher';
}

function canUseAdminWideScope(session) {
  return Boolean(session?.isAdmin) && !isTeacherScopedSession(session);
}

function getEffectiveTeacherId(session) {
  return normalizeCell(session?.actingAsUserId || session?.userId);
}

function getTeacherDisplayName(teacher) {
  return `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim();
}

function logAuditEvent(event, session, details = {}) {
  void event;
  void session;
  void details;
}

function buildPresenceKey(teacherId) {
  return `${PRESENCE_KEY_PREFIX}${normalizeCell(teacherId)}`;
}

function parsePresenceRecord(record) {
  try {
    return JSON.parse(record?.value || '{}');
  } catch {
    return {};
  }
}

async function updateTeacherPresence(session, payload = {}) {
  const teacherId = normalizeCell(session?.userId);
  if (!teacherId) return null;
  const settings = await getSheetRecords(SHEET_NAMES.settings);
  const key = buildPresenceKey(teacherId);
  const existing = settings.find((item) => normalizeCell(item.key) === key);
  const nextRecord = {
    institucionId: existing?.institucionId || config.defaultInstitutionId,
    key,
    value: JSON.stringify({
      teacherId,
      teacherName: `${session?.firstName || ''} ${session?.lastName || ''}`.trim(),
      viewMode: normalizeCell(session?.viewMode),
      actingAsUserId: normalizeCell(session?.actingAsUserId),
      actingAsTeacherName: `${session?.actingAsFirstName || ''} ${session?.actingAsLastName || ''}`.trim(),
      lastSeenAt: new Date().toISOString(),
      userAgent: normalizeCell(payload.userAgent),
      location: normalizeCell(payload.location || 'web')
    })
  };
  const nextSettings = existing
    ? settings.map((item) => (normalizeCell(item.key) === key ? nextRecord : item))
    : [...settings, nextRecord];
  await saveSheetRecords(SHEET_NAMES.settings, nextSettings);
  return nextRecord;
}

async function getTeacherUsageSummary() {
  const [settings, teachers, sedes] = await Promise.all([
    getSheetRecords(SHEET_NAMES.settings),
    getSheetRecords(SHEET_NAMES.teachers),
    getSheetRecords(SHEET_NAMES.sedes)
  ]);
  const now = Date.now();
  const activeUsers = settings
    .filter((item) => normalizeCell(item.key).startsWith(PRESENCE_KEY_PREFIX))
    .map((item) => parsePresenceRecord(item))
    .filter((item) => item.teacherId && item.lastSeenAt)
    .filter((item) => now - new Date(item.lastSeenAt).getTime() <= PRESENCE_TTL_MS)
    .map((item) => {
      const teacher = teachers.find((row) => row.id === item.teacherId);
      const sede = sedes.find((row) => row.id === teacher?.sedeId);
      return {
        teacherId: item.teacherId,
        teacherName: teacher ? getTeacherDisplayName(teacher) : item.teacherName || item.teacherId,
        sedeName: sede?.name || '',
        viewMode: item.viewMode || 'teacher',
        actingAsTeacherName: item.actingAsTeacherName || '',
        lastSeenAt: item.lastSeenAt,
        userAgent: item.userAgent || ''
      };
    })
    .sort((a, b) => compareText(a.teacherName, b.teacherName));

  return {
    activeCount: activeUsers.length,
    activeUsers
  };
}

function compareText(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base' });
}

function compareStudentsByLastName(a, b) {
  return compareText(a?.lastName, b?.lastName) || compareText(a?.firstName, b?.firstName) || compareText(a?.id, b?.id);
}

function sortStudentsByLastName(items) {
  return [...items].sort(compareStudentsByLastName);
}

function formatSubjectName(subject) {
  if (!subject) return '';
  return subject.shortName ? `${subject.name} (${subject.shortName})` : subject.name;
}

function buildSubjectGroupAssociatedLabel(data, group, members) {
  const labels = members
    .map((member) => data.subjects.find((item) => item.id === member.subjectId))
    .filter(Boolean)
    .sort((a, b) => compareText(a.shortName || a.name, b.shortName || b.name))
    .map((subject) => subject.shortName || subject.name);
  return labels.join(', ');
}

function formatSubjectGroupPrintLabel(data, group, members) {
  const associatedShort = buildSubjectGroupAssociatedLabel(data, group, members);
  switch (normalizeCell(group.printMode || 'NAME')) {
    case 'SHORT_NAME':
      return group.shortName || group.name || '';
    case 'NAME_WITH_ASSOCIATED_SHORT':
      return associatedShort ? `${group.name} (${associatedShort})` : group.name || '';
    case 'SHORT_NAME_WITH_ASSOCIATED_SHORT':
      return associatedShort ? `${group.shortName || group.name} (${associatedShort})` : group.shortName || group.name || '';
    default:
      return group.name || '';
  }
}

function buildPdfSubjectColumns(data, gradeId) {
  const activeAssignments = data.gradeSubjects.filter((item) => item.gradeId === gradeId && item.active !== 'FALSE');
  const activeGroups = data.subjectGroups.filter((item) => item.gradeId === gradeId && item.active !== 'FALSE');
  const membersByGroupId = new Map(
    activeGroups.map((group) => [
      group.id,
      data.subjectGroupMembers.filter((member) => member.subjectGroupId === group.id)
    ])
  );
  const groupBySubjectId = new Map();
  for (const group of activeGroups) {
    const members = membersByGroupId.get(group.id) || [];
    for (const member of members) {
      groupBySubjectId.set(member.subjectId, group);
    }
  }

  const columns = [];
  const pushedGroupIds = new Set();
  const pushedSubjectIds = new Set();

  for (const assignment of activeAssignments) {
    const group = groupBySubjectId.get(assignment.subjectId);
    if (group) {
      if (pushedGroupIds.has(group.id) || group.principalSubjectId !== assignment.subjectId) {
        continue;
      }
      const members = membersByGroupId.get(group.id) || [];
      columns.push({
        subjectId: group.principalSubjectId,
        reportLookupId: group.principalSubjectId,
        shortName: formatSubjectGroupPrintLabel(data, group, members),
        subjectName: formatSubjectGroupPrintLabel(data, group, members),
        teacherName: `${data.teachers.find((teacher) => teacher.id === assignment.teacherId)?.firstName || ''} ${
          data.teachers.find((teacher) => teacher.id === assignment.teacherId)?.lastName || ''
        }`.trim(),
        isGrouped: true,
        groupId: group.id
      });
      pushedGroupIds.add(group.id);
      pushedSubjectIds.add(group.principalSubjectId);
      continue;
    }

    if (pushedSubjectIds.has(assignment.subjectId)) continue;
    const subject = data.subjects.find((item) => item.id === assignment.subjectId);
    columns.push({
      subjectId: assignment.subjectId,
      reportLookupId: assignment.subjectId,
      shortName: subject?.shortName || '',
      subjectName: formatSubjectName(subject) || assignment.subjectId,
      teacherName: `${data.teachers.find((teacher) => teacher.id === assignment.teacherId)?.firstName || ''} ${
        data.teachers.find((teacher) => teacher.id === assignment.teacherId)?.lastName || ''
      }`.trim(),
      isGrouped: false,
      groupId: ''
    });
    pushedSubjectIds.add(assignment.subjectId);
  }

  return columns;
}

function buildDetailedReportRows(data, filters = {}) {
  return data.preReports
    .filter((report) => {
      if (report.status === 'deleted') return false;
      if (filters.periodId && report.periodId !== filters.periodId) return false;
      if (filters.gradeId && report.gradeId !== filters.gradeId) return false;
      if (filters.teacherId && report.teacherId !== filters.teacherId) return false;
      if (filters.sedeId) {
        const grade = data.grades.find((item) => item.id === report.gradeId);
        if (!grade || grade.sedeId !== filters.sedeId) return false;
      }
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
        updatedAt: report.updatedAt,
        hasSubjectContent: hasSubjectPreReportContent(report),
        hasDirectorObservation: Boolean(normalizeRichText(report.directorObservations))
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

function hasMeaningfulPreReportContent(payload = {}) {
  return Boolean(
    (Array.isArray(payload.convivencia) && payload.convivencia.length) ||
      (Array.isArray(payload.academica) && payload.academica.length) ||
      normalizeRichText(payload.observations) ||
      normalizeRichText(payload.directorObservations)
  );
}

function hasSubjectPreReportContent(payload = {}) {
  return Boolean(
    (Array.isArray(payload.convivencia) && payload.convivencia.length) ||
      (Array.isArray(payload.academica) && payload.academica.length) ||
      normalizeRichText(payload.observations)
  );
}

function mapTeacherView(data, session) {
  const effectiveTeacherId = getEffectiveTeacherId(session);
  const assignments = canUseAdminWideScope(session)
    ? data.gradeSubjects
    : data.gradeSubjects.filter((item) => item.teacherId === effectiveTeacherId);
  const gradeIds = new Set(assignments.map((item) => item.gradeId));
  const subjectIds = new Set(assignments.map((item) => item.subjectId));
  const directedGrades = canUseAdminWideScope(session)
    ? data.grades
    : data.grades.filter((item) => item.directorTeacherId === effectiveTeacherId);
  directedGrades.forEach((item) => gradeIds.add(item.id));
  const effectiveTeacher = data.teachers.find((item) => item.id === effectiveTeacherId);

  return {
    profile: {
      ...session,
      effectiveTeacherId,
      effectiveTeacherName: getTeacherDisplayName(effectiveTeacher)
    },
    institutions: data.institutions,
    sedes: data.sedes,
    grades: canUseAdminWideScope(session) ? data.grades : data.grades.filter((item) => gradeIds.has(item.id)),
    directedGrades,
    subjects: canUseAdminWideScope(session) ? data.subjects : data.subjects.filter((item) => subjectIds.has(item.id)),
    gradeSubjects: assignments,
    subjectGroups: data.subjectGroups.filter((item) => item.teacherId === effectiveTeacherId),
    subjectGroupMembers: data.subjectGroupMembers.filter((item) =>
      data.subjectGroups.some((group) => group.teacherId === effectiveTeacherId && group.id === item.subjectGroupId)
    ),
    students: sortStudentsByLastName(canUseAdminWideScope(session) ? data.students : data.students.filter((item) => gradeIds.has(item.gradeId))),
    periods: data.periods,
    preReports: canUseAdminWideScope(session) ? data.preReports : data.preReports.filter((item) => item.teacherId === effectiveTeacherId),
    questions: {
      convivencia: CONVIVENCIA_QUESTIONS,
      academica: ACADEMICA_QUESTIONS
    }
  };
}

function getVisibleGradesForSession(data, session) {
  if (canUseAdminWideScope(session)) {
    return data.grades;
  }
  const effectiveTeacherId = getEffectiveTeacherId(session);
  const directedGradeIds = new Set(
    data.grades.filter((item) => item.directorTeacherId === effectiveTeacherId).map((item) => item.id)
  );
  return data.grades.filter((item) => directedGradeIds.has(item.id));
}

function ensureDirectorGradeAccess(data, session, gradeId) {
  const normalizedGradeId = normalizeCell(gradeId);
  if (!normalizedGradeId) {
    const error = new Error('Debes seleccionar un grado');
    error.statusCode = 400;
    throw error;
  }

  const visibleGrade = getVisibleGradesForSession(data, session).find((item) => item.id === normalizedGradeId);
  if (!visibleGrade) {
    const error = new Error('Solo el director de grupo puede gestionar estas observaciones');
    error.statusCode = 403;
    throw error;
  }

  return visibleGrade;
}

function buildDirectorObservationPanel(data, session, periodId, gradeId) {
  const normalizedPeriodId = normalizeCell(periodId);
  const grade = ensureDirectorGradeAccess(data, session, gradeId);

  if (!normalizedPeriodId) {
    const error = new Error('Debes seleccionar un período');
    error.statusCode = 400;
    throw error;
  }

  const reports = data.preReports.filter(
    (item) => item.periodId === normalizedPeriodId && item.gradeId === grade.id && item.status !== 'deleted'
  );
  if (!reports.length) {
    const error = new Error('Aún no hay preinformes cargados para este grado en el período seleccionado');
    error.statusCode = 404;
    throw error;
  }

  const students = sortStudentsByLastName(data.students.filter((item) => item.gradeId === grade.id)).reduce((accumulator, student) => {
    const studentReports = reports.filter((item) => item.studentId === student.id);
    if (!studentReports.length) {
      return accumulator;
    }

    const uniqueObservations = [...new Set(studentReports.map((item) => normalizeRichText(item.directorObservations)).filter(Boolean))];
    accumulator.push({
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      directorObservations: uniqueObservations[0] || '',
      hasMixedValues: uniqueObservations.length > 1,
      totalReports: studentReports.length
    });
    return accumulator;
  }, []);

  const sharedObservation =
    students.length > 0 &&
    students.every((item) => !item.hasMixedValues) &&
    new Set(students.map((item) => normalizeRichText(item.directorObservations))).size === 1
      ? students[0]?.directorObservations || ''
      : '';

  return {
    periodId: normalizedPeriodId,
    gradeId: grade.id,
    gradeName: grade.name,
    totalReports: reports.length,
    totalStudents: students.length,
    sharedObservation,
    students
  };
}

function buildReportScope(data, session, filters = {}) {
  const visibleGrades = getVisibleGradesForSession(data, session);
  const sedeScopedGrades = filters.sedeId ? visibleGrades.filter((item) => item.sedeId === filters.sedeId) : visibleGrades;
  const scopedGrades = filters.gradeId ? sedeScopedGrades.filter((item) => item.id === filters.gradeId) : sedeScopedGrades;
  const visibleGradeIds = new Set(scopedGrades.map((item) => item.id));

  if (!canUseAdminWideScope(session) && visibleGradeIds.size === 0) {
    const error = new Error('Solo el administrador o el director de grupo pueden acceder a estos reportes');
    error.statusCode = 403;
    throw error;
  }

  const subjectDetailRows = buildDetailedReportRows(data, filters).filter((row) => row.hasSubjectContent);
  const detailRows = subjectDetailRows.filter((row) => {
    if (canUseAdminWideScope(session)) {
      return !filters.gradeId || row.gradeId === filters.gradeId;
    }
    return visibleGradeIds.has(row.gradeId);
  });

  const visibleStudents = data.students.filter((item) => {
    if (filters.gradeId) return item.gradeId === filters.gradeId;
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
      firstName: student.firstName,
      lastName: student.lastName,
      gradeId: student.gradeId,
      gradeName: data.grades.find((item) => item.id === student.gradeId)?.name || '',
      totalReports: reportedByStudent.get(student.id) || 0
    }))
    .sort((a, b) => a.gradeName.localeCompare(b.gradeName, 'es', { sensitivity: 'base' }) || compareStudentsByLastName(a, b));

  const studentsPending = visibleStudents
    .filter((student) => !reportedByStudent.has(student.id))
    .map((student) => ({
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      firstName: student.firstName,
      lastName: student.lastName,
      gradeId: student.gradeId,
      gradeName: data.grades.find((item) => item.id === student.gradeId)?.name || ''
    }))
    .sort((a, b) => a.gradeName.localeCompare(b.gradeName, 'es', { sensitivity: 'base' }) || compareStudentsByLastName(a, b));

  const teachersWithoutReports = canUseAdminWideScope(session)
    ? Array.from(
        data.gradeSubjects
          .filter((assignment) => {
            if (assignment.active === 'FALSE') return false;
            if (filters.gradeId && assignment.gradeId !== filters.gradeId) return false;
            if (filters.teacherId && assignment.teacherId !== filters.teacherId) return false;
            if (filters.sedeId) {
              const grade = data.grades.find((item) => item.id === assignment.gradeId);
              if (!grade || grade.sedeId !== filters.sedeId) return false;
            }
            return true;
          })
          .reduce((accumulator, assignment) => {
            const hasReports = data.preReports.some(
              (report) =>
                report.status !== 'deleted' &&
                report.gradeId === assignment.gradeId &&
                report.subjectId === assignment.subjectId &&
                report.teacherId === assignment.teacherId &&
                hasSubjectPreReportContent(report) &&
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
    if (filters.sedeId) {
      const grade = data.grades.find((item) => item.id === report.gradeId);
      if (!grade || grade.sedeId !== filters.sedeId) return false;
    }
    if (!canUseAdminWideScope(session) && !visibleGradeIds.has(report.gradeId)) return false;
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
    const assignments = buildPdfSubjectColumns(data, first.gradeId);
    const subjects = assignments.length
      ? assignments
      : dedupeBy(
          reports.map((report) => ({
            subjectId: report.subjectId,
            reportLookupId: report.subjectId,
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
        marks: subjects.map((subject) =>
          includesComparableText(reportBySubject.get(subject.reportLookupId || subject.subjectId)?.convivencia, question)
        )
      })),
      { type: 'section', label: 'Dificultades académicas' },
      ...ACADEMICA_QUESTIONS.map((question) => ({
        type: 'question',
        label: question,
        marks: subjects.map((subject) =>
          includesComparableText(reportBySubject.get(subject.reportLookupId || subject.subjectId)?.academica, question)
        )
      }))
    ];
    const observationEntries = subjects
      .map((subject) => {
        const report = reportBySubject.get(subject.reportLookupId || subject.subjectId);
        const observations = normalizeRichText(report?.observations);
        if (!observations) return null;
        return {
          subjectName: subject.subjectName || '',
          teacherName: subject.teacherName || '',
          observations
        };
      })
      .filter(Boolean);
    const directorObservationValues = [...new Set(reports.map((report) => normalizeRichText(report.directorObservations)).filter(Boolean))];
    if (directorObservationValues.length) {
      observationEntries.unshift({
        subjectName: 'Observación del director de grupo',
        teacherName: `${director?.firstName || ''} ${director?.lastName || ''}`.trim(),
        observations: directorObservationValues[0],
        isDirectorObservation: true
      });
    }

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

function buildReportedTeachersPdfSummary(data, session, filters = {}) {
  const scope = buildReportScope(data, session, filters);
  const groupedTeachers = new Map();

  for (const row of scope.detailRows) {
    const key = `${row.sedeId}::${row.gradeId}::${row.teacherId}`;
    const current =
      groupedTeachers.get(key) || {
        sedeId: row.sedeId,
        sedeName: row.sedeName || 'Sin sede',
        gradeId: row.gradeId,
        gradeName: row.gradeName || 'Sin grado',
        teacherId: row.teacherId,
        teacherName: row.teacherName || 'Sin docente',
        totalReports: 0,
        studentIds: new Set(),
        subjectNames: new Set()
      };

    current.totalReports += 1;
    current.studentIds.add(row.studentId);
    if (row.subjectName) current.subjectNames.add(row.subjectName);
    groupedTeachers.set(key, current);
  }

  const sedes = Array.from(groupedTeachers.values())
    .reduce((accumulator, item) => {
      const sedeKey = item.sedeId || 'no-sede';
      const currentSede =
        accumulator.get(sedeKey) || {
          sedeId: item.sedeId,
          sedeName: item.sedeName,
          totalReports: 0,
          teacherIds: new Set(),
          grades: new Map()
        };

      currentSede.totalReports += item.totalReports;
      currentSede.teacherIds.add(item.teacherId);

      const currentGrade =
        currentSede.grades.get(item.gradeId) || {
          gradeId: item.gradeId,
          gradeName: item.gradeName,
          totalReports: 0,
          teacherIds: new Set(),
          teachers: []
        };

      currentGrade.totalReports += item.totalReports;
      currentGrade.teacherIds.add(item.teacherId);
      currentGrade.teachers.push({
        teacherId: item.teacherId,
        teacherName: item.teacherName,
        totalReports: item.totalReports,
        totalStudents: item.studentIds.size,
        subjectNames: Array.from(item.subjectNames).sort(compareText)
      });

      currentSede.grades.set(item.gradeId, currentGrade);
      accumulator.set(sedeKey, currentSede);
      return accumulator;
    }, new Map());

  return {
    periodName: filters.periodId ? data.periods.find((item) => item.id === filters.periodId)?.name || filters.periodId : 'Todos',
    sedeName: filters.sedeId ? data.sedes.find((item) => item.id === filters.sedeId)?.name || filters.sedeId : 'Todas',
    gradeName: filters.gradeId ? data.grades.find((item) => item.id === filters.gradeId)?.name || filters.gradeId : 'Todos',
    teacherName: filters.teacherId
      ? getTeacherDisplayName(data.teachers.find((item) => item.id === filters.teacherId)) || filters.teacherId
      : 'Todos',
    sedes: Array.from(sedes.values())
      .map((sede) => ({
        sedeId: sede.sedeId,
        sedeName: sede.sedeName,
        totalReports: sede.totalReports,
        totalTeachers: sede.teacherIds.size,
        grades: Array.from(sede.grades.values())
          .map((grade) => ({
            gradeId: grade.gradeId,
            gradeName: grade.gradeName,
            totalReports: grade.totalReports,
            totalTeachers: grade.teacherIds.size,
            teachers: grade.teachers.sort(
              (a, b) => b.totalReports - a.totalReports || compareText(a.teacherName, b.teacherName)
            )
          }))
          .sort((a, b) => compareText(a.gradeName, b.gradeName))
      }))
      .sort((a, b) => compareText(a.sedeName, b.sedeName))
  };
}

function buildAdminSummaryPdfPayload(data, session, filters = {}) {
  const scope = buildReportScope(data, session, filters);
  return {
    periodName: filters.periodId ? data.periods.find((item) => item.id === filters.periodId)?.name || filters.periodId : 'Todos',
    sedeName: filters.sedeId ? data.sedes.find((item) => item.id === filters.sedeId)?.name || filters.sedeId : 'Todas',
    gradeName: filters.gradeId ? data.grades.find((item) => item.id === filters.gradeId)?.name || filters.gradeId : 'Todos',
    teacherName: filters.teacherId
      ? getTeacherDisplayName(data.teachers.find((item) => item.id === filters.teacherId)) || filters.teacherId
      : 'Todos',
    totals: {
      preReports: scope.detailRows.length,
      studentsReported: scope.studentsReported.length,
      studentsPending: scope.studentsPending.length,
      teachersWithoutReports: scope.teachersWithoutReports.length
    },
    bySede: groupBy(scope.detailRows, (item) => item.sedeId, (item) => ({
      sedeId: item.sedeId,
      sedeName: item.sedeName
    })),
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
    teachersWithoutReports: scope.teachersWithoutReports,
    studentsPending: scope.studentsPending
  };
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
  const viewMode = teacher.isAdmin === 'TRUE' ? 'chooser' : 'teacher';
  logAuditEvent('login', { userId: teacher.id, firstName: teacher.firstName, lastName: teacher.lastName, isAdmin: teacher.isAdmin === 'TRUE', viewMode });
  return {
    token: createSession(teacher, { viewMode }),
    session: {
      userId: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      isAdmin: teacher.isAdmin === 'TRUE',
      viewMode
    }
  };
}

export async function pingSessionService(session, payload = {}) {
  await updateTeacherPresence(session, payload);
  return { ok: true };
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
        getSheetRecords(SHEET_NAMES.subjectGroups),
        getSheetRecords(SHEET_NAMES.subjectGroupMembers),
        getSheetRecords(SHEET_NAMES.students),
        getSheetRecords(SHEET_NAMES.periods),
        getSheetRecords(SHEET_NAMES.preReports)
      ])
    : null;
  const effectiveTeacherId = getEffectiveTeacherId(session);
  const effectiveTeacher = data.teachers.find((item) => item.id === effectiveTeacherId);
  const teacherUsageSummary = session.isAdmin ? await getTeacherUsageSummary() : null;
  return {
    session: {
      ...session,
      isAdmin: Boolean(session.isAdmin),
      isDirector: visibleGrades.length > 0,
      effectiveTeacherId,
      effectiveTeacherName: getTeacherDisplayName(effectiveTeacher),
      isImpersonating: Boolean(session.actingAsUserId)
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
          subjectGroups: adminRecords[6].filter((item) => !normalizeCell(item.deletedAt)),
          subjectGroupMembers: adminRecords[7],
          students: sortStudentsByLastName(adminRecords[8]),
          periods: adminRecords[9],
          preReports: adminRecords[10].filter((item) => item.status !== 'deleted').map(inflatePreReport),
          teacherUsageSummary
        }
      : null
  };
}

export async function getTeacherUsageService(session) {
  if (!session.isAdmin) {
    const error = new Error('Solo el administrador puede consultar la actividad de usuarios');
    error.statusCode = 403;
    throw error;
  }
  return getTeacherUsageSummary();
}

export async function saveTeacherSubjectGroupService(session, payload = {}) {
  const data = await getDomainData();
  const effectiveTeacherId = getEffectiveTeacherId(session);
  const existing = data.subjectGroups.find((item) => item.id === normalizeCell(payload.id) && item.teacherId === effectiveTeacherId);
  const normalized = normalizeSubjectGroupRecord(
    {
      ...payload,
      id: existing ? payload.id : '',
      teacherId: effectiveTeacherId
    },
    existing || {}
  );

  const subjectIds = [...new Set((Array.isArray(payload.subjectIds) ? payload.subjectIds : []).map(normalizeCell).filter(Boolean))];
  if (!normalized.gradeId || !normalized.name || !normalized.shortName || !normalized.principalSubjectId) {
    const error = new Error('Debes completar grado, nombre, nombre corto y asignatura principal');
    error.statusCode = 400;
    throw error;
  }
  if (subjectIds.length < 2) {
    const error = new Error('Debes agrupar al menos dos asignaturas');
    error.statusCode = 400;
    throw error;
  }
  if (!subjectIds.includes(normalized.principalSubjectId)) {
    const error = new Error('La asignatura principal debe estar incluida entre las asignaturas agrupadas');
    error.statusCode = 409;
    throw error;
  }

  const assignments = data.gradeSubjects.filter(
    (item) => item.teacherId === effectiveTeacherId && item.gradeId === normalized.gradeId && item.active !== 'FALSE'
  );
  const allowedSubjectIds = new Set(assignments.map((item) => item.subjectId));
  if (subjectIds.some((subjectId) => !allowedSubjectIds.has(subjectId))) {
    const error = new Error('Solo puedes agrupar asignaturas activas que estén asignadas a tu perfil en este grado');
    error.statusCode = 403;
    throw error;
  }

  const conflictingGroup = data.subjectGroups.find((group) => {
    if (group.teacherId !== effectiveTeacherId || group.gradeId !== normalized.gradeId || group.active === 'FALSE') return false;
    if (group.id === normalized.id) return false;
    const groupMembers = data.subjectGroupMembers.filter((member) => member.subjectGroupId === group.id).map((member) => member.subjectId);
    return subjectIds.some((subjectId) => groupMembers.includes(subjectId));
  });
  if (conflictingGroup) {
    const error = new Error('Una o varias asignaturas ya pertenecen a otra agrupación activa en este grado');
    error.statusCode = 409;
    throw error;
  }

  const saved = await upsertRecord(SHEET_NAMES.subjectGroups, normalized.id, normalized);
  await replaceSubjectGroupMembers(saved.id, subjectIds);

  return {
    group: saved,
    subjectIds
  };
}

export async function deleteTeacherSubjectGroupService(session, groupId) {
  const data = await getDomainData();
  const effectiveTeacherId = getEffectiveTeacherId(session);
  const target = data.subjectGroups.find((item) => item.id === normalizeCell(groupId) && item.teacherId === effectiveTeacherId);
  if (!target) {
    const error = new Error('Agrupación no encontrada');
    error.statusCode = 404;
    throw error;
  }
  await deleteRecord(SHEET_NAMES.subjectGroups, target.id);
  return { deletedId: target.id };
}

export async function switchSessionViewService(session, payload = {}) {
  if (!session.isAdmin) {
    const error = new Error('Se requieren permisos de administrador');
    error.statusCode = 403;
    throw error;
  }

  const teachers = await getSheetRecords(SHEET_NAMES.teachers);
  const actor = teachers.find((item) => item.id === session.userId && item.active !== 'FALSE');
  if (!actor) {
    const error = new Error('Administrador no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const mode = normalizeCell(payload.mode || 'chooser');
  if (mode === 'admin' || mode === 'chooser') {
    logAuditEvent('switch_session_view', session, { targetMode: mode });
    return {
      token: createSession(actor, { viewMode: mode }),
      session: {
        userId: actor.id,
        firstName: actor.firstName,
        lastName: actor.lastName,
        isAdmin: true,
        viewMode: mode
      }
    };
  }

  if (mode !== 'teacher') {
    const error = new Error('Modo de sesión no válido');
    error.statusCode = 400;
    throw error;
  }

  const targetTeacherId = normalizeCell(payload.teacherId) || actor.id;
  const targetTeacher = teachers.find((item) => item.id === targetTeacherId && item.active !== 'FALSE');
  if (!targetTeacher) {
    const error = new Error('Docente no encontrado o inactivo');
    error.statusCode = 404;
    throw error;
  }

  logAuditEvent('switch_session_view', session, {
    targetMode: 'teacher',
    targetTeacherId,
    targetTeacherName: getTeacherDisplayName(targetTeacher)
  });

  return {
    token: createSession(actor, {
      viewMode: 'teacher',
      actingAsUserId: targetTeacher.id === actor.id ? '' : targetTeacher.id,
      actingAsFirstName: targetTeacher.firstName,
      actingAsLastName: targetTeacher.lastName
    }),
    session: {
      userId: actor.id,
      firstName: actor.firstName,
      lastName: actor.lastName,
      isAdmin: true,
      viewMode: 'teacher',
      actingAsUserId: targetTeacher.id === actor.id ? '' : targetTeacher.id,
      actingAsFirstName: targetTeacher.firstName,
      actingAsLastName: targetTeacher.lastName
    }
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
  const effectiveTeacherId = getEffectiveTeacherId(session);
  const assignment = data.gradeSubjects.find(
    (item) =>
      item.teacherId === effectiveTeacherId &&
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
  if (existing && hasSubjectPreReportContent(existing)) {
    const error = new Error('Ya existe un preinforme activo para este estudiante en la asignatura y periodo');
    error.statusCode = 409;
    throw error;
  }

  if (!hasSubjectPreReportContent(payload)) {
    const error = new Error('No se puede guardar un preinforme vacío');
    error.statusCode = 400;
    throw error;
  }

  if (session.actingAsUserId) {
    logAuditEvent('create_pre_report_as_other_teacher', session, {
      effectiveTeacherId,
      gradeId: payload.gradeId,
      subjectId: payload.subjectId,
      studentId: payload.studentId
    });
  }
  const normalized = normalizePreReportRecord(
    { ...existing, ...payload, id: existing?.id || payload.id, teacherId: effectiveTeacherId },
    existing || {}
  );
  return upsertRecord(SHEET_NAMES.preReports, normalized.id, normalized);
}

export async function createBulkPreReportsService(session, payload) {
  const periodId = normalizeCell(payload.periodId);
  const gradeId = normalizeCell(payload.gradeId);
  const subjectId = normalizeCell(payload.subjectId);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  const data = await getDomainData();
  const effectiveTeacherId = getEffectiveTeacherId(session);
  const assignment = data.gradeSubjects.find(
    (item) =>
      item.teacherId === effectiveTeacherId &&
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
      .filter(
        (item) =>
          item.periodId === periodId &&
          item.gradeId === gradeId &&
          item.subjectId === subjectId &&
          item.status !== 'deleted' &&
          hasSubjectPreReportContent(item)
      )
      .map((item) => item.studentId)
  );
  const reusableRowsByStudentId = new Map(
    data.preReports
      .filter(
        (item) =>
          item.periodId === periodId &&
          item.gradeId === gradeId &&
          item.subjectId === subjectId &&
          item.status !== 'deleted' &&
          !hasSubjectPreReportContent(item)
      )
      .map((item) => [item.studentId, item])
  );
  const incomingStudentIds = new Set();
  const normalizedRows = [];
  let skippedEmpty = 0;

  for (const row of rows) {
    if (!hasSubjectPreReportContent(row)) {
      skippedEmpty += 1;
      continue;
    }

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
      normalizePreReportRecord(
        {
          ...reusableRowsByStudentId.get(studentId),
          periodId,
          gradeId,
          subjectId,
          teacherId: effectiveTeacherId,
          studentId,
          convivencia: Array.isArray(row.convivencia) ? row.convivencia : [],
          academica: Array.isArray(row.academica) ? row.academica : [],
          observations: row.observations || ''
        },
        reusableRowsByStudentId.get(studentId) || {}
      )
    );
  }

  if (!normalizedRows.length) {
    const error = new Error('No hay preinformes con contenido para guardar');
    error.statusCode = 400;
    throw error;
  }

  if (session.actingAsUserId) {
    logAuditEvent('create_bulk_pre_reports_as_other_teacher', session, {
      effectiveTeacherId,
      gradeId,
      subjectId,
      totalRows: normalizedRows.length,
      skippedEmpty
    });
  }
  await appendRecords(SHEET_NAMES.preReports, normalizedRows);
  return { created: normalizedRows.length, skippedEmpty };
}

export async function copyTeacherPreReportsBetweenSubjectsService(session, payload) {
  const periodId = normalizeCell(payload.periodId);
  const gradeId = normalizeCell(payload.gradeId);
  const sourceSubjectId = normalizeCell(payload.sourceSubjectId);
  const targetSubjectId = normalizeCell(payload.targetSubjectId);

  if (!periodId || !gradeId || !sourceSubjectId || !targetSubjectId) {
    const error = new Error('Debes seleccionar periodo, grado, asignatura origen y asignatura destino');
    error.statusCode = 400;
    throw error;
  }

  if (sourceSubjectId === targetSubjectId) {
    const error = new Error('La asignatura origen y la asignatura destino deben ser diferentes');
    error.statusCode = 409;
    throw error;
  }

  const data = await getDomainData();
  const effectiveTeacherId = getEffectiveTeacherId(session);
  const sourceAssignment = data.gradeSubjects.find(
    (item) =>
      item.teacherId === effectiveTeacherId &&
      item.gradeId === gradeId &&
      item.subjectId === sourceSubjectId &&
      item.active !== 'FALSE'
  );
  const targetAssignment = data.gradeSubjects.find(
    (item) =>
      item.teacherId === effectiveTeacherId &&
      item.gradeId === gradeId &&
      item.subjectId === targetSubjectId &&
      item.active !== 'FALSE'
  );

  if (!sourceAssignment || !targetAssignment) {
    const error = new Error('Solo puedes copiar entre asignaturas del mismo grado que tengas asignadas');
    error.statusCode = 403;
    throw error;
  }

  const sourceReports = data.preReports.filter(
    (item) =>
      item.teacherId === effectiveTeacherId &&
      item.periodId === periodId &&
      item.gradeId === gradeId &&
      item.subjectId === sourceSubjectId &&
      item.status !== 'deleted'
  );

  if (!sourceReports.length) {
    const error = new Error('No existen preinformes en la asignatura origen para copiar');
    error.statusCode = 404;
    throw error;
  }

  const existingTargetByStudent = new Set(
    data.preReports
      .filter(
        (item) =>
          item.teacherId === effectiveTeacherId &&
          item.periodId === periodId &&
          item.gradeId === gradeId &&
          item.subjectId === targetSubjectId &&
          item.status !== 'deleted'
      )
      .map((item) => item.studentId)
  );

  const rowsToCopy = sourceReports.filter((item) => !existingTargetByStudent.has(item.studentId));
  const meaningfulRowsToCopy = rowsToCopy.filter((item) => hasSubjectPreReportContent(item));
  if (!meaningfulRowsToCopy.length) {
    return {
      copied: 0,
      skipped: sourceReports.length
    };
  }

  const normalizedRows = meaningfulRowsToCopy.map((item) =>
    normalizePreReportRecord({
      periodId,
      gradeId,
      subjectId: targetSubjectId,
      teacherId: effectiveTeacherId,
      studentId: item.studentId,
      convivencia: item.convivencia,
      academica: item.academica,
      observations: item.observations
    })
  );
  if (session.actingAsUserId) {
    logAuditEvent('copy_pre_reports_between_subjects_as_other_teacher', session, {
      effectiveTeacherId,
      gradeId,
      sourceSubjectId,
      targetSubjectId,
      copied: normalizedRows.length
    });
  }
  await appendRecords(SHEET_NAMES.preReports, normalizedRows);

  return {
    copied: normalizedRows.length,
    skipped: sourceReports.length - normalizedRows.length
  };
}

export async function updatePreReportService(session, preReportId, payload) {
  const records = await getSheetRecords(SHEET_NAMES.preReports);
  const existing = records.find((item) => item.id === preReportId && item.status !== 'deleted');
  if (!existing) {
    const error = new Error('Preinforme no encontrado');
    error.statusCode = 404;
    throw error;
  }
  if (existing.teacherId !== getEffectiveTeacherId(session)) {
    const error = new Error('No tiene permiso para editar este preinforme');
    error.statusCode = 403;
    throw error;
  }
  if (session.actingAsUserId) {
    logAuditEvent('update_pre_report_as_other_teacher', session, { preReportId });
  }
  if (!hasSubjectPreReportContent({ ...existing, ...payload })) {
    const error = new Error('No se puede guardar un preinforme vacío. Si deseas quitar todo el contenido, bórralo.');
    error.statusCode = 400;
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
  if (existing.teacherId !== getEffectiveTeacherId(session)) {
    const error = new Error('No tiene permiso para borrar este preinforme');
    error.statusCode = 403;
    throw error;
  }
  if (session.actingAsUserId) {
    logAuditEvent('delete_pre_report_as_other_teacher', session, { preReportId });
  }
  const normalized = normalizePreReportRecord({ ...existing, status: 'deleted' }, existing);
  return upsertRecord(SHEET_NAMES.preReports, preReportId, normalized);
}

export async function getTeacherStudentsForAssignment(session, periodId, gradeId, subjectId) {
  const data = await getDomainData();
  const effectiveTeacherId = getEffectiveTeacherId(session);
  const allowed = data.gradeSubjects.some(
    (item) =>
      item.teacherId === effectiveTeacherId &&
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
          item.status !== 'deleted' &&
          hasSubjectPreReportContent(item)
      )
      .map((item) => item.studentId)
  );
  return sortStudentsByLastName(
    data.students.filter((item) => item.gradeId === normalizeCell(gradeId) && !reportedIds.has(item.id))
  );
}

export async function getEditablePreReports(session, gradeId, subjectId) {
  const data = await getDomainData();
  const effectiveTeacherId = getEffectiveTeacherId(session);
  return data.preReports
    .filter(
      (item) =>
        item.teacherId === effectiveTeacherId &&
        item.gradeId === normalizeCell(gradeId) &&
        item.subjectId === normalizeCell(subjectId) &&
        item.status !== 'deleted' &&
        hasSubjectPreReportContent(item)
    )
    .sort((a, b) => {
      const studentA = data.students.find((item) => item.id === a.studentId);
      const studentB = data.students.find((item) => item.id === b.studentId);
      return compareStudentsByLastName(studentA, studentB);
    });
}

export async function generatePdfService(session, filters) {
  const data = await getDomainData();
  const mode = normalizeCell(filters?.mode || 'all');

  if (mode === 'admin_summary') {
    const summary = buildAdminSummaryPdfPayload(data, session, filters);
    return {
      buffer: await buildAdminSummaryPdf(summary),
      contentType: 'application/pdf',
      filename: 'resumen-reportes.pdf'
    };
  }

  if (mode === 'reported_teachers_summary') {
    const summary = buildReportedTeachersPdfSummary(data, session, filters);
    return {
      buffer: await buildTeachersReportedSummaryPdf(summary),
      contentType: 'application/pdf',
      filename: 'docentes-reportaron.pdf'
    };
  }

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
    bySede: groupBy(scope.detailRows, (item) => item.sedeId, (item) => ({
      sedeId: item.sedeId,
      sedeName: item.sedeName
    })),
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

export async function getDirectorObservationPanelService(session, filters = {}) {
  const data = await getDomainData();
  return buildDirectorObservationPanel(data, session, filters.periodId, filters.gradeId);
}

export async function saveDirectorObservationsService(session, payload = {}) {
  const mode = normalizeCell(payload.mode || 'single');
  const data = await getDomainData();
  const panel = buildDirectorObservationPanel(data, session, payload.periodId, payload.gradeId);
  const currentRecords = await getSheetRecords(SHEET_NAMES.preReports);
  const targetReportIds = new Set(
    data.preReports
      .filter((item) => item.periodId === panel.periodId && item.gradeId === panel.gradeId && item.status !== 'deleted')
      .map((item) => item.id)
  );

  const perStudentMap =
    mode === 'per_student'
      ? new Map(
          (Array.isArray(payload.rows) ? payload.rows : []).map((item) => [
            normalizeCell(item.studentId),
            normalizeRichText(item.directorObservations)
          ])
        )
      : null;
  const nextRecords = currentRecords.map((item) => {
    if (!targetReportIds.has(item.id)) {
      return item;
    }

    const nextDirectorObservations =
      mode === 'per_student'
        ? perStudentMap?.get(item.studentId) ?? item.directorObservations ?? ''
        : normalizeRichText(payload.observation);

    return normalizePreReportRecord({ ...item, directorObservations: nextDirectorObservations }, item);
  });

  if (session.actingAsUserId) {
    logAuditEvent('save_director_observations_as_other_teacher', session, {
      effectiveTeacherId: getEffectiveTeacherId(session),
      periodId: panel.periodId,
      gradeId: panel.gradeId,
      mode
    });
  }

  await saveSheetRecords(SHEET_NAMES.preReports, nextRecords);

  return {
    mode,
    gradeId: panel.gradeId,
    gradeName: panel.gradeName,
    periodId: panel.periodId,
    updatedReports: panel.totalReports,
    updatedStudents: panel.totalStudents
  };
}
