import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/modules/auth/dal";
import { getEmailConfig, sendEmail, sendingAllowed } from "@/modules/notifications/resend";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  if (user.role !== "admin") {
    return Response.json({ error: "Administrator access required." }, { status: 403 });
  }

  const config = getEmailConfig();
  if (!config) {
    return Response.json({ error: "Resend email settings are not configured." }, { status: 503 });
  }
  if (!sendingAllowed()) {
    return Response.json({ error: "Test emails can only be sent from production." }, { status: 403 });
  }

  const timestamp = new Date().toISOString();
  const result = await sendEmail(config, {
    to: "delivered@resend.dev",
    subject: "DPMM Resend Test",
    text: `Resend email configuration is working. Sender: ${config.from}. Timestamp: ${timestamp}`,
    html: `<h1>Resend email configuration is working</h1><p>Timestamp: ${timestamp}</p>`,
    idempotencyKey: `resend-test-${randomUUID()}`,
  });

  if (!result.ok) {
    console.error("Resend test email failed", result.error);
    return Response.json({ error: result.error }, { status: 502 });
  }

  return Response.json({
    success: true,
    messageId: result.id,
    message: "Test email sent successfully via Resend.",
    timestamp,
  });
}
