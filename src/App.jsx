import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import { apiFetch, getToken, setToken } from './apiClient.js';
import { LoginForm } from './components/LoginForm.jsx';
import { TeacherPanel } from './components/TeacherPanel.jsx';
import { AdminPanelV2 } from './components/AdminPanelV2.jsx';

const ADMIN_MODULES = [
  { key: 'Institutions', title: 'Institucion', description: 'Configurar el nombre institucional.', icon: 'layers', color: 'slate' },
  { key: 'Sedes', title: 'Sedes', description: 'Administrar sedes y su estado operativo.', icon: 'layers', color: 'blue' },
  { key: 'Teachers', title: 'Docentes', description: 'Crear usuarios y permisos.', icon: 'user', color: 'teal' },
  { key: 'Subjects', title: 'Asignaturas', description: 'Configurar materias institucionales.', icon: 'book', color: 'amber' },
  { key: 'Grades', title: 'Grados', description: 'Definir grados y directores de grupo.', icon: 'layers', color: 'blue' },
  { key: 'Students', title: 'Estudiantes', description: 'Registrar estudiantes por grado.', icon: 'group', color: 'green' },
  { key: 'GradeSubjects', title: 'Asignaciones', description: 'Relacionar grado, asignatura y docente.', icon: 'link', color: 'rose' },
  { key: 'Periods', title: 'Periodos', description: 'Abrir y cerrar periodos academicos.', icon: 'calendar', color: 'violet' },
  { key: 'PreReports', title: 'Preinformes', description: 'Registrar, editar y consultar preinformes.', icon: 'clipboard', color: 'orange' },
  { key: 'Reports', title: 'Reportes', description: 'Consolidado, exportaciones y PDF.', icon: 'chart', color: 'slate' }
];

const TEACHER_MODULES = [
  { key: 'prereports', title: 'Preinformes', description: 'Registrar y editar tus preinformes.', icon: 'clipboard', color: 'orange' },
  { key: 'group-reports', title: 'Reportes del grupo', description: 'Consultar e imprimir preinformes del grupo.', icon: 'chart', color: 'slate' }
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

export default function App() {
  const [state, setState] = useState({
    loading: Boolean(getToken()),
    data: null,
    error: ''
  });
  const [adminModule, setAdminModule] = useState('');
  const [teacherModule, setTeacherModule] = useState('');

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

  const visibleTeacherModules =
    state.data && (state.data.session.isDirector || state.data.session.isAdmin)
      ? TEACHER_MODULES
      : TEACHER_MODULES.filter((item) => item.key === 'prereports');

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
          PreReports: state.data.adminView.preReports.length,
          Reports: state.data.adminView.preReports.length
        }[module.key] || 0
      }))
    : [];

  const teacherModulesWithCounts = visibleTeacherModules.map((module) => ({
    ...module,
    count:
      module.key === 'prereports'
        ? state.data?.teacherView?.preReports?.length || 0
        : state.data?.teacherView?.grades?.length || 0
  }));

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
              Cerrar sesion
            </Button>
          </Col>
        </Row>

        {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

        {state.data.adminView ? (
          <>
            {!adminModule ? (
              <ModuleBoard
                title="Tablero administrativo"
                subtitle="Accede a cada modulo de configuracion y seguimiento."
                modules={adminModulesWithCounts}
                onChange={setAdminModule}
              />
            ) : adminModule === 'PreReports' ? (
              <TeacherPanel
                data={state.data.teacherView}
                onRefresh={loadBootstrap}
                session={state.data.session}
                activeModule="prereports"
                title="Modulo de preinformes"
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
        ) : (
          <>
            {!teacherModule ? (
              <ModuleBoard
                title="Tablero docente"
                subtitle="Solo tienes acceso al modulo de preinformes y a los reportes de tu grupo."
                modules={teacherModulesWithCounts}
                onChange={setTeacherModule}
              />
            ) : (
              <TeacherPanel
                data={state.data.teacherView}
                onRefresh={loadBootstrap}
                session={state.data.session}
                activeModule={teacherModule}
                title={teacherModule === 'group-reports' ? 'Reportes del grupo' : 'Modulo de preinformes'}
                onBack={() => setTeacherModule('')}
              />
            )}
          </>
        )}
      </Container>
    </div>
  );
}
