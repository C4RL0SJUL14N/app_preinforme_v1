import { Button, Card, Col, Form, Row, Table } from 'react-bootstrap';
import { SectionCard } from './shared.jsx';

const PDF_MODE_OPTIONS = [
  { value: 'all', label: 'Todos los preinformes en un solo PDF' },
  { value: 'grade_single_pdf', label: 'Un solo PDF por grado' },
  { value: 'grade_student_zip', label: 'Un PDF por estudiante en ZIP' },
  { value: 'individual', label: 'Un preinforme individual' }
];

function StudentStatusTable({ title, subtitle, rows, countLabel }) {
  return (
    <Card className="glass-card p-3 h-100">
      <div className="mb-3">
        <div className="section-title">{title}</div>
        <div className="text-muted">{subtitle}</div>
      </div>
      <div className="mb-3">
        <strong>{countLabel}: </strong>
        {rows.length}
      </div>
      <Table responsive striped hover>
        <thead>
          <tr>
            <th>Grado</th>
            <th>Estudiante</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.studentId}>
              <td>{row.gradeName}</td>
              <td>{row.studentName}</td>
              <td>{row.totalReports ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

export function ReportsModule({ data, reportFilters, setReportFilters, reportSummary, loadSummary, exportCsv, downloadPdf, isAdmin }) {
  const filteredStudents = reportFilters.gradeId
    ? data.students.filter((student) => student.gradeId === reportFilters.gradeId)
    : data.students;
  const canGeneratePdf =
    reportFilters.mode === 'individual'
      ? Boolean(reportFilters.studentId)
      : reportFilters.mode === 'grade_single_pdf' || reportFilters.mode === 'grade_student_zip'
        ? Boolean(reportFilters.gradeId)
        : true;

  return (
    <div>
      <Row className="g-3 mb-3">
        <Col lg={3}>
          <SectionCard title="Periodo">
            <Form.Select value={reportFilters.periodId} onChange={(e) => setReportFilters((c) => ({ ...c, periodId: e.target.value }))}>
              <option value="">Todos</option>
              {data.periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name}
                </option>
              ))}
            </Form.Select>
          </SectionCard>
        </Col>
        <Col lg={3}>
          <SectionCard title="Grado">
            <Form.Select
              value={reportFilters.gradeId}
              onChange={(e) =>
                setReportFilters((current) => ({
                  ...current,
                  gradeId: e.target.value,
                  studentId: ''
                }))
              }
            >
              <option value="">Todos</option>
              {data.grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </Form.Select>
          </SectionCard>
        </Col>
        <Col lg={3}>
          <SectionCard title="Docente">
            <Form.Select value={reportFilters.teacherId} onChange={(e) => setReportFilters((c) => ({ ...c, teacherId: e.target.value }))}>
              <option value="">Todos</option>
              {data.teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.firstName} {teacher.lastName}
                </option>
              ))}
            </Form.Select>
          </SectionCard>
        </Col>
        <Col lg={3}>
          <SectionCard title="Acciones" subtitle="Consulta, imprime o exporta.">
            <div className="d-grid gap-2">
              <Button onClick={loadSummary}>Cargar resumen</Button>
              <Button variant="outline-dark" onClick={downloadPdf} disabled={!canGeneratePdf}>
                Generar PDF
              </Button>
              <Button variant="outline-secondary" onClick={exportCsv}>
                Exportar CSV
              </Button>
            </div>
          </SectionCard>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={4}>
          <SectionCard title="Tipo de PDF" subtitle="Selecciona como quieres generar los preinformes.">
            <Form.Select
              value={reportFilters.mode}
              onChange={(e) =>
                setReportFilters((current) => ({
                  ...current,
                  mode: e.target.value,
                  studentId: e.target.value === 'individual' ? current.studentId : ''
                }))
              }
            >
              {PDF_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
          </SectionCard>
        </Col>
        <Col lg={4}>
          <SectionCard title="Estudiante" subtitle="Se usa solo para el preinforme individual.">
            <Form.Select
              value={reportFilters.studentId}
              onChange={(e) => setReportFilters((current) => ({ ...current, studentId: e.target.value }))}
              disabled={reportFilters.mode !== 'individual'}
            >
              <option value="">Seleccione</option>
              {filteredStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.firstName} {student.lastName}
                </option>
              ))}
            </Form.Select>
          </SectionCard>
        </Col>
        <Col lg={4}>
          <SectionCard title="Alcance" subtitle="Algunas opciones requieren escoger un grado o estudiante.">
            <div className="text-muted small">
              {reportFilters.mode === 'all' ? 'Se consolidan todos los preinformes visibles con los filtros aplicados.' : null}
              {reportFilters.mode === 'grade_single_pdf' ? 'Debes seleccionar un grado para generar un solo PDF consolidado.' : null}
              {reportFilters.mode === 'grade_student_zip' ? 'Debes seleccionar un grado para descargar un ZIP con un PDF por estudiante.' : null}
              {reportFilters.mode === 'individual' ? 'Debes seleccionar un estudiante para generar un solo preinforme.' : null}
            </div>
          </SectionCard>
        </Col>
      </Row>

      {reportSummary ? (
        <>
          <Row className="g-3 mb-3">
            <Col lg={4}>
              <SectionCard title="Por grado">
                {reportSummary.byGrade.slice(0, 8).map((item) => (
                  <div key={item.gradeId} className="d-flex justify-content-between mb-2">
                    <span>{item.gradeName}</span>
                    <strong>{item.total}</strong>
                  </div>
                ))}
              </SectionCard>
            </Col>
            <Col lg={4}>
              <SectionCard title="Por asignatura">
                {reportSummary.bySubject.slice(0, 8).map((item) => (
                  <div key={item.subjectId} className="d-flex justify-content-between mb-2">
                    <span>{item.subjectName}</span>
                    <strong>{item.total}</strong>
                  </div>
                ))}
              </SectionCard>
            </Col>
            <Col lg={4}>
              <SectionCard title="Por docente">
                {reportSummary.byTeacher.slice(0, 8).map((item) => (
                  <div key={item.teacherId} className="d-flex justify-content-between mb-2">
                    <span>{item.teacherName}</span>
                    <strong>{item.total}</strong>
                  </div>
                ))}
              </SectionCard>
            </Col>
          </Row>

          <Row className="g-3 mb-3">
            <Col lg={6}>
              <StudentStatusTable
                title="Estudiantes reportados"
                subtitle="Tienen al menos un preinforme con los filtros aplicados."
                rows={reportSummary.studentsReported}
                countLabel="Total reportados"
              />
            </Col>
            <Col lg={6}>
              <StudentStatusTable
                title="Estudiantes sin preinformes"
                subtitle="No tienen ningun preinforme con los filtros aplicados."
                rows={reportSummary.studentsPending}
                countLabel="Total pendientes"
              />
            </Col>
          </Row>

          {isAdmin ? (
            <Card className="glass-card p-3 mb-3">
              <div className="mb-3">
                <div className="section-title">Docentes sin preinformes</div>
                <div className="text-muted">Se listan los grados y asignaturas donde aun no registran preinformes.</div>
              </div>
              <Table responsive striped hover>
                <thead>
                  <tr>
                    <th>Docente</th>
                    <th>Grados</th>
                    <th>Asignaturas</th>
                    <th>Asignaciones pendientes</th>
                  </tr>
                </thead>
                <tbody>
                  {reportSummary.teachersWithoutReports.map((row) => (
                    <tr key={row.teacherId}>
                      <td>{row.teacherName}</td>
                      <td>{row.gradeNames.join(', ')}</td>
                      <td>{row.subjectNames.join(', ')}</td>
                      <td>{row.missingAssignments}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : null}

        </>
      ) : (
        <SectionCard title="Resumen institucional" subtitle="Aplica filtros y consulta consolidado, estudiantes reportados y pendientes.">
          <p className="text-muted mb-0">Todavia no has cargado un resumen para este conjunto de filtros.</p>
        </SectionCard>
      )}
    </div>
  );
}
