// Browser helper: POSTs to /api/save. Never rejects; returns { ok, ... }.
export async function saveToServer(payload) {
  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      console.warn('[save] server save failed:', res.status, data?.error);
      return { ok: false, error: data?.error || `HTTP ${res.status}` };
    }
    return data;
  } catch (err) {
    console.warn('[save] server save failed:', err?.message || err);
    return { ok: false, error: err?.message || 'network error' };
  }
}
