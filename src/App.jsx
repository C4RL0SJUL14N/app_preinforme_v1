import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { apiFetch, getToken, setToken } from './apiClient.js';
import { LoginForm } from './components/LoginForm.jsx';
import { TeacherPanel } from './components/TeacherPanel.jsx';
import { AdminPanelV2 } from './components/AdminPanelV2.jsx';
import { UserManualModule } from './components/UserManualModule.jsx';

const ADMIN_MODULES = [
  { key: 'Institutions', title: 'Institución', description: 'Configurar el nombre institucional.', icon: 'layers', color: 'slate' },
  { key: 'Sedes', title: 'Sedes', description: 'Administrar sedes y su estado operativo.', icon: 'layers', color: 'blue' },
  { key: 'Teachers', title: 'Docentes', description: 'Crear usuarios y permisos.', icon: 'user', color: 'teal' },
  { key: 'Subjects', title: 'Asignaturas', description: 'Configurar materias institucionales.', icon: 'book', color: 'amber' },
  { key: 'Grades', title: 'Grados', description: 'Definir grados y directores de grupo.', icon: 'layers', color: 'blue' },
  { key: 'Students', title: 'Estudiantes', description: 'Registrar estudiantes por grado.', icon: 'group', color: 'green' },
  { key: 'GradeSubjects', title: 'Asignaciones', description: 'Relacionar grado, asignatura y docente.', icon: 'link', color: 'rose' },
  { key: 'Periods', title: 'Períodos', description: 'Abrir y cerrar períodos académicos.', icon: 'calendar', color: 'violet' },
  { key: 'Activity', title: 'Actividad', description: 'Ver qué docentes están usando la aplicación.', icon: 'chart', color: 'teal' },
  { key: 'PreReports', title: 'Preinformes', description: 'Registrar, editar y consultar preinformes.', icon: 'clipboard', color: 'orange' },
  { key: 'Reports', title: 'Reportes', description: 'Consolidado, exportaciones y PDF.', icon: 'chart', color: 'slate' }
];

const TEACHER_MODULES = [
  { key: 'prereports', title: 'Preinformes', description: 'Registrar y editar tus preinformes.', icon: 'clipboard', color: 'orange' },
  {
    key: 'subject-groups',
    title: 'Agrupación de asignaturas',
    description: 'Crear y administrar agrupaciones afines por grado.',
    icon: 'link',
    color: 'blue'
  },
  { key: 'group-reports', title: 'Reportes del grupo', description: 'Consultar e imprimir preinformes del grupo.', icon: 'chart', color: 'slate' },
  {
    key: 'director-observations',
    title: 'Observaciones del director',
    description: 'Registrar y revisar observaciones del director de grupo.',
    icon: 'book',
    color: 'violet'
  },
  {
    key: 'manual',
    title: 'Manual de usuario',
    description: 'Consultar una guía visual para docentes y directores de grupo.',
    icon: 'book',
    color: 'teal'
  }
];

