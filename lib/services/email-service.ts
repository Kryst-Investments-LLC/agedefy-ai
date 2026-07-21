import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { randomBytes, createHash } from "crypto"

// ─── Token generation ────────────────────────────────────────

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function createPasswordResetToken(email: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) return null // Don't reveal whether email exists

  // Delete any existing tokens for this user
  await db.verificationToken.deleteMany({
    where: { identifier: `reset:${user.email}` },
  })

  const plainToken = randomBytes(32).toString("hex")
  const hashedToken = hashToken(plainToken)

  await db.verificationToken.create({
    data: {
      identifier: `reset:${user.email}`,
      token: hashedToken,
      expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  })

  return { plainToken, email: user.email, userId: user.id }
}

export async function verifyPasswordResetToken(token: string) {
  const hashedToken = hashToken(token)

  const stored = await db.verificationToken.findUnique({
    where: { token: hashedToken },
  })

  if (!stored) return null
  if (!stored.identifier.startsWith("reset:")) return null
  if (stored.expires < new Date()) {
    await db.verificationToken.delete({ where: { token: hashedToken } })
    return null
  }

  const email = stored.identifier.replace("reset:", "")
  return { email }
}

export async function consumePasswordResetToken(token: string) {
  const hashedToken = hashToken(token)
  const stored = await db.verificationToken.findFirst({
    where: { token: hashedToken },
  })

  if (!stored) return null
  if (!stored.identifier.startsWith("reset:")) return null
  if (stored.expires < new Date()) {
    await db.verificationToken.delete({ where: { token: hashedToken } })
    return null
  }

  const email = stored.identifier.replace("reset:", "")

  // Delete the token (single-use)
  await db.verificationToken.delete({ where: { token: hashedToken } })

  return { email }
}

// ─── Email verification tokens ──────────────────────────────

export async function createEmailVerificationToken(email: string) {
  await db.verificationToken.deleteMany({
    where: { identifier: `verify:${email.toLowerCase()}` },
  })

  const plainToken = randomBytes(32).toString("hex")
  const hashedToken = hashToken(plainToken)

  await db.verificationToken.create({
    data: {
      identifier: `verify:${email.toLowerCase()}`,
      token: hashedToken,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  })

  return { plainToken, email: email.toLowerCase() }
}

export async function consumeEmailVerificationToken(token: string) {
  const hashedToken = hashToken(token)
  const stored = await db.verificationToken.findFirst({
    where: { token: hashedToken },
  })

  if (!stored) return null
  if (!stored.identifier.startsWith("verify:")) return null
  if (stored.expires < new Date()) {
    await db.verificationToken.delete({ where: { token: hashedToken } })
    return null
  }

  const email = stored.identifier.replace("verify:", "")

  await db.verificationToken.delete({ where: { token: hashedToken } })

  return { email }
}

// ─── Email sending (SMTP via Nodemailer) ─────────────────────

interface EmailPayload {
  to: string
  subject: string
  html: string
}

export async function sendPlatformEmail(payload: EmailPayload): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const emailFrom = process.env.EMAIL_FROM ?? "noreply@biozephyra.com"

  if (!smtpHost || !smtpUser || !smtpPass) {
    // In development, log the email content instead of sending
    if (process.env.NODE_ENV !== "production") {
      logger.info("Email preview generated", {
        to: payload.to,
        subject: payload.subject,
        preview: payload.html.substring(0, 200) + "...",
      })
      return true
    }

    logger.warn("Email delivery skipped because SMTP is not configured", {
      to: payload.to,
      subject: payload.subject,
    })
    return false
  }

  // Dynamic import to avoid bundling nodemailer in client
  const nodemailer = await import("nodemailer")

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort) || 587,
    secure: (Number(smtpPort) || 587) === 465,
    auth: { user: smtpUser, pass: smtpPass },
    // Fail fast instead of hanging the request/worker — nodemailer's defaults are
    // 2 min (connection) and 10 min (socket), long enough to pin a handler.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })

  try {
    await transporter.sendMail({
      from: emailFrom,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    })
    return true
  } catch (error) {
    // Delivery failures (timeout, auth, connection) are logged and reported as a
    // boolean so best-effort callers (welcome email, notifications) don't crash;
    // callers that must guarantee delivery check the return value.
    logger.error("Email delivery failed", {
      to: payload.to,
      subject: payload.subject,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  } finally {
    transporter.close()
  }
}

// ─── Email templates ─────────────────────────────────────────

const baseUrl = () => process.env.NEXTAUTH_URL ?? "http://localhost:3000"

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${baseUrl()}/reset-password?token=${encodeURIComponent(token)}`

  return sendPlatformEmail({
    to: email,
    subject: "Biozephyra — Password Reset",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0d9488">Biozephyra</h2>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px">Reset Password</a></p>
        <p style="color:#6b7280;font-size:14px">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    `,
  })
}

export async function sendWelcomeEmail(email: string, name: string) {
  const dashboardUrl = `${baseUrl()}/dashboard`

  return sendPlatformEmail({
    to: email,
    subject: "Welcome to Biozephyra",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0d9488">Welcome, ${name}!</h2>
        <p>Your Biozephyra workspace is ready. You can now:</p>
        <ul>
          <li>Track biomarkers and protocols</li>
          <li>Explore the compound knowledge graph</li>
          <li>Search longevity research</li>
        </ul>
        <p><a href="${dashboardUrl}" style="display:inline-block;padding:12px 24px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px">Open Dashboard</a></p>
      </div>
    `,
  })
}

export async function sendEmailVerification(email: string, token: string) {
  const verifyUrl = `${baseUrl()}/verify-email?token=${encodeURIComponent(token)}`

  return sendPlatformEmail({
    to: email,
    subject: "Biozephyra — Verify Your Email",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0d9488">Biozephyra</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px">Verify Email</a></p>
        <p style="color:#6b7280;font-size:14px">This link expires in 24 hours.</p>
      </div>
    `,
  })
}
