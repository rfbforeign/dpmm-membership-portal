import type { TemplateVariables } from "./templates";

export interface EmailConfig {
  apiKey: string;
  from: string; // for example: DPMM Putrajaya <noreply@yourdomain.org.my>
  replyTo?: string;
  memberTemplateId?: string;
}

/** The email settings, or null when the service is not set up. */
export function getEmailConfig(env: Record<string, string | undefined> = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  const memberTemplateId = env.RESEND_MEMBER_TEMPLATE_ID?.trim();
  return {
    apiKey,
    from,
    replyTo: env.EMAIL_REPLY_TO?.trim() || undefined,
    ...(memberTemplateId ? { memberTemplateId } : {}),
  };
}

/**
 * Real emails go out only from the live website. On your computer or a preview site the queue
 * still fills up, but nothing is sent, so testing can never email real members.
 * (EMAIL_FORCE_SEND=true overrides this on purpose.)
 */
export function sendingAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "production" || env.EMAIL_FORCE_SEND === "true";
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string | null;
  template?: { id: string; variables: TemplateVariables };
  /** Stops the service sending it twice if we retry. */
  idempotencyKey: string;
}

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string; retryable: boolean };

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TIMEOUT_MS = 10_000;

export async function sendEmail(
  config: EmailConfig,
  message: OutgoingEmail,
  fetchImpl: typeof fetch = fetch
): Promise<SendResult> {
  if (!EMAIL_PATTERN.test(message.to)) {
    return { ok: false, error: "The email address is not valid.", retryable: false };
  }
  if (message.template) {
    if (!message.template.id.trim()) {
      return { ok: false, error: "The Resend template ID is missing.", retryable: false };
    }
    for (const [key, value] of Object.entries(message.template.variables)) {
      if (!/^[A-Za-z0-9_]{1,50}$/.test(key)) {
        return { ok: false, error: `The Resend template variable name "${key}" is invalid.`, retryable: false };
      }
      if (typeof value === "string" && value.length > 2000) {
        return { ok: false, error: `The Resend template variable "${key}" exceeds 2,000 characters.`, retryable: false };
      }
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from: config.from,
        to: [message.to],
        subject: message.subject,
        ...(message.template
          ? { template: { id: message.template.id, variables: message.template.variables } }
          : { text: message.text, ...(message.html ? { html: message.html } : {}) }),
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (response.ok && body.id) return { ok: true, id: body.id };

    const detail = body.message ?? `The email service answered ${response.status}.`;
    // Server trouble and rate limits are worth retrying; a rejected message or key is not
    const retryable = response.status >= 500 || response.status === 429;
    return { ok: false, error: detail.slice(0, 300), retryable };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, error: aborted ? "The email service took too long to answer." : "Could not reach the email service.", retryable: true };
  } finally {
    clearTimeout(timer);
  }
}
