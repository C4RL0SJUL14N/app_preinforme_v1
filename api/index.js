import * as XLSX from 'xlsx';
import { getSessionFromRequest } from '../lib/auth.js';
import { SHEET_NAMES } from '../lib/constants.js';
import {
  createPreReportService,
  createBulkPreReportsService,
  copyAssignmentsBetweenGradesService,
  copyTeacherPreReportsBetweenSubjectsService,
  deleteAssignmentsByGradeService,
  deletePreReportsByPeriodService,
  deleteEntityService,
  deletePreReportService,
  exportAdminDetailCsvService,
  generatePdfService,
  getAdminSummaryService,
  getTeacherUsageService,
  getBootstrapData,
  getDirectorObservationPanelService,
  getEditablePreReports,
  getTeacherStudentsForAssignment,
  importConfigWorkbookService,
  loginService,
  pingSessionService,
  reassignAssignmentsTeacherService,
  saveTeacherSubjectGroupService,
  saveDirectorObservationsService,
  saveEntityService,
  switchSessionViewService,
  deleteTeacherSubjectGroupService,
  updatePreReportService
} from '../lib/service.js';
import { jsonResponse, normalizeCell, readJsonBody, toCsv } from '../lib/utils.js';

function ensureSession(req) {
  const session = getSessionFromRequest(req);
  if (!session?.userId) {
    const error = new Error('Sesion no valida');
    error.statusCode = 401;
    throw error;
  }
  return session;
}

function ensureAdmin(session) {
  if (!session.isAdmin) {
    const error = new Error('Se requieren permisos de administrador');
    error.statusCode = 403;
    throw error;
  }
}

