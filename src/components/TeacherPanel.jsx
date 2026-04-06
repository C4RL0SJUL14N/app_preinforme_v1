import { useEffect, useMemo, useState } from 'react';
import { Accordion, Alert, Badge, Button, Card, Col, Form, Row, Tab, Table, Tabs } from 'react-bootstrap';
import { apiFetch } from '../apiClient.js';
import { RichTextEditor } from './RichTextEditor.jsx';
import { TeacherSubjectGroupsModule } from './TeacherSubjectGroupsModule.jsx';

const PDF_MODE_OPTIONS = [
  { value: 'all', label: 'Todos los preinformes en un solo PDF' },
  { value: 'grade_single_pdf', label: 'Un solo PDF por grado' },
  { value: 'grade_student_zip', label: 'Un PDF por estudiante en ZIP' },
  { value: 'individual', label: 'Un preinforme individual' }
];

function normalizeComparableText(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function includesComparableText(items, expected) {
  const normalizedExpected = normalizeComparableText(expected);
  return (Array.isArray(items) ? items : []).some((item) => normalizeComparableText(item) === normalizedExpected);
}

function compareStudents(a, b) {
  return (
    String(a?.lastName || '').localeCompare(String(b?.lastName || ''), 'es', { sensitivity: 'base' }) ||
    String(a?.firstName || '').localeCompare(String(b?.firstName || ''), 'es', { sensitivity: 'base' }) ||
    String(a?.id || '').localeCompare(String(b?.id || ''), 'es', { sensitivity: 'base' })
  );
}

function getPdfDownloadName(mode) {
  if (mode === 'grade_student_zip') return 'preinformes.zip';
  if (mode === 'individual') return 'preinforme-individual.pdf';
  if (mode === 'grade_single_pdf') return 'preinformes-grado.pdf';
  return 'preinformes.pdf';
}

function getTeacherStorageKey(scope, moduleKey = 'prereports') {
  return `preinformes:teacher:${moduleKey}:${scope}`;
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
          checked={includesComparableText(selected, question)}
          onChange={() => onToggle(question)}
        />
      ))}
    </Card>
  );
}

