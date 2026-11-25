const API_BASE = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? 'http://localhost:8000' : '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function post(path, body) {
  if (!API_BASE) {
    throw new ApiError('AI service is not configured for this deployment.', 503);
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.detail || `Service request failed (${response.status}).`, response.status);
  }
  return payload;
}

export async function getApiHealth() {
  if (!API_BASE) return { ai_configured: false };
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    if (!response.ok) return { ai_configured: false };
    return await response.json();
  } catch {
    return { ai_configured: false };
  }
}

export function isDemoFallback(error) {
  return error instanceof TypeError || error instanceof ApiError && error.status === 503;
}

export async function describeImage(image) {
  return post('/api/vision/describe', { image });
}

export async function detectObjects(image) {
  return post('/api/vision/detect', { image });
}

export async function askAssistant(question) {
  return post('/api/assistant/ask', { question });
}

export function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

export function demoDescription() {
  return {
    demo: true,
    result: 'Demo mode: no image analysis was performed. Connect a vision model in the backend to describe a real scene.',
    details: {
      overall: 'A real scene description will appear here when a vision model is configured.',
      objects: [],
      importantDetails: 'This is a clearly labeled demonstration response, not an analysis of your image.',
      text: 'No text was analyzed.',
      spatial: 'Spatial information is unavailable in demo mode.',
      uncertainty: 'Do not rely on this demo for safety-critical decisions.',
    },
  };
}

export function demoDetections() {
  return {
    demo: true,
    detections: [
      { name: 'Demo object', confidence: null },
      { name: 'Connect a model to detect objects in your image', confidence: null },
    ],
  };
}
