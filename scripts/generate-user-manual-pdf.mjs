import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 34;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 28;
const BODY_TOP = PAGE_HEIGHT - MARGIN;
const BODY_BOTTOM = MARGIN + FOOTER_HEIGHT;
const OUTPUT_PATH = path.resolve(process.cwd(), 'docs', 'manual-usuario-preinformes.pdf');

const COLORS = {
  text: rgb(0.12, 0.18, 0.23),
  muted: rgb(0.35, 0.43, 0.49),
  line: rgb(0.83, 0.88, 0.91),
  soft: rgb(0.96, 0.97, 0.98),
  primary: rgb(0.12, 0.42, 0.47),
  primarySoft: rgb(0.89, 0.96, 0.97),
  warm: rgb(0.98, 0.93, 0.87),
  blueSoft: rgb(0.9, 0.94, 1),
  greenSoft: rgb(0.91, 0.97, 0.92),
  white: rgb(1, 1, 1)
};

const manualSections = [
  {
    title: 'Cómo usar el tablero docente',
    audience: 'Docentes y directores de grupo',
    objective:
      'El tablero docente es el punto de partida de la plataforma. Desde allí eliges la función que necesitas, revisas tu contexto de trabajo y vuelves al inicio sin perder tu sesión.',
    steps: [
      'Inicia sesión con tu usuario institucional y tu contraseña.',
      'Observa las tarjetas disponibles según tu perfil.',
      'Haz clic sobre la tarjeta del módulo que quieras abrir y espera a que se cargue el contexto.',
      'Cuando necesites cambiar de tarea, usa el botón "Volver al tablero".'
    ],
    notes: [
      'La barra superior te ayuda a confirmar que estás en el módulo correcto.',
      'La aplicación conserva parte del contexto reciente para facilitar la continuidad del trabajo.'
    ],
    illustration: 'dashboard'
  },
  {
    title: 'Selección inicial en el módulo de preinformes',
    audience: 'Docentes',
    objective:
      'Antes de crear, editar o visualizar un preinforme debes definir el contexto base. Esta secuencia determina qué estudiantes se cargan, qué asignaturas aparecen y en qué período se guarda la información.',
    steps: [
      'Selecciona el período académico.',
      'Selecciona el grado.',
      'Selecciona la asignatura principal.',
      'Si la vista lo requiere, pulsa "Cargar" o "Cargar estudiantes".'
    ],
    notes: [
      'La asignatura principal sirve como base para validar permisos y cargar estudiantes.',
      'Si cambias el grado o la asignatura, confirma el contexto antes de guardar.'
    ],
    illustration: 'filters'
  },
  {
    title: 'Agrupación de asignaturas',
    audience: 'Docentes con varias asignaturas afines',
    objective:
      'Este módulo permite crear materias agrupadas por grado cuando un mismo docente necesita tratar varias asignaturas relacionadas como una sola opción visible dentro del módulo de preinformes.',
    steps: [
      'Abre el módulo "Agrupación de asignaturas" desde el tablero docente.',
      'Selecciona el grado en el que dictas las asignaturas afines.',
      'Escribe el nombre de la agrupación y su nombre corto.',
      'Marca las asignaturas que quieres integrar y elige cuál será la asignatura principal.',
      'Selecciona el modo de impresión que definirá cómo se verá la agrupación en el PDF.',
      'Guarda la agrupación para que aparezca como opción dentro del selector de asignaturas.'
    ],
    notes: [
      'La información del preinforme se guarda realmente en la asignatura principal elegida por el docente.',
      'Si la agrupación queda inactiva, las asignaturas asociadas vuelven a tratarse de manera normal.'
    ],
    illustration: 'subject-groups'
  },
  {
    title: 'Aplicar el mismo preinforme a varias asignaturas',
    audience: 'Docentes con varias asignaturas en el mismo grado',
    objective:
      'Si dictas más de una asignatura en el mismo grupo, puedes registrar una sola vez las dificultades y las observaciones y pedir a la plataforma que replique ese contenido en otras asignaturas seleccionadas.',
    steps: [
      'Selecciona la asignatura principal del formulario.',
      'Ubica la tarjeta "Asignaturas para aplicar este preinforme".',
      'Marca las demás asignaturas del mismo grado que también estén a tu cargo.',
      'Continúa con la carga individual o grupal y guarda el preinforme.',
      'Revisa el mensaje final para confirmar qué asignaturas se actualizaron y cuáles fueron omitidas.'
    ],
    notes: [
      'La asignatura principal siempre se incluye automáticamente.',
      'Solo aparecen asignaturas del mismo grado y del mismo docente.'
    ],
    illustration: 'multisubject'
  },
  {
    title: 'Carga individual de preinformes',
    audience: 'Docentes',
    objective:
      'La carga individual es ideal cuando necesitas registrar un caso puntual con más detalle, revisar un estudiante a la vez y redactar observaciones específicas.',
    steps: [
      'Completa la selección de período, grado y asignatura.',
      'Busca y selecciona al estudiante por apellido, nombre o identificación.',
      'Marca las dificultades de convivencia y académicas que correspondan.',
      'Escribe la observación en el editor de texto enriquecido o déjala vacía si solo registrarás marcas.',
      'Pulsa "Guardar" para registrar el preinforme. Si luego necesitas limpiar el texto, usa "Eliminar observación".'
    ],
    notes: [
      'La barra de acciones permanece visible para evitar desplazamientos largos.',
      'La plataforma impide crear duplicados activos para la misma combinación de estudiante, período y asignatura.'
    ],
    illustration: 'individual'
  },
  {
    title: 'Carga grupal de preinformes',
    audience: 'Docentes',
    objective:
      'La carga grupal permite registrar varios estudiantes desde una sola matriz visual con descriptores C y A. Es la forma más rápida de trabajar cuando debes registrar muchos casos dentro del mismo curso.',
    steps: [
      'Selecciona el período, el grado y la asignatura principal.',
      'Pulsa "Cargar estudiantes" para abrir la tabla grupal.',
      'Usa el acordeón de la leyenda para recordar el significado de cada descriptor.',
      'Marca las casillas necesarias por estudiante.',
      'Si lo necesitas, escribe una observación grupal para anexarla a quienes tengan al menos una dificultad marcada.',
      'Pulsa "Guardar carga grupal".'
    ],
    notes: [
      'La observación grupal no crea registros vacíos por sí sola.',
      'La barra horizontal de la matriz debe utilizarse dentro del panel de trabajo.'
    ],
    illustration: 'group'
  },
  {
    title: 'Editar, borrar y previsualizar preinformes',
    audience: 'Docentes',
    objective:
      'Estas vistas permiten corregir registros ya creados, borrar solo lo necesario y revisar visualmente la matriz final antes de imprimir o exportar.',
    steps: [
      'Abre la pestaña "Editar o borrar" para modificar registros existentes o limpiar observaciones sin borrar todo el registro.',
      'En modo individual, selecciona al estudiante, ajusta marcas u observaciones, o usa "Eliminar observación" si solo quieres limpiar el texto.',
      'En modo grupal, actualiza marcas o elimina solo los seleccionados.',
      'Abre la pestaña "Previsualizar" para revisar la matriz de solo lectura.',
      'Haz clic sobre un estudiante dentro de la previsualización para leer sus observaciones.'
    ],
    notes: [
      'La previsualización replica la lógica de la carga grupal para facilitar la revisión.',
      'En borrado grupal solo se eliminan los registros seleccionados.'
    ],
    illustration: 'preview'
  },
  {
    title: 'Módulo Reportes del grupo',
    audience: 'Directores de grupo',
    objective:
      'Este módulo reúne la información del grado dirigido. Desde allí puedes revisar cobertura, faltantes y generar PDF o exportaciones con distintos alcances.',
    steps: [
      'Selecciona el período y el grado donde eres director de grupo.',
      'Pulsa "Cargar resumen" para obtener el panorama general del curso.',
      'Revisa estudiantes reportados, estudiantes sin preinformes y docentes sin registros.',
      'En la sección de exportación elige la opción necesaria: todos los preinformes, PDF por grado, ZIP con un PDF por estudiante o un preinforme individual.',
      'Si el modo elegido lo exige, selecciona el estudiante correspondiente antes de generar el archivo.'
    ],
    notes: [
      'Este módulo solo muestra grados donde realmente eres director de grupo.',
      'Las observaciones del director aparecen en el PDF antes de las observaciones normales cuando existen.'
    ],
    illustration: 'reports'
  },
  {
    title: 'Módulo Observaciones del director de grupo',
    audience: 'Directores de grupo',
    objective:
      'Este módulo permite registrar observaciones exclusivas del director de grupo, independientes de las observaciones que el docente consignó por asignatura.',
    steps: [
      'Selecciona el período y el grado dirigido.',
      'Elige el modo de trabajo: individual, grupal o previsualización.',
      'En modo individual, selecciona un estudiante y redacta su observación particular. Si necesitas limpiarla, usa "Eliminar observación".',
      'En modo grupal, marca los estudiantes que recibirán la misma observación y guarda el texto.',
      'En modo previsualización revisa qué estudiantes ya tienen observación del director y consulta el contenido.'
    ],
    notes: [
      'Solo el director de grupo puede usar este módulo.',
      'La observación del director complementa la visión global del estudiante y del curso.'
    ],
    illustration: 'director'
  },
  {
    title: 'Buenas prácticas de uso',
    audience: 'Docentes y directores de grupo',
    objective:
      'Aplicar estas recomendaciones ayuda a mantener la plataforma ordenada, evitar duplicados y producir preinformes más claros y consistentes.',
    steps: [
      'Verifica siempre período, grado y asignatura antes de guardar.',
      'Usa la previsualización cuando trabajes en carga grupal.',
      'Si necesitas repetir el mismo contenido en varias asignaturas, usa la selección múltiple en vez de cargar una por una.',
      'Como director de grupo, registra observaciones del director solo cuando realmente complementen el seguimiento.',
      'Genera el PDF únicamente después de revisar que las observaciones estén completas.'
    ],
    notes: [
      'La aplicación recuerda parte del contexto anterior, pero siempre conviene confirmarlo al iniciar una nueva jornada.',
      'Si algo parece inconsistente, vuelve al tablero y entra de nuevo al módulo correspondiente.'
    ],
    illustration: 'dashboard'
  }
];

