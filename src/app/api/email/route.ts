import { NextRequest, NextResponse } from 'next/server';
import { buildOtpTemplate, buildPaymentCompletedTemplate, sendEmailViaResend } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, to, name, amount, txId, otp, subject } = body as {
      type: 'payment' | 'otp' | 'generic';
      to: string;
      name?: string;
      amount?: number;
      txId?: string;
      otp?: string;
      subject?: string;
    };

    if (!to) return NextResponse.json({ error: 'Missing recipient' }, { status: 400 });

    let html = '';
    let finalSubject = subject || 'Notification';

    switch (type) {
      case 'payment':
        html = buildPaymentCompletedTemplate(name || 'User', amount || 0, txId || 'N/A');
        finalSubject = subject || 'Payment Completed';
        break;
      case 'otp':
        if (!otp) return NextResponse.json({ error: 'Missing OTP' }, { status: 400 });
        html = buildOtpTemplate(name || 'User', otp);
        finalSubject = subject || 'Your OTP Code';
        break;
      default:
        html = `<p>${body.html || 'Hello from StockAnalyzer!'}</p>`;
        break;
    }

    const result = await sendEmailViaResend({ to, subject: finalSubject, html });
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}