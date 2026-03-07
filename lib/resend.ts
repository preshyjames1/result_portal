import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendPinEmailParams {
  to: string;
  full_name: string;
  pin_code: string;
  admission_no: string;
  term: string;
  session: string;
}

export async function sendPinEmail(params: SendPinEmailParams): Promise<void> {
  const { to, full_name, pin_code, admission_no, term, session } = params;

  // Support both env var names — whichever is set in Vercel
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM;
  // Support both site URL env var names
  const portalUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

  if (!fromAddress) {
    throw new Error('Email from address not configured (set RESEND_FROM_EMAIL in Vercel)');
  }

  // Format PIN with dashes for readability in the email: ABCD-1234-EFGH-5678
  const formattedPin = pin_code.replace(/(.{4})/g, '$1-').slice(0, -1);

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Georgia, serif; color: #1a1a2e; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border: 2px solid #4169E1; border-radius: 8px; overflow: hidden; }
    .header { background: #1a1a2e; color: #FFD700; padding: 24px 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
    .header p { margin: 4px 0 0; font-size: 13px; color: #ccc; }
    .body { padding: 32px; }
    .pin-box { background: #f0f4ff; border: 2px dashed #4169E1; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
    .pin-code { font-family: 'Courier New', monospace; font-size: 28px; font-weight: bold; color: #4169E1; letter-spacing: 4px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .info-table td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
    .info-table td:first-child { font-weight: bold; color: #666; width: 40%; }
    .steps { background: #fafafa; border-left: 4px solid #FFD700; padding: 16px 20px; margin: 20px 0; }
    .steps ol { margin: 8px 0; padding-left: 20px; }
    .steps li { margin: 6px 0; font-size: 14px; }
    .warning { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 12px 16px; font-size: 13px; margin: 16px 0; }
    .footer { background: #1a1a2e; color: #aaa; padding: 16px 32px; text-align: center; font-size: 12px; }
    .btn { display: inline-block; background: #4169E1; color: #fff !important; text-decoration: none; padding: 12px 28px; border-radius: 4px; font-size: 15px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>REHOBOTH COLLEGE</h1>
      <p>Official Result Checking Portal</p>
    </div>
    <div class="body">
      <p>Dear <strong>${full_name}</strong>,</p>
      <p>Your result checking PIN has been generated successfully. Please keep this PIN confidential.</p>

      <div class="pin-box">
        <p style="margin:0 0 8px; color:#666; font-size:13px; text-transform:uppercase; letter-spacing:1px;">Your Result PIN</p>
        <div class="pin-code">${formattedPin}</div>
        <p style="margin:8px 0 0; color:#888; font-size:12px;">You may also enter it without dashes: ${pin_code}</p>
      </div>

      <table class="info-table">
        <tr><td>Admission Number</td><td>${admission_no}</td></tr>
        <tr><td>Term</td><td>${term}</td></tr>
        <tr><td>Session</td><td>${session}</td></tr>
        <tr><td>Usage Limit</td><td>5 times</td></tr>
      </table>

      <div class="steps">
        <strong>How to check your result:</strong>
        <ol>
          <li>Visit <a href="${portalUrl}">${portalUrl}</a></li>
          <li>Enter your Admission Number: <strong>${admission_no}</strong></li>
          <li>Select your Class, Term (<strong>${term}</strong>) and Session (<strong>${session}</strong>)</li>
          <li>Enter the PIN above</li>
          <li>Click "Check Result"</li>
        </ol>
      </div>

      <div class="warning">
        <strong>⚠️ Important:</strong><br>
        • This PIN can be used up to <strong>5 times</strong>.<br>
        • After first use, this PIN is permanently linked to your admission number.<br>
        • Do not share this PIN with anyone.<br>
        • PIN is non-refundable once issued.
      </div>

      ${portalUrl ? `<a href="${portalUrl}" class="btn">Check My Result →</a>` : ''}
    </div>
    <div class="footer">
      Rehoboth College — Official Result Portal<br>
      If you did not request this PIN, please contact the school administration immediately.
    </div>
  </div>
</body>
</html>
  `.trim();

  const result = await resend.emails.send({
    from: fromAddress,
    to,
    subject: `Your Rehoboth College Result PIN — ${term} ${session}`,
    html: htmlBody,
  });

  // Surface any Resend errors so they appear in Vercel logs
  if (result.error) {
    throw new Error(`Resend error: ${JSON.stringify(result.error)}`);
  }
}
