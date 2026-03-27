import { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Table } from 'react-bootstrap';
import { apiFetch } from '../apiClient.js';

const PRINT_MODE_OPTIONS = [
  { value: 'NAME', label: 'Nombre' },
  { value: 'SHORT_NAME', label: 'Nombre corto' },
  { value: 'NAME_WITH_ASSOCIATED_SHORT', label: 'Nombre + asignaturas asociadas' },
  { value: 'SHORT_NAME_WITH_ASSOCIATED_SHORT', label: 'Nombre corto + asignaturas asociadas' }
];

function compareByName(a, b) {
  return String(a?.name || '').localeCompare(String(b?.name || ''), 'es', { sensitivity: 'base' });
}

function buildAssociatedLabel(subjects, members) {
  return members
    .map((member) => subjects.find((subject) => subject.id === member.subjectId))
    .filter(Boolean)
    .sort(compareByName)
    .map((subject) => subject.shortName || subject.name)
    .join(', ');
}

function createEmptyForm() {
  return {
    gradeId: '',
    name: '',
    shortName: '',
    principalSubjectId: '',
    subjectIds: [],
    printMode: 'NAME',
    active: 'TRUE'
  };
}

export function TeacherSubjectGroupsModule({ data, onRefresh, onBack }) {
  const [form, setForm] = useState(createEmptyForm());
  const [editingId, setEditingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const groups = useMemo(
    () =>
      [...(data.subjectGroups || [])]
        .sort((a, b) => {
          const gradeA = data.grades.find((item) => item.id === a.gradeId);
          const gradeB = data.grades.find((item) => item.id === b.gradeId);
          return (
            String(gradeA?.name || '').localeCompare(String(gradeB?.name || ''), 'es', { sensitivity: 'base' }) ||
            String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' })
          );
        }),
    [data.grades, data.subjectGroups]
  );

  const assignedSubjects = useMemo(
    () =>
      (data.gradeSubjects || [])
        .filter((item) => item.gradeId === form.gradeId && item.active !== 'FALSE')
        .map((item) => data.subjects.find((subject) => subject.id === item.subjectId))
        .filter(Boolean)
        .sort(compareByName),
    [data.gradeSubjects, data.subjects, form.gradeId]
  );

  const selectedSubjects = useMemo(
    () => assignedSubjects.filter((subject) => form.subjectIds.includes(subject.id)),
    [assignedSubjects, form.subjectIds]
  );

  function resetForm(nextGradeId = '') {
    setForm({ ...createEmptyForm(), gradeId: nextGradeId });
    setEditingId('');
  }

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'gradeId') {
        next.subjectIds = [];
        next.principalSubjectId = '';
      }
      if (field === 'principalSubjectId' && value && !current.subjectIds.includes(value)) {
        next.subjectIds = [...current.subjectIds, value];
      }
      return next;
    });
  }

  function toggleSubject(subjectId) {
    setForm((current) => {
      const exists = current.subjectIds.includes(subjectId);
      const nextSubjectIds = exists ? current.subjectIds.filter((item) => item !== subjectId) : [...current.subjectIds, subjectId];
      return {
        ...current,
        subjectIds: nextSubjectIds,
        principalSubjectId: current.principalSubjectId === subjectId && exists ? '' : current.principalSubjectId
      };
    });
  }

  function loadGroup(group) {
    const members = (data.subjectGroupMembers || []).filter((item) => item.subjectGroupId === group.id);
    setEditingId(group.id);
    setForm({
      gradeId: group.gradeId,
      name: group.name,
      shortName: group.shortName,
      principalSubjectId: group.principalSubjectId,
      subjectIds: members.map((item) => item.subjectId),
      printMode: group.printMode || 'NAME',
      active: group.active || 'TRUE'
    });
    setMessage('');
    setError('');
  }

  async function saveGroup(event) {
    event.preventDefault();
    try {
      setError('');
      setMessage('');
      const result = await apiFetch('/api/teacher/subject-groups', {
        method: 'POST',
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form)
      });
      setMessage(`Agrupación guardada: ${result.group.name}`);
      resetForm(form.gradeId);
      await onRefresh();
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function removeGroup() {
    if (!editingId) return;
    const confirmed = window.confirm('Se eliminará esta agrupación de asignaturas. ¿Deseas continuar?');
    if (!confirmed) return;
    try {
      setError('');
      setMessage('');
      await apiFetch(`/api/teacher/subject-groups/${editingId}`, { method: 'DELETE' });
      setMessage('Agrupación eliminada correctamente');
      resetForm(form.gradeId);
      await onRefresh();
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  return (
    <Card className="glass-card p-3">
      <div className="page-context-bar p-3 mb-3 rounded-4">
        <p className="section-title mb-1">Módulo docente</p>
        <h2 className="h4 mb-2">Agrupación de asignaturas</h2>
        <div className="text-muted">
          Crea agrupaciones afines por grado. El preinforme se guardará en la asignatura principal y la agrupación aparecerá como opción dentro del módulo de preinformes.
        </div>
        {onBack ? (
          <div className="mt-3">
            <Button variant="outline-dark" onClick={onBack}>
              Volver al tablero
            </Button>
          </div>
        ) : null}
      </div>

      <Row className="g-3">
        <Col xl={7}>
          <Card className="glass-card p-3 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <div className="section-title">Agrupaciones creadas</div>
                <div className="text-muted">Selecciona una fila para editarla o crea una nueva agrupación.</div>
              </div>
              <Button variant="outline-secondary" onClick={() => resetForm(form.gradeId)}>
                Nuevo
              </Button>
            </div>

            <div className="table-responsive">
              <Table hover bordered align-middle>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Grado</th>
                    <th>Nombre</th>
                    <th>Nombre corto</th>
                    <th>Activa</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {groups.length ? (
                    groups.map((group) => {
                      const grade = data.grades.find((item) => item.id === group.gradeId);
                      return (
                        <tr key={group.id}>
                          <td>{group.id}</td>
                          <td>{grade?.name || group.gradeId}</td>
                          <td>{group.name}</td>
                          <td>{group.shortName}</td>
                          <td>{group.active === 'FALSE' ? 'No' : 'Sí'}</td>
                          <td className="text-end">
                            <Button size="sm" variant="outline-primary" onClick={() => loadGroup(group)}>
                              Editar
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-muted text-center">
                        Aún no hay agrupaciones registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>

        <Col xl={5}>
          <Form onSubmit={saveGroup}>
            <Card className="glass-card p-3 h-100">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <div className="section-title">{editingId ? 'Editar agrupación' : 'Crear agrupación'}</div>
                  <div className="text-muted">Completa los campos y elige las asignaturas asociadas.</div>
                </div>
                {editingId ? (
                  <Button variant="outline-danger" onClick={removeGroup}>
                    Eliminar
                  </Button>
                ) : null}
              </div>

              <Row className="g-3">
                <Col md={12}>
                  <Form.Label>ID</Form.Label>
                  <Form.Control value={editingId || 'Se generará automáticamente al guardar'} readOnly />
                  <Form.Text className="text-muted">
                    El sistema asigna este identificador automáticamente cuando se crea una nueva agrupación.
                  </Form.Text>
                </Col>
                <Col md={6}>
                  <Form.Label>Activa</Form.Label>
                  <Form.Select value={form.active} onChange={(e) => updateField('active', e.target.value)}>
                    <option value="TRUE">Sí</option>
                    <option value="FALSE">No</option>
                  </Form.Select>
                </Col>
                <Col md={6}>
                  <Form.Label>Grado</Form.Label>
                  <Form.Select value={form.gradeId} onChange={(e) => updateField('gradeId', e.target.value)} required>
                    <option value="">Seleccione</option>
                    {data.grades.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={12}>
                  <Form.Label>Nombre</Form.Label>
                  <Form.Control value={form.name} onChange={(e) => updateField('name', e.target.value)} required />
                </Col>
                <Col md={12}>
                  <Form.Label>Nombre corto</Form.Label>
                  <Form.Control value={form.shortName} onChange={(e) => updateField('shortName', e.target.value)} required />
                </Col>
                <Col md={12}>
                  <Form.Label>Imprimir</Form.Label>
                  <Form.Select value={form.printMode} onChange={(e) => updateField('printMode', e.target.value)}>
                    {PRINT_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={12}>
                  <Form.Label>Asignaturas para agrupar</Form.Label>
                  <Card className="glass-card p-2">
                    {assignedSubjects.length ? (
                      assignedSubjects.map((subject) => (
                        <Form.Check
                          key={subject.id}
                          className="mb-2"
                          type="checkbox"
                          id={`subject-group-member-${subject.id}`}
                          label={subject.shortName ? `${subject.name} (${subject.shortName})` : subject.name}
                          checked={form.subjectIds.includes(subject.id)}
                          onChange={() => toggleSubject(subject.id)}
                        />
                      ))
                    ) : (
                      <div className="text-muted">Selecciona un grado para ver tus asignaturas disponibles.</div>
                    )}
                  </Card>
                </Col>
                <Col md={12}>
                  <Form.Label>Asignatura principal</Form.Label>
                  <Form.Select
                    value={form.principalSubjectId}
                    onChange={(e) => updateField('principalSubjectId', e.target.value)}
                    required
                    disabled={!selectedSubjects.length}
                  >
                    <option value="">Seleccione</option>
                    {selectedSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.shortName ? `${subject.name} (${subject.shortName})` : subject.name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>

              <Card className="glass-card p-3 mt-3">
                <div className="section-title mb-2">Vista previa de impresión</div>
                <div><strong>Nombre:</strong> {form.name || 'Sin definir'}</div>
                <div><strong>Nombre corto:</strong> {form.shortName || 'Sin definir'}</div>
                <div><strong>Asignaturas asociadas:</strong> {buildAssociatedLabel(data.subjects, form.subjectIds.map((subjectId) => ({ subjectId }))) || 'Sin definir'}</div>
              </Card>

              {error ? <Alert className="mt-3" variant="danger">{error}</Alert> : null}
              {message ? <Alert className="mt-3" variant="success">{message}</Alert> : null}

              <div className="sticky-action-bar">
                <div className="sticky-action-card d-flex flex-wrap justify-content-between align-items-center gap-3">
                  <div className="sticky-action-meta">
                    La agrupación activa aparecerá como una sola opción dentro del selector de asignaturas del preinforme.
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <Button variant="outline-secondary" type="button" onClick={() => resetForm(form.gradeId)}>
                      Limpiar
                    </Button>
                    <Button type="submit">{editingId ? 'Guardar cambios' : 'Crear agrupación'}</Button>
                  </div>
                </div>
              </div>
            </Card>
          </Form>
        </Col>
      </Row>
    </Card>
  );
}
