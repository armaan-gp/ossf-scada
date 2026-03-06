import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-cbc";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const raw = process.env.ALERT_EMAIL_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || "ossf-scada-default-key-change-in-production";
  return createHash("sha256").update(raw, "utf8").digest().subarray(0, KEY_LENGTH);
}

export function encrypt(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(cipherText: string): string {
  if (!cipherText || !cipherText.includes(":")) return "";
  const [ivHex, encryptedHex] = cipherText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
