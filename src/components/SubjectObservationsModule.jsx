import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, ListGroup, Row } from 'react-bootstrap';
import { apiFetch } from '../apiClient.js';
import { RichTextEditor } from './RichTextEditor.jsx';

function subjectOptionsForGrade(data, gradeId) {
  const activeGroups = (data.subjectGroups || []).filter((group) => group.gradeId === gradeId && group.active !== 'FALSE');
  const groupedSubjectIds = new Set(
    activeGroups.flatMap((group) =>
      (data.subjectGroupMembers || [])
        .filter((member) => member.subjectGroupId === group.id)
        .map((member) => member.subjectId)
    )
  );
  const regular = data.gradeSubjects
    .filter((assignment) => assignment.gradeId === gradeId && assignment.active !== 'FALSE')
    .filter((assignment) => !groupedSubjectIds.has(assignment.subjectId))
    .map((assignment) => {
      const subject = data.subjects.find((item) => item.id === assignment.subjectId);
      return {
        id: assignment.id,
        subjectId: assignment.subjectId,
        name: subject?.shortName ? `${subject.name} (${subject.shortName})` : subject?.name || assignment.subjectId
      };
    });
  const grouped = activeGroups.map((group) => ({
    id: group.id,
    subjectId: group.principalSubjectId,
    name: group.name
  }));
  return [...regular, ...grouped].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

export function SubjectObservationsModule({ data, onRefresh, title, onBack }) {
  const [filters, setFilters] = useState({ periodId: '', gradeId: '', subjectId: '' });
  const [students, setStudents] = useState([]);
  const [observations, setObservations] = useState({});
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [search, setSearch] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const subjectOptions = useMemo(() => subjectOptionsForGrade(data, filters.gradeId), [data, filters.gradeId]);
  const filteredStudents = useMemo(
    () =>
      students.filter((student) =>
        `${student.lastName} ${student.firstName} ${student.studentId}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))
      ),
    [search, students]
  );
  const ready = Boolean(filters.periodId && filters.gradeId && filters.subjectId);

  useEffect(() => {
    if (!ready) {
      setStudents([]);
      setObservations({});
      setSelectedStudentId('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    setMessage('');
    const query = new URLSearchParams(filters);
    apiFetch(`/api/teacher/pre-report-workspace?${query}`)
      .then((result) => {
        if (cancelled) return;
        const nextStudents = result.students || [];
        setStudents(nextStudents);
        setObservations(Object.fromEntries(nextStudents.map((student) => [student.studentId, student.observations || ''])));
        setSelectedStudentId(nextStudents[0]?.studentId || '');
        setDirty(false);
        setMessage(`Se cargaron ${nextStudents.length} estudiantes.`);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters.gradeId, filters.periodId, filters.subjectId, ready]);

  function updateFilter(field, value) {
    setFilters((current) => {
      if (field === 'periodId') return { periodId: value, gradeId: '', subjectId: '' };
      if (field === 'gradeId') return { ...current, gradeId: value, subjectId: '' };
      return { ...current, subjectId: value };
    });
  }

  async function saveObservations() {
    setSaving(true);
    setError('');
    try {
      await apiFetch('/api/teacher/subject-observations', {
        method: 'PUT',
        body: JSON.stringify({
          ...filters,
          rows: students.map((student) => ({
            studentId: student.studentId,
            observations: observations[student.studentId] || ''
          }))
        })
      });
      setDirty(false);
      setMessage('Observaciones por asignatura guardadas.');
      await onRefresh();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="glass-card p-3 mb-4">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div className="glass-card page-context-bar p-3 flex-grow-1">
          <p className="section-title mb-1">Docencia</p>
          <h2 className="h4 mb-1">{title || 'Observaciones por asignatura'}</h2>
          <div className="text-muted">Este módulo modifica únicamente la observación de la asignatura.</div>
        </div>
        <Button variant="outline-dark" onClick={onBack}>Volver al tablero</Button>
      </div>

      <Row>
        <Col md={4} className="mb-3">
          <Form.Label>Período</Form.Label>
          <Form.Select value={filters.periodId} onChange={(event) => updateFilter('periodId', event.target.value)}>
            <option value="">Seleccione</option>
            {data.periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
          </Form.Select>
        </Col>
        <Col md={4} className="mb-3">
          <Form.Label>Grado</Form.Label>
          <Form.Select value={filters.gradeId} onChange={(event) => updateFilter('gradeId', event.target.value)}>
            <option value="">Seleccione</option>
            {data.grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
          </Form.Select>
        </Col>
        <Col md={4} className="mb-3">
          <Form.Label>Asignatura</Form.Label>
          <Form.Select value={filters.subjectId} onChange={(event) => updateFilter('subjectId', event.target.value)}>
            <option value="">Seleccione</option>
            {subjectOptions.map((subject) => <option key={subject.id} value={subject.subjectId}>{subject.name}</option>)}
          </Form.Select>
        </Col>
      </Row>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}
      {!ready ? (
        <Card className="glass-card p-3"><div className="text-muted">Selecciona período, grado y asignatura.</div></Card>
      ) : loading ? (
        <Card className="glass-card p-3"><div className="text-muted">Cargando observaciones…</div></Card>
      ) : students.length ? (
        <Row className="g-3">
          <Col lg={4}>
            <Form.Control
              className="mb-2"
              value={search}
              placeholder="Buscar estudiante"
              onChange={(event) => setSearch(event.target.value)}
            />
            <ListGroup className="subject-observation-student-list">
              {filteredStudents.map((student, index) => (
                <ListGroup.Item
                  key={student.studentId}
                  action
                  active={student.studentId === selectedStudentId}
                  onClick={() => setSelectedStudentId(student.studentId)}
                >
                  {index + 1}. {student.lastName} {student.firstName}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Col>
          <Col lg={8}>
            {selectedStudentId ? (
              <Card className="glass-card p-3">
                <RichTextEditor
                  label="Observación de la asignatura"
                  rows={8}
                  value={observations[selectedStudentId] || ''}
                  onChange={(value) => {
                    setObservations((current) => ({ ...current, [selectedStudentId]: value }));
                    setDirty(true);
                  }}
                  helperText="Dejar el campo vacío y guardar elimina únicamente esta observación."
                />
              </Card>
            ) : null}
          </Col>
        </Row>
      ) : (
        <Alert variant="warning">No hay estudiantes activos en el grado seleccionado.</Alert>
      )}

      <div className="sticky-action-bar">
        <div className="sticky-action-card d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3">
          <div className="sticky-action-meta">{dirty ? 'Hay cambios pendientes.' : 'Sin cambios pendientes.'}</div>
          <Button disabled={!dirty || saving || !students.length} onClick={saveObservations}>
            {saving ? 'Guardando…' : 'Guardar observaciones'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
