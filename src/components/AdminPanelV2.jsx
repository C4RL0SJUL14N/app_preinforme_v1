import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Tab, Tabs } from 'react-bootstrap';
import { apiFetch } from '../apiClient.js';
import { AssignmentsModule } from './admin/AssignmentsModule.jsx';
import { ActivityModule } from './admin/ActivityModule.jsx';
import { GradesModule } from './admin/GradesModule.jsx';
import { InstitutionsModule } from './admin/InstitutionsModule.jsx';
import { PeriodsModule } from './admin/PeriodsModule.jsx';
import { ReportsModule } from './admin/ReportsModule.jsx';
import { SedesModule } from './admin/SedesModule.jsx';
import { StudentsModule } from './admin/StudentsModule.jsx';
import { SubjectsModule } from './admin/SubjectsModule.jsx';
import { TeachersModule } from './admin/TeachersModule.jsx';
import { EMPTY_FORMS, IMPORT_SCHEMAS, MODULE_TITLES, fileToBase64, freshForm, getModuleStats } from './admin/shared.jsx';

function getPdfDownloadName(filters) {
  if (filters.mode === 'grade_student_zip') return 'preinformes.zip';
  if (filters.mode === 'individual') return 'preinforme-individual.pdf';
  if (filters.mode === 'grade_single_pdf') return 'preinformes-grado.pdf';
  if (filters.mode === 'reported_teachers_summary') return 'docentes-reportaron.pdf';
  return 'preinformes.pdf';
}

function getFirstAdminFocusKey(moduleKey) {
  const firstField = Object.keys(EMPTY_FORMS[moduleKey] || {})[0];
  return firstField ? `${moduleKey}-${firstField}` : '';
}

function getStorageKey(moduleKey, scope) {
  return `preinformes:admin:${moduleKey}:${scope}`;
}

function ImportSection({
  moduleKey,
  importFile,
  setImportFile,
  sheetText,
  setSheetText,
  importWorkbook,
  importSheetData
}) {
  const schema = IMPORT_SCHEMAS[moduleKey];
  return (
    <Card className="glass-card p-3 mt-4">
      <div className="mb-3">
        <div className="section-title">Carga masiva</div>
        <div className="text-muted">Importa datos para este mÃ³dulo desde Excel o JSON.</div>
      </div>
      {schema ? (
        <Row className="g-3 mb-4">
          <Col lg={6}>
            <Card className="glass-card p-3 h-100">
              <div className="section-title">Campos esperados</div>
              <div className="text-muted mb-2">La hoja o archivo debe incluir estas columnas exactamente:</div>
              <code>{schema.fields.join(', ')}</code>
            </Card>
          </Col>
          <Col lg={6}>
            <Card className="glass-card p-3 h-100">
              <div className="section-title">Ejemplo de fila</div>
              <pre className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(schema.example, null, 2)}</pre>
            </Card>
          </Col>
        </Row>
      ) : null}
      <Row className="g-3">
        <Col lg={6}>
          <label className="form-label">Archivo Excel o CSV</label>
          <input className="form-control" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          <Button className="mt-3" onClick={() => importWorkbook(moduleKey)} disabled={!importFile}>
            Importar archivo
          </Button>
        </Col>
        <Col lg={6}>
          <label className="form-label">JSON pegado</label>
          <textarea className="form-control mb-3" rows="8" value={sheetText} onChange={(e) => setSheetText(e.target.value)} />
          <Button variant="outline-primary" onClick={() => importSheetData(moduleKey)}>
            Importar JSON
          </Button>
        </Col>
      </Row>
    </Card>
  );
}