function splitLines(text, maxWidth, font, size) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrappedText(page, text, x, y, width, font, size, color = COLORS.text, lineGap = 4) {
  const lines = splitLines(text, width, font, size);
  let cursorY = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursorY, size, font, color });
    cursorY -= size + lineGap;
  }
  return cursorY;
}

function drawFooter(page, fonts, pageNumber) {
  page.drawLine({
    start: { x: MARGIN, y: BODY_BOTTOM + 8 },
    end: { x: PAGE_WIDTH - MARGIN, y: BODY_BOTTOM + 8 },
    thickness: 0.8,
    color: COLORS.line
  });
  page.drawText('Manual de usuario - Plataforma de preinformes', {
    x: MARGIN,
    y: BODY_BOTTOM - 2,
    size: 8,
    font: fonts.regular,
    color: COLORS.muted
  });
  page.drawText(`Página ${pageNumber}`, {
    x: PAGE_WIDTH - MARGIN - 44,
    y: BODY_BOTTOM - 2,
    size: 8,
    font: fonts.regular,
    color: COLORS.muted
  });
}

function drawCard(page, x, yTop, width, height, fill = COLORS.white) {
  page.drawRectangle({
    x,
    y: yTop - height,
    width,
    height,
    borderColor: COLORS.line,
    borderWidth: 1,
    color: fill
  });
}

