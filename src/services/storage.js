const KEYS = {
  settings: 'vision-assistant-settings',
  history: 'vision-assistant-history',
};

export const defaultSettings = {
  voiceFeedback: true,
  speechRate: 1,
  volume: 0.85,
  language: 'en-US',
  theme: 'dark',
  preferredCamera: '',
  accessibilityMode: false,
};

function read(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? { ...fallback, ...JSON.parse(value) } : fallback;
  } catch {
    return fallback;
  }
}

export function getSettings() {
  return read(KEYS.settings, defaultSettings);
}

export function saveSettings(settings) {
  window.localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export function getHistory() {
  try {
    const value = window.localStorage.getItem(KEYS.history);
    const entries = value ? JSON.parse(value) : [];
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries) {
  window.localStorage.setItem(KEYS.history, JSON.stringify(entries));
}
