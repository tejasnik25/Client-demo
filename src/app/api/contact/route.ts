import { NextRequest, NextResponse } from 'next/server';
import { sendEmailNotification } from '@/db/dbService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { subject, message, email, tx } = body as { subject?: string; message?: string; email?: string; tx?: string };
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    const adminEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || 'support@example.com';
    const content = `From: ${email || 'unknown'}\nSubject: ${subject || 'Contact'}\nTransaction: ${tx || '-'}\n\n${message}`;
    const res = await sendEmailNotification(adminEmail, subject || 'Contact', content);
    if (!res.success) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}