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
    title: 'Ingreso y recuperación de contraseña',
    audience: 'Docentes y directores de grupo',
    objective:
      'La pantalla de ingreso permite acceder con el documento institucional, revisar visualmente la contraseña escrita y solicitar un enlace de recuperación al correo registrado.',
    steps: [
      'Escribe tu documento y contraseña.',
      'Usa el icono del campo de contraseña para mostrar u ocultar el contenido.',
      'Si olvidaste la clave, pulsa "¿Olvidaste tu contraseña?" y escribe tu documento.',
      'Abre el enlace recibido por correo y define una contraseña nueva.'
    ],
    notes: [
      'El enlace de recuperación tiene vigencia limitada y debe abrirse desde el mensaje más reciente.',
      'Si no tienes correo registrado, solicita al administrador que actualice tus datos.'
    ],
    illustration: 'individual'
  },
  {
    title: 'Tablero docente y módulos independientes',
    audience: 'Docentes y directores de grupo',
    objective:
      'El tablero separa las marcas de preinforme, las observaciones por asignatura y las observaciones del director para que cada tipo de información se administre desde su propio módulo.',
    steps: [
      'Abre la tarjeta correspondiente a la tarea que necesitas realizar.',
      'Confirma el título del módulo y los filtros visibles.',
      'Usa "Volver al tablero" para cambiar de función sin cerrar la sesión.'
    ],
    notes: [
      'Las marcas y las observaciones se almacenan de manera independiente.',
      'Los módulos del director solo aparecen cuando el usuario tiene un grado dirigido.'
    ],
    illustration: 'dashboard'
  },
  {
    title: 'Registrar y editar marcas de preinforme',
    audience: 'Docentes',
    objective:
      'El formulario de marcas carga el grupo completo y permite crear, modificar o eliminar dificultades con solo marcar o desmarcar los descriptores de cada estudiante.',
    steps: [
      'Selecciona período, grado y asignatura.',
      'Espera la carga automática de estudiantes y marcas existentes.',
      'Marca o desmarca los descriptores C y A necesarios.',
      'Pulsa "Guardar cambios" y espera la confirmación.',
      'Continúa editando: las marcas permanecen visibles después del guardado.'
    ],
    notes: [
      'La edición se bloquea brevemente mientras se guarda para evitar cambios simultáneos.',
      'Desmarcar y guardar elimina únicamente esa marca.'
    ],
    illustration: 'group'
  },
  {
    title: 'Autoguardado y varias asignaturas',
    audience: 'Docentes con varias asignaturas en el mismo grado',
    objective:
      'El módulo puede guardar periódicamente los cambios y también replicar las marcas en otras asignaturas disponibles para el docente dentro del mismo grado.',
    steps: [
      'Activa o desactiva el autoguardado; cuando está activo se ejecuta cada cinco minutos.',
      'Revisa el temporizador y la hora del último guardado.',
      'En "Guardar en varias asignaturas", marca las materias que recibirán los cambios.',
      'Para copiar lo ya registrado, elige una materia destino en "Copiar marcas a otra asignatura".',
      'Confirma la operación y revisa el mensaje final.'
    ],
    notes: [
      'El autoguardado solo actúa cuando existen cambios pendientes.',
      'La copia se limita a asignaturas del mismo grado disponibles para el usuario.'
    ],
    illustration: 'multisubject'
  },
  {
    title: 'Observaciones por asignatura',
    audience: 'Docentes',
    objective:
      'Las observaciones por asignatura se cargan en un listado independiente. Cada estudiante abre su editor debajo del nombre, como un acordeón.',
    steps: [
      'Selecciona período, grado y asignatura para cargar automáticamente el listado.',
      'Haz clic en un estudiante para abrir su editor.',
      'Aplica negrita, cursiva, subrayado, numeración, viñetas o colores.',
      'Guarda o borra la observación individual.',
      'Marca dos o más estudiantes para agregar o borrar una observación compartida.',
      'Usa las acciones para todos cuando corresponda al grupo completo.'
    ],
    notes: [
      'Guardar cierra el acordeón sin limpiar los filtros ni el listado.',
      'Las acciones múltiples reemplazan el texto existente después de solicitar confirmación.'
    ],
    illustration: 'director'
  },
  {
    title: 'Agrupación de asignaturas',
    audience: 'Docentes con asignaturas afines',
    objective:
      'Una agrupación permite mostrar varias asignaturas relacionadas como una sola opción, definiendo una materia principal y el nombre que se imprimirá.',
    steps: [
      'Abre "Agrupación de asignaturas" y selecciona el grado.',
      'Escribe el nombre y el nombre corto.',
      'Marca las asignaturas que integrarán el grupo.',
      'Elige la asignatura principal y el modo de impresión.',
      'Guarda la agrupación.'
    ],
    notes: [
      'La asignatura principal es la referencia interna utilizada por la plataforma.',
      'Solo se pueden agrupar asignaturas disponibles para el docente en ese grado.'
    ],
    illustration: 'subject-groups'
  },
  {
    title: 'Reportes del grupo y generación de PDF',
    audience: 'Directores de grupo',
    objective:
      'El módulo de reportes consolida la información del grado dirigido y permite generar archivos generales o individuales.',
    steps: [
      'Selecciona el período y el grado dirigido.',
      'Carga el resumen para revisar cobertura y registros faltantes.',
      'Elige el alcance del archivo: consolidado, por grado, por estudiante o individual.',
      'Genera y descarga el PDF o la exportación correspondiente.'
    ],
    notes: [
      'Los PDF conservan colores, negrita, cursiva, subrayado, numeración y viñetas.',
      'Las observaciones del director y de cada asignatura se presentan en secciones independientes.'
    ],
    illustration: 'reports'
  },
  {
    title: 'Observaciones del director de grupo',
    audience: 'Directores de grupo',
    objective:
      'El director registra observaciones globales de sus estudiantes sin mezclarlas con las observaciones de las asignaturas.',
    steps: [
      'Abre el módulo y selecciona el período; el grado dirigido se carga automáticamente.',
      'Haz clic en un estudiante para desplegar el editor.',
      'Guarda o borra la observación individual.',
      'Marca dos o más estudiantes para aplicar o eliminar una observación compartida.',
      'Usa las acciones generales para agregar o borrar observaciones de todo el grupo.'
    ],
    notes: [
      'Guardar cierra el acordeón y mantiene disponible el listado.',
      'Las acciones de borrado solicitan confirmación previa.'
    ],
    illustration: 'director'
  },
  {
    title: 'Buenas prácticas de uso',
    audience: 'Docentes y directores de grupo',
    objective:
      'Estas recomendaciones ayudan a evitar registros en períodos o asignaturas incorrectas y facilitan la generación de informes completos.',
    steps: [
      'Confirma siempre período, grado y asignatura antes de editar.',
      'Guarda manualmente antes de abandonar una sesión con cambios recientes.',
      'Usa la copia entre asignaturas únicamente cuando las mismas marcas correspondan.',
      'Revisa el formato y el contenido de las observaciones antes de generar el PDF.',
      'Lee los mensajes de confirmación después de cada operación.'
    ],
    notes: [
      'Las observaciones múltiples reemplazan el contenido anterior de los estudiantes seleccionados.',
      'Si algo parece inconsistente, vuelve al tablero y carga de nuevo el módulo.'
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
    'Este documento explica cómo ingresar, registrar marcas para todo el grupo, usar el autoguardado, copiar marcas entre asignaturas, redactar observaciones con formato y generar los reportes del grado.',
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
    'Ingreso y recuperación de contraseña',
    'Formulario único de marcas para todo el grupo',
    'Autoguardado y copia entre asignaturas',
    'Observaciones por asignatura con formato',
    'Observaciones individuales, múltiples o para todo el grupo',
    'Reportes y observaciones del director'
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
