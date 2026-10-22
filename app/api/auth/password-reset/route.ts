import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    supported: false,
    message:
      "Password reset via email requires configuring a transactional email provider (e.g., Resend, SendGrid, Amazon SES, or Postmark) in .env. Once configured, an expiring reset token model can be activated.",
    requirements: [
      "SMTP_HOST or RESEND_API_KEY",
      "SMTP_USER",
      "SMTP_PASSWORD",
      "EMAIL_FROM",
    ],
  });
}
