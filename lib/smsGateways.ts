/**
 * US carrier SMS gateway domains. Number is substituted for "number".
 */
export const CARRIER_GATEWAYS: Record<string, string> = {
  "T-Mobile": "tmomail.net",
  "Verizon": "vtext.com",
  "Sprint": "messaging.sprintpcs.com",
  "XFinity Mobile": "vtext.com",
  "Virgin Mobile": "vmobl.com",
  "MetroPCS": "mymetropcs.com",
  "Boost Mobile": "sms.myboostmobile.com",
  "Cricket Wireless": "sms.cricketwireless.net",
  "US Cellular": "email.uscc.net",
} as const;

/** Reverse map: gateway domain -> carrier name (for migrating legacy recipient). */
export const GATEWAY_TO_CARRIER: Record<string, string> = Object.fromEntries(
  (Object.entries(CARRIER_GATEWAYS) as [string, string][]).map(([carrier, domain]) => [domain, carrier])
);

export const CARRIER_OPTIONS = Object.keys(CARRIER_GATEWAYS) as string[];

/**
 * Build gateway email for SMS (e.g. 5550000000@tmomail.net).
 * Strips non-digits from phoneNumber.
 */
export function toGatewayEmail(phoneNumber: string, carrier: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  const domain = CARRIER_GATEWAYS[carrier];
  if (!domain) return "";
  return `${digits}@${domain}`;
}

/** Parse legacy recipient email (number@domain) into { phoneNumber, carrier } or null. */
export function parseLegacyRecipient(recipient: string): { phoneNumber: string; carrier: string } | null {
  if (!recipient || !recipient.includes("@")) return null;
  const [numPart, domain] = recipient.split("@");
  const carrier = GATEWAY_TO_CARRIER[domain];
  if (!carrier || !numPart) return null;
  const phoneNumber = numPart.replace(/\D/g, "");
  if (!phoneNumber) return null;
  return { phoneNumber, carrier };
}
