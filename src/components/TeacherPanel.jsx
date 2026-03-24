import { useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Tab, Tabs } from 'react-bootstrap';
import { apiFetch } from '../apiClient.js';
import { RichTextEditor } from './RichTextEditor.jsx';

const PDF_MODE_OPTIONS = [
  { value: 'all', label: 'Todos los preinformes en un solo PDF' },
  { value: 'grade_single_pdf', label: 'Un solo PDF por grado' },
  { value: 'grade_student_zip', label: 'Un PDF por estudiante en ZIP' },
  { value: 'individual', label: 'Un preinforme individual' }
];

function getPdfDownloadName(mode) {
  if (mode === 'grade_student_zip') return 'preinformes.zip';
  if (mode === 'individual') return 'preinforme-individual.pdf';
  if (mode === 'grade_single_pdf') return 'preinformes-grado.pdf';
  return 'preinformes.pdf';
}

function Checklist({ title, questions, selected, onToggle }) {
  return (
    <Card className="glass-card p-3 mb-3">
      <p className="section-title">{title}</p>
      {questions.map((question) => (
        <Form.Check
          key={question}
          type="switch"
          id={`${title}-${question}`}
          className="mb-2"
          label={question}
          checked={selected.includes(question)}
          onChange={() => onToggle(question)}
        />
      ))}
    </Card>
  );
}

function findOptions(data, gradeId) {
  return data.gradeSubjects
    .filter((item) => item.gradeId === gradeId)
    .map((item) => ({
      ...item,
      subjectName: (() => {
        const subject = data.subjects.find((currentSubject) => currentSubject.id === item.subjectId);
        return subject ? (subject.shortName ? `${subject.name} (${subject.shortName})` : subject.name) : item.subjectId;
      })()
    }));
}

function buildQuestionMeta(data) {
  return [
    ...data.questions.convivencia.map((question, index) => ({
      section: 'convivencia',
      key: `C${index + 1}`,
      label: `C${index + 1}`,
      title: question
    })),
    ...data.questions.academica.map((question, index) => ({
      section: 'academica',
      key: `A${index + 1}`,
      label: `A${index + 1}`,
      title: question
    }))
  ];
}

function createEmptyBulkRow(studentId, observations = '') {
  return {
    studentId,
    convivencia: [],
    academica: [],
    observations
  };
}

function BulkLegend({ data }) {
  return (
    <Row className="g-3 mb-3">
      <Col xl={6}>
        <Card className="glass-card p-3 h-100">
          <div className="section-title mb-2">Convivencia</div>
          <div className="matrix-legend-list">
            {data.questions.convivencia.map((question, index) => (
              <div key={question} className="matrix-legend-item">
                <Badge bg="warning" text="dark">{`C${index + 1}`}</Badge>
                <span>{question}</span>
              </div>
            ))}
          </div>
        </Card>
      </Col>
      <Col xl={6}>
        <Card className="glass-card p-3 h-100">
          <div className="section-title mb-2">Academicas</div>
          <div className="matrix-legend-list">
            {data.questions.academica.map((question, index) => (
              <div key={question} className="matrix-legend-item">
                <Badge bg="info">{`A${index + 1}`}</Badge>
                <span>{question}</span>
              </div>
            ))}
          </div>
        </Card>
      </Col>
    </Row>
  );
}

