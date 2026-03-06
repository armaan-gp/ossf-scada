import "server-only";
import nodemailer from "nodemailer";
import { db } from "@/db";
import { decrypt } from "./encrypt";

export interface SendAlertOptions {
  deviceName?: string;
  propertyName?: string;
  value?: unknown;
}

const HARDCODED_ALERT_MESSAGE = "Alert: {deviceName} - {propertyName} is out of range (value: {value}).";

function formatMessage(template: string, opts: SendAlertOptions): string {
  return template
    .replace(/\{deviceName\}/g, String(opts.deviceName ?? "Unknown device"))
    .replace(/\{propertyName\}/g, String(opts.propertyName ?? "Unknown property"))
    .replace(/\{value\}/g, String(opts.value ?? ""));
}

/**
 * Load alert email config from DB. Returns null if sender/password/recipients are not configured.
 */
export async function getAlertEmailConfigForSend() {
  const row = await db.query.alertEmailConfigTable.findFirst();
  if (!row || !row.senderEmail || !row.appPasswordEncrypted) return null;

  const appPassword = decrypt(row.appPasswordEncrypted);
  if (!appPassword) return null;

  let recipientEmails: string[] = [];
  try {
    const parsed = JSON.parse(row.recipientsJson || "[]");
    if (Array.isArray(parsed)) {
      recipientEmails = parsed
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  } catch {
    // ignore
  }

  if (recipientEmails.length === 0 && row.recipient?.includes("@")) {
    recipientEmails = [row.recipient.trim()];
  }
  if (recipientEmails.length === 0) return null;

  return {
    senderEmail: row.senderEmail,
    appPassword,
    recipientEmails,
  };
}

/**
 * Send alert email via Gmail SMTP to all configured recipients.
 * Only call from server.
 */
export async function sendAlertEmail(messageOverride?: string, opts: SendAlertOptions = {}): Promise<{ success: boolean; error?: string }> {
  const config = await getAlertEmailConfigForSend();
  if (!config) {
    return { success: false, error: "Email alerts are not configured. Set sender email, app password, and at least one recipient in Settings." };
  }

  const body = messageOverride ?? formatMessage(HARDCODED_ALERT_MESSAGE, opts);

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: config.senderEmail,
        pass: config.appPassword,
      },
    });

    await transporter.sendMail({
      from: config.senderEmail,
      to: config.recipientEmails,
      subject: "Website Alert",
      text: body,
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
