import { Badge, Button, Card, Col, Row } from 'react-bootstrap';

function ManualIllustration({ variant }) {
  if (variant === 'dashboard') {
    return (
      <div className="manual-shot">
        <div className="manual-browser">
          <div className="manual-browser-bar" />
          <div className="manual-dash-grid">
            <div className="manual-dash-tile warm">
              <div className="manual-dash-dot" />
              <div className="manual-dash-line short" />
              <div className="manual-dash-line" />
            </div>
            <div className="manual-dash-tile cool">
              <div className="manual-dash-dot" />
              <div className="manual-dash-line short" />
              <div className="manual-dash-line" />
            </div>
            <div className="manual-dash-tile soft">
              <div className="manual-dash-dot" />
              <div className="manual-dash-line short" />
              <div className="manual-dash-line" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'individual') {
    return (
      <div className="manual-shot">
        <div className="manual-form-card">
          <div className="manual-form-row">
            <span className="manual-label-pill" />
            <span className="manual-input wide" />
          </div>
          <div className="manual-form-row">
            <span className="manual-label-pill" />
            <span className="manual-input mid" />
          </div>
          <div className="manual-check-grid">
            <span className="manual-check on" />
            <span className="manual-check" />
            <span className="manual-check on" />
            <span className="manual-check" />
          </div>
          <div className="manual-editor" />
          <div className="manual-button-row">
            <span className="manual-button fill" />
            <span className="manual-button outline" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'group') {
    return (
      <div className="manual-shot">
        <div className="manual-matrix">
          <div className="manual-matrix-row head">
            <span className="manual-cell name" />
            <span className="manual-cell mark" />
            <span className="manual-cell mark" />
            <span className="manual-cell mark" />
            <span className="manual-cell mark" />
          </div>
          <div className="manual-matrix-row">
            <span className="manual-cell name filled" />
            <span className="manual-cell mark active" />
            <span className="manual-cell mark" />
            <span className="manual-cell mark active" />
            <span className="manual-cell mark" />
          </div>
          <div className="manual-matrix-row">
            <span className="manual-cell name filled" />
            <span className="manual-cell mark" />
            <span className="manual-cell mark active" />
            <span className="manual-cell mark" />
            <span className="manual-cell mark active" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'multisubject') {
    return (
      <div className="manual-shot">
        <div className="manual-select-card">
          <div className="manual-chip primary">Asignatura principal</div>
          <div className="manual-chip active">Matemáticas</div>
          <div className="manual-chip active">Geometría</div>
          <div className="manual-chip">Estadística</div>
        </div>
      </div>
    );
  }

  if (variant === 'subject-groups') {
    return (
      <div className="manual-shot">
        <div className="manual-form-card">
          <div className="manual-form-row">
            <span className="manual-label-pill" />
            <span className="manual-input mid" />
          </div>
          <div className="manual-form-row">
            <span className="manual-label-pill" />
            <span className="manual-input wide" />
          </div>
          <div className="manual-chip active">Lengua castellana</div>
          <div className="manual-chip active">Comprensión lectora</div>
          <div className="manual-chip active">Producción textual</div>
          <div className="manual-button-row">
            <span className="manual-button fill" />
            <span className="manual-button outline" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'preview') {
    return (
      <div className="manual-shot">
        <div className="manual-split">
          <div className="manual-panel table">
            <div className="manual-mini-row active" />
            <div className="manual-mini-row" />
            <div className="manual-mini-row" />
          </div>
          <div className="manual-panel detail">
            <div className="manual-dash-line short" />
            <div className="manual-dash-line" />
            <div className="manual-dash-line" />
            <div className="manual-dash-line short" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'reports') {
    return (
      <div className="manual-shot">
        <div className="manual-report-card">
          <div className="manual-filter-row">
            <span className="manual-input small" />
            <span className="manual-input small" />
            <span className="manual-input small" />
          </div>
          <div className="manual-button-row">
            <span className="manual-button fill" />
            <span className="manual-button outline" />
          </div>
          <div className="manual-bars">
            <span className="manual-bar h1" />
            <span className="manual-bar h2" />
            <span className="manual-bar h3" />
            <span className="manual-bar h4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="manual-shot">
      <div className="manual-director-card">
        <div className="manual-toggle-row">
          <span className="manual-chip active">Individual</span>
          <span className="manual-chip">Grupal</span>
          <span className="manual-chip">Previsualización</span>
        </div>
        <div className="manual-editor tall" />
        <div className="manual-button-row">
          <span className="manual-button fill" />
          <span className="manual-button outline" />
        </div>
      </div>
    </div>
  );
}

function ManualSection({ audience, title, description, steps, tip, illustration }) {
  return (
    <Card className="glass-card p-3 h-100 manual-section-card">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <div className="section-title mb-1">{audience}</div>
          <h3 className="h5 mb-2">{title}</h3>
          <p className="text-muted mb-0">{description}</p>
        </div>
        <Badge bg={audience === 'Director de grupo' ? 'secondary' : 'dark'}>{audience}</Badge>
      </div>
      <div className="manual-steps">
        {steps.map((step, index) => (
          <div key={`${title}-${index}`} className="manual-step">
            <span className="manual-step-index">{index + 1}</span>
            <span>{step}</span>
          </div>
        ))}
      </div>
      {tip ? <div className="manual-tip mt-3">{tip}</div> : null}
      <div className="mt-3">{illustration}</div>
    </Card>
  );
}

export function UserManualModule({ isDirector = false, onBack }) {
  const teacherSections = [
    {
      audience: 'Docente',
      title: 'Ingreso y recuperación de contraseña',
      description: 'Accede con tu documento y recupera el acceso mediante el correo registrado cuando sea necesario.',
      steps: [
        'Escribe tu documento y contraseña en la pantalla de ingreso.',
        'Usa el icono del campo de contraseña para mostrar u ocultar lo escrito.',
        'Si olvidaste la contraseña, pulsa "¿Olvidaste tu contraseña?" y escribe tu documento.',
        'Abre el enlace recibido en tu correo de recuperación y define una contraseña nueva.'
      ],
      tip: 'Si tu usuario no tiene correo registrado, la plataforma te indicará que debes solicitar su actualización.',
      illustration: <ManualIllustration variant="individual" />
    },
    {
      audience: 'Docente',
      title: 'Tablero y navegación',
      description: 'Desde el tablero eliges módulos independientes para marcas, observaciones y otras tareas docentes.',
      steps: [
        'Abre el módulo que necesitas desde las tarjetas del tablero.',
        'Revisa el título y los filtros para confirmar que estás en la vista correcta.',
        'Usa "Volver al tablero" para cambiar de módulo sin cerrar la sesión.'
      ],
      tip: 'Las marcas, las observaciones por asignatura y las observaciones del director se gestionan por separado.',
      illustration: <ManualIllustration variant="dashboard" />
    },
    {
      audience: 'Docente',
      title: 'Registrar marcas de preinforme',
      description: 'El formulario carga todo el grupo y permite crear, modificar o desmarcar dificultades desde una sola matriz.',
      steps: [
        'Selecciona período, grado y asignatura.',
        'Espera la carga automática del listado de estudiantes y las marcas existentes.',
        'Marca o desmarca los descriptores C y A de cada estudiante.',
        'Pulsa "Guardar cambios"; durante el guardado la edición se bloqueará brevemente.',
        'Continúa trabajando cuando aparezca la confirmación, ya que las marcas permanecerán visibles.',
        'Activa o desactiva el autoguardado de cinco minutos según tu forma de trabajo.'
      ],
      tip: 'Desmarcar una dificultad y guardar funciona como edición o eliminación de esa marca.',
      illustration: <ManualIllustration variant="group" />
    },
    {
      audience: 'Docente',
      title: 'Guardar o copiar marcas en otras asignaturas',
      description: 'Puedes reutilizar las marcas en otras asignaturas que tengas asignadas dentro del mismo grado.',
      steps: [
        'En "Guardar en varias asignaturas", marca las materias que recibirán los cambios junto con la principal.',
        'Edita la matriz y pulsa "Guardar cambios" para actualizar todas las seleccionadas.',
        'Para copiar lo ya cargado, selecciona una materia de destino en "Copiar marcas a otra asignatura".',
        'Confirma la copia y revisa el mensaje de finalización.'
      ],
      tip: 'Solo se ofrecen asignaturas del mismo grado disponibles para tu usuario.',
      illustration: <ManualIllustration variant="multisubject" />
    },
    {
      audience: 'Docente',
      title: 'Observaciones por asignatura',
      description: 'Las observaciones se guardan independientemente de las marcas y conservan el formato del editor.',
      steps: [
        'Selecciona período, grado y asignatura para cargar automáticamente los estudiantes.',
        'Haz clic en un estudiante para desplegar su editor debajo del nombre.',
        'Aplica negrita, cursiva, subrayado, numeración, viñetas o color y guarda.',
        'Usa "Borrar" para eliminar únicamente la observación individual.',
        'Marca dos o más estudiantes para agregar o borrar observaciones en grupo.',
        'Usa las acciones generales para agregar una observación a todos o borrarlas todas, previa confirmación.'
      ],
      tip: 'Al guardar se cierra el acordeón, pero los filtros y el listado permanecen disponibles para continuar.',
      illustration: <ManualIllustration variant="director" />
    },
    {
      audience: 'Docente',
      title: 'Agrupación de asignaturas',
      description: 'Permite presentar varias materias afines como una sola opción dentro de los módulos docentes.',
      steps: [
        'Abre "Agrupación de asignaturas" y selecciona el grado.',
        'Escribe el nombre y el nombre corto de la agrupación.',
        'Marca sus asignaturas y elige cuál será la principal.',
        'Define cómo se mostrará en el PDF y guarda.'
      ],
      tip: 'La asignatura principal es la referencia interna utilizada para consultar y guardar la información.',
      illustration: <ManualIllustration variant="subject-groups" />
    }
  ];

  const directorSections = [
    {
      audience: 'Director de grupo',
      title: 'Reportes del grupo y generación de PDF',
      description: 'Consolida los preinformes del grupo y permite exportar reportes o PDF.',
      steps: [
        'Selecciona el período y el grado que diriges.',
        'Carga el resumen para ver estadísticas por grado, asignatura y docente.',
        'Elige el tipo de PDF: consolidado, por grado, por estudiante o individual.',
        'Genera el archivo y descárgalo desde el navegador.'
      ],
      tip: 'Los PDF conservan color, negrita, cursiva, subrayado, numeración y viñetas de las observaciones.',
      illustration: <ManualIllustration variant="reports" />
    },
    {
      audience: 'Director de grupo',
      title: 'Observaciones del director',
      description:
        'Registra observaciones exclusivas del director, independientes de las observaciones por asignatura.',
      steps: [
        'Ingresa al módulo "Observaciones del director".',
        'Selecciona el período; el grado dirigido se asigna automáticamente.',
        'Haz clic en un estudiante para abrir el editor en forma de acordeón.',
        'Guarda o borra la observación individual desde el mismo editor.',
        'Marca dos o más estudiantes para aplicar o borrar una observación compartida.',
        'Usa las acciones para todos cuando la observación corresponda al grupo completo.'
      ],
      tip: 'Las acciones múltiples reemplazan el texto existente y siempre solicitan confirmación.',
      illustration: <ManualIllustration variant="director" />
    }
  ];

  const visibleSections = isDirector ? [...teacherSections, ...directorSections] : teacherSections;

  return (
    <div>
      <Card className="glass-card page-context-bar p-3 mb-4">
        <div className="d-flex justify-content-between align-items-start gap-3">
          <div>
            <p className="section-title mb-1">Ayuda</p>
            <h2 className="h4 mb-2">Manual de usuario</h2>
            <div className="text-muted">
              Aquí encontrarás una guía visual para usar las funciones disponibles en tu perfil docente.
            </div>
            <div className="context-chip-row">
              <span className="context-chip">
                <strong>Perfil:</strong> {isDirector ? 'Docente y director de grupo' : 'Docente'}
              </span>
              <span className="context-chip">
                <strong>Secciones:</strong> {visibleSections.length}
              </span>
            </div>
          </div>
          {onBack ? (
            <Button variant="outline-dark" onClick={onBack}>
              Volver al tablero
            </Button>
          ) : null}
        </div>
      </Card>

      <Row className="g-3">
        {visibleSections.map((section) => (
          <Col lg={6} key={`${section.audience}-${section.title}`}>
            <ManualSection {...section} />
          </Col>
        ))}
      </Row>
    </div>
  );
}
