import { EntityModule } from './EntityModule.jsx';
import { freshForm } from './shared.jsx';

const fields = [
  { name: 'name', label: 'Nombre' },
  { name: 'shortName', label: 'Nombre corto' },
  { name: 'active', label: 'Activo', type: 'boolean' }
];

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'shortName', label: 'Nombre corto' },
  { key: 'active', label: 'Activo' }
];

export function SubjectsModule(props) {
  return (
    <EntityModule
      {...props}
      moduleKey="Subjects"
      fields={fields}
      columns={columns}
      rows={props.data.subjects}
      onDelete={props.onDelete}
      onReset={() => {
        props.setEditingId('');
        props.setFormState(freshForm('Subjects'));
      }}
    />
  );
}
