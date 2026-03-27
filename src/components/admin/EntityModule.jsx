import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, Col, Form, Row, Table } from 'react-bootstrap';
import { MODULE_META, SaveDeleteActions } from './shared.jsx';

const PAGE_SIZE = 15;

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
    return value === 'ESCUELA_NUEVA' ? 'Escuela Nueva' : 'Educación Tradicional';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const baseRows = showInactive ? rows : rows.filter((row) => row.active !== 'FALSE');
  const visibleRows = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('es');
    if (!query) return baseRows;
    return baseRows.filter((row) =>
      columns.some((column) => String(displayValue(data, column.key, row[column.key]) || '').toLocaleLowerCase('es').includes(query))
    );
  }, [baseRows, columns, data, searchTerm]);
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(
    () => visibleRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, visibleRows]
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, rows, showInactive]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const allVisibleSelected =
    Boolean(rowSelection) &&
    paginatedRows.length > 0 &&
    paginatedRows.every((row) => rowSelection.selectedIds.includes(row.id));

  return (
    <Row className="g-3">
      <Col lg={4}>
        <Card className="glass-card p-3 h-100">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <div className="section-title">{meta.formTitle}</div>
              <div className="text-muted">{editingId ? 'Editando registro existente' : meta.formSubtitle}</div>
            </div>
            {editingId ? <Badge bg="dark">Edición</Badge> : <Badge bg="success">Nuevo</Badge>}
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
                  <option value="TRUE">Sí</option>
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
          <Row className="g-3 mb-3">
            <Col md={8}>
              <Form.Control
                value={searchTerm}
                placeholder="Buscar en la tabla visible"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Col>
            <Col md={4} className="d-flex align-items-center justify-content-md-end">
              <div className="text-muted small">
                {visibleRows.length} registro{visibleRows.length === 1 ? '' : 's'} visible{visibleRows.length === 1 ? '' : 's'} · página {page} de {totalPages}
              </div>
            </Col>
          </Row>
          {listControls ? <div className="mb-3">{listControls}</div> : null}
          <div className="admin-table-wrap">
          <Table responsive striped hover className="mb-0">
            <thead>
              <tr>
                {rowSelection ? (
                  <th style={{ width: '42px' }}>
                    <Form.Check
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => rowSelection.onToggleAll?.(paginatedRows, event.target.checked)}
                    />
                  </th>
                ) : null}
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
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
              {!visibleRows.length ? (
                <tr>
                  <td colSpan={columns.length + (rowSelection ? 1 : 0)} className="text-center text-muted py-4">
                    No hay registros que coincidan con la búsqueda o los filtros actuales.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
          </div>
          {visibleRows.length > PAGE_SIZE ? (
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
              <div className="text-muted small">
                Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, visibleRows.length)} a {Math.min(page * PAGE_SIZE, visibleRows.length)} de {visibleRows.length}
              </div>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  Anterior
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                  Siguiente
                </button>
              </div>
            </div>
          ) : null}
        </Card>
      </Col>
    </Row>
  );
}
