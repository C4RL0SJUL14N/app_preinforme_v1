import { useEffect, useMemo, useState } from 'react';
import { Col, Form, Row } from 'react-bootstrap';
import { EntityModule } from './EntityModule.jsx';
import { freshForm } from './shared.jsx';

const fields = [
  { name: 'firstName', label: 'Nombres' },
  { name: 'lastName', label: 'Apellidos' },
  { name: 'gradeId', label: 'Grado', type: 'select', optionsKey: 'grades' },
  { name: 'active', label: 'Activo', type: 'boolean' }
];

const columns = [
  { key: 'firstName', label: 'Nombres' },
  { key: 'lastName', label: 'Apellidos' },
  { key: 'gradeId', label: 'Grado' },
  { key: 'active', label: 'Activo' }
];

export function StudentsModule(props) {
  const [selectedSedeId, setSelectedSedeId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');

  useEffect(() => {
    const stored = window.localStorage.getItem('preinformes:admin:Students:listFilters');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      setSelectedSedeId(parsed.selectedSedeId || '');
      setSelectedGradeId(parsed.selectedGradeId || '');
    } catch {
      window.localStorage.removeItem('preinformes:admin:Students:listFilters');
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      'preinformes:admin:Students:listFilters',
      JSON.stringify({ selectedSedeId, selectedGradeId })
    );
  }, [selectedGradeId, selectedSedeId]);

  const visibleStudents = useMemo(() => {
    let rows = props.data.students;
    if (selectedSedeId) {
      const allowedGradeIds = new Set(
        props.data.grades.filter((grade) => grade.sedeId === selectedSedeId).map((grade) => grade.id)
      );
      rows = rows.filter((student) => allowedGradeIds.has(student.gradeId));
    }
    if (selectedGradeId) {
      rows = rows.filter((student) => student.gradeId === selectedGradeId);
    }
    return rows;
  }, [props.data.students, props.data.grades, selectedSedeId, selectedGradeId]);

  const gradeFilterOptions = props.data.grades
    .filter((grade) => !selectedSedeId || grade.sedeId === selectedSedeId)
    .map((grade) => ({
      value: grade.id,
      label: grade.name
    }));

  const listControls = (
    <Row className="g-3">
      <Col md={6}>
        <Form.Label>Filtrar por sede</Form.Label>
        <Form.Select
          value={selectedSedeId}
          onChange={(e) => {
            setSelectedSedeId(e.target.value);
            setSelectedGradeId('');
          }}
        >
          <option value="">Todas las sedes</option>
          {props.data.sedes
            .filter((sede) => sede.active !== 'FALSE')
            .map((sede) => (
              <option key={sede.id} value={sede.id}>
                {sede.name}
              </option>
            ))}
        </Form.Select>
      </Col>
      <Col md={6}>
        <Form.Label>Filtrar por grado</Form.Label>
        <Form.Select value={selectedGradeId} onChange={(e) => setSelectedGradeId(e.target.value)}>
          <option value="">Todos los grados</option>
          {gradeFilterOptions.map((grade) => (
            <option key={grade.value} value={grade.value}>
              {grade.label}
            </option>
          ))}
        </Form.Select>
      </Col>
    </Row>
  );

  return (
    <EntityModule
      {...props}
      moduleKey="Students"
      fields={fields}
      columns={columns}
      rows={visibleStudents}
      listControls={listControls}
      onDelete={props.onDelete}
      onReset={() => {
        props.setEditingId('');
        props.setFormState(freshForm('Students'));
      }}
    />
  );
}