function drawPill(page, x, y, width, height, fill, borderColor = null) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: fill,
    ...(borderColor ? { borderColor, borderWidth: 0.8 } : {})
  });
}

function drawAudienceTag(page, fonts, text, x, y) {
  const width = fonts.bold.widthOfTextAtSize(text, 8) + 18;
  drawPill(page, x, y, width, 18, COLORS.primarySoft);
  page.drawText(text, {
    x: x + 9,
    y: y + 5,
    size: 8,
    font: fonts.bold,
    color: COLORS.primary
  });
}

function drawIllustration(page, fonts, variant, x, yTop, width, height) {
  drawCard(page, x, yTop, width, height, COLORS.soft);

  if (variant === 'dashboard') {
    drawCard(page, x + 16, yTop - 14, width - 32, height - 28, COLORS.white);
    const tileWidth = (width - 64 - 20) / 3;
    const fills = [COLORS.warm, COLORS.blueSoft, COLORS.greenSoft];
    for (let i = 0; i < 3; i += 1) {
      const tileX = x + 24 + i * (tileWidth + 10);
      drawCard(page, tileX, yTop - 40, tileWidth, 100, fills[i]);
      drawPill(page, tileX + 12, yTop - 64, 28, 18, COLORS.white);
      drawPill(page, tileX + 12, yTop - 90, tileWidth * 0.45, 8, COLORS.white);
      drawPill(page, tileX + 12, yTop - 106, tileWidth * 0.68, 8, COLORS.white);
    }
    return;
  }

  if (variant === 'filters') {
    drawCard(page, x + 18, yTop - 18, width - 36, height - 36, COLORS.white);
    for (let i = 0; i < 4; i += 1) {
      const rowY = yTop - 40 - i * 34;
      drawPill(page, x + 34, rowY - 9, 88, 10, rgb(0.84, 0.88, 0.91));
      drawPill(page, x + 132, rowY - 14, width - 190, 18, rgb(0.93, 0.95, 0.97));
    }
    drawPill(page, x + 34, yTop - height + 42, 112, 18, COLORS.primary);
    return;
  }

  if (variant === 'multisubject') {
    drawCard(page, x + 18, yTop - 18, width - 36, height - 36, COLORS.white);
    const chips = [
      { text: 'Asignatura principal', fill: COLORS.warm, width: 118 },
      { text: 'Matemáticas', fill: COLORS.blueSoft, width: 84 },
      { text: 'Geometría', fill: COLORS.blueSoft, width: 76 },
      { text: 'Estadística', fill: rgb(0.95, 0.96, 0.97), width: 80 }
    ];
    let cursorX = x + 30;
    chips.forEach((chip) => {
      drawPill(page, cursorX, yTop - 54, chip.width, 24, chip.fill, COLORS.line);
      page.drawText(chip.text, { x: cursorX + 10, y: yTop - 46, size: 8, font: fonts.regular, color: COLORS.text });
      cursorX += chip.width + 8;
    });
    drawCard(page, x + 30, yTop - 96, width - 60, 54, rgb(0.98, 0.99, 1));
    drawPill(page, x + 44, yTop - 120, 140, 8, rgb(0.84, 0.88, 0.91));
    drawPill(page, x + 44, yTop - 136, width - 140, 8, rgb(0.9, 0.93, 0.95));
    return;
  }

  if (variant === 'subject-groups') {
    drawCard(page, x + 18, yTop - 18, width - 36, height - 36, COLORS.white);
    drawPill(page, x + 30, yTop - 44, 104, 16, COLORS.blueSoft);
    drawPill(page, x + 144, yTop - 44, 82, 16, rgb(0.93, 0.95, 0.97));
    drawPill(page, x + 30, yTop - 74, 160, 16, rgb(0.93, 0.95, 0.97));
    drawPill(page, x + 30, yTop - 104, 96, 22, COLORS.warm);
    drawPill(page, x + 136, yTop - 104, 122, 22, COLORS.blueSoft);
    drawPill(page, x + 268, yTop - 104, 120, 22, COLORS.greenSoft);
    drawPill(page, x + 30, yTop - height + 58, 106, 18, COLORS.primary);
    drawPill(page, x + 146, yTop - height + 58, 106, 18, COLORS.white, COLORS.line);
    return;
  }

  if (variant === 'individual') {
    drawCard(page, x + 18, yTop - 18, width - 36, height - 36, COLORS.white);
    for (let i = 0; i < 2; i += 1) {
      const rowY = yTop - 42 - i * 28;
      drawPill(page, x + 32, rowY - 7, 78, 8, rgb(0.84, 0.88, 0.91));
      drawPill(page, x + 122, rowY - 12, width - 176, 16, rgb(0.93, 0.95, 0.97));
    }
    const cellSize = 28;
    for (let i = 0; i < 4; i += 1) {
      drawCard(page, x + 34 + i * (cellSize + 10), yTop - 108, cellSize, cellSize, i % 2 === 0 ? COLORS.primary : COLORS.white);
    }
    drawCard(page, x + 32, yTop - height + 62, width - 64, 76, rgb(0.97, 0.98, 0.99));
    drawPill(page, x + 32, yTop - height + 30, 92, 18, COLORS.primary);
    drawPill(page, x + 132, yTop - height + 30, 120, 18, COLORS.white, COLORS.line);
    return;
  }

  if (variant === 'group') {
    drawCard(page, x + 18, yTop - 18, width - 36, height - 36, COLORS.white);
    const columns = [130, 34, 34, 34, 34, 34];
    let rowTop = yTop - 44;
    for (let row = 0; row < 4; row += 1) {
      let cursorX = x + 26;
      columns.forEach((columnWidth, columnIndex) => {
        drawCard(
          page,
          cursorX,
          rowTop,
          columnWidth,
          24,
          row === 0 ? rgb(0.95, 0.97, 0.98) : columnIndex > 0 && (row + columnIndex) % 3 === 0 ? COLORS.primary : COLORS.white
        );
        cursorX += columnWidth + 6;
      });
      rowTop -= 30;
    }
    drawPill(page, x + 28, yTop - height + 36, 112, 18, COLORS.primary);
    drawPill(page, x + 150, yTop - height + 36, 136, 18, rgb(0.93, 0.95, 0.97));
    return;
  }

  if (variant === 'preview') {
    drawCard(page, x + 18, yTop - 18, width - 36, height - 36, COLORS.white);
    drawCard(page, x + 28, yTop - 28, width * 0.52, height - 58, rgb(0.99, 0.99, 1));
    drawCard(page, x + width * 0.58, yTop - 28, width * 0.26, height - 58, rgb(0.99, 0.99, 1));
    let listY = yTop - 52;
    for (let i = 0; i < 4; i += 1) {
      drawPill(page, x + 40, listY - 12, width * 0.42, 18, i === 0 ? COLORS.blueSoft : rgb(0.95, 0.96, 0.97));
      listY -= 28;
    }
    let detailY = yTop - 58;
    for (let i = 0; i < 5; i += 1) {
      drawPill(page, x + width * 0.61, detailY - 8, width * 0.18 + (i % 2) * 26, 8, rgb(0.84, 0.88, 0.91));
      detailY -= 18;
    }
    return;
  }

  drawCard(page, x + 18, yTop - 18, width - 36, height - 36, COLORS.white);
  for (let i = 0; i < 3; i += 1) {
    drawPill(page, x + 30 + i * 92, yTop - 44, 74, 16, rgb(0.93, 0.95, 0.97));
  }
  drawPill(page, x + 30, yTop - 74, 94, 18, COLORS.primary);
  drawPill(page, x + 132, yTop - 74, 94, 18, COLORS.white, COLORS.line);
  const bars = [46, 74, 58, 92];
  let barX = x + 42;
  bars.forEach((barHeight) => {
    drawCard(page, barX, yTop - height + 30 + barHeight, 34, barHeight, COLORS.primary);
    barX += 50;
  });
}

