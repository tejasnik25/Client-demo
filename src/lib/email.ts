export type EmailType = 'payment' | 'otp' | 'generic';

type SendEmailPayload = {
  to: string;
  subject: string;
  html: string;
};

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export async function sendEmailViaResend(payload: SendEmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing');
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'no-reply@your-domain.com',
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error: ${res.status} ${text}`);
  }

  return res.json();
}

export function buildPaymentCompletedTemplate(name: string, amount: number, txId: string) {
  return `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; color:#1f2937;">
      <h2 style="color:#111827;">Payment Completed</h2>
      <p>Hi ${name},</p>
      <p>Your payment has been successfully processed.</p>
      <ul>
        <li><strong>Amount:</strong> ₹${amount.toFixed(2)}</li>
        <li><strong>Transaction ID:</strong> ${txId}</li>
      </ul>
      <p>Thank you for using StockAnalyzer.</p>
    </div>
  `;
}

export function buildOtpTemplate(name: string, otp: string) {
  return `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; color:#1f2937;">
      <h2 style="color:#111827;">Your One-Time Password</h2>
      <p>Hi ${name},</p>
      <p>Your OTP is <strong>${otp}</strong>. It expires in 10 minutes.</p>
      <p>If you did not request this code, please ignore this email.</p>
    </div>
  `;
}