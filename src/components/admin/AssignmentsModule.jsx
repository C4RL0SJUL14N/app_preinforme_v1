import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Row } from 'react-bootstrap';
import { EntityModule } from './EntityModule.jsx';
import { freshForm } from './shared.jsx';

const fields = [
  { name: 'gradeId', label: 'Grado', type: 'select', optionsKey: 'grades' },
  { name: 'subjectId', label: 'Asignatura', type: 'select', optionsKey: 'subjects' },
  { name: 'teacherId', label: 'Docente', type: 'select', optionsKey: 'teachers' },
  { name: 'active', label: 'Activo', type: 'boolean' }
];

const columns = [
  { key: 'gradeId', label: 'Grado' },
  { key: 'subjectId', label: 'Asignatura' },
  { key: 'teacherId', label: 'Docente' },
  { key: 'active', label: 'Activo' }
];

export function AssignmentsModule(props) {
  const [selectedSedeId, setSelectedSedeId] = useState('');
  const [selectedListGradeId, setSelectedListGradeId] = useState('');
  const [selectedTeacherFilterId, setSelectedTeacherFilterId] = useState('');
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState([]);
  const [bulkTeacherId, setBulkTeacherId] = useState('');
  const [copySourceGradeId, setCopySourceGradeId] = useState('');
  const [copyTargetGradeId, setCopyTargetGradeId] = useState('');
  const selectedGradeId = props.formState.gradeId || '';
  const currentAssignment = props.data.gradeSubjects.find((item) => item.id === props.editingId);
  const currentPair =
    currentAssignment && currentAssignment.gradeId === selectedGradeId
      ? `${currentAssignment.gradeId}::${currentAssignment.subjectId}`
      : '';

  const usedPairs = new Set(
    props.data.gradeSubjects
      .filter((item) => item.active !== 'FALSE')
      .filter((item) => item.gradeId === selectedGradeId)
      .filter((item) => `${item.gradeId}::${item.subjectId}` !== currentPair)
      .map((item) => `${item.gradeId}::${item.subjectId}`)
  );

  const subjectOptions = props.data.subjects
    .filter((item) => item.active !== 'FALSE')
    .filter((item) => {
      if (!selectedGradeId) return true;
      return !usedPairs.has(`${selectedGradeId}::${item.id}`);
    })
    .map((item) => ({ value: item.id, label: item.shortName ? `${item.name} (${item.shortName})` : item.name }));

  const activeGrades = props.data.grades.filter((item) => item.active !== 'FALSE');
  const filteredGradeOptions = activeGrades
    .filter((item) => !selectedSedeId || item.sedeId === selectedSedeId)
    .map((item) => ({ value: item.id, label: item.name }));

  const teacherOptions = props.data.teachers
    .filter((item) => item.active !== 'FALSE')
    .map((item) => ({ value: item.id, label: `${item.firstName} ${item.lastName}`.trim() }));

  const filteredRows = useMemo(
    () =>
      props.data.gradeSubjects.filter((item) => {
        const grade = props.data.grades.find((current) => current.id === item.gradeId);
        if (selectedSedeId && grade?.sedeId !== selectedSedeId) return false;
        if (selectedListGradeId && item.gradeId !== selectedListGradeId) return false;
        if (selectedTeacherFilterId && item.teacherId !== selectedTeacherFilterId) return false;
        return true;
      }),
    [props.data.gradeSubjects, props.data.grades, selectedSedeId, selectedListGradeId, selectedTeacherFilterId]
  );

  useEffect(() => {
    setSelectedAssignmentIds((current) => current.filter((id) => filteredRows.some((row) => row.id === id)));
  }, [filteredRows]);

  const listControls = (
    <Row className="g-3">
      <Col md={4}>
        <Form.Label>Sede</Form.Label>
        <Form.Select
          value={selectedSedeId}
          onChange={(e) => {
            setSelectedSedeId(e.target.value);
            setSelectedListGradeId('');
          }}
        >
          <option value="">Todas las sedes</option>
          {props.data.sedes
            .filter((item) => item.active !== 'FALSE')
            .map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
        </Form.Select>
      </Col>
      <Col md={4}>
        <Form.Label>Grado</Form.Label>
        <Form.Select value={selectedListGradeId} onChange={(e) => setSelectedListGradeId(e.target.value)}>
          <option value="">Todos los grados</option>
          {filteredGradeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Form.Select>
      </Col>
      <Col md={4}>
        <Form.Label>Docente</Form.Label>
        <Form.Select value={selectedTeacherFilterId} onChange={(e) => setSelectedTeacherFilterId(e.target.value)}>
          <option value="">Todos los docentes</option>
          {teacherOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Form.Select>
      </Col>
    </Row>
  );

  return (
    <>
      <EntityModule
        {...props}
        moduleKey="GradeSubjects"
        fields={fields}
        columns={columns}
        rows={filteredRows}
        customOptions={{ subjectId: subjectOptions }}
        listControls={listControls}
        rowSelection={{
          selectedIds: selectedAssignmentIds,
          onToggleRow: (rowId, checked) =>
            setSelectedAssignmentIds((current) =>
              checked ? [...new Set([...current, rowId])] : current.filter((item) => item !== rowId)
            ),
          onToggleAll: (rows, checked) =>
            setSelectedAssignmentIds((current) =>
              checked ? [...new Set([...current, ...rows.map((item) => item.id)])] : current.filter((id) => !rows.some((row) => row.id === id))
            )
        }}
        onDelete={props.onDelete}
        onReset={() => {
          props.setEditingId('');
          props.setFormState(freshForm('GradeSubjects'));
        }}
      />

      <Row className="g-3 mt-1">
        <Col lg={12}>
          <Card className="glass-card p-3">
            <div className="section-title mb-2">Cambiar docente de asignaciones seleccionadas</div>
            <div className="text-muted mb-3">
              Usa los checks de la tabla para seleccionar una o varias asignaciones visibles y reasignarlas a otro docente.
            </div>
            <Row className="g-3 align-items-end">
              <Col lg={5}>
                <Form.Label>Nuevo docente</Form.Label>
                <Form.Select value={bulkTeacherId} onChange={(e) => setBulkTeacherId(e.target.value)}>
                  <option value="">Seleccione</option>
                  {teacherOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col lg={4}>
                <div className="text-muted">
                  <strong>Seleccionadas:</strong> {selectedAssignmentIds.length}
                </div>
              </Col>
              <Col lg={3}>
                <div className="d-grid">
                  <Button
                    variant="outline-dark"
                    disabled={!selectedAssignmentIds.length || !bulkTeacherId}
                    onClick={() => props.onReassignTeacher?.(selectedAssignmentIds, bulkTeacherId)}
                  >
                    Cambiar docente
                  </Button>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="glass-card p-3 h-100">
            <div className="section-title mb-2">Eliminar asignaciones de un grado</div>
            <div className="text-muted mb-3">
              Borra todas las asignaciones del grado seleccionado, siempre que no tengan preinformes asociados.
            </div>
            <Form.Label>Grado</Form.Label>
            <Form.Select value={selectedListGradeId} onChange={(e) => setSelectedListGradeId(e.target.value)}>
              <option value="">Seleccione</option>
              {filteredGradeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
            <Button className="mt-3" variant="outline-danger" disabled={!selectedListGradeId} onClick={() => props.onDeleteByGrade?.(selectedListGradeId)}>
              Eliminar asignaciones del grado
            </Button>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="glass-card p-3 h-100">
            <div className="section-title mb-2">Copiar asignaciones entre grados</div>
            <div className="text-muted mb-3">
              Copia las asignaciones activas faltantes de un grado origen a un grado destino.
            </div>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label>Grado origen</Form.Label>
                <Form.Select value={copySourceGradeId} onChange={(e) => setCopySourceGradeId(e.target.value)}>
                  <option value="">Seleccione</option>
                  {filteredGradeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={6}>
                <Form.Label>Grado destino</Form.Label>
                <Form.Select value={copyTargetGradeId} onChange={(e) => setCopyTargetGradeId(e.target.value)}>
                  <option value="">Seleccione</option>
                  {filteredGradeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            </Row>
            <Button
              className="mt-3"
              variant="outline-primary"
              disabled={!copySourceGradeId || !copyTargetGradeId}
              onClick={() => props.onCopyByGrade?.(copySourceGradeId, copyTargetGradeId)}
            >
              Copiar asignaciones
            </Button>
          </Card>
        </Col>
      </Row>
    </>
  );
}