function addBodyPage(pdf, fonts, pageNumber) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawFooter(page, fonts, pageNumber);
  return page;
}

function drawCover(pdf, fonts, pageNumber) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 220, width: PAGE_WIDTH, height: 220, color: COLORS.primarySoft });
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: 120, color: COLORS.soft });

  page.drawText('Manual de usuario', { x: MARGIN, y: PAGE_HEIGHT - 118, size: 30, font: fonts.bold, color: COLORS.text });
  page.drawText('Plataforma de preinformes', { x: MARGIN, y: PAGE_HEIGHT - 154, size: 20, font: fonts.bold, color: COLORS.primary });
  page.drawText('Guía detallada para docentes y directores de grupo', {
    x: MARGIN,
    y: PAGE_HEIGHT - 184,
    size: 12,
    font: fonts.regular,
    color: COLORS.muted
  });

  let cursorY = PAGE_HEIGHT - 250;
  cursorY = drawWrappedText(
    page,
    'Este documento explica paso a paso cómo navegar por la plataforma, cómo cargar preinformes de forma individual y grupal, cómo aplicar el mismo registro en varias asignaturas, cómo agrupar materias afines y cómo generar reportes y PDF con la lógica real de la plataforma.',
    MARGIN,
    cursorY,
    CONTENT_WIDTH,
    fonts.regular,
    12,
    COLORS.text,
    4
  );

  drawCard(page, MARGIN, cursorY - 18, CONTENT_WIDTH, 174, COLORS.white);
  page.drawText('Contenido principal del manual', { x: MARGIN + 18, y: cursorY - 44, size: 13, font: fonts.bold, color: COLORS.primary });

  const highlights = [
    'Navegación del tablero docente',
    'Selección de período, grado y asignatura',
    'Agrupación de asignaturas afines',
    'Uso de varias asignaturas en una sola carga',
    'Carga individual, grupal, edición, eliminación y previsualización',
    'Reportes del grupo y observaciones del director'
  ];
  let listY = cursorY - 72;
  highlights.forEach((item) => {
    page.drawCircle({ x: MARGIN + 24, y: listY + 4, size: 4, color: COLORS.primary });
    page.drawText(item, { x: MARGIN + 36, y: listY, size: 11, font: fonts.regular, color: COLORS.text });
    listY -= 24;
  });

  drawIllustration(page, fonts, 'dashboard', MARGIN, 270, CONTENT_WIDTH, 170);
  drawFooter(page, fonts, pageNumber);
}

