import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendPartnerInvitationEmail({
  to,
  inviterName,
  portfolioName,
  percentage,
  token,
}: {
  to: string
  inviterName: string
  portfolioName: string
  percentage: number
  token: string
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const acceptUrl = `${appUrl}/invite/${token}`

  await transporter.sendMail({
    from: `"Stockify" <${process.env.SMTP_USER}>`,
    to,
    subject: `${inviterName} invited you to view "${portfolioName}" on Stockify`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#18181b;border-radius:16px;border:1px solid #27272a;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#10b981,#059669,#047857);">
              <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">
                Stock<span style="color:#d1fae5;">ify</span>
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:#a7f3d0;">PSX Portfolio Manager</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#f4f4f5;">
                You&rsquo;ve been invited!
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#a1a1aa;line-height:1.6;">
                <strong style="color:#e4e4e7;">${inviterName}</strong> has invited you to view their
                <strong style="color:#e4e4e7;">&ldquo;${portfolioName}&rdquo;</strong> portfolio
                with a <strong style="color:#10b981;">${percentage.toFixed(1)}%</strong> profit share.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${acceptUrl}"
                       style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.1px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#71717a;">Or copy this link into your browser:</p>
              <p style="margin:0 0 24px;font-size:12px;color:#10b981;word-break:break-all;">${acceptUrl}</p>

              <hr style="border:none;border-top:1px solid #27272a;margin:0 0 20px;" />

              <p style="margin:0;font-size:12px;color:#52525b;line-height:1.6;">
                This invitation expires in <strong style="color:#71717a;">7 days</strong>.
                You must sign up or log in with this email address (<strong style="color:#71717a;">${to}</strong>) to accept.
                If you weren&rsquo;t expecting this, you can ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  })
}
