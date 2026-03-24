import { useEffect, useRef } from 'react';
import { Button, ButtonGroup, Form } from 'react-bootstrap';

const ALLOWED_TAGS = new Set(['P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'B', 'STRONG', 'I', 'EM', 'U', 'SPAN']);
const BASIC_COLORS = [
  { label: 'Negro', value: '#000000' },
  { label: 'Rojo', value: '#c62828' },
  { label: 'Azul', value: '#1565c0' },
  { label: 'Verde', value: '#2e7d32' },
  { label: 'Naranja', value: '#ef6c00' },
  { label: 'Morado', value: '#6a1b9a' }
];

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function plainTextToHtml(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  if (!normalized.trim()) return '';
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function normalizeIncomingValue(value) {
  const text = String(value || '');
  return /<\/?[a-z][\s\S]*>/i.test(text) ? text : plainTextToHtml(text);
}

function sanitizeNode(node, document) {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent || '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const tagName = node.tagName.toUpperCase();
  if (!ALLOWED_TAGS.has(tagName)) {
    const fragment = document.createDocumentFragment();
    for (const child of node.childNodes) {
      const sanitizedChild = sanitizeNode(child, document);
      if (sanitizedChild) fragment.appendChild(sanitizedChild);
    }
    return fragment;
  }

  const clean = document.createElement(tagName.toLowerCase());
  if (tagName === 'SPAN') {
    const color = node.style?.color || '';
    if (color) clean.style.color = color;
  }

  for (const child of node.childNodes) {
    const sanitizedChild = sanitizeNode(child, document);
    if (sanitizedChild) clean.appendChild(sanitizedChild);
  }

  return clean;
}

function sanitizeHtml(html) {
  if (!html) return '';
  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = parsed.body.firstElementChild;
  const output = parsed.createElement('div');

  for (const child of container.childNodes) {
    const sanitizedChild = sanitizeNode(child, parsed);
    if (sanitizedChild) output.appendChild(sanitizedChild);
  }

  return output.innerHTML
    .replace(/<div><br><\/div>/gi, '<p><br></p>')
    .replace(/^(?:\s|&nbsp;)+|(?:\s|&nbsp;)+$/g, '');
}

export function RichTextEditor({ label, value, onChange, rows = 4, helperText }) {
  const editorRef = useRef(null);
  const lastAppliedValueRef = useRef(normalizeIncomingValue(value));

  useEffect(() => {
    const nextHtml = normalizeIncomingValue(value);
    if (!editorRef.current) return;
    if (document.activeElement === editorRef.current) {
      lastAppliedValueRef.current = editorRef.current.innerHTML;
      return;
    }
    if (nextHtml !== lastAppliedValueRef.current && editorRef.current.innerHTML !== nextHtml) {
      editorRef.current.innerHTML = nextHtml;
    }
    lastAppliedValueRef.current = nextHtml;
  }, [value]);

  function emitChange(nextHtml) {
    lastAppliedValueRef.current = nextHtml;
    onChange(sanitizeHtml(nextHtml));
  }

  function runCommand(command, commandValue = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange(editorRef.current?.innerHTML || '');
  }

  return (
    <Form.Group className="mb-3">
      {label ? <Form.Label>{label}</Form.Label> : null}
      <div className="rich-editor">
        <div className="rich-editor-toolbar">
          <ButtonGroup size="sm" className="flex-wrap">
            <Button type="button" variant="outline-dark" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('bold')}>
              B
            </Button>
            <Button type="button" variant="outline-dark" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('italic')}>
              I
            </Button>
            <Button type="button" variant="outline-dark" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('underline')}>
              U
            </Button>
            <Button
              type="button"
              variant="outline-dark"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand('insertUnorderedList')}
            >
              Vinetas
            </Button>
            <Button
              type="button"
              variant="outline-dark"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand('insertOrderedList')}
            >
              Numeracion
            </Button>
          </ButtonGroup>

          <div className="rich-editor-colors">
            <span className="rich-editor-color-label">Color</span>
            <ButtonGroup size="sm" className="flex-wrap">
              {BASIC_COLORS.map((color) => (
                <Button
                  key={color.value}
                  type="button"
                  variant="outline-dark"
                  className="rich-editor-color-btn"
                  title={color.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => runCommand('foreColor', color.value)}
                >
                  <span className="rich-editor-color-swatch" style={{ backgroundColor: color.value }} />
                  {color.label}
                </Button>
              ))}
            </ButtonGroup>
          </div>
        </div>

        <div
          ref={editorRef}
          className="rich-editor-surface"
          contentEditable
          suppressContentEditableWarning
          style={{ minHeight: `${rows * 1.5}rem` }}
          onInput={(e) => emitChange(e.currentTarget.innerHTML)}
          onBlur={(e) => {
            const sanitized = sanitizeHtml(e.currentTarget.innerHTML);
            if (e.currentTarget.innerHTML !== sanitized) {
              e.currentTarget.innerHTML = sanitized;
            }
            lastAppliedValueRef.current = sanitized;
            onChange(sanitized);
          }}
          dangerouslySetInnerHTML={{ __html: lastAppliedValueRef.current }}
        />
      </div>
      {helperText ? <Form.Text className="text-muted">{helperText}</Form.Text> : null}
    </Form.Group>
  );
}
