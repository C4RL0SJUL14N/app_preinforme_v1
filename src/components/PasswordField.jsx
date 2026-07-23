import { useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';

export function PasswordField({ value, onChange, toggleLabel = 'contraseña', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup>
      <Form.Control {...props} type={visible ? 'text' : 'password'} value={value} onChange={onChange} />
      <Button
        type="button"
        variant="outline-secondary"
        onClick={() => setVisible((current) => !current)}
        aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${toggleLabel}`}
        aria-pressed={visible}
      >
        {visible ? 'Ocultar' : 'Ver'}
      </Button>
    </InputGroup>
  );
}
