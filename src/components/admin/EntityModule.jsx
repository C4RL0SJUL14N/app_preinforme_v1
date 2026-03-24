import { Badge, Card, Col, Form, Row, Table } from 'react-bootstrap';
import { MODULE_META, SaveDeleteActions } from './shared.jsx';

function getOptions(data, optionsKey) {
  if (optionsKey === 'sedes') {
    return data.sedes
      .filter((item) => item.active !== 'FALSE')
      .map((item) => ({ value: item.id, label: item.name }));
  }
  if (optionsKey === 'teachers') {
    return data.teachers.map((item) => ({ value: item.id, label: `${item.firstName} ${item.lastName}`.trim() }));
  }
  if (optionsKey === 'grades') {
    return data.grades.map((item) => ({ value: item.id, label: item.name }));
  }
  if (optionsKey === 'subjects') {
    return data.subjects.map((item) => ({ value: item.id, label: item.shortName ? `${item.name} (${item.shortName})` : item.name }));
  }
  return [];
}

function displayValue(data, key, value) {
  if (key === 'sedeId') {
    return data.sedes.find((item) => item.id === value)?.name || value;
  }
  if (key === 'directorTeacherId' || key === 'teacherId') {
    const teacher = data.teachers.find((item) => item.id === value);
    return teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : value;
  }
  if (key === 'gradeId') {
    return data.grades.find((item) => item.id === value)?.name || value;
  }
  if (key === 'subjectId') {
    const subject = data.subjects.find((item) => item.id === value);
    return subject ? (subject.shortName ? `${subject.name} (${subject.shortName})` : subject.name) : value;
  }
  if (key === 'educationModel') {
    return value === 'ESCUELA_NUEVA' ? 'Escuela Nueva' : 'Educacion Tradicional';
  }
  return value;
}

export function EntityModule({
  moduleKey,
  data,
  fields,
  columns,
  rows,
  formState,
  setFormState,
  editingId,
  setEditingId,
  onSave,
  onReset,
  onDelete,
  customOptions = {},
  showInactive = false,
  listControls = null,
  rowSelection = null
}) {
  const meta = MODULE_META[moduleKey];
  const visibleRows = showInactive ? rows : rows.filter((row) => row.active !== 'FALSE');
  const allVisibleSelected =
    Boolean(rowSelection) &&
    visibleRows.length > 0 &&
    visibleRows.every((row) => rowSelection.selectedIds.includes(row.id));

  return (
    <Row className="g-3">
      <Col lg={4}>
        <Card className="glass-card p-3 h-100">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <div className="section-title">{meta.formTitle}</div>
              <div className="text-muted">{editingId ? 'Editando registro existente' : meta.formSubtitle}</div>
            </div>
            {editingId ? <Badge bg="dark">Edicion</Badge> : <Badge bg="success">Nuevo</Badge>}
          </div>

          {fields.map((field) => (
            <Form.Group className="mb-3" key={field.name}>
              <Form.Label>{field.label}</Form.Label>
              {field.type === 'select' ? (
                <Form.Select
                  data-admin-focus={`${moduleKey}-${field.name}`}
                  value={formState[field.name] || ''}
                  onChange={(e) => setFormState((c) => ({ ...c, [field.name]: e.target.value }))}
                >
                  <option value="">Seleccione</option>
                  {(customOptions[field.name] || getOptions(data, field.optionsKey)).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              ) : field.type === 'boolean' ? (
                <Form.Select
                  data-admin-focus={`${moduleKey}-${field.name}`}
                  value={formState[field.name] || 'TRUE'}
                  onChange={(e) => setFormState((c) => ({ ...c, [field.name]: e.target.value }))}
                >
                  <option value="TRUE">Si</option>
                  <option value="FALSE">No</option>
                </Form.Select>
              ) : field.type === 'enum' ? (
                <Form.Select
                  data-admin-focus={`${moduleKey}-${field.name}`}
                  value={formState[field.name] || field.options[0]}
                  onChange={(e) => setFormState((c) => ({ ...c, [field.name]: e.target.value }))}
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Form.Select>
              ) : (
                <Form.Control
                  data-admin-focus={`${moduleKey}-${field.name}`}
                  type={field.type || 'text'}
                  value={formState[field.name] || ''}
                  placeholder={field.placeholder || ''}
                  onChange={(e) => setFormState((c) => ({ ...c, [field.name]: e.target.value }))}
                />
              )}
            </Form.Group>
          ))}

          <SaveDeleteActions onSave={onSave} onReset={onReset} onDelete={onDelete} canDelete={Boolean(editingId && onDelete)} />
        </Card>
      </Col>

      <Col lg={8}>
        <Card className="glass-card p-3">
          <div className="mb-3">
            <div className="section-title">{meta.listTitle}</div>
            <div className="text-muted">{meta.listSubtitle}</div>
          </div>
          {listControls ? <div className="mb-3">{listControls}</div> : null}
          <Table responsive striped hover>
            <thead>
              <tr>
                {rowSelection ? (
                  <th style={{ width: '42px' }}>
                    <Form.Check
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => rowSelection.onToggleAll?.(visibleRows, event.target.checked)}
                    />
                  </th>
                ) : null}
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setEditingId(row.id);
                    setFormState((current) => ({ ...current, ...row, password: '' }));
                  }}
                >
                  {rowSelection ? (
                    <td onClick={(event) => event.stopPropagation()}>
                      <Form.Check
                        type="checkbox"
                        checked={rowSelection.selectedIds.includes(row.id)}
                        onChange={(event) => rowSelection.onToggleRow?.(row.id, event.target.checked)}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={`${row.id}-${column.key}`}>{displayValue(data, column.key, row[column.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </Col>
    </Row>
  );
}
