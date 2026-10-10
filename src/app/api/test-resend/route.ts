import { Resend } from 'resend';

export async function GET() {
  try {
    // Verify API key exists
    if (!process.env.RESEND_API_KEY) {
      return Response.json(
        { error: 'RESEND_API_KEY not set' },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send test email
    const response = await resend.emails.send({
      from: 'onboarding@resend.dev', // Test domain
      to: 'delivered@resend.dev',     // Test recipient
      subject: '✅ DPMM Resend Test',
      html: `
        <h1>✅ Resend Email Works!</h1>
        <p><strong>API Key Status:</strong> Connected</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      `,
    });

    if (response.error) {
      return Response.json(
        { error: response.error },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      messageId: response.data?.id,
      message: '✅ Email sent successfully via Resend!',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Resend error:', errorMessage);
    
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
