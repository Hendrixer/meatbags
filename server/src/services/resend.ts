import { Resend } from "resend";
import { config } from "../config.js";

let client: Resend | undefined;

const FROM = "TPS HR <hr@meatbag.lol>";

export interface EmailInput {
  to: string;
  subject: string;
  body: string;
  cc?: string;
}

/**
 * Send an email (escalation tiers 3–4, and the final "enjoy your afternoon"
 * note). Stub-capable: with no RESEND_API_KEY it logs and returns instead of
 * throwing, so the workflow keeps moving. Call inside `step.run` so retries are
 * isolated.
 */
export async function sendEmail(input: EmailInput): Promise<void> {
  if (!config.resend.apiKey) {
    console.log(`[email stub] to=${input.to}${input.cc ? ` cc=${input.cc}` : ""} · subject="${input.subject}"`);
    return;
  }
  client ??= new Resend(config.resend.apiKey);
  // The SDK reports failures in the return value rather than throwing; check it
  // or a rejected send looks exactly like a delivered one.
  const { data, error } = await client.emails.send({
    from: FROM,
    to: input.to,
    ...(input.cc ? { cc: input.cc } : {}),
    subject: input.subject,
    html: `<pre style="font-family:inherit;white-space:pre-wrap">${input.body}</pre>`,
  });
  if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
  console.log(`✉ sent ${data?.id} to=${input.to} subject="${input.subject}"`);
}
