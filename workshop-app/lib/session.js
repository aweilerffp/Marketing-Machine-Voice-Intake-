const STORAGE_KEY = 'workshop-voice-session';

function defaultSectionState() {
  return {
    transcript: '',
    nuggets: [],
    extractedData: null,
    completedAt: null,
  };
}

export function defaultSession() {
  return {
    clientName: '',
    currentPhase: 'WELCOME',
    startedAt: null,
    sectionA: defaultSectionState(),
    sectionB: defaultSectionState(),
    sectionC: defaultSectionState(),
  };
}

export function saveSession(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be full or unavailable
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupted or unavailable
  }
  return null;
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
