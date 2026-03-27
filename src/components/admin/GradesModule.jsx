import { useEffect, useMemo, useState } from 'react';
import { Col, Form, Row } from 'react-bootstrap';
import { EntityModule } from './EntityModule.jsx';
import { freshForm } from './shared.jsx';

const fields = [
  { name: 'sedeId', label: 'Sede', type: 'select', optionsKey: 'sedes' },
  { name: 'name', label: 'Nombre grado' },
  { name: 'educationModel', label: 'Modalidad', type: 'select', optionsKey: 'educationModels' },
  { name: 'directorTeacherId', label: 'Director de grupo', type: 'select', optionsKey: 'teachers' },
  { name: 'active', label: 'Activo', type: 'boolean' }
];

const columns = [
  { key: 'sedeId', label: 'Sede' },
  { key: 'name', label: 'Grado' },
  { key: 'educationModel', label: 'Modalidad' },
  { key: 'directorTeacherId', label: 'Director' },
  { key: 'active', label: 'Activo' }
];

export function GradesModule(props) {
  const [selectedSedeId, setSelectedSedeId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');

  useEffect(() => {
    const stored = window.localStorage.getItem('preinformes:admin:Grades:listFilters');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      setSelectedSedeId(parsed.selectedSedeId || '');
      setSelectedGradeId(parsed.selectedGradeId || '');
    } catch {
      window.localStorage.removeItem('preinformes:admin:Grades:listFilters');
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      'preinformes:admin:Grades:listFilters',
      JSON.stringify({ selectedSedeId, selectedGradeId })
    );
  }, [selectedGradeId, selectedSedeId]);

  const occupiedDirectorIds = new Set(
    props.data.grades
      .filter(
        (grade) =>
          grade.id !== props.editingId &&
          grade.directorTeacherId &&
          grade.active !== 'FALSE' &&
          (props.formState.educationModel || 'EDUCACION_TRADICIONAL') === 'EDUCACION_TRADICIONAL'
      )
      .map((grade) => grade.directorTeacherId)
  );

  const directorOptions = props.data.teachers
    .filter((teacher) => !props.formState.sedeId || teacher.sedeId === props.formState.sedeId)
    .filter((teacher) => !occupiedDirectorIds.has(teacher.id) || teacher.id === props.formState.directorTeacherId)
    .map((teacher) => ({
      value: teacher.id,
      label: `${teacher.firstName} ${teacher.lastName}`.trim()
    }));

  const educationModelOptions = [
    { value: 'EDUCACION_TRADICIONAL', label: 'Educación Tradicional' },
    { value: 'ESCUELA_NUEVA', label: 'Escuela Nueva' }
  ];

  const visibleGrades = useMemo(() => {
    let rows = props.data.grades;
    if (selectedSedeId) {
      rows = rows.filter((grade) => grade.sedeId === selectedSedeId);
    }
    if (selectedGradeId) {
      rows = rows.filter((grade) => grade.id === selectedGradeId);
    }
    return rows;
  }, [props.data.grades, selectedSedeId, selectedGradeId]);

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
      moduleKey="Grades"
      fields={fields}
      columns={columns}
      rows={visibleGrades}
      customOptions={{ directorTeacherId: directorOptions, educationModel: educationModelOptions }}
      listControls={listControls}
      onDelete={props.onDelete}
      onReset={() => {
        props.setEditingId('');
        props.setFormState(freshForm('Grades'));
      }}
    />
  );
}
