import { EntityModule } from './EntityModule.jsx';
import { freshForm } from './shared.jsx';

const fields = [
  { name: 'id', label: 'ID docente' },
  { name: 'sedeId', label: 'Sede', type: 'select', optionsKey: 'sedes' },
  { name: 'firstName', label: 'Nombres' },
  { name: 'lastName', label: 'Apellidos' },
  { name: 'password', label: 'Clave', type: 'password', placeholder: 'Solo diligenciar para crear o cambiar' },
  { name: 'isAdmin', label: 'Administrador', type: 'boolean' },
  { name: 'active', label: 'Activo', type: 'boolean' }
];

const columns = [
  { key: 'id', label: 'Usuario' },
  { key: 'sedeId', label: 'Sede' },
  { key: 'firstName', label: 'Nombres' },
  { key: 'lastName', label: 'Apellidos' },
  { key: 'isAdmin', label: 'Administrador' },
  { key: 'active', label: 'Activo' }
];

export function TeachersModule(props) {
  return (
    <EntityModule
      {...props}
      moduleKey="Teachers"
      fields={fields}
      columns={columns}
      rows={props.data.teachers}
      onDelete={props.onDelete}
      onReset={() => {
        props.setEditingId('');
        props.setFormState(freshForm('Teachers'));
      }}
    />
  );
}
