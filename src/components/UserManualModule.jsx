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
      title: 'Tablero y navegación',
      description: 'Desde el tablero docente eliges el módulo de trabajo y puedes volver al inicio cuando lo necesites.',
      steps: [
        'Abre el módulo que necesitas desde las tarjetas del tablero.',
        'Revisa la barra superior para confirmar vista, período, grado y asignatura.',
        'Usa "Volver al tablero" para cambiar de módulo sin perder el contexto general.'
      ],
      tip: 'Si tu usuario también es director de grupo, verás módulos adicionales para reportes y observaciones del director.',
      illustration: <ManualIllustration variant="dashboard" />
    },
    {
      audience: 'Docente',
      title: 'Crear un preinforme individual',
      description: 'Permite registrar dificultades y observaciones para un estudiante específico.',
      steps: [
        'Selecciona período, grado y asignatura.',
        'Carga los estudiantes y elige uno en la lista.',
        'Marca las dificultades de convivencia o académicas que correspondan.',
        'Escribe las observaciones y guarda el preinforme.',
        'Si necesitas dejar la observación en blanco, usa el botón "Eliminar observación".'
      ],
      tip: 'El formulario conserva visibles las acciones principales para que no tengas que volver al final de la página.',
      illustration: <ManualIllustration variant="individual" />
    },
    {
      audience: 'Docente',
      title: 'Crear carga grupal',
      description: 'Sirve para registrar varios estudiantes en una sola matriz con marcas rápidas.',
      steps: [
        'Selecciona período, grado y asignatura.',
        'Usa "Cargar estudiantes" para abrir la matriz grupal.',
        'Marca las casillas C y A según corresponda a cada estudiante.',
        'Si necesitas, agrega una observación grupal y guarda la carga.'
      ],
      tip: 'La observación grupal solo se aplica a estudiantes que tengan al menos una dificultad marcada.',
      illustration: <ManualIllustration variant="group" />
    },
    {
      audience: 'Docente',
      title: 'Agrupación de asignaturas',
      description:
        'Permite crear materias agrupadas por grado cuando varias asignaturas afines deben tratarse como una sola opción al cargar preinformes.',
      steps: [
        'Abre el módulo "Agrupación de asignaturas" desde el tablero docente.',
        'Selecciona el grado donde dictas varias materias afines.',
        'Escribe el nombre y el nombre corto de la agrupación.',
        'Marca las asignaturas que formarán parte del grupo.',
        'Elige la asignatura principal, que será la usada internamente para guardar la información.',
        'Define el modo de impresión y guarda la agrupación.'
      ],
      tip: 'Cuando la agrupación está activa, aparecerá como una sola opción dentro del selector de asignaturas del módulo de preinformes.',
      illustration: <ManualIllustration variant="subject-groups" />
    },
    {
      audience: 'Docente',
      title: 'Aplicar el mismo preinforme a varias asignaturas',
      description: 'Si dictas varias asignaturas en el mismo grado, puedes guardar el mismo contenido en más de una.',
      steps: [
        'Elige la asignatura principal.',
        'Marca las asignaturas adicionales del mismo grado donde quieres repetir el preinforme.',
        'Guarda en modo individual o grupal, según corresponda.',
        'Revisa el mensaje final para confirmar en cuáles asignaturas se creó.'
      ],
      tip: 'La asignatura principal siempre queda incluida, incluso si no marcas ninguna adicional.',
      illustration: <ManualIllustration variant="multisubject" />
    },
    {
      audience: 'Docente',
      title: 'Editar, borrar y previsualizar',
      description: 'Puedes revisar lo cargado antes de imprimir o hacer ajustes posteriores.',
      steps: [
        'En "Editar o borrar" carga el grado y la asignatura.',
        'Usa modo individual para cambiar un estudiante o modo grupal para varios a la vez.',
        'Usa el botón "Eliminar observación" si deseas conservar el preinforme pero limpiar solo el texto.',
        'En "Previsualizar" revisa las marcas de toda la matriz.',
        'Haz clic en un estudiante para ver sus observaciones al final.'
      ],
      tip: 'El modo grupal de edición solo muestra estudiantes que ya tienen al menos una dificultad registrada.',
      illustration: <ManualIllustration variant="preview" />
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
        'Elige el tipo de PDF: todos, por grado, por estudiante o individual.',
        'Genera el archivo y descárgalo desde el navegador.'
      ],
      tip: 'Este módulo solo muestra los grados donde estás asignado como director de grupo.',
      illustration: <ManualIllustration variant="reports" />
    },
    {
      audience: 'Director de grupo',
      title: 'Observaciones del director',
      description:
        'Registra observaciones exclusivas del director, independientes de las observaciones por asignatura.',
      steps: [
        'Ingresa al módulo "Observaciones del director".',
        'Escoge entre modo individual, grupal o previsualización.',
        'En individual eliges un estudiante y escribes una observación solo para ese caso.',
        'En grupal marcas varios estudiantes y aplicas una misma observación.',
        'Usa "Eliminar observación" cuando necesites limpiar el texto sin borrar otros registros.',
        'Guarda y luego revisa el resultado en la previsualización o en el PDF.'
      ],
      tip: 'Las observaciones del director aparecen antes de las observaciones normales en el PDF, solo si el estudiante tiene este registro.',
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
