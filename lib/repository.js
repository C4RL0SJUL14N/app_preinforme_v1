import { clearCache, getCache, setCache } from './cache.js';
import { SHEET_NAMES } from './constants.js';
import { config } from './config.js';
import { supabaseRequest } from './supabase.js';
import { ensureArray, normalizeBooleanString, normalizeCell, normalizeRichText, nowIso, parseJsonSafe } from './utils.js';

const TABLE_MAP = {
  [SHEET_NAMES.institutions]: 'instituciones',
  [SHEET_NAMES.sedes]: 'sedes',
  [SHEET_NAMES.teachers]: 'teachers',
  [SHEET_NAMES.subjects]: 'subjects',
  [SHEET_NAMES.grades]: 'grades',
  [SHEET_NAMES.gradeSubjects]: 'grade_subjects',
  [SHEET_NAMES.subjectGroups]: 'subject_groups',
  [SHEET_NAMES.subjectGroupMembers]: 'subject_group_members',
  [SHEET_NAMES.students]: 'students',
  [SHEET_NAMES.periods]: 'periods',
  [SHEET_NAMES.preReports]: 'pre_reports',
  [SHEET_NAMES.settings]: 'settings',
  [SHEET_NAMES.locks]: 'locks'
};

const SELECT_MAP = {
  [SHEET_NAMES.institutions]: 'id,nombre',
  [SHEET_NAMES.sedes]: 'id,institucion_id,nombre,active',
  [SHEET_NAMES.teachers]: 'id,sede_id,first_name,last_name,password_hash,is_admin,active',
  [SHEET_NAMES.subjects]: 'id,institucion_id,nombre,nombre_corto,active',
  [SHEET_NAMES.grades]: 'id,sede_id,nombre,education_model,director_teacher_id,active',
  [SHEET_NAMES.gradeSubjects]: 'id,grade_id,subject_id,teacher_id,active',
  [SHEET_NAMES.subjectGroups]:
    'id,grade_id,teacher_id,principal_subject_id,name,short_name,print_mode,active,created_at,updated_at,deleted_at',
  [SHEET_NAMES.subjectGroupMembers]: 'id,subject_group_id,subject_id,created_at',
  [SHEET_NAMES.students]: 'id,grade_id,first_name,last_name,active',
  [SHEET_NAMES.periods]: 'id,institucion_id,nombre,status,active',
  [SHEET_NAMES.preReports]:
    'id,period_id,grade_id,subject_id,teacher_id,student_id,convivencia,academica,observations,director_observations,status,created_at,updated_at,deleted_at',
  [SHEET_NAMES.settings]: 'institucion_id,key,value',
  [SHEET_NAMES.locks]: 'id,resource,owner,acquired_at,expires_at,released_at'
};

function isActive(record) {
  return normalizeCell(record.active || 'TRUE') !== 'FALSE';
}

function getTableName(sheetName) {
  const tableName = TABLE_MAP[sheetName];
  if (!tableName) {
    throw new Error(`Entidad no soportada: ${sheetName}`);
  }
  return tableName;
}

function formatBoolean(value) {
  return value ? 'TRUE' : 'FALSE';
}

function parseBoolean(value) {
  return normalizeBooleanString(value) === 'TRUE';
}

function formatSequentialId(value) {
  return `_${String(value).padStart(4, '0')}`;
}

function getNextSequence(records) {
  return (
    records.reduce((maxValue, record) => {
      const match = normalizeCell(record.id).match(/^_(\d+)$/);
      return match ? Math.max(maxValue, Number.parseInt(match[1], 10)) : maxValue;
    }, 0) + 1
  );
}

function assignMissingIds(records, existingRecords = []) {
  let nextSequence = getNextSequence([...existingRecords, ...records]);
  return records.map((record) => {
    if (normalizeCell(record.id)) {
      return record;
    }
    const nextRecord = { ...record, id: formatSequentialId(nextSequence) };
    nextSequence += 1;
    return nextRecord;
  });
}