function drawIndexPage(page, fonts, sections) {
  page.drawText('Índice', { x: MARGIN, y: BODY_TOP - 10, size: 24, font: fonts.bold, color: COLORS.text });
  let cursorY = BODY_TOP - 46;
  cursorY = drawWrappedText(
    page,
    'Usa este índice para ubicar rápidamente cada flujo de trabajo descrito en el manual.',
    MARGIN,
    cursorY,
    CONTENT_WIDTH,
    fonts.regular,
    11,
    COLORS.muted,
    4
  );
  cursorY -= 10;

  sections.forEach((section, index) => {
    const pageTarget = index + 3;
    drawCard(page, MARGIN, cursorY, CONTENT_WIDTH, 24, index % 2 === 0 ? COLORS.soft : COLORS.white);
    page.drawText(`${index + 1}. ${section.title}`, { x: MARGIN + 12, y: cursorY - 16, size: 10, font: fonts.regular, color: COLORS.text });
    page.drawText(String(pageTarget), {
      x: PAGE_WIDTH - MARGIN - 12 - fonts.bold.widthOfTextAtSize(String(pageTarget), 10),
      y: cursorY - 16,
      size: 10,
      font: fonts.bold,
      color: COLORS.primary
    });
    cursorY -= 32;
  });
}

