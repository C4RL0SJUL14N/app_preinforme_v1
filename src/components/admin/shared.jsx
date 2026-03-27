import { Button, Card } from 'react-bootstrap';

export const MODULE_TITLES = {
  Institutions: 'Módulo de institución',
  Sedes: 'Módulo de sedes',
  Teachers: 'Módulo de docentes',
  Subjects: 'Módulo de asignaturas',
  Grades: 'Módulo de grados',
  Students: 'Módulo de estudiantes',
  GradeSubjects: 'Módulo de asignaciones',
  Periods: 'Módulo de períodos',
  Activity: 'Módulo de actividad',
  Reports: 'Módulo de reportes'
};

export const EMPTY_FORMS = {
  Institutions: { name: '' },
  Sedes: { name: '', active: 'TRUE' },
  Teachers: { id: '', firstName: '', lastName: '', password: '', isAdmin: 'FALSE', active: 'TRUE' },
  Subjects: { name: '', shortName: '', active: 'TRUE' },
  Grades: { name: '', sedeId: '', educationModel: 'EDUCACION_TRADICIONAL', directorTeacherId: '', active: 'TRUE' },
  Students: { firstName: '', lastName: '', gradeId: '', active: 'TRUE' },
  GradeSubjects: { gradeId: '', subjectId: '', teacherId: '', active: 'TRUE' },
  Periods: { name: '', status: 'draft', active: 'TRUE' }
};

export const MODULE_META = {
  Institutions: {
    formTitle: 'Datos de la institución',
    formSubtitle: 'Actualiza el nombre visible de la institución educativa.',
    listTitle: 'Institución configurada',
    listSubtitle: 'Solo se maneja una institución en esta aplicación.'
  },
  Sedes: {
    formTitle: 'Gestión de sede',
    formSubtitle: 'Crea, actualiza, desactiva o elimina sedes sin datos asociados.',
    listTitle: 'Sedes registradas',
    listSubtitle: 'Al desactivar una sede, se desactivan también sus datos dependientes.'
  },
  Teachers: {
    formTitle: 'Formulario docente',
    formSubtitle: 'Crea usuarios, administra permisos y cambia claves.',
    listTitle: 'Listado de docentes',
    listSubtitle: 'Selecciona un docente para editarlo.'
  },
  Subjects: {
    formTitle: 'Nueva asignatura',
    formSubtitle: 'Registra las materias y su nombre corto institucional.',
    listTitle: 'Asignaturas registradas',
    listSubtitle: 'Consulta y edita las materias existentes.'
  },
  Grades: {
    formTitle: 'Configuración del grado',
    formSubtitle: 'Define la sede, el nombre del grado, su modalidad y su director de grupo.',
    listTitle: 'Grados creados',
    listSubtitle: 'Edita directores y estado del grado.'
  },
  Students: {
    formTitle: 'Registro de estudiante',
    formSubtitle: 'Asocia el estudiante a un grado activo.',
    listTitle: 'Estudiantes registrados',
    listSubtitle: 'Consulta los estudiantes y su grado actual.'
  },
  GradeSubjects: {
    formTitle: 'Asignación académica',
    formSubtitle: 'Relaciona grado, asignatura y docente responsable.',
    listTitle: 'Asignaciones vigentes',
    listSubtitle: 'Cada fila representa una carga académica activa.'
  },
  Periods: {
    formTitle: 'Período académico',
    formSubtitle: 'Controla la apertura, el cierre y la vigencia de los períodos.',
    listTitle: 'Períodos definidos',
    listSubtitle: 'Administra el estado operativo de cada período.'
  }
};

export const IMPORT_SCHEMAS = {
  Teachers: {
    fields: ['id', 'firstName', 'lastName', 'password', 'isAdmin', 'active'],
    example: {
      id: 'docente1',
      firstName: 'Ana',
      lastName: 'Pérez',
      password: 'Clave123',
      isAdmin: 'FALSE',
      active: 'TRUE'
    }
  },
  Subjects: {
    fields: ['name', 'shortName', 'active'],
    example: {
      name: 'Matemáticas',
      shortName: 'MATE',
      active: 'TRUE'
    }
  },
  Grades: {
    fields: ['name', 'educationModel', 'directorTeacherId', 'active'],
    example: {
      name: '6-1',
      educationModel: 'EDUCACION_TRADICIONAL',
      directorTeacherId: 'docente1',
      active: 'TRUE'
    }
  },
  Students: {
    fields: ['firstName', 'lastName', 'gradeId', 'active'],
    example: {
      firstName: 'Camila',
      lastName: 'Rojas',
      gradeId: 'grade-generado-o-existente',
      active: 'TRUE'
    }
  },
  GradeSubjects: {
    fields: ['gradeId', 'subjectId', 'teacherId', 'active'],
    example: {
      gradeId: 'grade-generado-o-existente',
      subjectId: 'subject-generado-o-existente',
      teacherId: 'docente1',
      active: 'TRUE'
    }
  },
  Periods: {
    fields: ['name', 'status', 'active'],
    example: {
      name: 'Período 1',
      status: 'open',
      active: 'TRUE'
    }
  }
};

export function freshForm(module) {
  return { ...(EMPTY_FORMS[module] || {}) };
}

export function toBooleanLabel(value) {
  return value === 'TRUE' ? 'Sí' : 'No';
}