function findOptions(data, gradeId) {
  const assignments = data.gradeSubjects.filter((item) => item.gradeId === gradeId);
  const activeGroups = (data.subjectGroups || []).filter((group) => group.gradeId === gradeId && group.active !== 'FALSE');
  const groupMembers = data.subjectGroupMembers || [];
  const groupedSubjectIds = new Set(
    activeGroups.flatMap((group) => groupMembers.filter((member) => member.subjectGroupId === group.id).map((member) => member.subjectId))
  );

  const regularOptions = assignments
    .filter((item) => !groupedSubjectIds.has(item.subjectId))
    .map((item) => {
      const subject = data.subjects.find((currentSubject) => currentSubject.id === item.subjectId);
      return {
        ...item,
        subjectName: subject ? (subject.shortName ? `${subject.name} (${subject.shortName})` : subject.name) : item.subjectId
      };
    });

  const groupedOptions = activeGroups.map((group) => {
    const members = groupMembers
      .filter((member) => member.subjectGroupId === group.id)
      .map((member) => data.subjects.find((subject) => subject.id === member.subjectId))
      .filter(Boolean);
    const associatedLabel = members
      .map((subject) => subject.shortName || subject.name)
      .sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' }))
      .join(', ');
    return {
      id: group.id,
      gradeId: group.gradeId,
      subjectId: group.principalSubjectId,
      teacherId: group.teacherId,
      subjectName: associatedLabel ? `${group.name} (${associatedLabel})` : group.name,
      isGrouped: true,
      groupId: group.id
    };
  });

  return [...regularOptions, ...groupedOptions].sort((a, b) =>
    String(a.subjectName || '').localeCompare(String(b.subjectName || ''), 'es', { sensitivity: 'base' })
  );
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

function hasMarkedQuestions(row) {
  return Boolean((row?.convivencia || []).length || (row?.academica || []).length);
}

function BulkLegend({ data }) {
  return (
    <Accordion className="mb-3" defaultActiveKey="0" alwaysOpen>
      <Accordion.Item eventKey="0" className="glass-card border-0">
        <Accordion.Header>Descriptores de convivencia y académicos</Accordion.Header>
        <Accordion.Body>
          <Row className="g-3">
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
                <div className="section-title mb-2">Académicas</div>
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
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
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
          Limpiar selección
        </Button>
        <Button variant="outline-danger" onClick={onClearMarks}>
          Limpiar marcas
        </Button>
        <div className="text-muted d-flex align-items-center">
          Si seleccionas varios estudiantes, al marcar una casilla se aplicará a todos los seleccionados.
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
                    const checked = includesComparableText(row[question.section], question.title);
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

function PreviewMatrix({ students, reports, selectedReportId, onSelectReport, data }) {
  const questionMeta = buildQuestionMeta(data);
  const reportByStudentId = new Map(reports.map((report) => [report.studentId, report]));

  return (
    <div className="bulk-matrix-wrap">
      <table className="table table-bordered align-middle bulk-matrix-table">
        <thead>
          <tr>
            <th className="bulk-sticky-col bulk-name-col bulk-name-col-solo">Estudiante</th>
            {questionMeta.map((question) => (
              <th key={question.key} className={`bulk-question-head bulk-question-head-${question.section}`} title={question.title}>
                <div>{question.label}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const report = reportByStudentId.get(student.id);
            const isSelected = selectedReportId === report?.id;
            return (
              <tr
                key={student.id}
                className={isSelected ? 'bulk-row-selected' : ''}
                style={{ cursor: report ? 'pointer' : 'default' }}
                onClick={() => {
                  if (report) onSelectReport(report.id);
                }}
              >
                <td className="bulk-sticky-col bulk-name-col bulk-name-col-solo">
                  {student.lastName} {student.firstName}
                </td>
                {questionMeta.map((question) => {
                  const checked = includesComparableText(report?.[question.section], question.title);
                  return (
                    <td key={`${student.id}-${question.key}`} className="bulk-question-cell">
                      <div className={`bulk-mark-btn ${checked ? 'is-marked' : ''}`}>{checked ? 'X' : ''}</div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
  const [editMode, setEditMode] = useState('individual');
  const [reportPdfMode, setReportPdfMode] = useState('all');
  const [copyTargetSubjectId, setCopyTargetSubjectId] = useState('');
  const [selectedCreateSubjectIds, setSelectedCreateSubjectIds] = useState([]);
  const [bulkRows, setBulkRows] = useState({});
  const [selectedBulkIds, setSelectedBulkIds] = useState([]);
  const [groupObservations, setGroupObservations] = useState('');
  const [editBulkRows, setEditBulkRows] = useState({});
  const [selectedEditBulkIds, setSelectedEditBulkIds] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [editSearch, setEditSearch] = useState('');
  const [reportStudentSearch, setReportStudentSearch] = useState('');
  const [previewSearch, setPreviewSearch] = useState('');
  const [selectedPreviewReportId, setSelectedPreviewReportId] = useState('');
  const [directorObservationMode, setDirectorObservationMode] = useState('single');
  const [directorGroupObservation, setDirectorGroupObservation] = useState('');
  const [directorStudentObservations, setDirectorStudentObservations] = useState({});
  const [directorPanel, setDirectorPanel] = useState(null);
  const [directorPanelError, setDirectorPanelError] = useState('');
  const [directorStudentSearch, setDirectorStudentSearch] = useState('');
  const [directorTab, setDirectorTab] = useState('individual');
  const [directorSelectedStudentId, setDirectorSelectedStudentId] = useState('');
  const [directorBulkObservation, setDirectorBulkObservation] = useState('');
  const [directorSelectedBulkIds, setDirectorSelectedBulkIds] = useState([]);
  const [directorPreviewStudentId, setDirectorPreviewStudentId] = useState('');

  const gradeOptions = data.grades;
  const reportGradeOptions = data.directedGrades || [];
  const subjectOptions = useMemo(() => findOptions(data, form.gradeId), [data, form.gradeId]);
  const studentOptions = useMemo(
    () =>
      [...availableStudents]
        .sort(compareStudents)
        .filter((student) =>
          `${student.lastName || ''} ${student.firstName || ''} ${student.id || ''}`.toLocaleLowerCase('es').includes(studentSearch.trim().toLocaleLowerCase('es'))
        ),
    [availableStudents, studentSearch]
  );
  const copySubjectOptions = useMemo(
    () => subjectOptions.filter((item) => item.subjectId !== form.subjectId),
    [subjectOptions, form.subjectId]
  );
  const createSubjectOptions = useMemo(
    () =>
      subjectOptions.map((item) => ({
        ...item,
        selected: item.subjectId === form.subjectId || selectedCreateSubjectIds.includes(item.subjectId)
      })),
    [selectedCreateSubjectIds, subjectOptions, form.subjectId]
  );
  const editableGroupStudents = useMemo(
    () =>
      editableReports
        .filter(hasMarkedQuestions)
        .map((report) => {
          const student = data.students.find((item) => item.id === report.studentId);
          return student ? { ...student, reportId: report.id } : null;
        })
        .filter(Boolean)
        .sort(compareStudents),
    [data.students, editableReports]
  );
  const editableFilteredReports = useMemo(
    () =>
      editableReports.filter((report) => {
        const student = data.students.find((item) => item.id === report.studentId);
        const label = `${student?.lastName || ''} ${student?.firstName || ''} ${student?.id || ''}`;
        return label.toLocaleLowerCase('es').includes(editSearch.trim().toLocaleLowerCase('es'));
      }),
    [data.students, editSearch, editableReports]
  );
  const previewReports = useMemo(
    () =>
      editableReports
        .filter((report) => {
          const student = data.students.find((item) => item.id === report.studentId);
          const label = `${student?.lastName || ''} ${student?.firstName || ''} ${student?.id || ''}`;
          return label.toLocaleLowerCase('es').includes(previewSearch.trim().toLocaleLowerCase('es'));
        })
        .sort((a, b) => {
          const studentA = data.students.find((item) => item.id === a.studentId);
          const studentB = data.students.find((item) => item.id === b.studentId);
          return compareStudents(studentA, studentB);
        }),
    [data.students, editableReports, previewSearch]
  );
  const selectedPreviewReport = useMemo(
    () => editableReports.find((item) => item.id === selectedPreviewReportId) || previewReports[0] || null,
    [editableReports, previewReports, selectedPreviewReportId]
  );
  const reportStudentOptions = useMemo(
    () =>
      (form.gradeId ? data.students.filter((student) => student.gradeId === form.gradeId).sort(compareStudents) : []).filter((student) =>
        `${student.lastName || ''} ${student.firstName || ''} ${student.id || ''}`.toLocaleLowerCase('es').includes(reportStudentSearch.trim().toLocaleLowerCase('es'))
      ),
    [data.students, form.gradeId, reportStudentSearch]
  );
  const directorStudents = useMemo(
    () =>
      (directorPanel?.students || []).filter((student) =>
        `${student.lastName || ''} ${student.firstName || ''} ${student.studentId || ''}`
          .toLocaleLowerCase('es')
          .includes(directorStudentSearch.trim().toLocaleLowerCase('es'))
      ),
    [directorPanel?.students, directorStudentSearch]
  );
  const selectedDirectorStudent = useMemo(
    () => (directorPanel?.students || []).find((student) => student.studentId === directorSelectedStudentId) || null,
    [directorPanel?.students, directorSelectedStudentId]
  );
  const selectedDirectorPreviewStudent = useMemo(
    () =>
      (directorPanel?.students || []).find((student) => student.studentId === directorPreviewStudentId) ||
      directorStudents[0] ||
      null,
    [directorPanel?.students, directorPreviewStudentId, directorStudents]
  );
  const canGenerateGroupPdf =
    reportPdfMode === 'individual'
      ? Boolean(form.studentId)
      : reportPdfMode === 'grade_single_pdf' || reportPdfMode === 'grade_student_zip'
        ? Boolean(form.gradeId)
        : true;

  if (activeModule === 'subject-groups') {
    return <TeacherSubjectGroupsModule data={data} onRefresh={onRefresh} onBack={onBack} />;
  }

  useEffect(() => {
    const storedForm = window.localStorage.getItem(getTeacherStorageKey('filters', activeModule));
    const storedTeacherTab = window.localStorage.getItem(getTeacherStorageKey('teacherTab', activeModule));
    const storedCreateMode = window.localStorage.getItem(getTeacherStorageKey('createMode', activeModule));
    const storedEditMode = window.localStorage.getItem(getTeacherStorageKey('editMode', activeModule));
    const storedReportPdfMode = window.localStorage.getItem(getTeacherStorageKey('reportPdfMode', activeModule));
    const storedDirectorTab = window.localStorage.getItem(getTeacherStorageKey('directorTab', activeModule));

    if (storedForm) {
      try {
        setForm((current) => ({ ...current, ...JSON.parse(storedForm) }));
      } catch {
        window.localStorage.removeItem(getTeacherStorageKey('filters', activeModule));
      }
    }
    if (storedTeacherTab) setTeacherTab(storedTeacherTab);
    if (storedCreateMode) setCreateMode(storedCreateMode);
    if (storedEditMode) setEditMode(storedEditMode);
    if (storedReportPdfMode) setReportPdfMode(storedReportPdfMode);
    if (storedDirectorTab) setDirectorTab(storedDirectorTab);
  }, [activeModule]);

  useEffect(() => {
    window.localStorage.setItem(
      getTeacherStorageKey('filters', activeModule),
      JSON.stringify({
        periodId: form.periodId,
        gradeId: form.gradeId,
        subjectId: form.subjectId,
        studentId: form.studentId
      })
    );
  }, [activeModule, form.gradeId, form.periodId, form.studentId, form.subjectId]);

  useEffect(() => {
    window.localStorage.setItem(getTeacherStorageKey('teacherTab', activeModule), teacherTab);
  }, [activeModule, teacherTab]);

  useEffect(() => {
    window.localStorage.setItem(getTeacherStorageKey('createMode', activeModule), createMode);
  }, [activeModule, createMode]);

  useEffect(() => {
    window.localStorage.setItem(getTeacherStorageKey('editMode', activeModule), editMode);
  }, [activeModule, editMode]);

  useEffect(() => {
    window.localStorage.setItem(getTeacherStorageKey('reportPdfMode', activeModule), reportPdfMode);
  }, [activeModule, reportPdfMode]);

  useEffect(() => {
    window.localStorage.setItem(getTeacherStorageKey('directorTab', activeModule), directorTab);
  }, [activeModule, directorTab]);

  useEffect(() => {
    if (activeModule !== 'prereports') {
      return;
    }
    if (teacherTab !== 'edit' && teacherTab !== 'preview') {
      return;
    }
    if (!form.gradeId || !form.subjectId) {
      setEditableReports([]);
      setSelectedEdit('');
      setSelectedPreviewReportId('');
      resetEditBulkState([]);
      return;
    }

    let cancelled = false;
    loadEditable(form)
      .then((reports) => {
        if (cancelled) return;
        setSelectedEdit((current) => (current && reports?.some((item) => item.id === current) ? current : reports?.[0]?.id || ''));
        setSelectedPreviewReportId((current) => (current && reports?.some((item) => item.id === current) ? current : reports?.[0]?.id || ''));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeModule, form.gradeId, form.subjectId, teacherTab]);

  useEffect(() => {
    if (activeModule !== 'director-observations') {
      return;
    }
    if (!form.periodId || !form.gradeId) {
      resetDirectorPanelState();
      return;
    }
    loadDirectorPanel(form);
  }, [activeModule, form.gradeId, form.periodId]);

  function resetBulkState(students = []) {
    setSelectedBulkIds([]);
    setGroupObservations('');
    setBulkRows(Object.fromEntries(students.map((student) => [student.id, createEmptyBulkRow(student.id)])));
  }

  function buildEditBulkRows(reports = []) {
    return Object.fromEntries(
      reports
        .filter(hasMarkedQuestions)
        .map((report) => [
          report.studentId,
          {
            studentId: report.studentId,
            convivencia: [...(report.convivencia || [])],
            academica: [...(report.academica || [])],
            observations: report.observations || ''
          }
        ])
    );
  }

  function resetEditBulkState(reports = []) {
    setSelectedEditBulkIds([]);
    setEditBulkRows(buildEditBulkRows(reports));
  }

  function resetDirectorPanelState() {
    setDirectorPanel(null);
    setDirectorPanelError('');
    setDirectorObservationMode('single');
    setDirectorGroupObservation('');
    setDirectorBulkObservation('');
    setDirectorStudentObservations({});
    setDirectorStudentSearch('');
    setDirectorSelectedStudentId('');
    setDirectorSelectedBulkIds([]);
    setDirectorPreviewStudentId('');
  }

  function applyDirectorPanelState(panelData) {
    setDirectorPanel(panelData);
    setDirectorPanelError('');
    setDirectorGroupObservation(panelData.sharedObservation || '');
    setDirectorBulkObservation('');
    setDirectorStudentObservations(
      Object.fromEntries((panelData.students || []).map((student) => [student.studentId, student.directorObservations || '']))
    );
    setDirectorSelectedStudentId((current) =>
      current && panelData.students?.some((student) => student.studentId === current)
        ? current
        : panelData.students?.[0]?.studentId || ''
    );
    setDirectorPreviewStudentId((current) =>
      current && panelData.students?.some((student) => student.studentId === current)
        ? current
        : panelData.students?.[0]?.studentId || ''
    );
    setDirectorSelectedBulkIds([]);
  }

  function toggleValue(listName, value) {
    setForm((current) => ({
      ...current,
      [listName]: includesComparableText(current[listName], value)
        ? current[listName].filter((item) => normalizeComparableText(item) !== normalizeComparableText(value))
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
    resetEditBulkState(result.preReports);
    return result.preReports;
  }

  function updateField(field, value) {
    const next = { ...form, [field]: value };
    if (field === 'periodId') {
      next.studentId = '';
      setAvailableStudents([]);
      setReportStudentSearch('');
      resetBulkState([]);
      if (activeModule === 'group-reports' || activeModule === 'director-observations') {
        resetDirectorPanelState();
      }
    }
    if (field === 'gradeId') {
      next.subjectId = '';
      next.studentId = '';
      setCopyTargetSubjectId('');
      setSelectedCreateSubjectIds([]);
      setAvailableStudents([]);
      setEditableReports([]);
      setSelectedEdit('');
      setStudentSearch('');
      setEditSearch('');
      setReportStudentSearch('');
      setPreviewSearch('');
      setSelectedPreviewReportId('');
      resetEditBulkState([]);
      resetBulkState([]);
      if (activeModule === 'group-reports' || activeModule === 'director-observations') {
        resetDirectorPanelState();
      }
    }
    if (field === 'subjectId') {
      next.studentId = '';
      setCopyTargetSubjectId('');
      setSelectedCreateSubjectIds((current) => current.filter((item) => item !== value));
      setAvailableStudents([]);
      setEditableReports([]);
      setSelectedEdit('');
      setStudentSearch('');
      setEditSearch('');
      setPreviewSearch('');
      setSelectedPreviewReportId('');
      resetEditBulkState([]);
      resetBulkState([]);
    }
    setForm(next);
  }

  function toggleCreateSubject(subjectId) {
    if (!subjectId || subjectId === form.subjectId) return;
    setSelectedCreateSubjectIds((current) =>
      current.includes(subjectId) ? current.filter((item) => item !== subjectId) : [...current, subjectId]
    );
  }

  function getCreateTargetSubjectIds() {
    return [...new Set([form.subjectId, ...selectedCreateSubjectIds].filter(Boolean))];
  }

  async function getVisiblePreReportsForSubject(subjectId) {
    const result = await apiFetch(`/api/teacher/pre-reports?gradeId=${form.gradeId}&subjectId=${subjectId}`);
    return Array.isArray(result.preReports) ? result.preReports : [];
  }

  async function createReportsForSubjects(subjectIds, createRequest, verifyRequest) {
    const subjectLabels = new Map(subjectOptions.map((item) => [item.subjectId, item.subjectName]));
    const results = {
      success: [],
      warnings: [],
      failed: []
    };

    for (const subjectId of subjectIds) {
      const subjectName = subjectLabels.get(subjectId) || subjectId;
      try {
        await createRequest(subjectId);
        if (verifyRequest) {
          const verification = await verifyRequest(subjectId);
          if (verification?.ok === false) {
            results.warnings.push({
              subjectName,
              message: verification.message || 'Se guardó en la base de datos, pero la vista no mostró los registros esperados todavía.'
            });
            continue;
          }
        }
        results.success.push(subjectName);
      } catch (err) {
        results.failed.push({
          subjectName,
          message: err.message
        });
      }
    }

    return results;
  }

  function buildCreateSummary(singleLabel, pluralLabel, results) {
    if (results.success.length && !results.failed.length && !results.warnings.length) {
      return results.success.length === 1
        ? `${singleLabel} ${results.success[0]}.`
        : `${pluralLabel} ${results.success.length} asignaturas: ${results.success.join(', ')}.`;
    }

    if (!results.success.length && !results.warnings.length && results.failed.length) {
      throw new Error(results.failed.map((item) => `${item.subjectName}: ${item.message}`).join(' | '));
    }

    const parts = [];
    if (results.success.length) {
      parts.push(
        results.success.length === 1
          ? `${singleLabel} ${results.success[0]}.`
          : `${pluralLabel} ${results.success.length} asignaturas: ${results.success.join(', ')}.`
      );
    }
    if (results.warnings.length) {
      parts.push(
        `Verifica ${results.warnings.length} asignaturas en pantalla: ${results.warnings
          .map((item) => `${item.subjectName} (${item.message})`)
          .join('; ')}.`
      );
    }
    if (results.failed.length) {
      parts.push(
        `Se omitieron ${results.failed.length}: ${results.failed.map((item) => `${item.subjectName} (${item.message})`).join('; ')}.`
      );
    }
    return parts.join(' ');
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const targetSubjectIds = getCreateTargetSubjectIds();
      const expectedStudentId = form.studentId;
      const results = await createReportsForSubjects(
        targetSubjectIds,
        async (subjectId) =>
          apiFetch('/api/pre-reports', {
            method: 'POST',
            body: JSON.stringify({ ...form, subjectId })
          }),
        async (subjectId) => {
          const visibleReports = await getVisiblePreReportsForSubject(subjectId);
          const isVisible = visibleReports.some((item) => item.studentId === expectedStudentId);
          return isVisible
            ? { ok: true }
            : {
                ok: false,
                message: 'Se guardó, pero ese estudiante no quedó visible en Editar o Previsualizar para esta asignatura.'
              };
        }
      );
      setMessage(buildCreateSummary('Preinforme guardado en la asignatura', 'Se guardó el mismo preinforme en', results));
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
      if (targetSubjectIds.includes(form.subjectId)) {
        const reports = await loadEditable(form);
        setSelectedEdit(reports?.[0]?.id || '');
        setSelectedPreviewReportId(reports?.[0]?.id || '');
      }
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
        setMessage('No hay estudiantes disponibles para crear preinformes en esta asignatura y período.');
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleBulkQuestion(targetStudentId, section, question) {
    const targetIds = selectedBulkIds.length ? selectedBulkIds : [targetStudentId];
    const shouldAdd = targetIds.some((studentId) => !includesComparableText(bulkRows[studentId]?.[section], question));

    setBulkRows((current) => {
      const next = { ...current };
      for (const studentId of targetIds) {
        const row = next[studentId] || createEmptyBulkRow(studentId);
        const values = row[section] || [];
        next[studentId] = {
          ...row,
          [section]: shouldAdd
            ? [...new Set([...values, question])]
            : values.filter((item) => normalizeComparableText(item) !== normalizeComparableText(question))
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
        .map((student) => {
          const row = bulkRows[student.id] || createEmptyBulkRow(student.id);
          const hasMarkedOptions = row.convivencia.length || row.academica.length;
          return {
            ...row,
            studentId: student.id,
            observations: hasMarkedOptions ? (row.observations || groupObservations || '').trim() : ''
          };
        })
        .filter((row) => row.convivencia.length || row.academica.length);

      if (!rows.length) {
        throw new Error('Debes marcar al menos una dificultad para uno o varios estudiantes');
      }

      const targetSubjectIds = getCreateTargetSubjectIds();
      const expectedStudentIds = new Set(rows.map((item) => item.studentId));
      const results = await createReportsForSubjects(
        targetSubjectIds,
        async (subjectId) =>
          apiFetch('/api/pre-reports/batch', {
            method: 'POST',
            body: JSON.stringify({
              periodId: form.periodId,
              gradeId: form.gradeId,
              subjectId,
              rows
            })
          }),
        async (subjectId) => {
          const visibleReports = await getVisiblePreReportsForSubject(subjectId);
          const visibleStudentIds = new Set(visibleReports.map((item) => item.studentId));
          const missingStudents = [...expectedStudentIds].filter((studentId) => !visibleStudentIds.has(studentId));
          return missingStudents.length
            ? {
                ok: false,
                message: `Se guardó, pero no quedaron visibles ${missingStudents.length} estudiantes en esta asignatura.`
              }
            : { ok: true };
        }
      );
      setMessage(
        buildCreateSummary(
          'Se guardó la carga grupal en la asignatura',
          'Se guardó la misma carga grupal en',
          results
        )
      );
      const students = await loadStudents(form, { initializeBulk: true });
      if (targetSubjectIds.includes(form.subjectId)) {
        const reports = await loadEditable(form);
        setSelectedEdit(reports?.[0]?.id || '');
        setSelectedPreviewReportId(reports?.[0]?.id || '');
      }
      if (!students.length) {
        setMessage((current) => `${current} Ya no quedan estudiantes disponibles en esta combinación.`);
      }
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function copyReportsToAnotherSubject() {
    setError('');
    setMessage('');
    try {
      const result = await apiFetch('/api/teacher/pre-reports/copy-subject', {
        method: 'POST',
        body: JSON.stringify({
          periodId: form.periodId,
          gradeId: form.gradeId,
          sourceSubjectId: form.subjectId,
          targetSubjectId: copyTargetSubjectId
        })
      });
      setMessage(
        `Se copiaron ${result.copied} preinformes a la asignatura de destino.${result.skipped ? ` Se omitieron ${result.skipped} que ya existían.` : ''}`
      );
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleEditLoad() {
    setError('');
    setMessage('');
    try {
      const reports = await loadEditable();
      if (teacherTab === 'preview') {
        setSelectedPreviewReportId(reports?.[0]?.id || '');
      }
      if (editMode === 'group' && !reports?.filter(hasMarkedQuestions).length) {
        setMessage('No hay preinformes con dificultades marcadas para mostrar en modo grupal.');
      }
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

  async function clearObservationOnly() {
    const report = editableReports.find((item) => item.id === selectedEdit);
    if (!report) return;
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/pre-reports/${report.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          convivencia: report.convivencia || [],
          academica: report.academica || [],
          observations: ''
        })
      });
      setForm((current) => ({ ...current, observations: '' }));
      setMessage('La observación del preinforme fue eliminada.');
      await loadEditable();
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleEditBulkQuestion(targetStudentId, section, question) {
    const targetIds = selectedEditBulkIds.length ? selectedEditBulkIds : [targetStudentId];
    const shouldAdd = targetIds.some((studentId) => !includesComparableText(editBulkRows[studentId]?.[section], question));

    setEditBulkRows((current) => {
      const next = { ...current };
      for (const studentId of targetIds) {
        const report = editableReports.find((item) => item.studentId === studentId);
        const row = next[studentId] || createEmptyBulkRow(studentId, report?.observations || '');
        const values = row[section] || [];
        next[studentId] = {
          ...row,
          [section]: shouldAdd
            ? [...new Set([...values, question])]
            : values.filter((item) => normalizeComparableText(item) !== normalizeComparableText(question))
        };
      }
      return next;
    });
  }

  function clearEditBulkMarks() {
    setEditBulkRows((current) =>
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

  async function applyBulkEdit() {
    setError('');
    setMessage('');
    try {
      if (!editableGroupStudents.length) {
        throw new Error('No hay preinformes grupales disponibles para editar.');
      }

      for (const student of editableGroupStudents) {
        const report = editableReports.find((item) => item.id === student.reportId);
        const row = editBulkRows[student.id];
        if (!report || !row) continue;
        await apiFetch(`/api/pre-reports/${report.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            convivencia: row.convivencia || [],
            academica: row.academica || [],
            observations: report.observations || ''
          })
        });
      }

      setMessage(`Se actualizaron ${editableGroupStudents.length} preinformes en modo grupal.`);
      await loadEditable();
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteSelectedBulkReports() {
    setError('');
    setMessage('');
    try {
      if (!selectedEditBulkIds.length) {
        throw new Error('Debes seleccionar al menos un estudiante para borrar sus preinformes.');
      }

      let deletedCount = 0;
      for (const studentId of selectedEditBulkIds) {
        const report = editableReports.find((item) => item.studentId === studentId);
        if (!report) continue;
        await apiFetch(`/api/pre-reports/${report.id}`, { method: 'DELETE' });
        deletedCount += 1;
      }

      setMessage(`Se eliminaron ${deletedCount} preinformes seleccionados.`);
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
      if (form.periodId && form.gradeId) {
        await loadDirectorPanel();
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadDirectorPanel(next = form) {
    if (activeModule !== 'director-observations' || !next.periodId || !next.gradeId) {
      resetDirectorPanelState();
      return null;
    }

    try {
      const result = await apiFetch(
        `/api/teacher/director-observations?periodId=${next.periodId}&gradeId=${next.gradeId}`
      );
      applyDirectorPanelState(result);
      return result;
    } catch (err) {
      setDirectorPanel(null);
      setDirectorPanelError(err.message);
      setDirectorGroupObservation('');
      setDirectorStudentObservations({});
      return null;
    }
  }

  async function saveDirectorObservations() {
    if (!form.periodId || !form.gradeId) {
      setError('Debes seleccionar período y grado para guardar observaciones del director.');
      return;
    }

    try {
      setError('');
      setMessage('');
      let payload;
      let successMessage;

      if (directorTab === 'individual') {
        if (!directorSelectedStudentId) {
          throw new Error('Debes seleccionar un estudiante.');
        }
        payload = {
          periodId: form.periodId,
          gradeId: form.gradeId,
          mode: 'per_student',
          rows: [
            {
              studentId: directorSelectedStudentId,
              directorObservations: directorStudentObservations[directorSelectedStudentId] || ''
            }
          ]
        };
        successMessage = 'Se guardó la observación del director para el estudiante seleccionado.';
      } else if (directorTab === 'group') {
        if (!directorSelectedBulkIds.length) {
          throw new Error('Debes seleccionar al menos un estudiante para la observación grupal.');
        }
        payload = {
          periodId: form.periodId,
          gradeId: form.gradeId,
          mode: 'per_student',
          rows: directorSelectedBulkIds.map((studentId) => ({
            studentId,
            directorObservations: directorBulkObservation || ''
          }))
        };
        successMessage = `Se guardó la observación del director para ${directorSelectedBulkIds.length} estudiantes.`;
      } else {
        payload =
          directorObservationMode === 'per_student'
            ? {
                periodId: form.periodId,
                gradeId: form.gradeId,
                mode: 'per_student',
                rows: (directorPanel?.students || []).map((student) => ({
                  studentId: student.studentId,
                  directorObservations: directorStudentObservations[student.studentId] || ''
                }))
              }
            : {
                periodId: form.periodId,
                gradeId: form.gradeId,
                mode: 'single',
                observation: directorGroupObservation || ''
              };
        successMessage =
          directorObservationMode === 'per_student'
            ? `Se guardaron observaciones del director para ${directorPanel?.students?.length || 0} estudiantes.`
            : `Se aplicó la observación del director a ${directorPanel?.students?.length || 0} estudiantes del grupo.`;
      }

      await apiFetch('/api/teacher/director-observations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setMessage(successMessage);
      await onRefresh();
      await loadDirectorPanel();
    } catch (err) {
      setError(err.message);
    }
  }

  async function clearDirectorObservation() {
    if (!form.periodId || !form.gradeId) {
      setError('Debes seleccionar período y grado para eliminar observaciones del director.');
      return;
    }

    try {
      setError('');
      setMessage('');
      let payload;
      let successMessage;

      if (directorTab === 'individual') {
        if (!directorSelectedStudentId) {
          throw new Error('Debes seleccionar un estudiante.');
        }
        payload = {
          periodId: form.periodId,
          gradeId: form.gradeId,
          mode: 'per_student',
          rows: [{ studentId: directorSelectedStudentId, directorObservations: '' }]
        };
        successMessage = 'La observación del director fue eliminada para el estudiante seleccionado.';
      } else if (directorTab === 'group') {
        if (!directorSelectedBulkIds.length) {
          throw new Error('Debes seleccionar al menos un estudiante para eliminar la observación.');
        }
        payload = {
          periodId: form.periodId,
          gradeId: form.gradeId,
          mode: 'per_student',
          rows: directorSelectedBulkIds.map((studentId) => ({ studentId, directorObservations: '' }))
        };
        successMessage = `Se eliminaron las observaciones del director para ${directorSelectedBulkIds.length} estudiantes.`;
      } else {
        throw new Error('Usa los modos individual o grupal para eliminar observaciones.');
      }

      await apiFetch('/api/teacher/director-observations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setDirectorBulkObservation('');
      if (directorSelectedStudentId) {
        setDirectorStudentObservations((current) => ({ ...current, [directorSelectedStudentId]: '' }));
      }
      setMessage(successMessage);
      await onRefresh();
      await loadDirectorPanel();
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

  const selectedPeriodName = data.periods.find((item) => item.id === form.periodId)?.name || 'Todos';
  const selectedGradeName =
    (activeModule === 'group-reports' || activeModule === 'director-observations' ? reportGradeOptions : gradeOptions).find((item) => item.id === form.gradeId)?.name || 'Todos';
  const selectedSubjectName = subjectOptions.find((item) => item.subjectId === form.subjectId)?.subjectName || 'Todas';
  const contextChips = [
    {
      label: 'Vista',
      value:
        activeModule === 'group-reports'
          ? 'Reportes del grupo'
          : activeModule === 'director-observations'
            ? 'Observaciones del director'
            : 'Preinformes'
    },
    {
      label: 'Pestaña',
      value:
        activeModule === 'group-reports'
          ? 'Consolidado'
          : activeModule === 'director-observations'
            ? directorTab === 'individual'
              ? 'Individual'
              : directorTab === 'group'
                ? 'Grupal'
                : 'Previsualización'
            : teacherTab === 'create'
              ? 'Creación'
              : teacherTab === 'edit'
                ? 'Edición'
                : 'Previsualización'
    },
    { label: 'Período', value: selectedPeriodName },
    { label: 'Grado', value: selectedGradeName }
  ];

  if (activeModule === 'prereports') {
    contextChips.push(
      { label: 'Asignatura', value: selectedSubjectName },
      {
        label: 'Modo',
        value:
          teacherTab === 'create'
            ? createMode === 'group'
              ? 'Carga grupal'
              : 'Carga individual'
            : teacherTab === 'edit'
              ? editMode === 'group'
                ? 'Edición grupal'
                : 'Edición individual'
              : 'Vista grupal'
      }
    );
  } else if (activeModule === 'group-reports') {
    contextChips.push({ label: 'PDF', value: PDF_MODE_OPTIONS.find((item) => item.value === reportPdfMode)?.label || 'Todos' });
  }

  return (
    <Card className="glass-card p-3 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="glass-card page-context-bar p-3 w-100 me-3">
          <p className="section-title mb-1">Docencia</p>
          <h2 className="h4 mb-0">{title || 'Módulo docente'}</h2>
          <div className="context-chip-row">
            {contextChips.map((chip) => (
              <span key={chip.label} className="context-chip">
                <strong>{chip.label}:</strong> {chip.value}
              </span>
            ))}
          </div>
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
              <Form.Label>Período</Form.Label>
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
              <Form.Control
                className="mb-2"
                value={reportStudentSearch}
                placeholder="Buscar estudiante por apellido, nombre o ID"
                onChange={(e) => setReportStudentSearch(e.target.value)}
                disabled={reportPdfMode !== 'individual'}
              />
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
          <div className="sticky-action-bar">
            <div className="sticky-action-card d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
              <div className="sticky-action-meta">Las acciones de reportes permanecen visibles mientras revisas el consolidado.</div>
              <div className="d-flex flex-wrap gap-2">
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
            </div>
          </div>
          <Card className="glass-card p-3 mb-3">
            <div className="section-title mb-2">Observaciones del director de grupo</div>
            {!form.periodId || !form.gradeId ? (
              <div className="text-muted mb-0">
                Selecciona un período y un grado específico para cargar las observaciones del director.
              </div>
            ) : directorPanel ? (
              <>
                <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                  <div className="text-muted">
                    {directorPanel.totalStudents} estudiantes con preinformes cargados en este período.
                  </div>
                  <div className="text-muted">
                    {directorPanel.totalReports} preinformes activos recibirán la observación del director.
                  </div>
                </div>
                <Row className="g-3 mb-3">
                  <Col md={6}>
                    <Form.Label>Modo de observación</Form.Label>
                    <Form.Select value={directorObservationMode} onChange={(e) => setDirectorObservationMode(e.target.value)}>
                      <option value="single">Una observación para todo el grupo</option>
                      <option value="per_student">Una observación diferente por estudiante</option>
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Label>Buscar estudiante</Form.Label>
                    <Form.Control
                      value={directorStudentSearch}
                      placeholder="Buscar por apellido, nombre o ID"
                      onChange={(e) => setDirectorStudentSearch(e.target.value)}
                      disabled={directorObservationMode !== 'per_student'}
                    />
                  </Col>
                </Row>
                {directorObservationMode === 'single' ? (
                  <RichTextEditor
                    label="Observación del director para todo el grupo"
                    rows={5}
                    value={directorGroupObservation}
                    onChange={setDirectorGroupObservation}
                    helperText="Esta observación se copiará en todos los preinformes activos del grupo para el período seleccionado."
                  />
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {directorStudents.map((student) => (
                      <Card key={student.studentId} className="glass-card p-3">
                        <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                          <div>
                            <strong>{`${student.lastName} ${student.firstName}`.trim()}</strong>
                            <div className="text-muted small">{student.studentId}</div>
                          </div>
                          <div className="text-muted small d-flex align-items-center">
                            {student.totalReports} preinformes asociados
                          </div>
                        </div>
                        {student.hasMixedValues ? (
                          <Alert variant="warning" className="mb-3">
                            Este estudiante tenía observaciones del director distintas entre asignaturas. Al guardar, quedará unificada.
                          </Alert>
                        ) : null}
                        <RichTextEditor
                          label="Observación del director"
                          rows={4}
                          value={directorStudentObservations[student.studentId] || ''}
                          onChange={(nextValue) =>
                            setDirectorStudentObservations((current) => ({ ...current, [student.studentId]: nextValue }))
                          }
                        />
                      </Card>
                    ))}
                    {!directorStudents.length ? (
                      <div className="text-muted">No hay estudiantes con preinformes que coincidan con la búsqueda.</div>
                    ) : null}
                  </div>
                )}
                <div className="sticky-action-bar">
                  <div className="sticky-action-card d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3">
                    <div className="sticky-action-meta">
                      Esta acción solo está disponible para el director de grupo del grado seleccionado.
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      <Button variant="outline-dark" onClick={() => loadDirectorPanel()}>
                        Recargar panel
                      </Button>
                      <Button variant="outline-secondary" onClick={clearDirectorObservation}>
                        Eliminar observación
                      </Button>
                      <Button onClick={saveDirectorObservations}>Guardar observaciones del director</Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted mb-0">
                Selecciona <strong>Ver resumen</strong> o cambia el grado para cargar el panel del director.
              </div>
            )}
            {directorPanelError ? <Alert className="mt-3 mb-0" variant="warning">{directorPanelError}</Alert> : null}
          </Card>
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
      ) : activeModule === 'director-observations' ? (
        <div className="pt-2">
          {!reportGradeOptions.length ? <Alert variant="warning">No tienes grados asignados como director de grupo.</Alert> : null}
          <Row>
            <Col md={4} className="mb-3">
              <Form.Label>Período</Form.Label>
              <Form.Select value={form.periodId} onChange={(e) => updateField('periodId', e.target.value)}>
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
              <Form.Select value={form.gradeId} onChange={(e) => updateField('gradeId', e.target.value)}>
                <option value="">Seleccione</option>
                {reportGradeOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={4} className="d-flex align-items-end mb-3">
              <Button variant="outline-dark" onClick={() => loadDirectorPanel()}>
                Cargar observaciones
              </Button>
            </Col>
          </Row>

          <div className="d-flex gap-2 mb-3">
            <Button variant={directorTab === 'individual' ? 'dark' : 'outline-dark'} onClick={() => setDirectorTab('individual')}>
              Individual
            </Button>
            <Button variant={directorTab === 'group' ? 'dark' : 'outline-dark'} onClick={() => setDirectorTab('group')}>
              Grupal
            </Button>
            <Button variant={directorTab === 'preview' ? 'dark' : 'outline-dark'} onClick={() => setDirectorTab('preview')}>
              Previsualización
            </Button>
          </div>

          {!form.periodId || !form.gradeId ? (
            <Card className="glass-card p-3">
              <div className="text-muted">Selecciona un período y un grado para gestionar las observaciones del director.</div>
            </Card>
          ) : !directorPanel ? (
            <Card className="glass-card p-3">
              <div className="text-muted">Usa <strong>Cargar observaciones</strong> para abrir el panel del director.</div>
            </Card>
          ) : directorTab === 'individual' ? (
            <>
              <Row className="g-3 mb-3">
                <Col md={6}>
                  <Form.Label>Buscar estudiante</Form.Label>
                  <Form.Control
                    value={directorStudentSearch}
                    placeholder="Buscar por apellido, nombre o ID"
                    onChange={(e) => setDirectorStudentSearch(e.target.value)}
                  />
                </Col>
                <Col md={6}>
                  <Form.Label>Estudiante</Form.Label>
                  <Form.Select value={directorSelectedStudentId} onChange={(e) => setDirectorSelectedStudentId(e.target.value)}>
                    <option value="">Seleccione</option>
                    {directorStudents.map((student) => (
                      <option key={student.studentId} value={student.studentId}>
                        {student.lastName} {student.firstName}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>

              {selectedDirectorStudent ? (
                <Card className="glass-card p-3">
                  <div className="mb-2">
                    <strong>{`${selectedDirectorStudent.lastName} ${selectedDirectorStudent.firstName}`.trim()}</strong>
                    <div className="text-muted small">{selectedDirectorStudent.studentId}</div>
                  </div>
                  <RichTextEditor
                    label="Observación del director"
                    rows={6}
                    value={directorStudentObservations[selectedDirectorStudent.studentId] || ''}
                    onChange={(nextValue) =>
                      setDirectorStudentObservations((current) => ({ ...current, [selectedDirectorStudent.studentId]: nextValue }))
                    }
                  />
                </Card>
              ) : (
                <Card className="glass-card p-3">
                  <div className="text-muted">Selecciona un estudiante para escribir su observación.</div>
                </Card>
              )}
            </>
          ) : directorTab === 'group' ? (
            <>
              <Card className="glass-card p-3 mb-3">
                <div className="section-title mb-2">Selecciona los estudiantes</div>
                <div className="d-flex flex-column gap-2">
                  {directorStudents.map((student) => (
                    <Form.Check
                      key={student.studentId}
                      type="checkbox"
                      id={`director-group-${student.studentId}`}
                      label={`${student.lastName} ${student.firstName} (${student.studentId})`}
                      checked={directorSelectedBulkIds.includes(student.studentId)}
                      onChange={(e) =>
                        setDirectorSelectedBulkIds((current) =>
                          e.target.checked
                            ? [...new Set([...current, student.studentId])]
                            : current.filter((item) => item !== student.studentId)
                        )
                      }
                    />
                  ))}
                </div>
              </Card>
              <Card className="glass-card p-3">
                <RichTextEditor
                  label="Observación grupal del director"
                  rows={6}
                  value={directorBulkObservation}
                  onChange={setDirectorBulkObservation}
                  helperText="Esta observación se aplicará únicamente a los estudiantes seleccionados."
                />
              </Card>
            </>
          ) : (
            <Row className="g-3">
              <Col lg={5}>
                <Card className="glass-card p-3 h-100">
                  <div className="section-title mb-2">Estudiantes con observación</div>
                  <div className="d-flex flex-column gap-2">
                    {directorStudents.map((student) => (
                      <button
                        key={student.studentId}
                        type="button"
                        className={`module-tile w-100 text-start ${directorPreviewStudentId === student.studentId ? 'module-blue' : 'module-slate'}`}
                        onClick={() => setDirectorPreviewStudentId(student.studentId)}
                      >
                        <div className="module-tile-title">{`${student.lastName} ${student.firstName}`.trim()}</div>
                        <div className="module-tile-body">{student.studentId}</div>
                      </button>
                    ))}
                  </div>
                </Card>
              </Col>
              <Col lg={7}>
                <Card className="glass-card p-3 h-100">
                  <div className="section-title mb-2">Observación guardada</div>
                  {selectedDirectorPreviewStudent ? (
                    selectedDirectorPreviewStudent.directorObservations ? (
                      <div dangerouslySetInnerHTML={{ __html: selectedDirectorPreviewStudent.directorObservations }} />
                    ) : (
                      <div className="text-muted">Este estudiante no tiene observación del director registrada.</div>
                    )
                  ) : (
                    <div className="text-muted">Selecciona un estudiante para ver su observación.</div>
                  )}
                </Card>
              </Col>
            </Row>
          )}

          {directorTab !== 'preview' && directorPanel ? (
            <div className="sticky-action-bar">
              <div className="sticky-action-card d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3">
                <div className="sticky-action-meta">
                  Esta acción solo modifica el texto de observación del director de grupo.
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <Button variant="outline-dark" onClick={() => loadDirectorPanel()}>
                    Recargar panel
                  </Button>
                  <Button variant="outline-secondary" onClick={clearDirectorObservation}>
                    Eliminar observación
                  </Button>
                  <Button onClick={saveDirectorObservations}>Guardar observaciones del director</Button>
                </div>
              </div>
            </div>
          ) : null}

          {directorPanelError ? <Alert className="mt-3" variant="warning">{directorPanelError}</Alert> : null}
          {error ? <Alert className="mt-3" variant="danger">{error}</Alert> : null}
          {message ? <Alert className="mt-3" variant="success">{message}</Alert> : null}
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
                  <Form.Label>Período</Form.Label>
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

              <Card className="glass-card p-3 mb-3">
                <div className="section-title mb-2">Copiar preinformes a otra asignatura del grupo</div>
                <div className="text-muted mb-3">
                  Copia los preinformes ya creados de esta asignatura hacia otra asignatura del mismo grado que también dictas.
                </div>
                <Row className="g-3 align-items-end">
                  <Col md={6}>
                    <Form.Label>Asignatura destino</Form.Label>
                    <Form.Select value={copyTargetSubjectId} onChange={(e) => setCopyTargetSubjectId(e.target.value)}>
                      <option value="">Seleccione</option>
                      {copySubjectOptions.map((item) => (
                        <option key={item.id} value={item.subjectId}>
                          {item.subjectName}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <div className="d-grid">
                      <Button
                        variant="outline-primary"
                        disabled={!form.periodId || !form.gradeId || !form.subjectId || !copyTargetSubjectId}
                        onClick={copyReportsToAnotherSubject}
                      >
                        Copiar preinformes a otra asignatura
                      </Button>
                    </div>
                  </Col>
                </Row>
              </Card>

              {createMode === 'individual' || createMode === 'group' ? (
                <Card className="glass-card p-3 mb-3">
                  <div className="section-title mb-2">Asignaturas para aplicar este preinforme</div>
                  <div className="text-muted mb-3">
                    La asignatura principal siempre se incluye. Puedes marcar otras asignaturas del mismo grado que también dictas para guardar el mismo contenido.
                  </div>
                  <Row className="g-2">
                    {createSubjectOptions.map((item) => {
                      const isPrimary = item.subjectId === form.subjectId;
                      return (
                        <Col md={6} xl={4} key={`create-subject-${item.subjectId}`}>
                          <Card className="glass-card p-2 h-100">
                            <Form.Check
                              type="checkbox"
                              id={`create-subject-${item.subjectId}`}
                              label={item.subjectName}
                              checked={item.selected}
                              disabled={isPrimary}
                              onChange={() => toggleCreateSubject(item.subjectId)}
                            />
                            <div className="text-muted small mt-1">
                              {isPrimary ? 'Asignatura principal' : 'Aplicar también en esta asignatura'}
                            </div>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                </Card>
              ) : null}

              {createMode === 'individual' ? (
                <Form onSubmit={handleCreate}>
                  <Row>
                    <Col md={6} className="mb-3">
                      <Form.Label>Estudiante</Form.Label>
                      <div className="d-flex gap-2">
                        <Form.Control
                          className="mb-0"
                          value={studentSearch}
                          placeholder="Buscar estudiante por apellido, nombre o ID"
                          onChange={(e) => setStudentSearch(e.target.value)}
                        />
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
                      <Form.Select className="mt-2" value={form.studentId} onChange={(e) => updateField('studentId', e.target.value)} required>
                        <option value="">Seleccione</option>
                        {studentOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.firstName} {item.lastName}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                  </Row>

                  <Checklist
                    title="Convivencia"
                    questions={data.questions.convivencia}
                    selected={form.convivencia}
                    onToggle={(value) => toggleValue('convivencia', value)}
                  />
                  <Checklist
                    title="Académicas"
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
                  <div className="sticky-action-bar">
                    <div className="sticky-action-card d-flex flex-wrap justify-content-between align-items-center gap-3">
                      <div className="sticky-action-meta">El guardado queda visible para seguir trabajando sin volver al final del formulario.</div>
                      <div className="d-flex flex-wrap gap-2">
                        <Button type="submit">Guardar</Button>
                      </div>
                    </div>
                  </div>
                </Form>
              ) : (
                <div>
                  <div className="sticky-action-bar">
                    <div className="sticky-action-card d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                      <div className="sticky-action-meta">
                        {selectedBulkIds.length ? `${selectedBulkIds.length} estudiantes seleccionados en la matriz.` : 'Usa estas acciones para cargar y guardar la carga grupal.'}
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        <Button onClick={handleBulkLoad}>Cargar estudiantes</Button>
                        <Button variant="outline-success" onClick={handleBulkCreate} disabled={!availableStudents.length}>
                          Guardar carga grupal
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Card className="glass-card p-3 mb-3">
                    <RichTextEditor
                      label="Observación grupal opcional"
                      rows={4}
                      value={groupObservations}
                      onChange={setGroupObservations}
                      helperText="Esta observación solo se aplicará a los estudiantes que tengan al menos una dificultad marcada en esta carga grupal."
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
                        Selecciona período, grado y asignatura. Luego usa <strong>Cargar estudiantes</strong> para abrir la matriz grupal.
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
                  <Form.Label>Modo</Form.Label>
                  <Form.Select value={editMode} onChange={(e) => setEditMode(e.target.value)}>
                    <option value="individual">Individual</option>
                    <option value="group">Grupal</option>
                  </Form.Select>
                </Col>
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

              {editMode === 'individual' ? (
                <>
                  <Form.Group className="mb-3">
                    <Form.Label>Preinforme</Form.Label>
                    <Form.Control
                      className="mb-2"
                      value={editSearch}
                      placeholder="Buscar estudiante por apellido, nombre o ID"
                      onChange={(e) => setEditSearch(e.target.value)}
                    />
                    <Form.Select value={selectedEdit} onChange={(e) => loadReportToForm(e.target.value)}>
                      <option value="">Seleccione</option>
                      {editableFilteredReports.map((item) => {
                        const student = data.students.find((studentItem) => studentItem.id === item.studentId);
                        return (
                          <option key={item.id} value={item.id}>
                            {student?.lastName || ''} {student?.firstName || ''}
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
                    title="Académicas"
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
                </>
              ) : editableGroupStudents.length ? (
                <>
                  <Alert variant="info">
                    En modo grupal solo se muestran los estudiantes que tienen al menos una dificultad marcada.
                  </Alert>
                  <BulkMatrix
                    students={editableGroupStudents}
                    bulkRows={editBulkRows}
                    selectedBulkIds={selectedEditBulkIds}
                    setSelectedBulkIds={setSelectedEditBulkIds}
                    onToggleQuestion={toggleEditBulkQuestion}
                    onClearMarks={clearEditBulkMarks}
                    data={data}
                  />
                </>
              ) : (
                <Card className="glass-card p-3 mb-3">
                  <div className="text-muted mb-0">
                    No hay preinformes con dificultades marcadas para este grado y asignatura.
                  </div>
                </Card>
              )}

              {error ? <Alert variant="danger">{error}</Alert> : null}
              {message ? <Alert variant="success">{message}</Alert> : null}

              {editMode === 'individual' ? (
                <div className="sticky-action-bar">
                  <div className="sticky-action-card d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div className="sticky-action-meta">Las acciones de edición individual permanecen visibles mientras revisas el preinforme.</div>
                    <div className="d-flex flex-wrap gap-2">
                      <Button onClick={() => applyEdit('update')} disabled={!selectedEdit}>
                        Guardar cambios
                      </Button>
                      <Button variant="outline-secondary" onClick={clearObservationOnly} disabled={!selectedEdit}>
                        Eliminar observación
                      </Button>
                      <Button variant="outline-danger" onClick={() => applyEdit('delete')} disabled={!selectedEdit}>
                        Borrar
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="sticky-action-bar">
                  <div className="sticky-action-card d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div className="sticky-action-meta">
                      {selectedEditBulkIds.length
                        ? `${selectedEditBulkIds.length} preinformes marcados para borrar.`
                        : 'Guarda cambios grupales o selecciona estudiantes para borrar solo esos preinformes.'}
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      <Button onClick={applyBulkEdit} disabled={!editableGroupStudents.length}>
                        Guardar cambios grupales
                      </Button>
                      <Button variant="outline-danger" onClick={deleteSelectedBulkReports} disabled={!selectedEditBulkIds.length}>
                        Borrar seleccionados
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Tab>
          <Tab eventKey="preview" title="Previsualizar">
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
                  <Button onClick={handleEditLoad}>Cargar preinformes</Button>
                </Col>
              </Row>

              <div className="sticky-action-bar">
                <div className="sticky-action-card d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                  <div className="sticky-action-meta">
                    {previewReports.length
                      ? `${previewReports.length} preinformes cargados para previsualización grupal.`
                      : 'Selecciona grado y asignatura para cargar la previsualización grupal.'}
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <Form.Control
                      value={previewSearch}
                      placeholder="Buscar estudiante por apellido, nombre o ID"
                      onChange={(e) => setPreviewSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Card className="glass-card p-3 mb-3">
                <div className="section-title mb-2">Matriz de previsualización</div>
                <div className="text-muted mb-3">
                  La matriz muestra las marcas registradas para cada estudiante. Haz clic sobre una fila para ver sus observaciones.
                </div>
                {previewReports.length ? (
                  <PreviewMatrix
                    students={previewReports
                      .map((report) => data.students.find((item) => item.id === report.studentId))
                      .filter(Boolean)
                      .sort(compareStudents)}
                    reports={previewReports}
                    selectedReportId={selectedPreviewReport?.id || ''}
                    onSelectReport={setSelectedPreviewReportId}
                    data={data}
                  />
                ) : (
                  <div className="text-muted">No hay preinformes para mostrar con este filtro.</div>
                )}
              </Card>
              <Card className="glass-card p-3">
                <div className="section-title mb-2">Observaciones del estudiante seleccionado</div>
                {selectedPreviewReport ? (
                  <>
                    <div className="mb-3">
                      <strong>
                        {(() => {
                          const student = data.students.find((item) => item.id === selectedPreviewReport.studentId);
                          return student ? `${student.lastName} ${student.firstName}`.trim() : selectedPreviewReport.studentId;
                        })()}
                      </strong>
                    </div>
                    {selectedPreviewReport.observations ? (
                      <div dangerouslySetInnerHTML={{ __html: selectedPreviewReport.observations }} />
                    ) : (
                      <div className="text-muted">Este estudiante no tiene observaciones registradas.</div>
                    )}
                  </>
                ) : (
                  <div className="text-muted">Carga preinformes y selecciona un estudiante para ver sus observaciones.</div>
                )}
              </Card>

              {error ? <Alert className="mt-3" variant="danger">{error}</Alert> : null}
              {message ? <Alert className="mt-3" variant="success">{message}</Alert> : null}
            </div>
          </Tab>
        </Tabs>
      )}
    </Card>
  );
}


