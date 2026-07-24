import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row } from 'react-bootstrap';
import userManualUrl from '../../docs/manual-usuario-preinformes.pdf?url';
import { PasswordField } from './PasswordField.jsx';

export function LoginForm({ onLogin, onForgotPassword, onResetPassword, resetToken = '', error }) {
  const [mode, setMode] = useState(resetToken ? 'reset' : 'login');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (resetToken) setMode('reset');
  }, [resetToken]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setLocalError('');
    setMessage('');
    setPassword('');
    setPasswordConfirmation('');
  }

  async function runAction(action) {
    setLoading(true);
    setLocalError('');
    setMessage('');
    try {
      await action();
    } catch (actionError) {
      setLocalError(actionError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    await runAction(() => onLogin({ login, password }));
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    await runAction(async () => {
      const result = await onForgotPassword(login);
      setMessage(result.message);
    });
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    if (password !== passwordConfirmation) {
      setLocalError('Las contraseñas no coinciden');
      return;
    }
    await runAction(async () => {
      const result = await onResetPassword({ token: resetToken, password });
      changeMode('login');
      setMessage(result.message);
    });
  }

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={6} lg={5}>
          <Card className="glass-card p-4">
            <Card.Body>
              <p className="section-title">Ingreso docente</p>
              <h1 className="h3 mb-2">Sistema de preinformes</h1>
              <p className="text-muted mb-4">
                {mode === 'forgot'
                  ? 'Solicita un enlace en el correo registrado.'
                  : mode === 'reset'
                    ? 'Define una nueva contraseña para tu usuario.'
                    : 'Ingresa con tu usuario y contraseña.'}
              </p>
              {localError || error ? <Alert variant="danger">{localError || error}</Alert> : null}
              {message ? <Alert variant="success">{message}</Alert> : null}

              {mode === 'login' ? (
                <Form onSubmit={handleLogin}>
                  <Form.Group className="mb-3">
                    <Form.Label>Usuario</Form.Label>
                    <Form.Control value={login} onChange={(e) => setLogin(e.target.value)} required autoComplete="username" />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Contraseña</Form.Label>
                    <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                  </Form.Group>
                  <div className="text-end mb-3">
                    <Button type="button" variant="link" className="p-0" onClick={() => changeMode('forgot')}>
                      ¿Olvidaste tu contraseña?
                    </Button>
                  </div>
                  <Button type="submit" className="w-100" disabled={loading}>
                    {loading ? 'Ingresando...' : 'Ingresar'}
                  </Button>
                </Form>
              ) : null}

              {mode === 'forgot' ? (
                <Form onSubmit={handleForgotPassword}>
                  <Form.Group className="mb-3">
                    <Form.Label>Usuario</Form.Label>
                    <Form.Control value={login} onChange={(e) => setLogin(e.target.value)} required autoComplete="username" />
                    <Form.Text>Usaremos el correo registrado por el administrador.</Form.Text>
                  </Form.Group>
                  <Button type="submit" className="w-100 mb-3" disabled={loading}>
                    {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                  </Button>
                  <Button type="button" variant="outline-secondary" className="w-100" onClick={() => changeMode('login')}>
                    Volver al ingreso
                  </Button>
                </Form>
              ) : null}

              {mode === 'reset' ? (
                <Form onSubmit={handleResetPassword}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nueva contraseña</Form.Label>
                    <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" />
                    <Form.Text>Mínimo 8 caracteres.</Form.Text>
                  </Form.Group>
                  <Form.Group className="mb-4">
                    <Form.Label>Confirmar nueva contraseña</Form.Label>
                    <PasswordField value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" toggleLabel="confirmación de contraseña" />
                  </Form.Group>
                  <Button type="submit" className="w-100" disabled={loading}>
                    {loading ? 'Actualizando...' : 'Cambiar contraseña'}
                  </Button>
                </Form>
              ) : null}

              <div className="text-center border-top mt-4 pt-3">
                <Button
                  as="a"
                  href={userManualUrl}
                  download="manual-usuario-preinformes.pdf"
                  variant="outline-primary"
                  size="sm"
                >
                  Descargar manual de usuario (PDF)
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