export function fullTeacherName(teacher) {
  return `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim();
}

export function SectionCard({ title, subtitle, children, actions }) {
  return (
    <Card className="glass-card p-3 h-100">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <div className="section-title">{title}</div>
          {subtitle ? <div className="text-muted">{subtitle}</div> : null}
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}

export function SaveActions({ onSave, onReset }) {
  return (
    <div className="sticky-action-bar">
      <div className="sticky-action-card d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div className="sticky-action-meta">Las acciones principales permanecen visibles mientras navegas por el formulario.</div>
        <div className="d-flex flex-wrap gap-2">
          <Button onClick={onSave}>Guardar</Button>
          <Button variant="outline-secondary" onClick={onReset}>
            Nuevo
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SaveDeleteActions({ onSave, onReset, onDelete, canDelete }) {
  return (
    <div className="sticky-action-bar">
      <div className="sticky-action-card d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div className="sticky-action-meta">Las acciones principales permanecen visibles mientras navegas por el formulario.</div>
        <div className="d-flex flex-wrap gap-2">
          <Button onClick={onSave}>Guardar</Button>
          <Button variant="outline-secondary" onClick={onReset}>
            Nuevo
          </Button>
          {canDelete ? (
            <Button variant="outline-danger" onClick={onDelete}>
              Eliminar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function getModuleStats(entityName, data) {
  const activeCount = (items) => items.filter((item) => item.active !== 'FALSE').length;
  const inactiveCount = (items) => items.filter((item) => item.active === 'FALSE').length;
  switch (entityName) {
    case 'Institutions':
      return [
        { label: 'Instituciones configuradas', value: data.institutions.length },
        { label: 'Sedes registradas', value: data.sedes.length },
        { label: 'Sedes activas', value: activeCount(data.sedes) }
      ];
    case 'Sedes':
      return [
        { label: 'Sedes activas', value: activeCount(data.sedes) },
        { label: 'Sedes inactivas', value: inactiveCount(data.sedes), tone: 'inactive' },
        { label: 'Grados vinculados', value: new Set(data.grades.map((item) => item.sedeId)).size },
        { label: 'Docentes por sede', value: new Set(data.teachers.map((item) => item.sedeId)).size }
      ];
    case 'Teachers':
      return [
        { label: 'Docentes activos', value: activeCount(data.teachers) },
        { label: 'Docentes inactivos', value: inactiveCount(data.teachers), tone: 'inactive' },
        { label: 'Administradores', value: data.teachers.filter((item) => item.isAdmin === 'TRUE').length },
        { label: 'Total usuarios', value: data.teachers.length }
      ];
    case 'Subjects':
      return [
        { label: 'Asignaturas activas', value: activeCount(data.subjects) },
        { label: 'Asignaturas inactivas', value: inactiveCount(data.subjects), tone: 'inactive' },
        { label: 'Total materias', value: data.subjects.length },
        { label: 'Con asignación', value: new Set(data.gradeSubjects.map((item) => item.subjectId)).size }
      ];
    case 'Grades':
      return [
        { label: 'Grados activos', value: activeCount(data.grades) },
        { label: 'Grados inactivos', value: inactiveCount(data.grades), tone: 'inactive' },
        { label: 'Sedes con grados', value: new Set(data.grades.map((item) => item.sedeId)).size },
        { label: 'Con director', value: data.grades.filter((item) => item.directorTeacherId).length },
        { label: 'Total grados', value: data.grades.length }
      ];
    case 'Students':
      return [
        { label: 'Estudiantes activos', value: activeCount(data.students) },
        { label: 'Estudiantes inactivos', value: inactiveCount(data.students), tone: 'inactive' },
        { label: 'Grados con estudiantes', value: new Set(data.students.map((item) => item.gradeId)).size },
        { label: 'Total estudiantes', value: data.students.length }
      ];
    case 'GradeSubjects':
      return [
        { label: 'Asignaciones activas', value: activeCount(data.gradeSubjects) },
        { label: 'Asignaciones inactivas', value: inactiveCount(data.gradeSubjects), tone: 'inactive' },
        { label: 'Docentes con carga', value: new Set(data.gradeSubjects.map((item) => item.teacherId)).size },
        { label: 'Grados cubiertos', value: new Set(data.gradeSubjects.map((item) => item.gradeId)).size }
      ];
    case 'Periods':
      return [
        { label: 'Períodos activos', value: activeCount(data.periods) },
        { label: 'Períodos inactivos', value: inactiveCount(data.periods), tone: 'inactive' },
        { label: 'Abiertos', value: data.periods.filter((item) => item.status === 'open').length },
        { label: 'Cerrados', value: data.periods.filter((item) => item.status === 'closed').length }
      ];
    case 'Activity':
      return [
        { label: 'Docentes activos ahora', value: data.teacherUsageSummary?.activeCount || 0 },
        { label: 'Docentes registrados', value: data.teachers.length },
        { label: 'Administradores', value: data.teachers.filter((item) => item.isAdmin === 'TRUE').length }
      ];
    default:
      return [];
  }
}

export async function fileToBase64(file) {
  const bytes = await file.arrayBuffer();
  let binary = '';
  const view = new Uint8Array(bytes);
  for (const item of view) binary += String.fromCharCode(item);
  return window.btoa(binary);
}
