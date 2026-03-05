import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { name, email, mobile, subject, message } = await req.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { message: 'All fields are required' },
        { status: 400 }
      );
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('Missing SMTP credentials. Please set SMTP_USER and SMTP_PASS in your .env file.');
      return NextResponse.json(
        { message: 'Server configuration error: Missing email credentials.' },
        { status: 500 }
      );
    }

    // Create a transporter
    // Note: These environment variables must be set in your Vercel project or .env file
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f9f9f9; }
          .header { background-color: #00d09c; color: white; padding: 15px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { padding: 20px; background-color: white; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #555; display: block; margin-bottom: 5px; }
          .value { background-color: #f5f5f5; padding: 10px; border-radius: 5px; border-left: 4px solid #00d09c; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Support Request</h2>
          </div>
          <div class="content">
            <p>You have received a new message from the contact form.</p>
            
            <div class="field">
              <span class="label">Name:</span>
              <div class="value">${name}</div>
            </div>
            
            <div class="field">
              <span class="label">Email:</span>
              <div class="value">${email}</div>
            </div>
            
            <div class="field">
              <span class="label">Mobile:</span>
              <div class="value">${mobile || 'Not provided'}</div>
            </div>
            
            <div class="field">
              <span class="label">Subject:</span>
              <div class="value">${subject}</div>
            </div>
            
            <div class="field">
              <span class="label">Message:</span>
              <div class="value" style="white-space: pre-wrap;">${message}</div>
            </div>
          </div>
          <div class="footer">
            <p>This email was sent from your website contact form.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Support Form" <${process.env.SMTP_USER}>`,
      to: 'tradeown3@gmail.com', // Destination email
      replyTo: email,
      subject: `[Support Request] ${subject}`,
      html: htmlContent,
      text: `Name: ${name}\nEmail: ${email}\nMobile: ${mobile || 'Not provided'}\nSubject: ${subject}\n\nMessage:\n${message}`,
    });

    return NextResponse.json({ message: 'Message sent successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Email sending error:', error);
    return NextResponse.json(
      { message: 'Failed to send message. Please try again later.' },
      { status: 500 }
    );
  }
}
