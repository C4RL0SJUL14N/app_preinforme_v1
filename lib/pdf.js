import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const PORTRAIT_PAGE_WIDTH = 595;
const PORTRAIT_PAGE_HEIGHT = 842;
const MARGIN = 20;
const TABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FIRST_COLUMN_WIDTH = 248;
const BORDER_COLOR = rgb(0, 0, 0);
const HEADER_FILL = rgb(0.95, 0.95, 0.95);
const SECTION_FILL = rgb(0.9, 0.93, 0.96);

function loadHeaderImage() {
  const imagePath = path.resolve(process.cwd(), 'assets', 'header-preinforme-completo.png');
  return fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null;
}

function loadHeaderLogoImage() {
  const imagePath = path.resolve(process.cwd(), 'assets', 'header-logo-preinforme.png');
  return fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null;
}

function sanitizeText(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/\uFFFD/g, '')
    .replace(/Â·/g, '·')
    .replace(/Â/g, '')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã/g, 'Á')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã/g, 'Í')
    .replace(/Ã“/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Ã‘/g, 'Ñ')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ãœ/g, 'Ü')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[•▪◦]/g, '-');
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&uuml;/gi, 'ü')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&#225;/g, 'á')
    .replace(/&#233;/g, 'é')
    .replace(/&#237;/g, 'í')
    .replace(/&#243;/g, 'ó')
    .replace(/&#250;/g, 'ú')
    .replace(/&#241;/g, 'ñ')
    .replace(/&#252;/g, 'ü')
    .replace(/&#193;/g, 'Á')
    .replace(/&#201;/g, 'É')
    .replace(/&#205;/g, 'Í')
    .replace(/&#211;/g, 'Ó')
    .replace(/&#218;/g, 'Ú')
    .replace(/&#209;/g, 'Ñ')
    .replace(/&#220;/g, 'Ü');
}

function extractObservationParagraphs(value) {
  const source = String(value || '').replace(/\r\n/g, '\n');
  if (!source.trim()) return [];
  if (!/<\/?[a-z][\s\S]*>/i.test(source)) {
    return source
      .split(/\n+/)
      .map((paragraph) => sanitizeText(paragraph.trim()))
      .filter(Boolean);
  }

  const tokens = source.match(/<\/?[^>]+>|[^<]+/g) || [];
  const paragraphs = [];
  const listStack = [];
  let current = '';

  function flushParagraph() {
    const text = sanitizeText(current.replace(/\s+/g, ' ').trim());
    if (text) paragraphs.push(text);
    current = '';
  }

  function appendText(text) {
    const normalized = decodeHtmlEntities(text).replace(/\s+/g, ' ').trim();
    if (!normalized) return;
    current = current ? `${current} ${normalized}` : normalized;
  }

  for (const token of tokens) {
    if (!token.startsWith('<')) {
      appendText(token);
      continue;
    }

    const tag = token.toLowerCase().replace(/\s+/g, ' ');

    if (/^<br\b/.test(tag)) {
      flushParagraph();
      continue;
    }

    if (/^<(p|div)\b/.test(tag) || /^<\/(p|div)>/.test(tag)) {
      flushParagraph();
      continue;
    }

    if (/^<ul\b/.test(tag)) {
      flushParagraph();
      listStack.push({ type: 'ul', index: 0 });
      continue;
    }

    if (/^<ol\b/.test(tag)) {
      flushParagraph();
      listStack.push({ type: 'ol', index: 0 });
      continue;
    }

    if (/^<\/(ul|ol)>/.test(tag)) {
      flushParagraph();
      listStack.pop();
      continue;
    }

    if (/^<li\b/.test(tag)) {
      flushParagraph();
      const currentList = listStack[listStack.length - 1];
      if (currentList?.type === 'ol') {
        currentList.index += 1;
        current = `${currentList.index}. `;
      } else {
        current = '- ';
      }
      continue;
    }

    if (/^<\/li>/.test(tag)) {
      flushParagraph();
    }
  }

  flushParagraph();
  return paragraphs;
}

function wrapObservationParagraphs(value, maxWidth, font, size) {
  const paragraphs = extractObservationParagraphs(value);
  if (!paragraphs.length) return [];

  const lines = [];
  paragraphs.forEach((paragraph, index) => {
    const paragraphLines = splitLines(paragraph, maxWidth, font, size);
    lines.push(...paragraphLines);
    if (index < paragraphs.length - 1) lines.push('');
  });
  return lines;
}

function splitLines(text, maxWidth, font, size) {
  const words = sanitizeText(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCell(page, text, x, topY, width, height, options) {
  const {
    font,
    bold,
    fontSize = 8,
    align = 'left',
    verticalAlign = 'center',
    fillColor = rgb(1, 1, 1),
    textColor = rgb(0, 0, 0)
  } = options;
  page.drawRectangle({
    x,
    y: topY - height,
    width,
    height,
    borderColor: BORDER_COLOR,
    borderWidth: 0.8,
    color: fillColor
  });

  const drawFont = bold ? options.boldFont : font;
  const maxWidth = Math.max(10, width - 6);
  const lines = splitLines(text, maxWidth, drawFont, fontSize).slice(0, Math.max(1, Math.floor((height - 4) / (fontSize + 1))));
  const totalHeight = lines.length * fontSize + (lines.length - 1) * 1;
  let currentY =
    verticalAlign === 'top' ? topY - 4 - fontSize : topY - Math.max(4, (height - totalHeight) / 2) - fontSize;

  for (const line of lines) {
    const safeLine = sanitizeText(line);
    const textWidth = drawFont.widthOfTextAtSize(safeLine, fontSize);
    const textX =
      align === 'center' ? x + (width - textWidth) / 2 : align === 'right' ? x + width - textWidth - 3 : x + 3;
    page.drawText(safeLine, {
      x: textX,
      y: currentY,
      size: fontSize,
      font: drawFont,
      color: textColor
    });
    currentY -= fontSize + 1;
  }
}

function drawMark(page, marked, x, topY, width, height, boldFont) {
  if (!marked) return;
  const size = 10;
  const text = 'X';
  const textWidth = boldFont.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: x + (width - textWidth) / 2,
    y: topY - height + (height - size) / 2,
    size,
    font: boldFont,
    color: rgb(0.08, 0.08, 0.08)
  });
}

function drawRow(page, cells, topY, height, ctx) {
  let cursorX = MARGIN;
  for (const cell of cells) {
    drawCell(page, cell.text, cursorX, topY, cell.width, height, {
      font: ctx.font,
      boldFont: ctx.bold,
      bold: Boolean(cell.bold),
      fontSize: cell.fontSize,
      align: cell.align,
      verticalAlign: cell.verticalAlign,
      fillColor: cell.fillColor,
      textColor: cell.textColor
    });
    if (cell.marked) {
      drawMark(page, cell.marked, cursorX, topY, cell.width, height, ctx.bold);
    }
    cursorX += cell.width;
  }
}

function getHeaderSubjectLabel(subject) {
  return subject.shortName || subject.subjectName || '';
}

function buildEmptySignatureCells(item, subjectWidth) {
  return [
    { text: 'Firma del docente', width: FIRST_COLUMN_WIDTH, bold: true, fontSize: 8, align: 'center' },
    ...item.subjects.map(() => ({ text: '', width: subjectWidth }))
  ];
}

function getGeneralStrategiesText() {
  return '- El estudiante debe ponerse al día con las actividades trabajadas hasta la fecha (plazo de entrega, hasta la semana 11). Como estrategia de sustentación, el educando será evaluado de forma escrita u oral. Quien supere el 25% de la inasistencia injustificada durante el período obtendrá una calificación de 2.0.';
}

function getGeneralObservationsText() {
  return '- Debe cambiar de actitud frente a todos los procesos de aprendizaje (disciplinarios y acad\u00e9micos). - Debe asumir con responsabilidad y seriedad todas las actividades asignadas. - Es necesario que estudiante y acudiente se mantengan en constante contacto con el docente. Debe acatar las normas disciplinarias y de convivencia.';
}

function drawTextBlock(page, title, body, x, topY, width, height, font, bold) {
  page.drawRectangle({
    x,
    y: topY - height,
    width,
    height,
    borderColor: BORDER_COLOR,
    borderWidth: 0.8,
    color: rgb(1, 1, 1)
  });

  const titleSize = 6.6;
  const bodySize = 5.4;
  const innerX = x + 4;
  let currentY = topY - 5 - titleSize;

  page.drawText(sanitizeText(title), {
    x: innerX,
    y: currentY,
    size: titleSize,
    font: bold,
    color: rgb(0, 0, 0)
  });

  currentY -= titleSize + 3;
  const bodyLines = splitLines(body, Math.max(20, width - 8), font, bodySize).slice(0, 7);
  for (const line of bodyLines) {
    page.drawText(sanitizeText(line), {
      x: innerX,
      y: currentY,
      size: bodySize,
      font,
      color: rgb(0, 0, 0)
    });
    currentY -= bodySize + 1.2;
  }
}

function drawGuardianSignatureCell(page, x, topY, width, height, bold) {
  page.drawRectangle({
    x,
    y: topY - height,
    width,
    height,
    borderColor: BORDER_COLOR,
    borderWidth: 0.8,
    color: rgb(1, 1, 1)
  });

  const lineY = topY - height / 2 + 6;
  page.drawLine({
    start: { x: x + 10, y: lineY },
    end: { x: x + width - 10, y: lineY },
    thickness: 0.6,
    color: BORDER_COLOR
  });

  const label = 'Firma del acudiente';
  const labelSize = 6.8;
  const labelWidth = bold.widthOfTextAtSize(label, labelSize);
  page.drawText(label, {
    x: x + (width - labelWidth) / 2,
    y: topY - height + 10,
    size: labelSize,
    font: bold,
    color: rgb(0, 0, 0)
  });
}

function drawGeneralFooterRow(page, topY, height, font, bold) {
  const firstWidth = 305;
  const secondWidth = 305;
  const thirdWidth = TABLE_WIDTH - firstWidth - secondWidth;

  drawTextBlock(
    page,
    'Estrategias de superaci\u00f3n generales:',
    getGeneralStrategiesText(),
    MARGIN,
    topY,
    firstWidth,
    height,
    font,
    bold
  );
  drawTextBlock(
    page,
    'Observaciones generales:',
    getGeneralObservationsText(),
    MARGIN + firstWidth,
    topY,
    secondWidth,
    height,
    font,
    bold
  );
  drawGuardianSignatureCell(page, MARGIN + firstWidth + secondWidth, topY, thirdWidth, height, bold);
}

async function loadHeaderAssets(pdf) {
  const imageBytes = loadHeaderImage();
  const logoBytes = loadHeaderLogoImage();
  return {
    headerImage: imageBytes ? await pdf.embedPng(imageBytes) : null,
    logoImage: logoBytes ? await pdf.embedPng(logoBytes) : null
  };
}

function drawDocumentHeader(page, assets, font, bold) {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const width = pageWidth - MARGIN * 2;
  const topY = pageHeight - MARGIN;
  if (assets.headerImage) {
    const maxWidth = width;
    const maxHeight = pageWidth > pageHeight ? 82 : 96;
    const scale = Math.min(maxWidth / assets.headerImage.width, maxHeight / assets.headerImage.height, 1);
    const imageWidth = assets.headerImage.width * scale;
    const imageHeight = assets.headerImage.height * scale;

    page.drawImage(assets.headerImage, {
      x: MARGIN + (width - imageWidth) / 2,
      y: topY - imageHeight,
      width: imageWidth,
      height: imageHeight
    });

    return topY - imageHeight;
  }

  const headerHeight = pageWidth > pageHeight ? 66 : 72;
  const x = MARGIN;

  page.drawRectangle({
    x,
    y: topY - headerHeight,
    width,
    height: headerHeight,
    borderColor: BORDER_COLOR,
    borderWidth: 0.8,
    color: rgb(1, 1, 1)
  });

  const leftWidth = 72;
  const centerWidth = pageWidth > pageHeight ? width - leftWidth - 92 : width - leftWidth - 84;
  const rightWidth = width - leftWidth - centerWidth;
  const rowHeights = [26, 20, headerHeight - 46];
  const col1X = x + leftWidth;
  const col2X = x + leftWidth + centerWidth;

  page.drawLine({
    start: { x: col1X, y: topY },
    end: { x: col1X, y: topY - headerHeight },
    thickness: 0.8,
    color: BORDER_COLOR
  });
  page.drawLine({
    start: { x: col2X, y: topY },
    end: { x: col2X, y: topY - headerHeight },
    thickness: 0.8,
    color: BORDER_COLOR
  });

  let rowCursorY = topY - rowHeights[0];
  page.drawLine({
    start: { x: col1X, y: rowCursorY },
    end: { x: x + width, y: rowCursorY },
    thickness: 0.8,
    color: BORDER_COLOR
  });
  rowCursorY -= rowHeights[1];
  page.drawLine({
    start: { x: col1X, y: rowCursorY },
    end: { x: x + width, y: rowCursorY },
    thickness: 0.8,
    color: BORDER_COLOR
  });

  if (assets.logoImage) {
    const maxLogoWidth = leftWidth - 14;
    const maxLogoHeight = headerHeight - 12;
    const logoScale = Math.min(maxLogoWidth / assets.logoImage.width, maxLogoHeight / assets.logoImage.height, 1);
    const logoWidth = assets.logoImage.width * logoScale;
    const logoHeight = assets.logoImage.height * logoScale;
    page.drawImage(assets.logoImage, {
      x: x + (leftWidth - logoWidth) / 2,
      y: topY - headerHeight + (headerHeight - logoHeight) / 2,
      width: logoWidth,
      height: logoHeight
    });
  }

  drawCell(page, 'Institución Educativa Juan de Dios Girón', col1X, topY, centerWidth, rowHeights[0], {
    font,
    boldFont: bold,
    bold: true,
    fontSize: pageWidth > pageHeight ? 10 : 9,
    align: 'center',
    fillColor: rgb(1, 1, 1)
  });
  drawCell(page, `Proceso de Acompañamiento del Año Escolar ${new Date().getFullYear()}`, col1X, topY - rowHeights[0], centerWidth, rowHeights[1], {
    font,
    boldFont: bold,
    bold: true,
    fontSize: pageWidth > pageHeight ? 9 : 8,
    align: 'center',
    fillColor: rgb(1, 1, 1)
  });

  drawCell(page, 'Seguimiento al Estudiante (preinforme)', col1X, topY - rowHeights[0] - rowHeights[1], centerWidth, rowHeights[2], {
    font,
    boldFont: bold,
    bold: true,
    fontSize: pageWidth > pageHeight ? 9 : 8,
    align: 'center',
    fillColor: rgb(1, 1, 1)
  });

  drawCell(page, 'PGF-02-R', col2X, topY, rightWidth, headerHeight, {
    font,
    boldFont: bold,
    bold: true,
    fontSize: pageWidth > pageHeight ? 9 : 8,
    align: 'center',
    fillColor: rgb(1, 1, 1)
  });

  return topY - headerHeight;
}

function drawNoDataPage(pdf, font, bold, headerAssets) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const headerBottomY = drawDocumentHeader(page, headerAssets, font, bold);
  page.drawText('No hay preinformes para imprimir con los filtros seleccionados.', {
    x: 48,
    y: headerBottomY - 42,
    size: 16,
    font: bold,
    color: rgb(0.1, 0.1, 0.1)
  });
  page.drawText('Ajusta período, grado o estudiante y vuelve a intentarlo.', {
    x: 48,
    y: headerBottomY - 70,
    size: 11,
    font,
    color: rgb(0.25, 0.25, 0.25)
  });
}

function drawObservationsPage(pdf, font, bold, item, headerAssets) {
  let page = pdf.addPage([PORTRAIT_PAGE_WIDTH, PORTRAIT_PAGE_HEIGHT]);
  let currentY = drawDocumentHeader(page, headerAssets, font, bold) - 28;
  const maxWidth = page.getWidth() - MARGIN * 2;
  const bottomLimit = MARGIN + 24;
  const title = 'Observaciones';
  const titleSize = 15;
  const titleWidth = bold.widthOfTextAtSize(title, titleSize);

  page.drawText(title, {
    x: MARGIN + (maxWidth - titleWidth) / 2,
    y: currentY,
    size: titleSize,
    font: bold,
    color: rgb(0.08, 0.08, 0.08)
  });
  currentY -= 26;

  page.drawText(sanitizeText(`Estudiante: ${item.studentName || ''}`), {
    x: MARGIN,
    y: currentY,
    size: 10,
    font: bold,
    color: rgb(0.08, 0.08, 0.08)
  });
  currentY -= 18;

  for (const entry of item.observationEntries) {
    const labelPrefix = entry.isDirectorObservation ? 'Director de grupo' : 'Asignatura';
    const teacherPrefix = entry.isDirectorObservation ? 'Registró' : 'Docente';
    const headingSize = entry.isDirectorObservation ? 9 : 9;
    const bodySize = entry.isDirectorObservation ? 8.5 : 8.5;
    const lineStep = 10.5;
    const sectionGap = 3;
    const blockGap = 12;
    const subjectLines = splitLines(`${labelPrefix}: ${entry.subjectName}`, maxWidth, bold, headingSize);
    const observationLines = wrapObservationParagraphs(entry.observations, maxWidth, font, bodySize);
    const teacherLines = splitLines(`${teacherPrefix}: ${entry.teacherName}`, maxWidth, font, bodySize);
    const blockHeight = lineStep * (subjectLines.length + observationLines.length + teacherLines.length) + 22;

    if (currentY - blockHeight < bottomLimit) {
      page = pdf.addPage([PORTRAIT_PAGE_WIDTH, PORTRAIT_PAGE_HEIGHT]);
      currentY = drawDocumentHeader(page, headerAssets, font, bold) - 28;
    }

    for (const line of subjectLines) {
      page.drawText(sanitizeText(line), {
        x: MARGIN,
        y: currentY,
        size: headingSize,
        font: bold,
        color: rgb(0.08, 0.08, 0.08)
      });
      currentY -= lineStep;
    }

    currentY -= sectionGap;
    for (const line of observationLines) {
      if (!line) {
        currentY -= lineStep - 2;
        continue;
      }
      page.drawText(sanitizeText(line), {
        x: MARGIN,
        y: currentY,
        size: bodySize,
        font,
        color: rgb(0.12, 0.12, 0.12)
      });
      currentY -= lineStep;
    }

    currentY -= sectionGap;
    for (const line of teacherLines) {
      page.drawText(sanitizeText(line), {
        x: MARGIN,
        y: currentY,
        size: bodySize,
        font,
        color: rgb(0.12, 0.12, 0.12)
      });
      currentY -= lineStep;
    }

    currentY -= blockGap - 2;
    page.drawLine({
      start: { x: MARGIN, y: currentY },
      end: { x: page.getWidth() - MARGIN, y: currentY },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7)
    });
    currentY -= blockGap + 4;
  }
}

export async function buildPreReportsPdf(items) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const headerAssets = await loadHeaderAssets(pdf);

  if (!items.length) {
    drawNoDataPage(pdf, font, bold, headerAssets);
    return Buffer.from(await pdf.save());
  }

  for (const item of items) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const subjectCount = Math.max(item.subjects.length, 1);
    const subjectWidth = (TABLE_WIDTH - FIRST_COLUMN_WIDTH) / subjectCount;
    let topY = drawDocumentHeader(page, headerAssets, font, bold) - 8;

    drawRow(
      page,
      [
        { text: `Sede: ${item.sede || ''}`, width: 150, bold: true, fontSize: 8 },
        { text: `Fecha: ${item.dateLabel}`, width: 120, bold: true, fontSize: 8 },
        { text: `Director de grupo: ${item.directorName || ''}`, width: 360, bold: true, fontSize: 8 },
        { text: `Grupo: ${item.gradeName || ''}`, width: TABLE_WIDTH - 150 - 120 - 360, bold: true, fontSize: 8 }
      ],
      topY,
      18,
      { font, bold }
    );
    topY -= 18;

    drawRow(
      page,
      [
        { text: `Período: ${item.periodName || ''}`, width: 160, bold: true, fontSize: 8 },
        { text: `Nombre del estudiante: ${item.studentName || ''}`, width: TABLE_WIDTH - 160, bold: true, fontSize: 8 }
      ],
      topY,
      18,
      { font, bold }
    );
    topY -= 18;

    drawRow(
      page,
      [
        { text: 'Áreas curriculares', width: FIRST_COLUMN_WIDTH, bold: true, fontSize: 8, align: 'center', fillColor: HEADER_FILL },
        ...item.subjects.map((subject) => ({
          text: getHeaderSubjectLabel(subject),
          width: subjectWidth,
          bold: true,
          fontSize: 6,
          align: 'center',
          fillColor: HEADER_FILL
        }))
      ],
      topY,
      24,
      { font, bold }
    );
    topY -= 24;

    for (const row of item.rows) {
      if (row.type === 'section') {
        drawRow(
          page,
          [
            { text: row.label, width: FIRST_COLUMN_WIDTH, bold: true, fontSize: 8, fillColor: SECTION_FILL, align: 'center' },
            ...item.subjects.map(() => ({ text: '', width: subjectWidth, fillColor: SECTION_FILL }))
          ],
          topY,
          14,
          { font, bold }
        );
        topY -= 14;
        continue;
      }

      drawRow(
        page,
        [
          { text: row.label, width: FIRST_COLUMN_WIDTH, fontSize: 6, align: 'left' },
          ...item.subjects.map((subject, index) => ({
            text: '',
            width: subjectWidth,
            marked: row.marks[index]
          }))
        ],
        topY,
        16,
        { font, bold }
      );
      topY -= 16;
    }

    drawRow(page, buildEmptySignatureCells(item, subjectWidth), topY, 22, { font, bold });
    topY -= 22;

    drawGeneralFooterRow(page, topY, 58, font, bold);

    if (item.observationEntries?.length) {
      drawObservationsPage(pdf, font, bold, item, headerAssets);
    }
  }

  return Buffer.from(await pdf.save());
}

function drawSummaryMessagePage(pdf, font, bold, headerAssets, title, subtitle) {
  const page = pdf.addPage([PORTRAIT_PAGE_WIDTH, PORTRAIT_PAGE_HEIGHT]);
  const headerBottomY = drawDocumentHeader(page, headerAssets, font, bold);
  page.drawText(sanitizeText(title), {
    x: MARGIN,
    y: headerBottomY - 44,
    size: 16,
    font: bold,
    color: rgb(0.1, 0.1, 0.1)
  });
  page.drawText(sanitizeText(subtitle), {
    x: MARGIN,
    y: headerBottomY - 72,
    size: 11,
    font,
    color: rgb(0.25, 0.25, 0.25)
  });
}

function drawWrappedParagraph(page, text, x, currentY, maxWidth, font, size, color = rgb(0.12, 0.12, 0.12)) {
  const lines = splitLines(text, maxWidth, font, size);
  for (const line of lines) {
    page.drawText(sanitizeText(line), {
      x,
      y: currentY,
      size,
      font,
      color
    });
    currentY -= size + 3;
  }
  return currentY;
}

export async function buildTeachersReportedSummaryPdf(summary) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const headerAssets = await loadHeaderAssets(pdf);

  if (!summary?.sedes?.length) {
    drawSummaryMessagePage(
      pdf,
      font,
      bold,
      headerAssets,
      'No hay docentes con preinformes para este filtro.',
      'Ajusta sede, grado, período o docente y vuelve a intentarlo.'
    );
    return Buffer.from(await pdf.save());
  }

  const createPage = () => {
    const page = pdf.addPage([PORTRAIT_PAGE_WIDTH, PORTRAIT_PAGE_HEIGHT]);
    let currentY = drawDocumentHeader(page, headerAssets, font, bold) - 24;
    currentY = drawWrappedParagraph(
      page,
      'Docentes que reportaron por sede y grado',
      MARGIN,
      currentY,
      page.getWidth() - MARGIN * 2,
      bold,
      15,
      rgb(0.08, 0.08, 0.08)
    );
    currentY -= 4;
    currentY = drawWrappedParagraph(
      page,
      `Periodo: ${summary.periodName || 'Todos'} | Sede: ${summary.sedeName || 'Todas'} | Grado: ${summary.gradeName || 'Todos'} | Docente: ${summary.teacherName || 'Todos'}`,
      MARGIN,
      currentY,
      page.getWidth() - MARGIN * 2,
      font,
      9,
      rgb(0.25, 0.25, 0.25)
    );
    currentY -= 8;
    return { page, currentY };
  };

  let { page, currentY } = createPage();
  const pageBottom = MARGIN + 28;
  const maxWidth = page.getWidth() - MARGIN * 2;

  const ensureSpace = (neededHeight) => {
    if (currentY - neededHeight >= pageBottom) return;
    ({ page, currentY } = createPage());
  };

  for (const sede of summary.sedes) {
    ensureSpace(44);
    page.drawRectangle({
      x: MARGIN,
      y: currentY - 22,
      width: maxWidth,
      height: 24,
      color: SECTION_FILL,
      borderColor: BORDER_COLOR,
      borderWidth: 0.8
    });
    page.drawText(sanitizeText(`Sede: ${sede.sedeName || 'Sin sede'}`), {
      x: MARGIN + 6,
      y: currentY - 14,
      size: 11,
      font: bold,
      color: rgb(0.08, 0.08, 0.08)
    });
    page.drawText(sanitizeText(`Docentes: ${sede.totalTeachers} | Preinformes: ${sede.totalReports}`), {
      x: MARGIN + 270,
      y: currentY - 14,
      size: 9,
      font,
      color: rgb(0.12, 0.12, 0.12)
    });
    currentY -= 34;

    for (const grade of sede.grades) {
      ensureSpace(38);
      page.drawText(sanitizeText(`Grado: ${grade.gradeName}`), {
        x: MARGIN,
        y: currentY,
        size: 10.5,
        font: bold,
        color: rgb(0.1, 0.1, 0.1)
      });
      page.drawText(sanitizeText(`Docentes: ${grade.totalTeachers} | Preinformes: ${grade.totalReports}`), {
        x: MARGIN + 220,
        y: currentY,
        size: 9,
        font,
        color: rgb(0.28, 0.28, 0.28)
      });
      currentY -= 18;

      for (const teacher of grade.teachers) {
        const subjectText = teacher.subjectNames.length ? teacher.subjectNames.join(', ') : 'Sin asignaturas';
        const subjectLines = splitLines(`Asignaturas: ${subjectText}`, maxWidth - 16, font, 8.5);
        const blockHeight = 36 + subjectLines.length * 11;
        ensureSpace(blockHeight);

        page.drawRectangle({
          x: MARGIN + 4,
          y: currentY - blockHeight + 8,
          width: maxWidth - 8,
          height: blockHeight - 4,
          color: rgb(1, 1, 1),
          borderColor: rgb(0.82, 0.82, 0.82),
          borderWidth: 0.6
        });

        page.drawText(sanitizeText(teacher.teacherName || 'Sin docente'), {
          x: MARGIN + 12,
          y: currentY - 12,
          size: 9.5,
          font: bold,
          color: rgb(0.1, 0.1, 0.1)
        });
        page.drawText(sanitizeText(`Preinformes: ${teacher.totalReports} | Estudiantes: ${teacher.totalStudents}`), {
          x: MARGIN + 12,
          y: currentY - 25,
          size: 8.5,
          font,
          color: rgb(0.25, 0.25, 0.25)
        });

        let subjectY = currentY - 39;
        for (const line of subjectLines) {
          page.drawText(sanitizeText(line), {
            x: MARGIN + 12,
            y: subjectY,
            size: 8.5,
            font,
            color: rgb(0.15, 0.15, 0.15)
          });
          subjectY -= 11;
        }

        currentY -= blockHeight + 6;
      }

      currentY -= 4;
    }
  }

  return Buffer.from(await pdf.save());
}

export async function buildAdminSummaryPdf(summary) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const headerAssets = await loadHeaderAssets(pdf);

  const createPage = () => {
    const page = pdf.addPage([PORTRAIT_PAGE_WIDTH, PORTRAIT_PAGE_HEIGHT]);
    let currentY = drawDocumentHeader(page, headerAssets, font, bold) - 24;
    currentY = drawWrappedParagraph(
      page,
      'Resumen institucional de reportes',
      MARGIN,
      currentY,
      page.getWidth() - MARGIN * 2,
      bold,
      15,
      rgb(0.08, 0.08, 0.08)
    );
    currentY -= 4;
    currentY = drawWrappedParagraph(
      page,
      `Periodo: ${summary.periodName || 'Todos'} | Sede: ${summary.sedeName || 'Todas'} | Grado: ${summary.gradeName || 'Todos'} | Docente: ${summary.teacherName || 'Todos'}`,
      MARGIN,
      currentY,
      page.getWidth() - MARGIN * 2,
      font,
      9,
      rgb(0.25, 0.25, 0.25)
    );
    currentY -= 8;
    return { page, currentY };
  };

  const drawMetricGroup = (pageRef, currentYRef, title, items) => {
    let currentPage = pageRef;
    let currentY = currentYRef;
    const itemFontSize = 8.8;
    const itemLineHeight = itemFontSize + 3;
    const maxWidth = currentPage.getWidth() - MARGIN * 2 - 4;

    const ensureSpace = (neededHeight) => {
      if (currentY - neededHeight >= pageBottom) return;
      const next = createPage();
      currentPage = next.page;
      currentY = next.currentY;
    };

    ensureSpace(20);
    currentPage.drawText(sanitizeText(title), {
      x: MARGIN,
      y: currentY,
      size: 10.5,
      font: bold,
      color: rgb(0.08, 0.08, 0.08)
    });
    currentY -= 16;

    if (!items.length) {
      ensureSpace(18);
      currentPage.drawText('Sin datos para mostrar.', {
        x: MARGIN + 4,
        y: currentY,
        size: 8.5,
        font,
        color: rgb(0.35, 0.35, 0.35)
      });
      return { page: currentPage, currentY: currentY - 18 };
    }

    for (const item of items) {
      const label = item.label || 'Sin etiqueta';
      const suffix = item.total === '' ? '' : `: ${item.total ?? 0}`;
      const lines = splitLines(`${label}${suffix}`, maxWidth, font, itemFontSize);
      ensureSpace(lines.length * itemLineHeight);
      for (const line of lines) {
        currentPage.drawText(sanitizeText(line), {
          x: MARGIN + 4,
          y: currentY,
          size: itemFontSize,
          font,
          color: rgb(0.12, 0.12, 0.12)
        });
        currentY -= itemLineHeight;
      }
    }

    return { page: currentPage, currentY: currentY - 6 };
  };

  let { page, currentY } = createPage();
  const pageBottom = MARGIN + 28;

  const sections = [
    {
      title: 'Totales',
      items: [
        { label: 'Preinformes', total: summary.totals?.preReports || 0 },
        { label: 'Estudiantes reportados', total: summary.totals?.studentsReported || 0 },
        { label: 'Estudiantes pendientes', total: summary.totals?.studentsPending || 0 },
        { label: 'Docentes sin preinformes', total: summary.totals?.teachersWithoutReports || 0 }
      ]
    },
    {
      title: 'Por sede',
      items: (summary.bySede || []).slice(0, 20).map((item) => ({ label: item.sedeName, total: item.total }))
    },
    {
      title: 'Por grado',
      items: (summary.byGrade || []).slice(0, 20).map((item) => ({ label: item.gradeName, total: item.total }))
    },
    {
      title: 'Por asignatura',
      items: (summary.bySubject || []).slice(0, 20).map((item) => ({ label: item.subjectName, total: item.total }))
    },
    {
      title: 'Por docente',
      items: (summary.byTeacher || []).slice(0, 20).map((item) => ({ label: item.teacherName, total: item.total }))
    },
    {
      title: 'Docentes sin preinformes',
      items: (summary.teachersWithoutReports || []).slice(0, 25).map((item) => ({
        label: `${item.teacherName} | Grados: ${item.gradeNames.join(', ') || 'Ninguno'} | Asignaturas: ${item.subjectNames.join(', ') || 'Ninguna'}`,
        total: item.missingAssignments
      }))
    },
    {
      title: 'Estudiantes sin ningún preinforme',
      items: (summary.studentsPending || []).slice(0, 40).map((item) => ({
        label: `${item.gradeName} - ${item.studentName}`,
        total: ''
      }))
    }
  ];

  for (const section of sections) {
    const estimatedHeight = 28 + Math.max(section.items.length, 1) * 12;
    if (currentY - estimatedHeight < pageBottom) {
      ({ page, currentY } = createPage());
    }
    ({ page, currentY } = drawMetricGroup(page, currentY, section.title, section.items));
  }

  return Buffer.from(await pdf.save());
}