function buildShortName(value) {
  const normalized = normalizeCell(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized ? normalized.replace(/ /g, '').slice(0, 12) : '';
}

function mapDbToApp(sheetName, row) {
  switch (sheetName) {
    case SHEET_NAMES.teachers:
      return {
        id: row.id,
        sedeId: row.sede_id || '',
        firstName: row.first_name || '',
        lastName: row.last_name || '',
        passwordHash: row.password_hash || '',
        isAdmin: formatBoolean(row.is_admin),
        active: formatBoolean(row.active)
      };
    case SHEET_NAMES.institutions:
      return {
        id: row.id,
        name: row.nombre || ''
      };
    case SHEET_NAMES.sedes:
      return {
        id: row.id,
        institutionId: row.institucion_id || '',
        name: row.nombre || '',
        active: formatBoolean(row.active)
      };
    case SHEET_NAMES.subjects:
      return {
        id: row.id,
        institucionId: row.institucion_id || '',
        name: row.nombre || '',
        shortName: row.nombre_corto || '',
        active: formatBoolean(row.active)
      };
    case SHEET_NAMES.grades:
      return {
        id: row.id,
        sedeId: row.sede_id || '',
        name: row.nombre || '',
        educationModel: row.education_model || 'EDUCACION_TRADICIONAL',
        directorTeacherId: row.director_teacher_id || '',
        active: formatBoolean(row.active)
      };
    case SHEET_NAMES.gradeSubjects:
      return {
        id: row.id,
        gradeId: row.grade_id || '',
        subjectId: row.subject_id || '',
        teacherId: row.teacher_id || '',
        active: formatBoolean(row.active)
      };
    case SHEET_NAMES.subjectGroups:
      return {
        id: row.id,
        gradeId: row.grade_id || '',
        teacherId: row.teacher_id || '',
        principalSubjectId: row.principal_subject_id || '',
        name: row.name || '',
        shortName: row.short_name || '',
        printMode: row.print_mode || 'NAME',
        active: formatBoolean(row.active),
        createdAt: row.created_at || '',
        updatedAt: row.updated_at || '',
        deletedAt: row.deleted_at || ''
      };
    case SHEET_NAMES.subjectGroupMembers:
      return {
        id: row.id ? String(row.id) : '',
        subjectGroupId: row.subject_group_id || '',
        subjectId: row.subject_id || '',
        createdAt: row.created_at || ''
      };
    case SHEET_NAMES.students:
      return {
        id: row.id,
        gradeId: row.grade_id || '',
        firstName: row.first_name || '',
        lastName: row.last_name || '',
        active: formatBoolean(row.active)
      };
    case SHEET_NAMES.periods:
      return {
        id: row.id,
        institucionId: row.institucion_id || '',
        name: row.nombre || '',
        status: row.status || '',
        active: formatBoolean(row.active)
      };
    case SHEET_NAMES.preReports:
      return {
        id: row.id,
        periodId: row.period_id || '',
        gradeId: row.grade_id || '',
        subjectId: row.subject_id || '',
        teacherId: row.teacher_id || '',
        studentId: row.student_id || '',
        convivenciaJson: JSON.stringify(row.convivencia || []),
        academicaJson: JSON.stringify(row.academica || []),
        observations: row.observations || '',
        directorObservations: row.director_observations || '',
        status: row.status || 'active',
        createdAt: row.created_at || '',
        updatedAt: row.updated_at || '',
        deletedAt: row.deleted_at || ''
      };
    case SHEET_NAMES.settings:
      return {
        institucionId: row.institucion_id || '',
        key: row.key || '',
        value: row.value || ''
      };
    case SHEET_NAMES.locks:
      return {
        id: row.id,
        resource: row.resource || '',
        owner: row.owner || '',
        acquiredAt: row.acquired_at || '',
        expiresAt: row.expires_at || '',
        releasedAt: row.released_at || ''
      };
    default:
      return row;
  }
}

function mapAppToDb(sheetName, record) {
  switch (sheetName) {
    case SHEET_NAMES.teachers:
      return {
        id: normalizeCell(record.id),
        sede_id: normalizeCell(record.sedeId || config.defaultSedeId),
        first_name: normalizeCell(record.firstName),
        last_name: normalizeCell(record.lastName),
        password_hash: normalizeCell(record.passwordHash),
        is_admin: parseBoolean(record.isAdmin),
        active: parseBoolean(record.active)
      };
    case SHEET_NAMES.institutions:
      return {
        id: normalizeCell(record.id),
        nombre: normalizeCell(record.name)
      };
    case SHEET_NAMES.sedes:
      return {
        id: normalizeCell(record.id),
        institucion_id: normalizeCell(record.institutionId || config.defaultInstitutionId),
        nombre: normalizeCell(record.name),
        active: parseBoolean(record.active)
      };
    case SHEET_NAMES.subjects:
      return {
        id: normalizeCell(record.id),
        institucion_id: normalizeCell(record.institucionId || config.defaultInstitutionId),
        nombre: normalizeCell(record.name),
        nombre_corto: normalizeCell(record.shortName) || buildShortName(record.name),
        active: parseBoolean(record.active)
      };
    case SHEET_NAMES.grades:
      return {
        id: normalizeCell(record.id),
        sede_id: normalizeCell(record.sedeId || config.defaultSedeId),
        nombre: normalizeCell(record.name),
        education_model: normalizeCell(record.educationModel || 'EDUCACION_TRADICIONAL'),
        director_teacher_id: normalizeCell(record.directorTeacherId),
        active: parseBoolean(record.active)
      };
    case SHEET_NAMES.gradeSubjects:
      return {
        id: normalizeCell(record.id),
        grade_id: normalizeCell(record.gradeId),
        subject_id: normalizeCell(record.subjectId),
        teacher_id: normalizeCell(record.teacherId),
        active: parseBoolean(record.active)
      };
    case SHEET_NAMES.subjectGroups:
      return {
        id: normalizeCell(record.id),
        grade_id: normalizeCell(record.gradeId),
        teacher_id: normalizeCell(record.teacherId),
        principal_subject_id: normalizeCell(record.principalSubjectId),
        name: normalizeCell(record.name),
        short_name: normalizeCell(record.shortName) || buildShortName(record.name),
        print_mode: normalizeCell(record.printMode || 'NAME'),
        active: parseBoolean(record.active),
        created_at: normalizeCell(record.createdAt || nowIso()),
        updated_at: normalizeCell(record.updatedAt || nowIso()),
        deleted_at: normalizeCell(record.deletedAt) || null
      };
    case SHEET_NAMES.subjectGroupMembers:
      return {
        ...(normalizeCell(record.id) ? { id: Number(record.id) } : {}),
        subject_group_id: normalizeCell(record.subjectGroupId),
        subject_id: normalizeCell(record.subjectId),
        created_at: normalizeCell(record.createdAt || nowIso())
      };
    case SHEET_NAMES.students:
      return {
        id: normalizeCell(record.id),
        grade_id: normalizeCell(record.gradeId),
        first_name: normalizeCell(record.firstName),
        last_name: normalizeCell(record.lastName),
        active: parseBoolean(record.active)
      };
    case SHEET_NAMES.periods:
      return {
        id: normalizeCell(record.id),
        institucion_id: normalizeCell(record.institucionId || config.defaultInstitutionId),
        nombre: normalizeCell(record.name),
        status: normalizeCell(record.status),
        active: parseBoolean(record.active)
      };
    case SHEET_NAMES.preReports:
      return {
        id: normalizeCell(record.id),
        period_id: normalizeCell(record.periodId),
        grade_id: normalizeCell(record.gradeId),
        subject_id: normalizeCell(record.subjectId),
        teacher_id: normalizeCell(record.teacherId),
        student_id: normalizeCell(record.studentId),
        convivencia: parseJsonSafe(record.convivenciaJson, []),
        academica: parseJsonSafe(record.academicaJson, []),
        observations: normalizeCell(record.observations),
        director_observations: normalizeCell(record.directorObservations),
        status: normalizeCell(record.status || 'active'),
        created_at: normalizeCell(record.createdAt || nowIso()),
        updated_at: normalizeCell(record.updatedAt || nowIso()),
        deleted_at: normalizeCell(record.deletedAt) || null
      };
    case SHEET_NAMES.settings:
      return {
        institucion_id: normalizeCell(record.institucionId || config.defaultInstitutionId),
        key: normalizeCell(record.key),
        value: normalizeCell(record.value)
      };
    case SHEET_NAMES.locks:
      return {
        id: normalizeCell(record.id),
        resource: normalizeCell(record.resource),
        owner: normalizeCell(record.owner),
        acquired_at: normalizeCell(record.acquiredAt),
        expires_at: normalizeCell(record.expiresAt) || null,
        released_at: normalizeCell(record.releasedAt) || null
      };
    default:
      return record;
  }
}

async function fetchTable(sheetName) {
  const allRows = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const rows = await supabaseRequest(getTableName(sheetName), {
      query: {
        select: SELECT_MAP[sheetName],
        order: sheetName === SHEET_NAMES.settings ? 'key.asc' : 'id.asc',
        limit: String(pageSize),
        offset: String(offset)
      }
    });

    const pageRows = rows || [];
    allRows.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allRows.map((row) => mapDbToApp(sheetName, row));
}

async function upsertTableRows(sheetName, records) {
  if (!records.length) {
    return;
  }

  await supabaseRequest(getTableName(sheetName), {
    method: 'POST',
    query: {
      on_conflict: sheetName === SHEET_NAMES.settings ? 'institucion_id,key' : 'id'
    },
    body: records.map((record) => mapAppToDb(sheetName, record)),
    prefer: 'resolution=merge-duplicates'
  });
}

async function deleteMissingRows(sheetName, existingRecords, nextRecords) {
  if (sheetName === SHEET_NAMES.settings) {
    return;
  }

  const nextIds = new Set(nextRecords.map((record) => normalizeCell(record.id)).filter(Boolean));
  const missingIds = existingRecords
    .map((record) => normalizeCell(record.id))
    .filter((id) => id && !nextIds.has(id));

  if (!missingIds.length) {
    return;
  }

  await supabaseRequest(getTableName(sheetName), {
    method: 'DELETE',
    query: {
      id: `in.(${missingIds.join(',')})`
    }
  });
}

export async function getSheetRecords(sheetName) {
  const cacheKey = `sheet:${sheetName}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const rows = await fetchTable(sheetName);
  setCache(cacheKey, rows);
  return rows;
}

export async function saveSheetRecords(sheetName, records) {
  const currentRecords = await getSheetRecords(sheetName);
  const nextRecords = assignMissingIds(records, currentRecords);
  await upsertTableRows(sheetName, nextRecords);
  await deleteMissingRows(sheetName, currentRecords, nextRecords);
  clearCache(`sheet:${sheetName}`);
}

export async function appendRecords(sheetName, records) {
  const currentRecords = await getSheetRecords(sheetName);
  const nextRecords = assignMissingIds(records, currentRecords);
  await upsertTableRows(sheetName, nextRecords);
  clearCache(`sheet:${sheetName}`);
  return nextRecords;
}

export async function listActiveRecords(sheetName) {
  const rows = await getSheetRecords(sheetName);
  return rows.filter(isActive);
}

export function normalizeTeacherRecord(payload, existing = {}) {
  return {
    id: normalizeCell(payload.id || existing.id),
    sedeId: normalizeCell(payload.sedeId || existing.sedeId || config.defaultSedeId),
    firstName: normalizeCell(payload.firstName || existing.firstName),
    lastName: normalizeCell(payload.lastName || existing.lastName),
    passwordHash: normalizeCell(payload.passwordHash || existing.passwordHash),
    isAdmin: normalizeBooleanString(payload.isAdmin ?? existing.isAdmin ?? 'FALSE'),
    active: normalizeBooleanString(payload.active ?? existing.active ?? 'TRUE')
  };
}

export function normalizeInstitutionRecord(payload, existing = {}) {
  return {
    id: normalizeCell(payload.id || existing.id),
    name: normalizeCell(payload.name || existing.name)
  };
}

export function normalizeSedeRecord(payload, existing = {}) {
  return {
    id: normalizeCell(payload.id || existing.id),
    institutionId: normalizeCell(payload.institutionId || existing.institutionId || config.defaultInstitutionId),
    name: normalizeCell(payload.name || existing.name),
    active: normalizeBooleanString(payload.active ?? existing.active ?? 'TRUE')
  };
}

export function normalizeSimpleRecord(payload, existing = {}) {
  return {
    id: normalizeCell(payload.id || existing.id),
    name: normalizeCell(payload.name || existing.name),
    shortName: normalizeCell(payload.shortName || payload.nombreCorto || existing.shortName || existing.nombreCorto),
    active: normalizeBooleanString(payload.active ?? existing.active ?? 'TRUE')
  };
}

export function normalizeGradeRecord(payload, existing = {}) {
  return {
    id: normalizeCell(payload.id || existing.id),
    name: normalizeCell(payload.name || existing.name),
    sedeId: normalizeCell(payload.sedeId || existing.sedeId || config.defaultSedeId),
    educationModel: normalizeCell(payload.educationModel || existing.educationModel || 'EDUCACION_TRADICIONAL'),
    directorTeacherId: normalizeCell(payload.directorTeacherId || existing.directorTeacherId),
    active: normalizeBooleanString(payload.active ?? existing.active ?? 'TRUE')
  };
}

export function normalizeGradeSubjectRecord(payload, existing = {}) {
  return {
    id: normalizeCell(payload.id || existing.id),
    gradeId: normalizeCell(payload.gradeId || existing.gradeId),
    subjectId: normalizeCell(payload.subjectId || existing.subjectId),
    teacherId: normalizeCell(payload.teacherId || existing.teacherId),
    active: normalizeBooleanString(payload.active ?? existing.active ?? 'TRUE')
  };
}

export function normalizeSubjectGroupRecord(payload, existing = {}) {
  return {
    id: normalizeCell(payload.id || existing.id),
    gradeId: normalizeCell(payload.gradeId || existing.gradeId),
    teacherId: normalizeCell(payload.teacherId || existing.teacherId),
    principalSubjectId: normalizeCell(payload.principalSubjectId || existing.principalSubjectId),
    name: normalizeCell(payload.name || existing.name),
    shortName: normalizeCell(payload.shortName || existing.shortName),
    printMode: normalizeCell(payload.printMode || existing.printMode || 'NAME'),
    active: normalizeBooleanString(payload.active ?? existing.active ?? 'TRUE'),
    createdAt: existing.createdAt || nowIso(),
    updatedAt: nowIso(),
    deletedAt: normalizeCell(payload.deletedAt ?? existing.deletedAt)
  };
}

export function normalizeStudentRecord(payload, existing = {}) {
  return {
    id: normalizeCell(payload.id || existing.id),
    firstName: normalizeCell(payload.firstName || existing.firstName),
    lastName: normalizeCell(payload.lastName || existing.lastName),
    gradeId: normalizeCell(payload.gradeId || existing.gradeId),
    active: normalizeBooleanString(payload.active ?? existing.active ?? 'TRUE')
  };
}

export function normalizePeriodRecord(payload, existing = {}) {
  return {
    id: normalizeCell(payload.id || existing.id),
    name: normalizeCell(payload.name || existing.name),
    status: normalizeCell(payload.status || existing.status || 'draft'),
    active: normalizeBooleanString(payload.active ?? existing.active ?? 'TRUE')
  };
}

export function normalizePreReportRecord(payload, existing = {}) {
  const status = payload.status || existing.status || 'active';
  return {
    id: normalizeCell(payload.id || existing.id),
    periodId: normalizeCell(payload.periodId || existing.periodId),
    gradeId: normalizeCell(payload.gradeId || existing.gradeId),
    subjectId: normalizeCell(payload.subjectId || existing.subjectId),
    teacherId: normalizeCell(payload.teacherId || existing.teacherId),
    studentId: normalizeCell(payload.studentId || existing.studentId),
    convivenciaJson: JSON.stringify(ensureArray(payload.convivencia).map(normalizeCell)),
    academicaJson: JSON.stringify(ensureArray(payload.academica).map(normalizeCell)),
    observations: normalizeRichText(payload.observations ?? existing.observations),
    directorObservations: normalizeRichText(payload.directorObservations ?? existing.directorObservations),
    status: normalizeCell(status),
    createdAt: existing.createdAt || nowIso(),
    updatedAt: nowIso(),
    deletedAt: status === 'deleted' ? nowIso() : ''
  };
}

export function inflatePreReport(record) {
  return {
    ...record,
    convivencia: parseJsonSafe(record.convivenciaJson, []),
    academica: parseJsonSafe(record.academicaJson, []),
    directorObservations: normalizeCell(record.directorObservations)
  };
}

export async function upsertRecord(sheetName, id, normalizedRecord) {
  const records = await getSheetRecords(sheetName);
  const nextRecord = normalizeCell(id)
    ? { ...normalizedRecord, id: normalizeCell(id) }
    : assignMissingIds([normalizedRecord], records)[0];
  await upsertTableRows(sheetName, [nextRecord]);
  clearCache(`sheet:${sheetName}`);
  return nextRecord;
}

export async function deleteRecord(sheetName, id) {
  await supabaseRequest(getTableName(sheetName), {
    method: 'DELETE',
    query: {
      id: `eq.${normalizeCell(id)}`
    }
  });
  clearCache(`sheet:${sheetName}`);
  return { deletedId: id };
}

export async function replaceSubjectGroupMembers(subjectGroupId, subjectIds) {
  await supabaseRequest(getTableName(SHEET_NAMES.subjectGroupMembers), {
    method: 'DELETE',
    query: {
      subject_group_id: `eq.${normalizeCell(subjectGroupId)}`
    }
  });

  const rows = subjectIds
    .map((subjectId) => normalizeCell(subjectId))
    .filter(Boolean)
    .map((subjectId) => ({
      subjectGroupId: normalizeCell(subjectGroupId),
      subjectId,
      createdAt: nowIso()
    }));

  if (rows.length) {
    await supabaseRequest(getTableName(SHEET_NAMES.subjectGroupMembers), {
      method: 'POST',
      body: rows.map((record) => mapAppToDb(SHEET_NAMES.subjectGroupMembers, record)),
      prefer: 'return=minimal'
    });
  }

  clearCache(`sheet:${SHEET_NAMES.subjectGroupMembers}`);
  return rows;
}

export async function deletePreReportsByPeriod(periodId) {
  await supabaseRequest(getTableName(SHEET_NAMES.preReports), {
    method: 'DELETE',
    query: {
      period_id: `eq.${normalizeCell(periodId)}`
    }
  });
  clearCache(`sheet:${SHEET_NAMES.preReports}`);
  return { periodId: normalizeCell(periodId) };
}

export async function getDomainData() {
  const [institutions, sedes, teachers, subjects, grades, gradeSubjects, subjectGroups, subjectGroupMembers, students, periods, preReports] = await Promise.all([
    getSheetRecords(SHEET_NAMES.institutions),
    listActiveRecords(SHEET_NAMES.sedes),
    listActiveRecords(SHEET_NAMES.teachers),
    listActiveRecords(SHEET_NAMES.subjects),
    listActiveRecords(SHEET_NAMES.grades),
    listActiveRecords(SHEET_NAMES.gradeSubjects),
    getSheetRecords(SHEET_NAMES.subjectGroups),
    getSheetRecords(SHEET_NAMES.subjectGroupMembers),
    listActiveRecords(SHEET_NAMES.students),
    listActiveRecords(SHEET_NAMES.periods),
    getSheetRecords(SHEET_NAMES.preReports)
  ]);

  return {
    institutions,
    sedes,
    teachers,
    subjects,
    grades,
    gradeSubjects,
    subjectGroups: subjectGroups.filter((item) => !normalizeCell(item.deletedAt)),
    subjectGroupMembers,
    students,
    periods,
    preReports: preReports.filter((item) => item.status !== 'deleted').map(inflatePreReport)
  };
}
