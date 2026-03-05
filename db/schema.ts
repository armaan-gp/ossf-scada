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

// Per-property data recording config for CSV exports.
export const propertyRecordingConfigsTable = pgTable(
  "property_recording_configs",
  {
    thingId: varchar({ length: 255 }).notNull(),
    propertyId: varchar({ length: 255 }).notNull(),
    enabled: boolean().notNull().default(false),
    intervalMinutes: integer(),
    maxRows: integer(),
    lastRecordedAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.thingId, table.propertyId] }),
  ]
);

export type PropertyRecordingConfig = typeof propertyRecordingConfigsTable.$inferSelect;
export type PropertyRecordingConfigInsert = typeof propertyRecordingConfigsTable.$inferInsert;

// Rolling per-property recorded values (exported as CSV in UI).
export const propertyRecordingRowsTable = pgTable("property_recording_rows", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  thingId: varchar({ length: 255 }).notNull(),
  propertyId: varchar({ length: 255 }).notNull(),
  recordedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  value: text().notNull(),
  alertCount: integer().notNull().default(0),
});

export type PropertyRecordingRow = typeof propertyRecordingRowsTable.$inferSelect;
export type PropertyRecordingRowInsert = typeof propertyRecordingRowsTable.$inferInsert;

// Global decimal-place display setting for PLC property values.
export const propertyDisplaySettingsTable = pgTable("property_display_settings", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  globalDecimalPlaces: integer(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type PropertyDisplaySettings = typeof propertyDisplaySettingsTable.$inferSelect;
export type PropertyDisplaySettingsInsert = typeof propertyDisplaySettingsTable.$inferInsert;

// Per-property decimal-place display overrides.
export const propertyDisplayOverridesTable = pgTable(
  "property_display_overrides",
  {
    thingId: varchar({ length: 255 }).notNull(),
    propertyId: varchar({ length: 255 }).notNull(),
    decimalPlaces: integer(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.thingId, table.propertyId] }),
  ]
);

export type PropertyDisplayOverride = typeof propertyDisplayOverridesTable.$inferSelect;
export type PropertyDisplayOverrideInsert = typeof propertyDisplayOverridesTable.$inferInsert;

// Global assignment of OSSF center systems to PLC device IDs.
export const centerMapAssignmentsTable = pgTable("center_map_assignments", {
  systemKey: varchar({ length: 64 }).primaryKey(),
  deviceId: varchar({ length: 255 }),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type CenterMapAssignment = typeof centerMapAssignmentsTable.$inferSelect;
export type CenterMapAssignmentInsert = typeof centerMapAssignmentsTable.$inferInsert;
