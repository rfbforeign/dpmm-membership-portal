import { Resend } from 'resend';

export async function GET() {
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const response = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'delivered@resend.dev',
      subject: 'DPMM Resend Test',
      html: '<h1>✅ Resend is working perfectly!</h1><p>API Key: Connected</p>',
    });

    return Response.json({
      success: true,
      messageId: response.data?.id,
      message: 'Email sent via Resend!',
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
