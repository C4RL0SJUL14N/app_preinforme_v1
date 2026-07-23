import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Nav, Row, Table } from 'react-bootstrap';
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

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function SubjectObservationsModule({ data, onRefresh, title, onBack, observationType = 'subject' }) {
  const isDirector = observationType === 'director';
  const directedGrade = data.directedGrades?.[0] || null;
  const [filters, setFilters] = useState({
    periodId: '',
    gradeId: isDirector ? directedGrade?.id || '' : '',
    subjectId: ''
  });
  const [students, setStudents] = useState([]);
  const [observations, setObservations] = useState({});
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [checkedIds, setCheckedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [bulkModal, setBulkModal] = useState({ show: false, scope: 'selected', value: '' });

  const subjectOptions = useMemo(() => subjectOptionsForGrade(data, filters.gradeId), [data, filters.gradeId]);
  const filteredStudents = useMemo(
    () =>
      students.filter((student) =>
        `${student.lastName} ${student.firstName} ${student.studentId}`
          .toLocaleLowerCase('es')
          .includes(search.trim().toLocaleLowerCase('es'))
      ),
    [search, students]
  );
  const ready = Boolean(filters.periodId && filters.gradeId && (isDirector || filters.subjectId));
  const allChecked = Boolean(students.length && checkedIds.length === students.length);
  const selectedStudent = students.find((student) => student.studentId === selectedStudentId) || null;

  useEffect(() => {
    if (isDirector && directedGrade?.id && filters.gradeId !== directedGrade.id) {
      setFilters((current) => ({ ...current, gradeId: directedGrade.id }));
    }
  }, [directedGrade?.id, filters.gradeId, isDirector]);

  const loadStudents = useCallback(
    async (nextFilters) => {
      if (!nextFilters.periodId || !nextFilters.gradeId || (!isDirector && !nextFilters.subjectId)) {
        setStudents([]);
        setObservations({});
        setSelectedStudentId('');
        setCheckedIds([]);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams({
          periodId: nextFilters.periodId,
          gradeId: nextFilters.gradeId,
          ...(isDirector ? {} : { subjectId: nextFilters.subjectId })
        });
        const result = await apiFetch(
          isDirector
            ? `/api/teacher/director-observations?${query}`
            : `/api/teacher/pre-report-workspace?${query}`
        );
        const nextStudents = result.students || [];
        setStudents(nextStudents);
        setObservations(
          Object.fromEntries(
            nextStudents.map((student) => [
              student.studentId,
              isDirector ? student.directorObservations || '' : student.observations || ''
            ])
          )
        );
        setSelectedStudentId((current) =>
          current && nextStudents.some((student) => student.studentId === current)
            ? current
            : nextStudents[0]?.studentId || ''
        );
        setCheckedIds([]);
      } catch (loadError) {
        setStudents([]);
        setObservations({});
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    },
    [isDirector]
  );

  useEffect(() => {
    void loadStudents(filters);
  }, [filters, loadStudents]);

  function updateFilter(field, value) {
    setMessage('');
    setFilters((current) => {
      if (field === 'periodId') return { ...current, periodId: value };
      if (field === 'gradeId') return { ...current, gradeId: value, subjectId: '' };
      return { ...current, subjectId: value };
    });
  }

  async function persist(ids, value, actionLabel) {
    if (!ids.length) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (isDirector) {
        await apiFetch('/api/teacher/director-observations', {
          method: 'POST',
          body: JSON.stringify({
            periodId: filters.periodId,
            gradeId: filters.gradeId,
            mode: 'per_student',
            rows: ids.map((studentId) => ({ studentId, directorObservations: value }))
          })
        });
      } else {
        await apiFetch('/api/teacher/subject-observations', {
          method: 'PUT',
          body: JSON.stringify({
            ...filters,
            rows: ids.map((studentId) => ({ studentId, observations: value }))
          })
        });
      }
      setMessage(actionLabel);
      await onRefresh();
      await loadStudents(filters);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveIndividual() {
    if (!selectedStudentId) return;
    await persist(
      [selectedStudentId],
      observations[selectedStudentId] || '',
      'La observación del estudiante fue guardada.'
    );
  }

  async function deleteFor(ids, scopeLabel) {
    if (!ids.length) return;
    if (!window.confirm(`¿Confirmas que deseas borrar ${scopeLabel}? Esta acción solo elimina las observaciones.`)) return;
    await persist(ids, '', `Se eliminaron las observaciones de ${ids.length} estudiante${ids.length === 1 ? '' : 's'}.`);
  }

  async function applyBulkObservation() {
    const ids = bulkModal.scope === 'all' ? students.map((student) => student.studentId) : checkedIds;
    if (!stripHtml(bulkModal.value)) {
      setError('Escribe la observación que deseas aplicar.');
      return;
    }
    if (
      !window.confirm(
        `La nueva observación reemplazará el texto existente de ${ids.length} estudiante${ids.length === 1 ? '' : 's'}. ¿Deseas continuar?`
      )
    ) {
      return;
    }
    const value = bulkModal.value;
    setBulkModal({ show: false, scope: 'selected', value: '' });
    await persist(ids, value, `Se reemplazó la observación de ${ids.length} estudiante${ids.length === 1 ? '' : 's'}.`);
  }

  const moduleTitle = title || (isDirector ? 'Observaciones del director de grupo' : 'Observaciones por asignatura');

  return (
    <Card className="glass-card p-3 mb-4">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div className="glass-card page-context-bar p-3 flex-grow-1">
          <p className="section-title mb-1">Docencia</p>
          <h2 className="h4 mb-1">{moduleTitle}</h2>
          <div className="text-muted">
            {isDirector
              ? `Grado dirigido: ${directedGrade?.name || 'Sin grado asignado'}`
              : 'Las observaciones de asignatura se administran independientemente de las marcas.'}
          </div>
        </div>
        <Button variant="outline-dark" onClick={onBack}>Volver al tablero</Button>
      </div>

      {!isDirector || directedGrade ? (
        <Row>
          <Col md={isDirector ? 4 : 4} className="mb-3">
            <Form.Label>Período</Form.Label>
            <Form.Select value={filters.periodId} onChange={(event) => updateFilter('periodId', event.target.value)}>
              <option value="">Seleccione</option>
              {data.periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
            </Form.Select>
          </Col>
          {!isDirector ? (
            <>
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
                  {subjectOptions.map((subject) => (
                    <option key={subject.id} value={subject.subjectId}>{subject.name}</option>
                  ))}
                </Form.Select>
              </Col>
            </>
          ) : null}
        </Row>
      ) : (
        <Alert variant="warning">No tienes un grado asignado como director de grupo.</Alert>
      )}

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      {ready ? (
        <>
          <div className="sticky-action-bar">
            <div className="sticky-action-card d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
              <div className="sticky-action-meta">
                {checkedIds.length
                  ? `${checkedIds.length} estudiantes seleccionados. Las acciones múltiples se habilitan desde 2 estudiantes.`
                  : 'Selecciona estudiantes o abre uno para editar su observación individual.'}
              </div>
              <div className="d-flex flex-wrap gap-2">
                <Button
                  variant="outline-primary"
                  disabled={checkedIds.length < 2}
                  onClick={() => setBulkModal({ show: true, scope: 'selected', value: '' })}
                >
                  Agregar a seleccionados
                </Button>
                <Button
                  variant="outline-danger"
                  disabled={checkedIds.length < 2 || saving}
                  onClick={() => deleteFor(checkedIds, `las observaciones de ${checkedIds.length} estudiantes`)}
                >
                  Borrar seleccionados
                </Button>
                <Button
                  variant="primary"
                  disabled={!students.length}
                  onClick={() => setBulkModal({ show: true, scope: 'all', value: '' })}
                >
                  Agregar observación a todos
                </Button>
                <Button
                  variant="danger"
                  disabled={!students.length || saving}
                  onClick={() => deleteFor(students.map((student) => student.studentId), 'todas las observaciones')}
                >
                  Borrar todas
                </Button>
              </div>
            </div>
          </div>

          <Form.Control
            className="mb-3"
            value={search}
            placeholder="Buscar por apellidos, nombres o documento"
            onChange={(event) => setSearch(event.target.value)}
          />

          {loading ? (
            <Card className="glass-card p-3"><div className="text-muted">Cargando estudiantes…</div></Card>
          ) : students.length ? (
            <>
              <div className="table-responsive">
                <Table hover align="middle" className="observation-student-table">
                  <thead>
                    <tr>
                      <th>
                        <Form.Check
                          aria-label="Seleccionar todos"
                          checked={allChecked}
                          onChange={() => setCheckedIds(allChecked ? [] : students.map((student) => student.studentId))}
                        />
                      </th>
                      <th>#</th>
                      <th>Apellidos</th>
                      <th>Nombres</th>
                      <th>Observación</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student, index) => {
                      const preview = stripHtml(observations[student.studentId]);
                      return (
                        <tr
                          key={student.studentId}
                          className={student.studentId === selectedStudentId ? 'table-active' : ''}
                          onClick={() => setSelectedStudentId(student.studentId)}
                        >
                          <td onClick={(event) => event.stopPropagation()}>
                            <Form.Check
                              aria-label={`Seleccionar ${student.firstName} ${student.lastName}`}
                              checked={checkedIds.includes(student.studentId)}
                              onChange={() =>
                                setCheckedIds((current) =>
                                  current.includes(student.studentId)
                                    ? current.filter((id) => id !== student.studentId)
                                    : [...current, student.studentId]
                                )
                              }
                            />
                          </td>
                          <td>{index + 1}</td>
                          <td>{student.lastName}</td>
                          <td>{student.firstName}</td>
                          <td>
                            {preview ? <span>{preview.slice(0, 90)}{preview.length > 90 ? '…' : ''}</span> : <Badge bg="secondary">Sin observación</Badge>}
                          </td>
                          <td><Button size="sm" variant="outline-dark">Abrir</Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              {selectedStudent ? (
                <Card className="glass-card observation-editor-panel mt-3">
                  <Nav variant="tabs" className="px-3 pt-3">
                    <Nav.Item>
                      <Nav.Link active>
                        Observación · {selectedStudent.lastName} {selectedStudent.firstName}
                      </Nav.Link>
                    </Nav.Item>
                  </Nav>
                  <Card.Body>
                    <RichTextEditor
                      label={isDirector ? 'Observación del director de grupo' : 'Observación de la asignatura'}
                      rows={8}
                      value={observations[selectedStudent.studentId] || ''}
                      onChange={(value) =>
                        setObservations((current) => ({ ...current, [selectedStudent.studentId]: value }))
                      }
                      helperText="Puedes aplicar negrita, cursiva, subrayado y colores al texto."
                    />
                    <div className="d-flex flex-wrap justify-content-end gap-2">
                      <Button
                        variant="outline-danger"
                        disabled={saving || !stripHtml(observations[selectedStudent.studentId])}
                        onClick={() => deleteFor([selectedStudent.studentId], 'la observación de este estudiante')}
                      >
                        Borrar
                      </Button>
                      <Button disabled={saving} onClick={saveIndividual}>
                        {saving ? 'Guardando…' : 'Guardar'}
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              ) : null}
            </>
          ) : (
            <Alert variant="warning">No hay estudiantes activos para mostrar.</Alert>
          )}
        </>
      ) : (
        <Card className="glass-card p-3">
          <div className="text-muted">
            {isDirector ? 'Selecciona el período para cargar automáticamente el grupo.' : 'Selecciona período, grado y asignatura.'}
          </div>
        </Card>
      )}

      <Modal show={bulkModal.show} onHide={() => setBulkModal({ show: false, scope: 'selected', value: '' })} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {bulkModal.scope === 'all' ? 'Observación para todo el grupo' : `Observación para ${checkedIds.length} estudiantes`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            Al confirmar, esta observación reemplazará cualquier texto existente de los estudiantes incluidos.
          </Alert>
          <RichTextEditor
            label="Nueva observación"
            rows={7}
            value={bulkModal.value}
            onChange={(value) => setBulkModal((current) => ({ ...current, value }))}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setBulkModal({ show: false, scope: 'selected', value: '' })}>
            Cancelar
          </Button>
          <Button disabled={saving || !stripHtml(bulkModal.value)} onClick={applyBulkObservation}>
            Reemplazar observaciones
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}