export function AdminPanelV2({ data, onRefresh, activeModule = 'Teachers', onBack }) {
  const panelRef = useRef(null);
  const lastFocusedFieldRef = useRef('');
  const [panelTab, setPanelTab] = useState(activeModule === 'Reports' ? 'reports' : 'manual');
  const [formState, setFormState] = useState(freshForm(activeModule));
  const [editingId, setEditingId] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [sheetText, setSheetText] = useState('[{"name":"","active":"TRUE"}]');
  const [reportFilters, setReportFilters] = useState({
    periodId: '',
    sedeId: '',
    gradeId: '',
    teacherId: '',
    mode: 'all',
    studentId: ''
  });
  const [reportSummary, setReportSummary] = useState(null);
  const [teacherUsageSummary, setTeacherUsageSummary] = useState(data.teacherUsageSummary || null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    setPanelTab(activeModule === 'Reports' ? 'reports' : 'manual');
    if (activeModule === 'Institutions' && data.institutions?.[0]) {
      setFormState({ ...freshForm('Institutions'), ...data.institutions[0] });
      setEditingId(data.institutions[0].id || '');
    } else {
      setFormState(freshForm(activeModule));
      setEditingId('');
    }
    setShowInactive(false);
    setError('');
    setMessage('');
    lastFocusedFieldRef.current = '';
    setTeacherUsageSummary(data.teacherUsageSummary || null);
  }, [activeModule, data.institutions]);

  useEffect(() => {
    setTeacherUsageSummary(data.teacherUsageSummary || null);
  }, [data.teacherUsageSummary]);

  useEffect(() => {
    const storedPanelTab = window.localStorage.getItem(getStorageKey(activeModule, 'panelTab'));
    const storedShowInactive = window.localStorage.getItem(getStorageKey(activeModule, 'showInactive'));
    const storedReportFilters = window.localStorage.getItem(getStorageKey(activeModule, 'reportFilters'));

    if (storedPanelTab) {
      setPanelTab(storedPanelTab);
    }
    if (storedShowInactive !== null) {
      setShowInactive(storedShowInactive === 'true');
    }
    if (storedReportFilters) {
      try {
        setReportFilters((current) => ({ ...current, ...JSON.parse(storedReportFilters) }));
      } catch {
        window.localStorage.removeItem(getStorageKey(activeModule, 'reportFilters'));
      }
    }
  }, [activeModule]);

  useEffect(() => {
    window.localStorage.setItem(getStorageKey(activeModule, 'panelTab'), panelTab);
  }, [activeModule, panelTab]);

  useEffect(() => {
    window.localStorage.setItem(getStorageKey(activeModule, 'showInactive'), String(showInactive));
  }, [activeModule, showInactive]);

  useEffect(() => {
    window.localStorage.setItem(getStorageKey(activeModule, 'reportFilters'), JSON.stringify(reportFilters));
  }, [activeModule, reportFilters]);

  function rememberFocusedField(event) {
    const focusKey = event.target?.dataset?.adminFocus;
    if (focusKey) {
      lastFocusedFieldRef.current = focusKey;
    }
  }

  function restoreFormFocus(moduleKey, preferredFocusKey = '') {
    const focusKey = preferredFocusKey || lastFocusedFieldRef.current || getFirstAdminFocusKey(moduleKey);
    if (!focusKey) return;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = panelRef.current?.querySelector(`[data-admin-focus="${focusKey}"]`);
        if (!target) return;
        target.focus();
        if (typeof target.select === 'function' && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          target.select();
        }
      });
    });
  }

  async function saveEntity(moduleKey) {
    setError('');
    setMessage('');
    const focusKey = lastFocusedFieldRef.current || getFirstAdminFocusKey(moduleKey);
    try {
      await apiFetch('/api/admin/entity', {
        method: 'POST',
        body: JSON.stringify({
          entityName: moduleKey,
          payload: editingId ? { ...formState, id: editingId } : formState
        })
      });
      setMessage('Registro guardado.');
      setEditingId('');
      setFormState(freshForm(moduleKey));
      await onRefresh();
      restoreFormFocus(moduleKey, focusKey);
    } catch (err) {
      setError(err.message);
      restoreFormFocus(moduleKey, focusKey);
    }
  }

  async function deleteEntity(moduleKey) {
    if (!editingId) return;
    const confirmed = window.confirm('Se eliminarÃ¡ este registro de la base de datos y no se podrÃ¡ recuperar desde la aplicaciÃ³n. Â¿Desea continuar?');
    if (!confirmed) return;
    setError('');
    setMessage('');
    const focusKey = getFirstAdminFocusKey(moduleKey);
    try {
      await apiFetch(`/api/admin/entity?entityName=${encodeURIComponent(moduleKey)}&id=${encodeURIComponent(editingId)}`, {
        method: 'DELETE'
      });
      setMessage('Registro eliminado.');
      setEditingId('');
      setFormState(freshForm(moduleKey));
      await onRefresh();
      restoreFormFocus(moduleKey, focusKey);
    } catch (err) {
      setError(err.message);
      restoreFormFocus(moduleKey, focusKey);
    }
  }

  async function importWorkbook(moduleKey) {
    if (!importFile) return;
    setError('');
    setMessage('');
    try {
      const fileBase64 = await fileToBase64(importFile);
      await apiFetch('/api/admin/import-workbook', {
        method: 'POST',
        body: JSON.stringify({ entityType: moduleKey, fileBase64 })
      });
      setMessage('Importacion desde Excel completada.');
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function importSheetData(moduleKey) {
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/admin/import-sheet', {
        method: 'POST',
        body: JSON.stringify({ entityType: moduleKey, rows: JSON.parse(sheetText) })
      });
      setMessage('Importacion desde JSON completada.');
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deletePreReportsByPeriod(period) {
    if (!period?.id) return;
    const confirmed = window.confirm(
      `Advertencia del sistema:\n\nEsta acciÃ³n eliminarÃ¡ de forma permanente todos los preinformes registrados en el perÃ­odo "${period.name}".\n\nLos datos borrados no podrÃ¡n recuperarse desde la aplicaciÃ³n.\n\nÂ¿Desea continuar?`
    );
    if (!confirmed) return;

    setError('');
    setMessage('');
    try {
      const result = await apiFetch('/api/admin/pre-reports/delete-by-period', {
        method: 'POST',
        body: JSON.stringify({ periodId: period.id })
      });
      setMessage(`Se eliminaron ${result.deleted} preinformes del perÃ­odo ${result.periodName}.`);
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteAssignmentsByGrade(gradeId) {
    if (!gradeId) return;
    const grade = data.grades.find((item) => item.id === gradeId);
    const confirmed = window.confirm(
      `Advertencia del sistema:\n\nEsta acciÃ³n eliminarÃ¡ todas las asignaciones acadÃ©micas del grado "${grade?.name || gradeId}".\n\nSi alguna asignaciÃ³n ya tiene preinformes registrados, la operaciÃ³n serÃ¡ rechazada.\n\nÂ¿Desea continuar?`
    );
    if (!confirmed) return;

    setError('');
    setMessage('');
    try {
      const result = await apiFetch('/api/admin/grade-subjects/delete-by-grade', {
        method: 'POST',
        body: JSON.stringify({ gradeId })
      });
      setMessage(`Se eliminaron ${result.deleted} asignaciones del grado ${result.gradeName}.`);
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function copyAssignmentsBetweenGrades(sourceGradeId, targetGradeId) {
    if (!sourceGradeId || !targetGradeId) return;
    const sourceGrade = data.grades.find((item) => item.id === sourceGradeId);
    const targetGrade = data.grades.find((item) => item.id === targetGradeId);
    const confirmed = window.confirm(
      `ConfirmaciÃ³n del sistema:\n\nSe copiarÃ¡n las asignaciones activas de "${sourceGrade?.name || sourceGradeId}" hacia "${targetGrade?.name || targetGradeId}".\n\nLas asignaciones que ya existan en el grado destino no se duplicarÃ¡n.\n\nÂ¿Desea continuar?`
    );
    if (!confirmed) return;

    setError('');
    setMessage('');
    try {
      const sourceAssignments = data.gradeSubjects.filter((item) => item.gradeId === sourceGradeId && item.active !== 'FALSE');
      const targetSubjects = new Set(
        data.gradeSubjects
          .filter((item) => item.gradeId === targetGradeId && item.active !== 'FALSE')
          .map((item) => item.subjectId)
      );
      const rowsToCopy = sourceAssignments.filter((item) => !targetSubjects.has(item.subjectId));
      const teacherOverrides = {};
      const targetSedeTeachers = data.teachers.filter(
        (item) => item.active !== 'FALSE' && item.sedeId === targetGrade?.sedeId
      );

      if (!targetSedeTeachers.length) {
        throw new Error('La sede del grado destino no tiene docentes activos disponibles para reasignar');
      }

      const conflictingAssignments = rowsToCopy.filter((assignment) => {
        const teacher = data.teachers.find((item) => item.id === assignment.teacherId);
        return teacher?.sedeId !== targetGrade?.sedeId;
      });

      const groupsByTeacher = conflictingAssignments.reduce((accumulator, assignment) => {
        const current = accumulator.get(assignment.teacherId) || [];
        current.push(assignment);
        accumulator.set(assignment.teacherId, current);
        return accumulator;
      }, new Map());

      for (const [sourceTeacherId, assignmentsForTeacher] of groupsByTeacher.entries()) {
        const sourceTeacher = data.teachers.find((item) => item.id === sourceTeacherId);
        const teacherLabel = sourceTeacher ? `${sourceTeacher.firstName} ${sourceTeacher.lastName}`.trim() : sourceTeacherId;
        const teacherOptionsText = targetSedeTeachers.map((item) => `${item.id}: ${item.firstName} ${item.lastName}`.trim()).join('\n');

        if (assignmentsForTeacher.length > 1) {
          const sameTeacherForAll = window.confirm(
            `El docente "${teacherLabel}" no pertenece a la misma sede que el grado de destino y aparece en ${assignmentsForTeacher.length} asignaciones.\n\nÂ¿Deseas usar el mismo docente de reemplazo para las demÃ¡s asignaciones de este docente?`
          );

          if (sameTeacherForAll) {
            const replacementId = window.prompt(
              `Indica el ID del docente que asumirÃ¡ las asignaciones de "${teacherLabel}" en "${targetGrade?.name || targetGradeId}".\n\nDocentes disponibles en la sede de destino:\n${teacherOptionsText}`
            );
            if (!replacementId) {
              throw new Error('La copia fue cancelada porque falta indicar el docente reemplazo');
            }
            assignmentsForTeacher.forEach((assignment) => {
              teacherOverrides[assignment.id] = replacementId.trim();
            });
            continue;
          }
        }

        for (const assignment of assignmentsForTeacher) {
          const subject = data.subjects.find((item) => item.id === assignment.subjectId);
          const replacementId = window.prompt(
            `La asignatura "${subject?.name || assignment.subjectId}" del docente "${teacherLabel}" no puede copiarse porque ese docente no pertenece a la sede del grado de destino.\n\nIndica el ID del docente que la asumirÃ¡ en "${targetGrade?.name || targetGradeId}".\n\nDocentes disponibles en la sede de destino:\n${teacherOptionsText}`
          );
          if (!replacementId) {
            throw new Error('La copia fue cancelada porque falta indicar el docente reemplazo');
          }
          teacherOverrides[assignment.id] = replacementId.trim();
        }
      }

      const result = await apiFetch('/api/admin/grade-subjects/copy-grade', {
        method: 'POST',
        body: JSON.stringify({ sourceGradeId, targetGradeId, teacherOverrides })
      });
      setMessage(
        `Se copiaron ${result.copied} asignaciones de ${result.sourceGradeName} a ${result.targetGradeName}. ${result.skipped ? `Se omitieron ${result.skipped} que ya existÃ­an.` : ''}`.trim()
      );
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reassignAssignmentsTeacher(assignmentIds, teacherId) {
    if (!assignmentIds?.length || !teacherId) return;
    const teacher = data.teachers.find((item) => item.id === teacherId);
    const confirmed = window.confirm(
      `ConfirmaciÃ³n del sistema:\n\nSe cambiarÃ¡n ${assignmentIds.length} asignaciones al docente "${teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : teacherId}".\n\nÂ¿Desea continuar?`
    );
    if (!confirmed) return;

    setError('');
    setMessage('');
    try {
      const result = await apiFetch('/api/admin/grade-subjects/reassign-teacher', {
        method: 'POST',
        body: JSON.stringify({ assignmentIds, teacherId })
      });
      setMessage(`Se reasignaron ${result.updated} asignaciones al docente ${result.teacherName}.`);
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadSummary() {
    setError('');
    setMessage('');
    try {
      const query = new URLSearchParams(reportFilters).toString();
      setReportSummary(await apiFetch(`/api/admin/reports/summary?${query}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function exportCsv() {
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${window.localStorage.getItem('preinformes-token') || ''}`
        },
        body: JSON.stringify(reportFilters)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'No fue posible exportar');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'preinformes-detalle.csv';
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadTeacherUsage() {
    setError('');
    try {
      const result = await apiFetch('/api/admin/teacher-usage');
      setTeacherUsageSummary(result);
    } catch (err) {
      setError(err.message);
    }
  }

  async function downloadPdf() {
    setError('');
    setMessage('');
    try {
      const blob = await apiFetch('/api/pdf', {
        method: 'POST',
        body: JSON.stringify({
          periodId: reportFilters.periodId,
          sedeId: reportFilters.sedeId,
          gradeId: reportFilters.gradeId,
          teacherId: reportFilters.teacherId,
          mode: reportFilters.mode,
          studentId: reportFilters.studentId
        })
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = getPdfDownloadName(reportFilters);
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  async function downloadSummaryPdf() {
    setError('');
    setMessage('');
    try {
      const blob = await apiFetch('/api/pdf', {
        method: 'POST',
        body: JSON.stringify({
          periodId: reportFilters.periodId,
          sedeId: reportFilters.sedeId,
          gradeId: reportFilters.gradeId,
          teacherId: reportFilters.teacherId,
          mode: 'admin_summary'
        })
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'resumen-reportes.pdf';
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  const moduleStats = getModuleStats(activeModule, data);
  const contextChips = useMemo(() => {
    const chips = [
      { label: 'MÃ³dulo', value: MODULE_TITLES[activeModule] || 'MÃ³dulo institucional' },
      {
        label: 'PestaÃ±a',
        value: panelTab === 'import' ? 'Carga masiva' : activeModule === 'Reports' ? 'Reportes' : activeModule === 'Activity' ? 'Actividad' : 'GestiÃ³n'
      }
    ];
    if (activeModule === 'Reports') {
      const selectedPeriod = data.periods.find((item) => item.id === reportFilters.periodId)?.name || 'Todos';
      const selectedSede = data.sedes.find((item) => item.id === reportFilters.sedeId)?.name || 'Todas';
      const selectedGrade = data.grades.find((item) => item.id === reportFilters.gradeId)?.name || 'Todos';
      const selectedTeacher =
        reportFilters.teacherId
          ? `${data.teachers.find((item) => item.id === reportFilters.teacherId)?.firstName || ''} ${data.teachers.find((item) => item.id === reportFilters.teacherId)?.lastName || ''}`.trim()
          : 'Todos';
      chips.push(
        { label: 'PerÃ­odo', value: selectedPeriod },
        { label: 'Sede', value: selectedSede },
        { label: 'Grado', value: selectedGrade },
        { label: 'Docente', value: selectedTeacher || 'Todos' }
      );
    } else {
      chips.push({ label: 'Inactivos', value: showInactive ? 'Visibles' : 'Ocultos' });
    }
    return chips;
  }, [activeModule, data.grades, data.periods, data.sedes, data.teachers, panelTab, reportFilters, showInactive]);
  const sharedProps = { data, formState, setFormState, editingId, setEditingId, showInactive };
  const moduleContent = {
    Institutions: <InstitutionsModule {...sharedProps} onSave={() => saveEntity('Institutions')} />,
    Sedes: <SedesModule {...sharedProps} onSave={() => saveEntity('Sedes')} onDelete={() => deleteEntity('Sedes')} />,
    Teachers: <TeachersModule {...sharedProps} onSave={() => saveEntity('Teachers')} onDelete={() => deleteEntity('Teachers')} />,
    Subjects: <SubjectsModule {...sharedProps} onSave={() => saveEntity('Subjects')} onDelete={() => deleteEntity('Subjects')} />,
    Grades: <GradesModule {...sharedProps} onSave={() => saveEntity('Grades')} onDelete={() => deleteEntity('Grades')} />,
    Students: <StudentsModule {...sharedProps} onSave={() => saveEntity('Students')} onDelete={() => deleteEntity('Students')} />,
    GradeSubjects: (
      <AssignmentsModule
        {...sharedProps}
        onSave={() => saveEntity('GradeSubjects')}
        onDelete={() => deleteEntity('GradeSubjects')}
        onDeleteByGrade={deleteAssignmentsByGrade}
        onCopyByGrade={copyAssignmentsBetweenGrades}
        onReassignTeacher={reassignAssignmentsTeacher}
      />
    ),
    Periods: (
      <PeriodsModule
        {...sharedProps}
        onSave={() => saveEntity('Periods')}
        onDelete={() => deleteEntity('Periods')}
        onDeletePreReportsByPeriod={deletePreReportsByPeriod}
      />
    ),
    Reports: (
      <ReportsModule
        data={data}
        reportFilters={reportFilters}
        setReportFilters={setReportFilters}
        reportSummary={reportSummary}
        loadSummary={loadSummary}
        exportCsv={exportCsv}
        downloadPdf={downloadPdf}
        downloadSummaryPdf={downloadSummaryPdf}
        isAdmin
      />
    ),
    Activity: (
      <ActivityModule
        usageSummary={teacherUsageSummary || data.teacherUsageSummary || { activeCount: 0, activeUsers: [] }}
        onRefreshUsage={loadTeacherUsage}
      />
    )
  }[activeModule];

  return (
    <div ref={panelRef} onFocusCapture={rememberFocusedField}>
      <Card className="glass-card page-context-bar p-3 mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <p className="section-title mb-1">AdministraciÃ³n</p>
            <h2 className="h4 mb-0">{MODULE_TITLES[activeModule] || 'MÃ³dulo institucional'}</h2>
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
      </Card>

      {activeModule !== 'Reports' && activeModule !== 'Activity' ? (
        <Row className="g-3 mb-3">
          {moduleStats.map((item) => (
            <Col md={4} xl={4} key={item.label}>
              <Card className={`glass-card p-3 h-100 ${item.tone === 'inactive' ? 'inactive-stat-card' : ''}`}>
                <div className="section-title">{item.label}</div>
                <div className="fs-4 fw-semibold">{item.value}</div>
                {item.tone === 'inactive' ? (
                  <Form.Check
                    className="mt-3"
                    type="switch"
                    id={`show-inactive-${activeModule}`}
                    label="Ver registros inactivos"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                  />
                ) : null}
              </Card>
            </Col>
          ))}
        </Row>
      ) : null}

      <Tabs activeKey={panelTab} onSelect={(key) => setPanelTab(key || 'manual')}>
        <Tab eventKey="manual" title={activeModule === 'Reports' ? 'Reportes' : activeModule === 'Activity' ? 'Actividad en tiempo real' : 'GestiÃ³n del mÃ³dulo'}>
          <div className="pt-3">{moduleContent}</div>
        </Tab>
        {activeModule !== 'Reports' && activeModule !== 'Activity' ? (
          <Tab eventKey="import" title="Carga masiva">
            <ImportSection
              moduleKey={activeModule}
              importFile={importFile}
              setImportFile={setImportFile}
              sheetText={sheetText}
              setSheetText={setSheetText}
              importWorkbook={importWorkbook}
              importSheetData={importSheetData}
            />
          </Tab>
        ) : null}
      </Tabs>

      {error ? <Alert className="mt-3" variant="danger">{error}</Alert> : null}
      {message ? <Alert className="mt-3" variant="success">{message}</Alert> : null}
    </div>
  );
}


