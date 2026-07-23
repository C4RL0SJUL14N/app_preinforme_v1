import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { apiFetch } from '../apiClient.js';

const AUTOSAVE_SECONDS = 5 * 60;
const AUTOSAVE_STORAGE_KEY = 'preinformes:marks:autosave';
const MINIMUM_SAVE_FEEDBACK_MS = 1000;

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function includesQuestion(values, question) {
  const expected = normalizeText(question);
  return (values || []).some((value) => normalizeText(value) === expected);
}

function findSubjectOptions(data, gradeId) {
  const assignments = data.gradeSubjects.filter((item) => item.gradeId === gradeId && item.active !== 'FALSE');
  const activeGroups = (data.subjectGroups || []).filter((group) => group.gradeId === gradeId && group.active !== 'FALSE');
  const groupedSubjectIds = new Set(
    activeGroups.flatMap((group) =>
      (data.subjectGroupMembers || [])
        .filter((member) => member.subjectGroupId === group.id)
        .map((member) => member.subjectId)
    )
  );
  const regular = assignments
    .filter((item) => !groupedSubjectIds.has(item.subjectId))
    .map((item) => {
      const subject = data.subjects.find((candidate) => candidate.id === item.subjectId);
      return {
        id: item.id,
        subjectId: item.subjectId,
        name: subject?.shortName ? `${subject.name} (${subject.shortName})` : subject?.name || item.subjectId
      };
    });
  const grouped = activeGroups.map((group) => ({
    id: group.id,
    subjectId: group.principalSubjectId,
    name: group.name
  }));
  return [...regular, ...grouped].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function PreReportMarksModule({ data, onRefresh, title, onBack }) {
  const [filters, setFilters] = useState({ periodId: '', gradeId: '', subjectId: '' });
  const [students, setStudents] = useState([]);
  const [rows, setRows] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [additionalSubjectIds, setAdditionalSubjectIds] = useState([]);
  const [copyTargetSubjectId, setCopyTargetSubjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState('');
  const [autosaveEnabled, setAutosaveEnabled] = useState(
    () => window.localStorage.getItem(AUTOSAVE_STORAGE_KEY) !== 'false'
  );
  const [secondsRemaining, setSecondsRemaining] = useState(AUTOSAVE_SECONDS);
  const rowsRef = useRef(rows);
  const filtersRef = useRef(filters);
  const dirtyRef = useRef(dirty);
  const savingRef = useRef(false);
  const additionalSubjectIdsRef = useRef(additionalSubjectIds);

  const subjectOptions = useMemo(() => findSubjectOptions(data, filters.gradeId), [data, filters.gradeId]);
  const questionMeta = useMemo(
    () => [
      ...data.questions.convivencia.map((question, index) => ({
        section: 'convivencia',
        key: `C${index + 1}`,
        question
      })),
      ...data.questions.academica.map((question, index) => ({
        section: 'academica',
        key: `A${index + 1}`,
        question
      }))
    ],
    [data.questions]
  );
  const ready = Boolean(filters.periodId && filters.gradeId && filters.subjectId);
  const otherSubjectOptions = useMemo(
    () => subjectOptions.filter((subject) => subject.subjectId !== filters.subjectId),
    [filters.subjectId, subjectOptions]
  );

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    additionalSubjectIdsRef.current = additionalSubjectIds;
  }, [additionalSubjectIds]);

  const loadWorkspace = useCallback(async (nextFilters) => {
    if (!nextFilters.periodId || !nextFilters.gradeId || !nextFilters.subjectId) {
      setStudents([]);
      setRows({});
      setDirty(false);
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const query = new URLSearchParams(nextFilters);
      const result = await apiFetch(`/api/teacher/pre-report-workspace?${query}`);
      const nextStudents = result.students || [];
      setStudents(nextStudents);
      setRows(
        Object.fromEntries(
          nextStudents.map((student) => [
            student.studentId,
            {
              studentId: student.studentId,
              convivencia: student.convivencia || [],
              academica: student.academica || []
            }
          ])
        )
      );
      setSelectedIds([]);
      setDirty(false);
      setSecondsRemaining(AUTOSAVE_SECONDS);
      setMessage(`Se cargaron las marcas de ${nextStudents.length} estudiantes.`);
    } catch (loadError) {
      setStudents([]);
      setRows({});
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace(filters);
  }, [filters.periodId, filters.gradeId, filters.subjectId, loadWorkspace]);

  const saveMarks = useCallback(
    async (automatic = false) => {
      const currentFilters = filtersRef.current;
      if (!currentFilters.periodId || !currentFilters.gradeId || !currentFilters.subjectId || savingRef.current) return;
      if (automatic && !dirtyRef.current) return;
      savingRef.current = true;
      setSaving(true);
      setError('');
      setMessage('');
      const startedAt = Date.now();
      try {
        const targetSubjectIds = [
          currentFilters.subjectId,
          ...additionalSubjectIdsRef.current.filter((subjectId) => subjectId !== currentFilters.subjectId)
        ];
        const results = await Promise.all(
          targetSubjectIds.map((subjectId) =>
            apiFetch('/api/teacher/pre-report-marks', {
              method: 'PUT',
              body: JSON.stringify({
                ...currentFilters,
                subjectId,
                rows: Object.values(rowsRef.current)
              })
            })
          )
        );
        const remainingDelay = Math.max(0, MINIMUM_SAVE_FEEDBACK_MS - (Date.now() - startedAt));
        if (remainingDelay) await wait(remainingDelay);
        setDirty(false);
        setLastSavedAt(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
        setSecondsRemaining(AUTOSAVE_SECONDS);
        setMessage(
          automatic
            ? `Autoguardado completado en ${targetSubjectIds.length} asignatura${targetSubjectIds.length === 1 ? '' : 's'}.`
            : `Cambios guardados en ${targetSubjectIds.length} asignatura${targetSubjectIds.length === 1 ? '' : 's'}. ${results[0].marked} estudiantes tienen marcas activas.`
        );
      } catch (saveError) {
        const remainingDelay = Math.max(0, MINIMUM_SAVE_FEEDBACK_MS - (Date.now() - startedAt));
        if (remainingDelay) await wait(remainingDelay);
        setError(`No fue posible ${automatic ? 'autoguardar' : 'guardar'}: ${saveError.message}`);
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    []
  );

  async function copyMarksToSubject() {
    if (!copyTargetSubjectId || savingRef.current) return;
    const targetName = subjectOptions.find((subject) => subject.subjectId === copyTargetSubjectId)?.name || 'la asignatura seleccionada';
    if (!window.confirm(`Las marcas actuales reemplazarán las marcas existentes en ${targetName}. ¿Deseas continuar?`)) return;

    savingRef.current = true;
    setSaving(true);
    setError('');
    setMessage('');
    const startedAt = Date.now();
    try {
      const result = await apiFetch('/api/teacher/pre-report-marks', {
        method: 'PUT',
        body: JSON.stringify({
          ...filtersRef.current,
          subjectId: copyTargetSubjectId,
          rows: Object.values(rowsRef.current)
        })
      });
      const remainingDelay = Math.max(0, MINIMUM_SAVE_FEEDBACK_MS - (Date.now() - startedAt));
      if (remainingDelay) await wait(remainingDelay);
      setMessage(`Marcas copiadas a ${targetName}. ${result.marked} estudiantes quedaron con marcas activas.`);
    } catch (copyError) {
      const remainingDelay = Math.max(0, MINIMUM_SAVE_FEEDBACK_MS - (Date.now() - startedAt));
      if (remainingDelay) await wait(remainingDelay);
      setError(`No fue posible copiar las marcas: ${copyError.message}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  useEffect(() => {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, String(autosaveEnabled));
    setSecondsRemaining(AUTOSAVE_SECONDS);
    if (!autosaveEnabled || !ready || !students.length) return undefined;
    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [autosaveEnabled, ready, saveMarks, students.length]);

  useEffect(() => {
    if (!autosaveEnabled || !ready || !students.length || secondsRemaining > 0) return;
    setSecondsRemaining(AUTOSAVE_SECONDS);
    void saveMarks(true);
  }, [autosaveEnabled, ready, saveMarks, secondsRemaining, students.length]);

  function updateFilter(field, value) {
    setAdditionalSubjectIds([]);
    setCopyTargetSubjectId('');
    setFilters((current) => {
      if (field === 'periodId') return { periodId: value, gradeId: '', subjectId: '' };
      if (field === 'gradeId') return { ...current, gradeId: value, subjectId: '' };
      return { ...current, subjectId: value };
    });
  }

  function toggleQuestion(studentId, section, question) {
    const targetIds = selectedIds.length ? selectedIds : [studentId];
    const shouldAdd = targetIds.some((id) => !includesQuestion(rowsRef.current[id]?.[section], question));
    setRows((current) => {
      const next = { ...current };
      for (const id of targetIds) {
        const row = next[id] || { studentId: id, convivencia: [], academica: [] };
        const values = row[section] || [];
        next[id] = {
          ...row,
          [section]: shouldAdd
            ? [...values.filter((value) => normalizeText(value) !== normalizeText(question)), question]
            : values.filter((value) => normalizeText(value) !== normalizeText(question))
        };
      }
      return next;
    });
    setDirty(true);
  }

  function clearSelectedMarks() {
    const targetIds = selectedIds.length ? selectedIds : students.map((student) => student.studentId);
    setRows((current) => {
      const next = { ...current };
      targetIds.forEach((id) => {
        next[id] = { ...next[id], convivencia: [], academica: [] };
      });
      return next;
    });
    setDirty(true);
  }

  const allSelected = Boolean(students.length && selectedIds.length === students.length);

  return (
    <Card className="glass-card p-3 mb-4">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div className="glass-card page-context-bar p-3 flex-grow-1">
          <p className="section-title mb-1">Docencia</p>
          <h2 className="h4 mb-1">{title || 'Preinformes'}</h2>
          <div className="text-muted">Crea, modifica o quita únicamente las marcas del preinforme.</div>
        </div>
        <Button variant="outline-dark" onClick={onBack} disabled={saving}>Volver al tablero</Button>
      </div>

      <Row>
        <Col md={4} className="mb-3">
          <Form.Label>Período</Form.Label>
          <Form.Select value={filters.periodId} disabled={saving} onChange={(event) => updateFilter('periodId', event.target.value)}>
            <option value="">Seleccione</option>
            {data.periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
          </Form.Select>
        </Col>
        <Col md={4} className="mb-3">
          <Form.Label>Grado</Form.Label>
          <Form.Select value={filters.gradeId} disabled={saving} onChange={(event) => updateFilter('gradeId', event.target.value)}>
            <option value="">Seleccione</option>
            {data.grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
          </Form.Select>
        </Col>
        <Col md={4} className="mb-3">
          <Form.Label>Asignatura</Form.Label>
          <Form.Select value={filters.subjectId} disabled={saving} onChange={(event) => updateFilter('subjectId', event.target.value)}>
            <option value="">Seleccione</option>
            {subjectOptions.map((subject) => <option key={subject.id} value={subject.subjectId}>{subject.name}</option>)}
          </Form.Select>
        </Col>
      </Row>

      {ready && otherSubjectOptions.length ? (
        <Row className="g-3 mb-3">
          <Col lg={7}>
            <Card className="glass-card p-3 h-100">
              <div className="section-title mb-2">Guardar en varias asignaturas</div>
              <div className="text-muted small mb-3">
                La asignatura principal siempre se guarda. Marca otras asignaturas del mismo grado para aplicarles también esta matriz.
              </div>
              <Row className="g-2">
                <Col md={6}>
                  <Form.Check type="checkbox" checked disabled label={subjectOptions.find((item) => item.subjectId === filters.subjectId)?.name || 'Asignatura principal'} />
                </Col>
                {otherSubjectOptions.map((subject) => (
                  <Col md={6} key={`additional-${subject.subjectId}`}>
                    <Form.Check
                      type="checkbox"
                      disabled={saving}
                      id={`additional-subject-${subject.subjectId}`}
                      checked={additionalSubjectIds.includes(subject.subjectId)}
                      label={subject.name}
                      onChange={() =>
                        setAdditionalSubjectIds((current) =>
                          current.includes(subject.subjectId)
                            ? current.filter((subjectId) => subjectId !== subject.subjectId)
                            : [...current, subject.subjectId]
                        )
                      }
                    />
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
          <Col lg={5}>
            <Card className="glass-card p-3 h-100">
              <div className="section-title mb-2">Copiar marcas a otra asignatura</div>
              <div className="text-muted small mb-3">Reemplaza las marcas de la asignatura destino con la matriz que estás viendo.</div>
              <Form.Select
                className="mb-2"
                disabled={saving}
                value={copyTargetSubjectId}
                onChange={(event) => setCopyTargetSubjectId(event.target.value)}
              >
                <option value="">Seleccione la asignatura destino</option>
                {otherSubjectOptions.map((subject) => (
                  <option key={`copy-${subject.subjectId}`} value={subject.subjectId}>{subject.name}</option>
                ))}
              </Form.Select>
              <Button variant="outline-primary" disabled={!copyTargetSubjectId || saving} onClick={copyMarksToSubject}>
                Copiar marcas
              </Button>
            </Card>
          </Col>
        </Row>
      ) : null}

      <div className="sticky-action-bar">
        <div className="sticky-action-card d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <div>
            <div className="sticky-action-meta">
              {dirty ? 'Hay cambios pendientes.' : lastSavedAt ? `Último guardado: ${lastSavedAt}.` : 'Sin cambios pendientes.'}
            </div>
            <Form.Check
              type="switch"
              id="pre-report-autosave"
              label={autosaveEnabled ? `Autoguardado activo · ${formatCountdown(secondsRemaining)}` : 'Autoguardado desactivado'}
              checked={autosaveEnabled}
              disabled={saving}
              onChange={(event) => setAutosaveEnabled(event.target.checked)}
            />
          </div>
          <div className="d-flex flex-wrap gap-2">
            <Button variant="outline-secondary" disabled={!students.length || saving} onClick={clearSelectedMarks}>
              Quitar marcas {selectedIds.length ? 'seleccionadas' : 'de todo el grupo'}
            </Button>
            <Button disabled={!ready || !students.length || saving || (!dirty && !additionalSubjectIds.length)} onClick={() => saveMarks(false)}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      {!ready ? (
        <Card className="glass-card p-3"><div className="text-muted">Selecciona período, grado y asignatura para cargar automáticamente todo el grupo.</div></Card>
      ) : loading ? (
        <Card className="glass-card p-3"><div className="text-muted">Cargando marcas del grupo…</div></Card>
      ) : students.length ? (
        <>
          <Card className="glass-card p-3 mb-3">
            <div className="section-title mb-2">Descriptores</div>
            <div className="matrix-legend-list">
              {questionMeta.map((item) => (
                <div key={item.key} className="matrix-legend-item">
                  <Badge bg={item.section === 'convivencia' ? 'warning' : 'info'} text={item.section === 'convivencia' ? 'dark' : undefined}>
                    {item.key}
                  </Badge>
                  <span>{item.question}</span>
                </div>
              ))}
            </div>
          </Card>
          <div className="table-responsive bulk-matrix-wrap">
            <table className="table align-middle bulk-matrix-table">
              <thead>
                <tr>
                  <th className="bulk-sticky-col bulk-index-col">
                    <Form.Check
                      aria-label="Seleccionar todo el grupo"
                      checked={allSelected}
                      disabled={saving}
                      onChange={() => setSelectedIds(allSelected ? [] : students.map((student) => student.studentId))}
                    />
                  </th>
                  <th className="bulk-sticky-col bulk-name-col">Estudiante</th>
                  {questionMeta.map((item) => <th key={item.key} title={item.question}>{item.key}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => {
                  const row = rows[student.studentId] || {};
                  return (
                    <tr key={student.studentId}>
                      <td className="bulk-sticky-col bulk-index-col">
                        <Form.Check
                          label={index + 1}
                          checked={selectedIds.includes(student.studentId)}
                          disabled={saving}
                          onChange={() =>
                            setSelectedIds((current) =>
                              current.includes(student.studentId)
                                ? current.filter((id) => id !== student.studentId)
                                : [...current, student.studentId]
                            )
                          }
                        />
                      </td>
                      <td className="bulk-sticky-col bulk-name-col">
                        <span className="bulk-student-name">{`${student.lastName} ${student.firstName}`.trim()}</span>
                      </td>
                      {questionMeta.map((item) => {
                        const checked = includesQuestion(row[item.section], item.question);
                        return (
                          <td key={`${student.studentId}-${item.key}`} className="bulk-question-cell">
                            <button
                              type="button"
                              disabled={saving}
                              className={`bulk-mark-btn ${checked ? 'is-marked' : ''}`}
                              onClick={() => toggleQuestion(student.studentId, item.section, item.question)}
                              aria-label={`${checked ? 'Quitar' : 'Agregar'} ${item.key} a ${student.firstName} ${student.lastName}`}
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
      ) : (
        <Alert variant="warning">No hay estudiantes activos en el grado seleccionado.</Alert>
      )}
    </Card>
  );
}
