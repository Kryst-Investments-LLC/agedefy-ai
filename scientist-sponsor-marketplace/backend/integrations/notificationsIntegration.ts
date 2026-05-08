import { logger } from "@/lib/logger"
import { sendPlatformEmail } from "@/lib/services/email-service"

export const notificationsIntegration = {
  async dispatch(
    channels: string[],
    title: string,
    body: string,
    options?: {
      recipientEmail?: string | null
      recipientName?: string | null
      actionUrl?: string | null
      metadata?: Record<string, unknown>
    },
  ) {
    const results = await Promise.all(
      channels.map(async (channel) => {
        if (channel === "email") {
          if (!options?.recipientEmail) {
            logger.warn("Marketplace email notification skipped because no recipient email was available", {
              title,
              metadata: options?.metadata,
            })

            return {
              channel,
              delivered: false,
              reason: "missing-recipient-email",
              title,
              body,
              deliveredAt: null,
            }
          }

          const delivered = await sendPlatformEmail({
            to: options.recipientEmail,
            subject: `Biozephyra Marketplace — ${title}`,
            html: `
              <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
                <h2 style="color:#0d9488">Scientist-Sponsor Marketplace</h2>
                <p>${options.recipientName ? `Hello ${options.recipientName},` : "Hello,"}</p>
                <p>${body}</p>
                ${options.actionUrl ? `<p><a href="${options.actionUrl}" style="display:inline-block;padding:12px 24px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px">Open Workspace</a></p>` : ""}
              </div>
            `,
          })

          return {
            channel,
            delivered,
            title,
            body,
            deliveredAt: delivered ? new Date().toISOString() : null,
          }
        }

        logger.info("Marketplace in-app notification dispatched", {
          title,
          channel,
          metadata: options?.metadata,
        })

        return {
          channel,
          delivered: true,
          title,
          body,
          deliveredAt: new Date().toISOString(),
        }
      }),
    )

    return results
  },
}