function ModuleIcon({ icon }) {
  const icons = {
    user: (
      <svg viewBox="0 0 24 24" className="module-icon-svg" aria-hidden="true">
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.2 0-7 2.1-7 5v1h14v-1c0-2.9-2.8-5-7-5Z" fill="currentColor" />
      </svg>
    ),
    book: (
      <svg viewBox="0 0 24 24" className="module-icon-svg" aria-hidden="true">
        <path d="M5 4h11a3 3 0 0 1 3 3v11H8a3 3 0 0 0-3 3Zm0 0v17" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    layers: (
      <svg viewBox="0 0 24 24" className="module-icon-svg" aria-hidden="true">
        <path d="m12 4 8 4-8 4-8-4Zm-8 8 8 4 8-4M4 16l8 4 8-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    group: (
      <svg viewBox="0 0 24 24" className="module-icon-svg" aria-hidden="true">
        <path d="M9 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm6 1a2.5 2.5 0 1 0-2.5-2.5A2.5 2.5 0 0 0 15 12ZM4 19c0-2.6 2.8-4.5 5-4.5S14 16.4 14 19m2 0c0-1.8 1.7-3.2 3.8-3.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    link: (
      <svg viewBox="0 0 24 24" className="module-icon-svg" aria-hidden="true">
        <path d="M10 14 8 16a3 3 0 0 1-4-4l3-3a3 3 0 0 1 4 0m3 1 2-2a3 3 0 0 1 4 4l-3 3a3 3 0 0 1-4 0" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    calendar: (
      <svg viewBox="0 0 24 24" className="module-icon-svg" aria-hidden="true">
        <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    clipboard: (
      <svg viewBox="0 0 24 24" className="module-icon-svg" aria-hidden="true">
        <path d="M9 4h6l1 2h3v14H5V6h3Zm1 0a2 2 0 0 1 4 0" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    chart: (
      <svg viewBox="0 0 24 24" className="module-icon-svg" aria-hidden="true">
        <path d="M5 19V9m7 10V5m7 14v-7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  };
  return icons[icon] || icons.chart;
}

function ModuleBoard({ title, subtitle, modules, onChange }) {
  return (
    <Card className="glass-card p-3 mb-4">
      <p className="section-title mb-1">{title}</p>
      <h2 className="h4 mb-3">{subtitle}</h2>
      <Row className="g-3">
        {modules.map((module) => (
          <Col md={6} xl={3} key={module.key}>
            <button
              type="button"
              className={`module-tile module-${module.color} w-100 text-start`}
              onClick={() => onChange(module.key)}
            >
              <div className="module-tile-top">
                <div className="module-icon-wrap">
                  <ModuleIcon icon={module.icon} />
                </div>
                <div className="module-counter">{module.count}</div>
              </div>
              <div className="module-tile-title">{module.title}</div>
              <div className="module-tile-body">{module.description}</div>
            </button>
          </Col>
        ))}
      </Row>
    </Card>
  );
}

function AdminWorkspaceBoard({ session, teachers, selectedTeacherProfileId, setSelectedTeacherProfileId, onChooseAdmin, onChooseOwnTeacher, onChooseAnotherTeacher }) {
  return (
    <>
      <Card className="glass-card page-context-bar p-3 mb-4">
        <p className="section-title mb-1">Acceso administrativo</p>
        <h2 className="h4 mb-2">Elige cómo deseas ingresar</h2>
        <div className="text-muted">
          Puedes entrar al tablero administrativo, usar tu propio perfil docente o actuar temporalmente como otro docente.
        </div>
      </Card>

      <Row className="g-3">
        <Col lg={4}>
          <Card className="glass-card p-3 h-100">
            <div className="section-title mb-2">Administración</div>
            <div className="text-muted mb-3">Accede a la configuración institucional, asignaciones, reportes y mantenimiento general.</div>
            <Button onClick={onChooseAdmin}>Entrar como administrador</Button>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="glass-card p-3 h-100">
            <div className="section-title mb-2">Mi perfil docente</div>
            <div className="text-muted mb-3">
              Usa el sistema exactamente como un docente normal con tus propios grados, asignaturas y reportes.
            </div>
            <Button variant="outline-dark" onClick={onChooseOwnTeacher}>
              Entrar como {session.firstName} {session.lastName}
            </Button>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="glass-card p-3 h-100">
            <div className="section-title mb-2">Otro docente</div>
            <div className="text-muted mb-3">
              Ingresa a las funciones de otro docente. La auditoría conservará tu identidad administrativa.
            </div>
            <Form.Select className="mb-3" value={selectedTeacherProfileId} onChange={(e) => setSelectedTeacherProfileId(e.target.value)}>
              <option value="">Seleccione un docente</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.lastName} {teacher.firstName}
                </option>
              ))}
            </Form.Select>
            <Button variant="outline-primary" disabled={!selectedTeacherProfileId} onClick={() => onChooseAnotherTeacher(selectedTeacherProfileId)}>
              Entrar bajo este perfil
            </Button>
          </Card>
        </Col>
      </Row>
    </>
  );
}

function getTeacherModuleTitle(moduleKey) {
  if (moduleKey === 'subject-groups') return 'Agrupación de asignaturas';
  if (moduleKey === 'group-reports') return 'Reportes del grupo';
  if (moduleKey === 'director-observations') return 'Observaciones del director de grupo';
  if (moduleKey === 'manual') return 'Manual de usuario';
  return 'Módulo de preinformes';
}

export default function App() {
  const [state, setState] = useState({
    loading: Boolean(getToken()),
    data: null,
    error: ''
  });
  const [adminModule, setAdminModule] = useState('');
  const [teacherModule, setTeacherModule] = useState('');
  const [selectedTeacherProfileId, setSelectedTeacherProfileId] = useState('');

  async function loadBootstrap() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await apiFetch('/api/bootstrap');
      setState({ loading: false, data, error: '' });
    } catch (error) {
      setToken('');
      setState({ loading: false, data: null, error: error.message });
    }
  }

  useEffect(() => {
    if (getToken()) loadBootstrap();
  }, []);

  async function handleLogin(credentials) {
    const result = await apiFetch('/api/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    setToken(result.token);
    await loadBootstrap();
  }

  function handleLogout() {
    setToken('');
    setState({ loading: false, data: null, error: '' });
  }

  async function switchSessionView(mode, teacherId = '') {
    const result = await apiFetch('/api/session/view', {
      method: 'POST',
      body: JSON.stringify({ mode, teacherId })
    });
    setToken(result.token);
    setAdminModule('');
    setTeacherModule('');
    await loadBootstrap();
  }

  const visibleTeacherModules = state.data?.session.isDirector
    ? TEACHER_MODULES
    : TEACHER_MODULES.filter((item) => ['prereports', 'subject-groups', 'manual'].includes(item.key));

  const adminModulesWithCounts = state.data?.adminView
    ? ADMIN_MODULES.map((module) => ({
        ...module,
        count: {
          Institutions: state.data.adminView.institutions.length,
          Sedes: state.data.adminView.sedes.length,
          Teachers: state.data.adminView.teachers.length,
          Subjects: state.data.adminView.subjects.length,
          Grades: state.data.adminView.grades.length,
          Students: state.data.adminView.students.length,
          GradeSubjects: state.data.adminView.gradeSubjects.length,
          Periods: state.data.adminView.periods.length,
          Activity: state.data.adminView.teacherUsageSummary?.activeCount || 0,
          PreReports: state.data.adminView.preReports.length,
          Reports: state.data.adminView.preReports.length
        }[module.key] || 0
      }))
    : [];

  useEffect(() => {
    if (!state.data?.session?.userId) return undefined;
    let cancelled = false;

    async function pingSession() {
      try {
        await apiFetch('/api/session/ping', {
          method: 'POST',
          body: JSON.stringify({
            location: 'app',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
          })
        });
      } catch (error) {
        if (!cancelled) {
          console.warn('No fue posible actualizar la actividad de sesión.', error);
        }
      }
    }

    pingSession();
    const intervalId = window.setInterval(pingSession, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [state.data?.session?.userId, state.data?.session?.viewMode, state.data?.session?.actingAsUserId]);

  const teacherModulesWithCounts = visibleTeacherModules.map((module) => ({
    ...module,
    count:
      module.key === 'prereports'
        ? state.data?.teacherView?.preReports?.length || 0
        : module.key === 'subject-groups'
          ? state.data?.teacherView?.subjectGroups?.length || 0
        : module.key === 'director-observations'
          ? state.data?.teacherView?.directedGrades?.length || 0
          : module.key === 'manual'
            ? state.data?.session.isDirector
              ? 7
              : 5
          : state.data?.teacherView?.grades?.length || 0
  }));

  const activeAdminTeachers =
    state.data?.adminView?.teachers?.filter((item) => item.active !== 'FALSE').sort((a, b) => `${a.lastName || ''} ${a.firstName || ''}`.localeCompare(`${b.lastName || ''} ${b.firstName || ''}`, 'es', { sensitivity: 'base' })) || [];

  if (state.loading) {
    return (
      <div className="app-shell d-flex align-items-center justify-content-center">
        <Spinner animation="border" />
      </div>
    );
  }

  if (!state.data) {
    return (
      <div className="app-shell">
        <LoginForm onLogin={handleLogin} error={state.error} />
      </div>
    );
  }

  return (
    <div className="app-shell py-4">
      <Container>
        <Row className="mb-4 align-items-center">
          <Col>
            <h1 className="mb-1">Preinformes</h1>
            <p className="text-muted mb-0">
              {state.data.session.firstName} {state.data.session.lastName}
            </p>
          </Col>
          <Col xs="auto">
            <Button variant="outline-dark" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </Col>
        </Row>

        {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

        {state.data.session.isAdmin ? (
          <>
            {state.data.session.viewMode === 'admin' ? (
              <>
                {!adminModule ? (
                  <Card className="glass-card page-context-bar p-3 mb-4">
                    <p className="section-title mb-1">Modo administrador</p>
                    <h2 className="h4 mb-2">Gestión institucional</h2>
                    <div className="text-muted mb-3">Desde aquí puedes administrar la plataforma o cambiar a un contexto docente cuando lo necesites.</div>
                    <div className="d-flex flex-wrap gap-2">
                      <Button variant="outline-dark" onClick={() => switchSessionView('chooser')}>
                        Cambiar modo de acceso
                      </Button>
                      <Button variant="outline-secondary" onClick={() => switchSessionView('teacher')}>
                        Ir a mi perfil docente
                      </Button>
                    </div>
                  </Card>
                ) : null}
                {!adminModule ? (
                  <ModuleBoard
                    title="Tablero administrativo"
                    subtitle="Accede a cada módulo de configuración y seguimiento."
                    modules={adminModulesWithCounts}
                    onChange={setAdminModule}
                  />
                ) : adminModule === 'PreReports' ? (
                  <TeacherPanel
                    data={state.data.teacherView}
                    onRefresh={loadBootstrap}
                    session={state.data.session}
                    activeModule="prereports"
                    title="Módulo de preinformes"
                    onBack={() => setAdminModule('')}
                  />
                ) : (
                  <AdminPanelV2
                    data={state.data.adminView}
                    onRefresh={loadBootstrap}
                    activeModule={adminModule}
                    onBack={() => setAdminModule('')}
                  />
                )}
              </>
            ) : state.data.session.viewMode === 'teacher' ? (
              <>
                <Card className="glass-card page-context-bar p-3 mb-4">
                  <p className="section-title mb-1">Modo docente</p>
                  <h2 className="h4 mb-2">
                    {state.data.session.isImpersonating
                      ? `Actuando como ${state.data.session.effectiveTeacherName || 'docente'}`
                      : 'Usando tu perfil docente'}
                  </h2>
                  <div className="text-muted">
                    {state.data.session.isImpersonating
                      ? `Administrador: ${state.data.session.firstName} ${state.data.session.lastName}. Toda acción queda auditada con tu identidad.`
                      : 'Estás usando el sistema con el mismo alcance de un docente normal.'}
                  </div>
                  <div className="mt-3 d-flex flex-wrap gap-2">
                    <Button variant="outline-dark" onClick={() => switchSessionView('chooser')}>
                      Cambiar modo de acceso
                    </Button>
                    <Button variant="outline-secondary" onClick={() => switchSessionView('admin')}>
                      Ir al tablero administrativo
                    </Button>
                  </div>
                </Card>
                {!teacherModule ? (
                  <ModuleBoard
                    title="Tablero docente"
                    subtitle="Solo tienes acceso a las funciones habilitadas para el perfil docente activo."
                    modules={teacherModulesWithCounts}
                    onChange={setTeacherModule}
                  />
                ) : teacherModule === 'manual' ? (
                  <UserManualModule
                    isDirector={state.data.session.isDirector}
                    onBack={() => setTeacherModule('')}
                  />
                ) : teacherModule === 'manual' ? (
                  <UserManualModule
                    isDirector={state.data.session.isDirector}
                    onBack={() => setTeacherModule('')}
                  />
                ) : (
                  <TeacherPanel
                    data={state.data.teacherView}
                    onRefresh={loadBootstrap}
                    session={state.data.session}
                    activeModule={teacherModule}
                    title={getTeacherModuleTitle(teacherModule)}
                    onBack={() => setTeacherModule('')}
                  />
                )}
              </>
            ) : (
              <AdminWorkspaceBoard
                session={state.data.session}
                teachers={activeAdminTeachers}
                selectedTeacherProfileId={selectedTeacherProfileId}
                setSelectedTeacherProfileId={setSelectedTeacherProfileId}
                onChooseAdmin={() => switchSessionView('admin')}
                onChooseOwnTeacher={() => switchSessionView('teacher')}
                onChooseAnotherTeacher={(teacherId) => switchSessionView('teacher', teacherId)}
              />
            )}
          </>
        ) : (
          <>
            {!teacherModule ? (
              <ModuleBoard
                title="Tablero docente"
                subtitle="Accede a los módulos docentes habilitados para tu perfil actual."
                modules={teacherModulesWithCounts}
                onChange={setTeacherModule}
              />
            ) : teacherModule === 'manual' ? (
              <UserManualModule
                isDirector={state.data.session.isDirector}
                onBack={() => setTeacherModule('')}
              />
            ) : teacherModule === 'manual' ? (
              <UserManualModule
                isDirector={state.data.session.isDirector}
                onBack={() => setTeacherModule('')}
              />
            ) : (
              <TeacherPanel
                data={state.data.teacherView}
                onRefresh={loadBootstrap}
                session={state.data.session}
                activeModule={teacherModule}
                title={getTeacherModuleTitle(teacherModule)}
                onBack={() => setTeacherModule('')}
              />
            )}
          </>
        )}
      </Container>
    </div>
  );
}
