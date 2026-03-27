export const SHEET_NAMES = {
  institutions: 'Institutions',
  sedes: 'Sedes',
  teachers: 'Teachers',
  subjects: 'Subjects',
  grades: 'Grades',
  gradeSubjects: 'GradeSubjects',
  subjectGroups: 'SubjectGroups',
  subjectGroupMembers: 'SubjectGroupMembers',
  students: 'Students',
  periods: 'Periods',
  preReports: 'PreReports',
  settings: 'Settings',
  locks: 'Locks'
};

export const SHEET_HEADERS = {
  [SHEET_NAMES.institutions]: ['id', 'name'],
  [SHEET_NAMES.sedes]: ['id', 'institutionId', 'name', 'active'],
  [SHEET_NAMES.teachers]: ['id', 'firstName', 'lastName', 'passwordHash', 'isAdmin', 'active'],
  [SHEET_NAMES.subjects]: ['id', 'name', 'active'],
  [SHEET_NAMES.grades]: ['id', 'name', 'educationModel', 'directorTeacherId', 'active'],
  [SHEET_NAMES.gradeSubjects]: ['id', 'gradeId', 'subjectId', 'teacherId', 'active'],
  [SHEET_NAMES.subjectGroups]: [
    'id',
    'gradeId',
    'teacherId',
    'principalSubjectId',
    'name',
    'shortName',
    'printMode',
    'active',
    'createdAt',
    'updatedAt',
    'deletedAt'
  ],
  [SHEET_NAMES.subjectGroupMembers]: ['id', 'subjectGroupId', 'subjectId', 'createdAt'],
  [SHEET_NAMES.students]: ['id', 'firstName', 'lastName', 'gradeId', 'active'],
  [SHEET_NAMES.periods]: ['id', 'name', 'status', 'active'],
  [SHEET_NAMES.preReports]: [
    'id',
    'periodId',
    'gradeId',
    'subjectId',
    'teacherId',
    'studentId',
    'convivenciaJson',
    'academicaJson',
    'observations',
    'status',
    'createdAt',
    'updatedAt',
    'deletedAt'
  ],
  [SHEET_NAMES.settings]: ['key', 'value'],
  [SHEET_NAMES.locks]: ['resource', 'owner', 'acquiredAt', 'expiresAt', 'releasedAt']
};

export const CONVIVENCIA_QUESTIONS = [
  'Utiliza equipos electrónicos en la clase, sin autorización.',
  'Constantemente llega tarde a la clase.',
  'Tiene actitudes de irrespeto hacia los demás.',
  'No porta el uniforme correctamente según el manual.',
  'Se evade de la clase.',
  'Se le dificulta seguir las orientaciones del docente.',
  'Su comportamiento incide en actos de indisciplina.',
  'Utiliza un lenguaje agresivo (tono, gestos, palabras).',
  'Posturas desobligantes ante las actividades grupales e institucionales.',
  'No cuida los enseres ni materiales de la IE.',
  'Constantemente falta al colegio sin excusa.'
];

export const ACADEMICA_QUESTIONS = [
  'Se distrae con facilidad y no presta atención a la clase.',
  'Entrega actividades que no responden a lo planteado.',
  'Las competencias alcanzadas se encuentran en niveles de desempeño bajo y básico.',
  'No emplea adecuadamente el tiempo de la clase.',
  'No se compromete a estudiar para las evaluaciones.',
  'Le hace falta responsabilidad y compromiso con la entrega de evidencias de aprendizaje.',
  'Presenta actividades, pero no las sustenta.',
  'Desinterés y apatía por los procesos escolares.'
];
