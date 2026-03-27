import { EntityModule } from './EntityModule.jsx';
import { freshForm } from './shared.jsx';

const fields = [{ name: 'name', label: 'Nombre de la institución' }];

const columns = [{ key: 'name', label: 'Institución' }];

export function InstitutionsModule(props) {
  return (
    <EntityModule
      {...props}
      moduleKey="Institutions"
      fields={fields}
      columns={columns}
      rows={props.data.institutions}
      onDelete={undefined}
      onReset={() => {
        props.setEditingId('');
        props.setFormState(
          props.data.institutions[0]
            ? { ...freshForm('Institutions'), ...props.data.institutions[0] }
            : freshForm('Institutions')
        );
      }}
    />
  );
}
