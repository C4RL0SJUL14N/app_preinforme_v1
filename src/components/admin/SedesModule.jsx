import { EntityModule } from './EntityModule.jsx';
import { freshForm } from './shared.jsx';

const fields = [
  { name: 'name', label: 'Nombre de la sede' },
  { name: 'active', label: 'Activo', type: 'boolean' }
];

const columns = [
  { key: 'name', label: 'Sede' },
  { key: 'active', label: 'Activo' }
];

export function SedesModule(props) {
  return (
    <EntityModule
      {...props}
      moduleKey="Sedes"
      fields={fields}
      columns={columns}
      rows={props.data.sedes}
      onDelete={props.onDelete}
      onReset={() => {
        props.setEditingId('');
        props.setFormState(freshForm('Sedes'));
      }}
    />
  );
}
