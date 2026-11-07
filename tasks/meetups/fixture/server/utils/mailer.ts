import { useRuntimeConfig } from "nuxt/server"

export interface MailMessage {
  to: string
  subject: string
  text: string
}

/** Sends one email through the mail provider. The provider is slow: a send takes about 1.5 seconds. */
export async function sendMail(message: MailMessage): Promise<void> {
  const { mailer } = useRuntimeConfig()
  const response = await fetch(`${mailer.url}/mail`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(message),
  })
  if (!response.ok) throw new Error(`The mail provider answered ${response.status}.`)
}
