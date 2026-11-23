const API_URL = import.meta.env.VITE_API_URL;
const TOKEN_KEY = 'campusEventsToken';

export function saveToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function readToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

function makeError(message, status, data) {
  const error = new Error(message);
  error.status = status;
  error.data = data;
  return error;
}

async function readJson(response) {
  const text = await response.text();
  if (text === '') {
    return null;
  }
  return JSON.parse(text);
}

function buildRequest(options) {
  const headers = {};
  const token = readToken();
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }
  let body;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  return { method: options.method || 'GET', headers: headers, body: body };
}

export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(API_URL + path, buildRequest(options));
  } catch {
    throw makeError('Cannot reach the server. Is the backend running?', 0, null);
  }
  const data = await readJson(response);
  if (!response.ok) {
    let message = 'Something went wrong';
    if (data && data.error) {
      message = data.error;
    }
    throw makeError(message, response.status, data);
  }
  return data;
}
