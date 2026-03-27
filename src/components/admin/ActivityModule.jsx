import { Button, Card, Table } from 'react-bootstrap';
import { SectionCard } from './shared.jsx';

function formatRelativeTime(value) {
  if (!value) return 'Sin registro';
  const diffMs = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diffMs)) return 'Sin registro';
  const totalSeconds = Math.max(0, Math.round(diffMs / 1000));
  if (totalSeconds < 60) return 'Hace menos de un minuto';
  if (totalSeconds < 3600) return `Hace ${Math.floor(totalSeconds / 60)} min`;
  return `Hace ${Math.floor(totalSeconds / 3600)} h`;
}

export function ActivityModule({ usageSummary, onRefreshUsage }) {
  const activeUsers = usageSummary?.activeUsers || [];

  return (
    <div className="d-grid gap-3">
      <SectionCard
        title="Docentes conectados"
        subtitle="Consulta cuántos docentes tienen actividad reciente en la aplicación."
        actions={
          <Button variant="outline-dark" onClick={onRefreshUsage}>
            Actualizar
          </Button>
        }
      >
        <div className="d-flex flex-wrap gap-3">
          <Card className="glass-card p-3 flex-grow-1">
            <div className="section-title">Activos ahora</div>
            <div className="fs-3 fw-semibold">{usageSummary?.activeCount || 0}</div>
            <div className="text-muted">Se consideran activos quienes enviaron actividad en los últimos 3 minutos.</div>
          </Card>
        </div>
      </SectionCard>

      <SectionCard
        title="Listado de actividad"
        subtitle="Incluye el nombre del docente, la sede y el modo de uso detectado."
      >
        {!activeUsers.length ? (
          <div className="text-muted">No hay docentes con actividad reciente en este momento.</div>
        ) : (
          <div className="table-scroll-shell">
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Docente</th>
                    <th>Sede</th>
                    <th>Modo</th>
                    <th>Actuando como</th>
                    <th>Última actividad</th>
                  </tr>
                </thead>
                <tbody>
                  {activeUsers.map((item) => (
                    <tr key={`${item.teacherId}-${item.lastSeenAt}`}>
                      <td>
                        <div className="fw-semibold">{item.teacherName}</div>
                        <div className="text-muted small">{item.teacherId}</div>
                      </td>
                      <td>{item.sedeName || 'Sin sede'}</td>
                      <td>{item.viewMode === 'admin' ? 'Administrador' : 'Docente'}</td>
                      <td>{item.actingAsTeacherName || 'No aplica'}</td>
                      <td>{formatRelativeTime(item.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
