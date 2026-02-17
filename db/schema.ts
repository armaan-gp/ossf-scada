import { integer, pgTable, varchar, boolean, text, timestamp, real, primaryKey } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  hashedPassword: varchar({ length: 255 }).notNull(),
  isAdmin: boolean().notNull().default(false),
});

export type User = typeof usersTable.$inferSelect
export type UserInsert = typeof usersTable.$inferInsert

// SMS config (single row): sender email, encrypted app password, recipients as JSON array of { phoneNumber, carrier }
export const smsConfigTable = pgTable("sms_config", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  senderEmail: varchar({ length: 255 }).notNull().default(""),
  appPasswordEncrypted: text().notNull().default(""),
  recipient: varchar({ length: 255 }).notNull().default(""), // legacy; use recipientsJson
  recipientsJson: text().notNull().default("[]"),
  alertMessage: text().notNull().default("Alert: {deviceName} - {propertyName} is out of range (value: {value})."),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type SmsConfig = typeof smsConfigTable.$inferSelect;
export type SmsConfigInsert = typeof smsConfigTable.$inferInsert;

// Tracks which (thing, property) alerts have already triggered an SMS this episode
export const alertNotificationsTable = pgTable("alert_notifications", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  thingId: varchar({ length: 255 }).notNull(),
  propertyId: varchar({ length: 255 }).notNull(),
  smsSentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type AlertNotification = typeof alertNotificationsTable.$inferSelect;
export type AlertNotificationInsert = typeof alertNotificationsTable.$inferInsert;

// Per-property alert thresholds (editable per PLC property)
export const propertyAlertThresholdsTable = pgTable("property_alert_thresholds", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  thingId: varchar({ length: 255 }).notNull(),
  propertyId: varchar({ length: 255 }).notNull(),
  minValue: real(),
  maxValue: real(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type PropertyAlertThreshold = typeof propertyAlertThresholdsTable.$inferSelect;
export type PropertyAlertThresholdInsert = typeof propertyAlertThresholdsTable.$inferInsert;