function drawSectionPage(page, fonts, section) {
  let cursorY = BODY_TOP - 18;
  drawAudienceTag(page, fonts, section.audience, MARGIN, cursorY - 6);
  cursorY -= 38;

  page.drawText(section.title, { x: MARGIN, y: cursorY, size: 18, font: fonts.bold, color: COLORS.text });
  cursorY -= 24;
  cursorY = drawWrappedText(page, section.objective, MARGIN, cursorY, CONTENT_WIDTH, fonts.regular, 10.5, COLORS.muted, 4);
  cursorY -= 12;

  page.drawText('Paso a paso', { x: MARGIN, y: cursorY, size: 13, font: fonts.bold, color: COLORS.primary });
  cursorY -= 18;
  section.steps.forEach((step, index) => {
    page.drawCircle({ x: MARGIN + 8, y: cursorY + 4, size: 8, color: COLORS.primary });
    page.drawText(String(index + 1), { x: MARGIN + 5.6, y: cursorY, size: 8, font: fonts.bold, color: COLORS.white });
    cursorY = drawWrappedText(page, step, MARGIN + 22, cursorY, CONTENT_WIDTH - 24, fonts.regular, 10, COLORS.text, 4);
    cursorY -= 8;
  });

  page.drawText('Recomendaciones', { x: MARGIN, y: cursorY, size: 13, font: fonts.bold, color: COLORS.primary });
  cursorY -= 18;
  section.notes.forEach((note) => {
    drawCard(page, MARGIN, cursorY, CONTENT_WIDTH, 30, COLORS.primarySoft);
    drawWrappedText(page, note, MARGIN + 12, cursorY - 12, CONTENT_WIDTH - 24, fonts.regular, 9.5, COLORS.text, 3);
    cursorY -= 38;
  });

  drawIllustration(page, fonts, section.illustration, MARGIN, BODY_BOTTOM + 194, CONTENT_WIDTH, 182);
}

async function main() {
  const pdf = await PDFDocument.create();
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold)
  };

  let pageNumber = 1;
  drawCover(pdf, fonts, pageNumber);

  pageNumber += 1;
  const indexPage = addBodyPage(pdf, fonts, pageNumber);
  drawIndexPage(indexPage, fonts, manualSections);

  for (const section of manualSections) {
    pageNumber += 1;
    const page = addBodyPage(pdf, fonts, pageNumber);
    drawSectionPage(page, fonts, section);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, Buffer.from(await pdf.save()));
  console.log(`Manual generado en: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
