const TOKEN_KEY = 'preinformes-token';

// Los tokens antiguos se guardaban de forma permanente. Se eliminan para
// impedir que una sesión previa se restaure después de cerrar el navegador.
window.localStorage.removeItem(TOKEN_KEY);

export function getToken() {
  return window.sessionStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  window.localStorage.removeItem(TOKEN_KEY);
  if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
  else window.sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Error de red');
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/pdf') || contentType.includes('application/zip')) return response.blob();
  return response.json();
}
