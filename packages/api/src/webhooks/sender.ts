import { signWebhookPayload } from '@kite402/sdk';

export async function sendWebhook(
  url: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = signWebhookPayload(body, process.env.WEBHOOK_SECRET ?? '');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kite402-Signature': `sha256=${signature}`,
      },
      body,
    });
    if (!res.ok) {
      console.error(`[webhook] delivery failed (${res.status}) to ${url}`);
    }
  } catch (err) {
    console.error(`[webhook] delivery error to ${url}:`, err);
  }
}
