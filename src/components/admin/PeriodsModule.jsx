import { Button, Card } from 'react-bootstrap';
import { EntityModule } from './EntityModule.jsx';
import { freshForm } from './shared.jsx';

const fields = [
  { name: 'name', label: 'Nombre del período' },
  { name: 'status', label: 'Estado', type: 'enum', options: ['draft', 'open', 'closed'] },
  { name: 'active', label: 'Activo', type: 'boolean' }
];

const columns = [
  { key: 'name', label: 'Período' },
  { key: 'status', label: 'Estado' },
  { key: 'active', label: 'Activo' }
];

export function PeriodsModule(props) {
  const selectedPeriodId = props.editingId || props.formState.id || '';
  const selectedPeriod = props.data.periods.find((item) => item.id === selectedPeriodId);

  return (
    <>
      <EntityModule
        {...props}
        moduleKey="Periods"
        fields={fields}
        columns={columns}
        rows={props.data.periods}
        onDelete={props.onDelete}
        onReset={() => {
          props.setEditingId('');
          props.setFormState(freshForm('Periods'));
        }}
      />

      <Card className="glass-card p-3 mt-4">
        <div className="section-title mb-2">Limpieza de preinformes por período</div>
        <div className="text-muted mb-3">
          Selecciona un período de la tabla y usa esta acción para borrar todos los preinformes registrados en ese período.
        </div>
        <div className="mb-3">
          <strong>Período seleccionado:</strong> {selectedPeriod?.name || 'Ninguno'}
        </div>
        <Button variant="outline-danger" disabled={!selectedPeriod} onClick={() => props.onDeletePreReportsByPeriod?.(selectedPeriod)}>
          Borrar todos los preinformes de este período
        </Button>
      </Card>
    </>
  );
}