function BulkMatrix({ students, bulkRows, selectedBulkIds, setSelectedBulkIds, onToggleQuestion, onClearMarks, data }) {
  const questionMeta = buildQuestionMeta(data);
  const allSelected = students.length > 0 && selectedBulkIds.length === students.length;

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Button variant="outline-dark" onClick={() => setSelectedBulkIds(students.map((item) => item.id))}>
          Seleccionar todos
        </Button>
        <Button variant="outline-secondary" onClick={() => setSelectedBulkIds([])}>
          Limpiar seleccion
        </Button>
        <Button variant="outline-danger" onClick={onClearMarks}>
          Limpiar marcas
        </Button>
        <div className="text-muted d-flex align-items-center">
          Si seleccionas varios estudiantes, al marcar una casilla se aplicara a todos los seleccionados.
        </div>
      </div>

      <BulkLegend data={data} />

      <div className="bulk-matrix-wrap">
        <table className="table table-bordered align-middle bulk-matrix-table">
          <thead>
            <tr>
              <th className="bulk-sticky-col bulk-select-col">
                <Form.Check
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setSelectedBulkIds(e.target.checked ? students.map((item) => item.id) : [])}
                />
              </th>
              <th className="bulk-sticky-col bulk-name-col">Estudiante</th>
              {questionMeta.map((question) => (
                <th key={question.key} className={`bulk-question-head bulk-question-head-${question.section}`} title={question.title}>
                  <div>{question.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const row = bulkRows[student.id] || createEmptyBulkRow(student.id);
              const isSelected = selectedBulkIds.includes(student.id);
              return (
                <tr key={student.id} className={isSelected ? 'bulk-row-selected' : ''}>
                  <td className="bulk-sticky-col bulk-select-col">
                    <Form.Check
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) =>
                        setSelectedBulkIds((current) =>
                          e.target.checked ? [...new Set([...current, student.id])] : current.filter((item) => item !== student.id)
                        )
                      }
                    />
                  </td>
                  <td className="bulk-sticky-col bulk-name-col">
                    {student.firstName} {student.lastName}
                  </td>
                  {questionMeta.map((question) => {
                    const checked = (row[question.section] || []).includes(question.title);
                    return (
                      <td key={`${student.id}-${question.key}`} className="bulk-question-cell">
                        <button
                          type="button"
                          className={`bulk-mark-btn ${checked ? 'is-marked' : ''}`}
                          title={question.title}
                          onClick={() => onToggleQuestion(student.id, question.section, question.title)}
                        >
                          {checked ? 'X' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function TeacherPanel({ data, onRefresh, session, activeModule = 'prereports', title, onBack }) {
  const [form, setForm] = useState({
    periodId: '',
    gradeId: '',
    subjectId: '',
    studentId: '',
    convivencia: [],
    academica: [],
    observations: ''
  });
  const [availableStudents, setAvailableStudents] = useState([]);
  const [editableReports, setEditableReports] = useState([]);
  const [selectedEdit, setSelectedEdit] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reportSummary, setReportSummary] = useState(null);
  const [teacherTab, setTeacherTab] = useState('create');
  const [createMode, setCreateMode] = useState('individual');
  const [reportPdfMode, setReportPdfMode] = useState('all');
  const [bulkRows, setBulkRows] = useState({});
  const [selectedBulkIds, setSelectedBulkIds] = useState([]);
  const [groupObservations, setGroupObservations] = useState('');

  const gradeOptions = data.grades;
  const reportGradeOptions = data.directedGrades || [];
  const subjectOptions = useMemo(() => findOptions(data, form.gradeId), [data, form.gradeId]);
  const studentOptions = availableStudents;
  const reportStudentOptions = useMemo(
    () => (form.gradeId ? data.students.filter((student) => student.gradeId === form.gradeId) : []),
    [data.students, form.gradeId]
  );
  const canGenerateGroupPdf =
    reportPdfMode === 'individual'
      ? Boolean(form.studentId)
      : reportPdfMode === 'grade_single_pdf' || reportPdfMode === 'grade_student_zip'
        ? Boolean(form.gradeId)
        : true;

  function resetBulkState(students = []) {
    setSelectedBulkIds([]);
    setGroupObservations('');
    setBulkRows(Object.fromEntries(students.map((student) => [student.id, createEmptyBulkRow(student.id)])));
  }

  function toggleValue(listName, value) {
    setForm((current) => ({
      ...current,
      [listName]: current[listName].includes(value)
        ? current[listName].filter((item) => item !== value)
        : [...current[listName], value]
    }));
  }

  async function loadStudents(next = form, options = {}) {
    if (!next.periodId || !next.gradeId || !next.subjectId) {
      setAvailableStudents([]);
      if (options.resetBulk !== false) resetBulkState([]);
      return [];
    }
    const result = await apiFetch(
      `/api/teacher/students?periodId=${next.periodId}&gradeId=${next.gradeId}&subjectId=${next.subjectId}`
    );
    setAvailableStudents(result.students);
    if (options.initializeBulk) {
      resetBulkState(result.students);
    }
    return result.students;
  }

  async function loadEditable(next = form) {
    if (!next.gradeId || !next.subjectId) return;
    const result = await apiFetch(`/api/teacher/pre-reports?gradeId=${next.gradeId}&subjectId=${next.subjectId}`);
    setEditableReports(result.preReports);
  }

  function updateField(field, value) {
    const next = { ...form, [field]: value };
    if (field === 'periodId') {
      next.studentId = '';
      setAvailableStudents([]);
      resetBulkState([]);
    }
    if (field === 'gradeId') {
      next.subjectId = '';
      next.studentId = '';
      setAvailableStudents([]);
      setEditableReports([]);
      resetBulkState([]);
    }
    if (field === 'subjectId') {
      next.studentId = '';
      setAvailableStudents([]);
      resetBulkState([]);
    }
    setForm(next);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/pre-reports', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setMessage('Preinforme guardado.');
      setForm({
        periodId: form.periodId,
        gradeId: form.gradeId,
        subjectId: form.subjectId,
        studentId: '',
        convivencia: [],
        academica: [],
        observations: ''
      });
      await loadStudents(form);
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleBulkLoad() {
    setError('');
    setMessage('');
    try {
      const students = await loadStudents(form, { initializeBulk: true });
      if (!students.length) {
        setMessage('No hay estudiantes disponibles para crear preinformes en esta asignatura y periodo.');
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleBulkQuestion(targetStudentId, section, question) {
    const targetIds = selectedBulkIds.length ? selectedBulkIds : [targetStudentId];
    const shouldAdd = targetIds.some((studentId) => !(bulkRows[studentId]?.[section] || []).includes(question));

    setBulkRows((current) => {
      const next = { ...current };
      for (const studentId of targetIds) {
        const row = next[studentId] || createEmptyBulkRow(studentId, groupObservations);
        const values = row[section] || [];
        next[studentId] = {
          ...row,
          observations: row.observations || groupObservations,
          [section]: shouldAdd ? [...new Set([...values, question])] : values.filter((item) => item !== question)
        };
      }
      return next;
    });
  }

  function clearBulkMarks() {
    setBulkRows((current) =>
      Object.fromEntries(
        Object.entries(current).map(([studentId, row]) => [
          studentId,
          {
            ...row,
            convivencia: [],
            academica: []
          }
        ])
      )
    );
  }

  async function handleBulkCreate() {
    setError('');
    setMessage('');
    try {
      const rows = availableStudents
        .map((student) => ({
          ...(bulkRows[student.id] || createEmptyBulkRow(student.id)),
          studentId: student.id,
          observations: (bulkRows[student.id]?.observations || groupObservations || '').trim()
        }))
        .filter((row) => row.convivencia.length || row.academica.length || row.observations);

      if (!rows.length) {
        throw new Error('Debes marcar al menos una dificultad o agregar una observacion para uno o varios estudiantes');
      }

      const result = await apiFetch('/api/pre-reports/batch', {
        method: 'POST',
        body: JSON.stringify({
          periodId: form.periodId,
          gradeId: form.gradeId,
          subjectId: form.subjectId,
          rows
        })
      });
      setMessage(`Se guardaron ${result.created} preinformes grupales.`);
      const students = await loadStudents(form, { initializeBulk: true });
      if (!students.length) {
        setMessage(`Se guardaron ${result.created} preinformes grupales. Ya no quedan estudiantes disponibles en esta combinacion.`);
      }
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleEditLoad() {
    setError('');
    setMessage('');
    try {
      await loadEditable();
    } catch (err) {
      setError(err.message);
    }
  }

  async function applyEdit(mode) {
    const report = editableReports.find((item) => item.id === selectedEdit);
    if (!report) return;
    setError('');
    setMessage('');
    try {
      if (mode === 'delete') {
        await apiFetch(`/api/pre-reports/${report.id}`, { method: 'DELETE' });
      } else {
        await apiFetch(`/api/pre-reports/${report.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            convivencia: form.convivencia,
            academica: form.academica,
            observations: form.observations
          })
        });
      }
      setMessage(mode === 'delete' ? 'Preinforme eliminado.' : 'Preinforme actualizado.');
      await loadEditable();
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function loadReportToForm(reportId) {
    setSelectedEdit(reportId);
    const report = editableReports.find((item) => item.id === reportId);
    if (!report) return;
    setForm((current) => ({
      ...current,
      convivencia: report.convivencia || [],
      academica: report.academica || [],
      observations: report.observations || ''
    }));
  }

  async function downloadPdf() {
    try {
      setError('');
      setMessage('');
      const blob = await apiFetch('/api/pdf', {
        method: 'POST',
        body: JSON.stringify({
          periodId: form.periodId,
          gradeId: form.gradeId,
          studentId: reportPdfMode === 'individual' ? form.studentId : '',
          mode: reportPdfMode
        })
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = getPdfDownloadName(reportPdfMode);
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadReportSummary() {
    const query = new URLSearchParams({
      periodId: form.periodId,
      gradeId: form.gradeId,
      teacherId: ''
    }).toString();
    try {
      const result = await apiFetch(`/api/admin/reports/summary?${query}`);
      setReportSummary(result);
    } catch (err) {
      setError(err.message);
    }
  }

  async function downloadCsv() {
    try {
      const response = await fetch('/api/admin/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${window.localStorage.getItem('preinformes-token') || ''}`
        },
        body: JSON.stringify({
          periodId: form.periodId,
          gradeId: form.gradeId,
          teacherId: ''
        })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'No fue posible exportar');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'preinformes-reporte.csv';
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card className="glass-card p-3 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <p className="section-title mb-1">Docencia</p>
          <h2 className="h4 mb-0">{title || 'Modulo docente'}</h2>
        </div>
        {onBack ? (
          <Button variant="outline-dark" onClick={onBack}>
            Volver al tablero
          </Button>
        ) : null}
      </div>
      {activeModule === 'group-reports' ? (
        <div className="pt-2">
          {!reportGradeOptions.length ? <Alert variant="warning">No tienes grados asignados como director de grupo.</Alert> : null}
          <Row>
            <Col md={4} className="mb-3">
              <Form.Label>Periodo</Form.Label>
              <Form.Select value={form.periodId} onChange={(e) => updateField('periodId', e.target.value)}>
                <option value="">Todos</option>
                {data.periods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={4} className="mb-3">
              <Form.Label>Grado</Form.Label>
              <Form.Select value={form.gradeId} onChange={(e) => updateField('gradeId', e.target.value)}>
                <option value="">Todos</option>
                {reportGradeOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={4} className="mb-3">
              <Form.Label>Tipo de PDF</Form.Label>
              <Form.Select
                value={reportPdfMode}
                onChange={(e) => {
                  setReportPdfMode(e.target.value);
                  if (e.target.value !== 'individual') {
                    setForm((current) => ({ ...current, studentId: '' }));
                  }
                }}
              >
                {PDF_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>
          <Row>
            <Col md={4} className="mb-3">
              <Form.Label>Estudiante</Form.Label>
              <Form.Select
                value={form.studentId}
                onChange={(e) => updateField('studentId', e.target.value)}
                disabled={reportPdfMode !== 'individual'}
              >
                <option value="">Seleccione</option>
                {reportStudentOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.firstName} {item.lastName}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>
          <div className="d-flex gap-2 mb-3">
            <Button onClick={downloadPdf} disabled={!reportGradeOptions.length || !canGenerateGroupPdf}>
              Generar PDF
            </Button>
            <Button variant="outline-dark" onClick={downloadCsv} disabled={!reportGradeOptions.length}>
              Exportar CSV
            </Button>
            <Button variant="outline-secondary" onClick={loadReportSummary} disabled={!reportGradeOptions.length}>
              Ver resumen
            </Button>
          </div>
          {reportSummary ? (
            <>
            <Row className="g-3 mb-3">
              <Col md={4}>
                <Card className="glass-card p-3">
                  <div className="section-title">Por grado</div>
                  {reportSummary.byGrade.slice(0, 5).map((item) => (
                    <div key={item.gradeId} className="d-flex justify-content-between">
                      <span>{item.gradeName}</span>
                      <strong>{item.total}</strong>
                    </div>
                  ))}
                </Card>
              </Col>
              <Col md={4}>
                <Card className="glass-card p-3">
                  <div className="section-title">Por asignatura</div>
                  {reportSummary.bySubject.slice(0, 5).map((item) => (
                    <div key={item.subjectId} className="d-flex justify-content-between">
                      <span>{item.subjectName}</span>
                      <strong>{item.total}</strong>
                    </div>
                  ))}
                </Card>
              </Col>
              <Col md={4}>
                <Card className="glass-card p-3">
                  <div className="section-title">Por docente</div>
                  {reportSummary.byTeacher.slice(0, 5).map((item) => (
                    <div key={item.teacherId} className="d-flex justify-content-between">
                      <span>{item.teacherName}</span>
                      <strong>{item.total}</strong>
                    </div>
                  ))}
                </Card>
              </Col>
            </Row>
            <Row className="g-3">
              <Col md={6}>
                <Card className="glass-card p-3 h-100">
                  <div className="section-title">Estudiantes reportados</div>
                  {reportSummary.studentsReported.length ? (
                    reportSummary.studentsReported.map((item) => (
                      <div key={item.studentId} className="d-flex justify-content-between mb-2">
                        <span>{item.gradeName} · {item.studentName}</span>
                        <strong>{item.totalReports}</strong>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted">No hay estudiantes reportados con estos filtros.</div>
                  )}
                </Card>
              </Col>
              <Col md={6}>
                <Card className="glass-card p-3 h-100">
                  <div className="section-title">Estudiantes sin preinformes</div>
                  {reportSummary.studentsPending.length ? (
                    reportSummary.studentsPending.map((item) => (
                      <div key={item.studentId} className="d-flex justify-content-between mb-2">
                        <span>{item.gradeName} · {item.studentName}</span>
                        <strong>Pendiente</strong>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted">Todos los estudiantes visibles tienen al menos un preinforme.</div>
                  )}
                </Card>
              </Col>
            </Row>
            </>
          ) : (
            <p className="text-muted mb-0">Consulta e imprime los preinformes consolidados solo de los grados donde eres director de grupo.</p>
          )}
          {error ? <Alert className="mt-3" variant="danger">{error}</Alert> : null}
        </div>
      ) : (
        <Tabs activeKey={teacherTab} onSelect={(key) => setTeacherTab(key || 'create')}>
          <Tab eventKey="create" title="Crear preinforme">
            <div className="pt-3">
              <div className="d-flex gap-2 mb-3">
                <Button variant={createMode === 'individual' ? 'dark' : 'outline-dark'} onClick={() => setCreateMode('individual')}>
                  Carga individual
                </Button>
                <Button variant={createMode === 'group' ? 'dark' : 'outline-dark'} onClick={() => setCreateMode('group')}>
                  Carga grupal
                </Button>
              </div>

              <Row>
                <Col md={4} className="mb-3">
                  <Form.Label>Periodo</Form.Label>
                  <Form.Select value={form.periodId} onChange={(e) => updateField('periodId', e.target.value)} required>
                    <option value="">Seleccione</option>
                    {data.periods.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4} className="mb-3">
                  <Form.Label>Grado</Form.Label>
                  <Form.Select value={form.gradeId} onChange={(e) => updateField('gradeId', e.target.value)} required>
                    <option value="">Seleccione</option>
                    {gradeOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4} className="mb-3">
                  <Form.Label>Asignatura</Form.Label>
                  <Form.Select value={form.subjectId} onChange={(e) => updateField('subjectId', e.target.value)} required>
                    <option value="">Seleccione</option>
                    {subjectOptions.map((item) => (
                      <option key={item.id} value={item.subjectId}>
                        {item.subjectName}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>

              {createMode === 'individual' ? (
                <Form onSubmit={handleCreate}>
                  <Row>
                    <Col md={6} className="mb-3">
                      <Form.Label>Estudiante</Form.Label>
                      <div className="d-flex gap-2">
                        <Form.Select value={form.studentId} onChange={(e) => updateField('studentId', e.target.value)} required>
                          <option value="">Seleccione</option>
                          {studentOptions.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.firstName} {item.lastName}
                            </option>
                          ))}
                        </Form.Select>
                        <Button
                          type="button"
                          variant="outline-dark"
                          onClick={async () => {
                            try {
                              setError('');
                              await loadStudents(form);
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          Cargar
                        </Button>
                      </div>
                    </Col>
                  </Row>

                  <Checklist
                    title="Convivencia"
                    questions={data.questions.convivencia}
                    selected={form.convivencia}
                    onToggle={(value) => toggleValue('convivencia', value)}
                  />
                  <Checklist
                    title="Academicas"
                    questions={data.questions.academica}
                    selected={form.academica}
                    onToggle={(value) => toggleValue('academica', value)}
                  />

                  <Card className="glass-card p-3 mb-3">
                    <RichTextEditor
                      label="Observaciones"
                      rows={5}
                      value={form.observations}
                      onChange={(nextValue) => updateField('observations', nextValue)}
                    />
                  </Card>

                  {error ? <Alert variant="danger">{error}</Alert> : null}
                  {message ? <Alert variant="success">{message}</Alert> : null}
                  <Button type="submit">Guardar</Button>
                </Form>
              ) : (
                <div>
                  <div className="d-flex gap-2 mb-3">
                    <Button onClick={handleBulkLoad}>Cargar estudiantes</Button>
                    <Button variant="outline-success" onClick={handleBulkCreate} disabled={!availableStudents.length}>
                      Guardar carga grupal
                    </Button>
                  </div>

                  <Card className="glass-card p-3 mb-3">
                    <RichTextEditor
                      label="Observacion grupal opcional"
                      rows={4}
                      value={groupObservations}
                      onChange={setGroupObservations}
                      helperText="Esta observacion se aplicara a los estudiantes que guardes en esta carga grupal."
                    />
                  </Card>

                  {availableStudents.length ? (
                    <BulkMatrix
                      students={availableStudents}
                      bulkRows={bulkRows}
                      selectedBulkIds={selectedBulkIds}
                      setSelectedBulkIds={setSelectedBulkIds}
                      onToggleQuestion={toggleBulkQuestion}
                      onClearMarks={clearBulkMarks}
                      data={data}
                    />
                  ) : (
                    <Card className="glass-card p-3">
                      <div className="text-muted mb-0">
                        Selecciona periodo, grado y asignatura. Luego usa <strong>Cargar estudiantes</strong> para abrir la matriz grupal.
                      </div>
                    </Card>
                  )}

                  {error ? <Alert className="mt-3" variant="danger">{error}</Alert> : null}
                  {message ? <Alert className="mt-3" variant="success">{message}</Alert> : null}
                </div>
              )}
            </div>
          </Tab>

          <Tab eventKey="edit" title="Editar o borrar">
            <div className="pt-3">
              <Row>
                <Col md={4} className="mb-3">
                  <Form.Label>Grado</Form.Label>
                  <Form.Select value={form.gradeId} onChange={(e) => updateField('gradeId', e.target.value)}>
                    <option value="">Seleccione</option>
                    {gradeOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4} className="mb-3">
                  <Form.Label>Asignatura</Form.Label>
                  <Form.Select value={form.subjectId} onChange={(e) => updateField('subjectId', e.target.value)}>
                    <option value="">Seleccione</option>
                    {subjectOptions.map((item) => (
                      <option key={item.id} value={item.subjectId}>
                        {item.subjectName}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4} className="d-flex align-items-end mb-3">
                  <Button onClick={handleEditLoad}>Cargar</Button>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Preinforme</Form.Label>
                <Form.Select value={selectedEdit} onChange={(e) => loadReportToForm(e.target.value)}>
                  <option value="">Seleccione</option>
                  {editableReports.map((item) => {
                    const student = data.students.find((studentItem) => studentItem.id === item.studentId);
                    return (
                      <option key={item.id} value={item.id}>
                        {student?.firstName || ''} {student?.lastName || ''}
                      </option>
                    );
                  })}
                </Form.Select>
              </Form.Group>

              <Checklist
                title="Convivencia"
                questions={data.questions.convivencia}
                selected={form.convivencia}
                onToggle={(value) => toggleValue('convivencia', value)}
              />
              <Checklist
                title="Academicas"
                questions={data.questions.academica}
                selected={form.academica}
                onToggle={(value) => toggleValue('academica', value)}
              />
              <RichTextEditor
                label="Observaciones"
                rows={5}
                value={form.observations}
                onChange={(nextValue) => updateField('observations', nextValue)}
              />

              {error ? <Alert variant="danger">{error}</Alert> : null}
              {message ? <Alert variant="success">{message}</Alert> : null}

              <div className="d-flex gap-2">
                <Button onClick={() => applyEdit('update')} disabled={!selectedEdit}>
                  Guardar cambios
                </Button>
                <Button variant="outline-danger" onClick={() => applyEdit('delete')} disabled={!selectedEdit}>
                  Borrar
                </Button>
              </div>
            </div>
          </Tab>
        </Tabs>
      )}
    </Card>
  );
}