function parseWorkbookRows(base64Content) {
  const workbook = XLSX.read(Buffer.from(base64Content, 'base64'), { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: '', raw: false });
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const { pathname, searchParams } = url;

    if (req.method === 'POST' && pathname === '/api/login') {
      const body = await readJsonBody(req);
      return jsonResponse(res, 200, await loginService(body.login, body.password));
    }

    if (req.method === 'GET' && pathname === '/api/bootstrap') {
      return jsonResponse(res, 200, await getBootstrapData(ensureSession(req)));
    }

    if (req.method === 'POST' && pathname === '/api/session/view') {
      const session = ensureSession(req);
      ensureAdmin(session);
      return jsonResponse(res, 200, await switchSessionViewService(session, await readJsonBody(req)));
    }

    if (req.method === 'POST' && pathname === '/api/session/ping') {
      return jsonResponse(res, 200, await pingSessionService(ensureSession(req), await readJsonBody(req)));
    }

    if (req.method === 'GET' && pathname === '/api/teacher/students') {
      const session = ensureSession(req);
      const students = await getTeacherStudentsForAssignment(
        session,
        searchParams.get('periodId'),
        searchParams.get('gradeId'),
        searchParams.get('subjectId')
      );
      return jsonResponse(res, 200, { students });
    }

    if (req.method === 'GET' && pathname === '/api/teacher/pre-reports') {
      const session = ensureSession(req);
      const preReports = await getEditablePreReports(session, searchParams.get('gradeId'), searchParams.get('subjectId'));
      return jsonResponse(res, 200, { preReports });
    }

    if (req.method === 'GET' && pathname === '/api/teacher/director-observations') {
      const session = ensureSession(req);
      return jsonResponse(
        res,
        200,
        await getDirectorObservationPanelService(session, {
          periodId: searchParams.get('periodId'),
          gradeId: searchParams.get('gradeId')
        })
      );
    }

    if (req.method === 'POST' && pathname === '/api/pre-reports') {
      return jsonResponse(res, 201, await createPreReportService(ensureSession(req), await readJsonBody(req)));
    }

    if (req.method === 'POST' && pathname === '/api/pre-reports/batch') {
      return jsonResponse(res, 201, await createBulkPreReportsService(ensureSession(req), await readJsonBody(req)));
    }

    if (req.method === 'POST' && pathname === '/api/teacher/pre-reports/copy-subject') {
      return jsonResponse(
        res,
        200,
        await copyTeacherPreReportsBetweenSubjectsService(ensureSession(req), await readJsonBody(req))
      );
    }

    if (req.method === 'POST' && pathname === '/api/teacher/director-observations') {
      return jsonResponse(res, 200, await saveDirectorObservationsService(ensureSession(req), await readJsonBody(req)));
    }

    if (req.method === 'POST' && pathname === '/api/teacher/subject-groups') {
      return jsonResponse(res, 200, await saveTeacherSubjectGroupService(ensureSession(req), await readJsonBody(req)));
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/teacher/subject-groups/')) {
      const groupId = pathname.split('/').pop();
      return jsonResponse(res, 200, await deleteTeacherSubjectGroupService(ensureSession(req), groupId));
    }

    if (req.method === 'PUT' && pathname.startsWith('/api/pre-reports/')) {
      const preReportId = pathname.split('/').pop();
      return jsonResponse(
        res,
        200,
        await updatePreReportService(ensureSession(req), preReportId, await readJsonBody(req))
      );
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/pre-reports/')) {
      const preReportId = pathname.split('/').pop();
      return jsonResponse(res, 200, await deletePreReportService(ensureSession(req), preReportId));
    }

    if (req.method === 'POST' && pathname === '/api/admin/entity') {
      const session = ensureSession(req);
      ensureAdmin(session);
      const body = await readJsonBody(req);
      const entityName = normalizeCell(body.entityName);
      if (!Object.values(SHEET_NAMES).includes(entityName)) throw new Error('Entidad no valida');
      return jsonResponse(res, 200, await saveEntityService(entityName, body.payload || {}));
    }

    if (req.method === 'DELETE' && pathname === '/api/admin/entity') {
      const session = ensureSession(req);
      ensureAdmin(session);
      const entityName = normalizeCell(searchParams.get('entityName'));
      const recordId = normalizeCell(searchParams.get('id'));
      if (!Object.values(SHEET_NAMES).includes(entityName)) throw new Error('Entidad no valida');
      if (!recordId) throw new Error('ID requerido');
      return jsonResponse(res, 200, await deleteEntityService(entityName, recordId));
    }

    if (req.method === 'POST' && pathname === '/api/admin/import-workbook') {
      const session = ensureSession(req);
      ensureAdmin(session);
      const body = await readJsonBody(req);
      return jsonResponse(res, 200, await importConfigWorkbookService(body.entityType, parseWorkbookRows(body.fileBase64)));
    }

    if (req.method === 'POST' && pathname === '/api/admin/import-sheet') {
      const session = ensureSession(req);
      ensureAdmin(session);
      const body = await readJsonBody(req);
      return jsonResponse(res, 200, await importConfigWorkbookService(body.entityType, body.rows || []));
    }

    if (req.method === 'POST' && pathname === '/api/admin/pre-reports/delete-by-period') {
      const session = ensureSession(req);
      ensureAdmin(session);
      const body = await readJsonBody(req);
      return jsonResponse(res, 200, await deletePreReportsByPeriodService(session, body.periodId));
    }

    if (req.method === 'POST' && pathname === '/api/admin/grade-subjects/delete-by-grade') {
      const session = ensureSession(req);
      ensureAdmin(session);
      const body = await readJsonBody(req);
      return jsonResponse(res, 200, await deleteAssignmentsByGradeService(session, body.gradeId));
    }

    if (req.method === 'POST' && pathname === '/api/admin/grade-subjects/copy-grade') {
      const session = ensureSession(req);
      ensureAdmin(session);
      const body = await readJsonBody(req);
      return jsonResponse(
        res,
        200,
        await copyAssignmentsBetweenGradesService(session, body.sourceGradeId, body.targetGradeId, body.teacherOverrides || {})
      );
    }

    if (req.method === 'POST' && pathname === '/api/admin/grade-subjects/reassign-teacher') {
      const session = ensureSession(req);
      ensureAdmin(session);
      const body = await readJsonBody(req);
      return jsonResponse(res, 200, await reassignAssignmentsTeacherService(session, body.assignmentIds, body.teacherId));
    }

    if (req.method === 'GET' && pathname === '/api/admin/reports/summary') {
      const session = ensureSession(req);
      return jsonResponse(
        res,
        200,
        await getAdminSummaryService(session, {
          periodId: searchParams.get('periodId') || '',
          sedeId: searchParams.get('sedeId') || '',
          gradeId: searchParams.get('gradeId') || '',
          teacherId: searchParams.get('teacherId') || ''
        })
      );
    }

    if (req.method === 'GET' && pathname === '/api/admin/teacher-usage') {
      const session = ensureSession(req);
      ensureAdmin(session);
      return jsonResponse(res, 200, await getTeacherUsageService(session));
    }

    if (req.method === 'POST' && pathname === '/api/admin/reports/export') {
      const session = ensureSession(req);
      const body = await readJsonBody(req);
      const rows = await exportAdminDetailCsvService(session, body || {});
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=\"preinformes-detalle.csv\"');
      res.end(toCsv(rows));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/pdf') {
      const fileResult = await generatePdfService(ensureSession(req), await readJsonBody(req));
      res.statusCode = 200;
      res.setHeader('Content-Type', fileResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileResult.filename}"`);
      res.end(fileResult.buffer);
      return;
    }

    return jsonResponse(res, 404, { error: 'Ruta no encontrada' });
  } catch (error) {
    return jsonResponse(res, error.statusCode || 500, { error: error.message || 'Error interno del servidor' });
  }
}
