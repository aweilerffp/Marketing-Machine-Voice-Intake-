// Server-only. Posts a plain-text message to a Slack incoming webhook.
// Returns 'sent' | 'skipped' | 'failed' and never throws.
export async function postSlack(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return 'skipped';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn('[slack] webhook responded', res.status, await res.text().catch(() => ''));
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    console.warn('[slack] webhook failed:', err?.message || err);
    return 'failed';
  }
}
