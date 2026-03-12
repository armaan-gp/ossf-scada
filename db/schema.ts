import { integer, pgTable, varchar, boolean, text, timestamp, real, primaryKey, pgEnum, type AnyPgColumn } from "drizzle-orm/pg-core";

export const userOriginEnum = pgEnum("user_origin", ["invite", "seed", "manual_script", "migration"]);
export const userStatusEnum = pgEnum("user_status", ["invited", "active", "disabled"]);
export const inviteRoleEnum = pgEnum("invite_role", ["admin", "user"]);
export const userAuditActionEnum = pgEnum("user_audit_action", [
  "invite_created",
  "invite_revoked",
  "user_activated",
  "user_updated",
  "role_changed",
  "user_disabled",
  "user_deleted",
  "password_reset_forced",
]);
export const userAuditSourceEnum = pgEnum("user_audit_source", ["ui_admin", "script_seed", "migration", "system"]);

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  hashedPassword: varchar({ length: 255 }).notNull(),
  isAdmin: boolean().notNull().default(false),
  createdByUserId: integer().references((): AnyPgColumn => usersTable.id, { onDelete: "set null" }),
  updatedByUserId: integer().references((): AnyPgColumn => usersTable.id, { onDelete: "set null" }),
  origin: userOriginEnum().notNull().default("migration"),
  status: userStatusEnum().notNull().default("active"),
  inviteAcceptedAt: timestamp({ withTimezone: true }),
  lastLoginAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect
export type UserInsert = typeof usersTable.$inferInsert
export type UserOrigin = typeof userOriginEnum.enumValues[number];
export type UserStatus = typeof userStatusEnum.enumValues[number];

export const userInvitesTable = pgTable("user_invites", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  email: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  role: inviteRoleEnum().notNull().default("user"),
  tokenHash: varchar({ length: 255 }).notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  usedAt: timestamp({ withTimezone: true }),
  revokedAt: timestamp({ withTimezone: true }),
  createdByUserId: integer().references((): AnyPgColumn => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type UserInvite = typeof userInvitesTable.$inferSelect;
export type UserInviteInsert = typeof userInvitesTable.$inferInsert;
export type InviteRole = typeof inviteRoleEnum.enumValues[number];

export const userAuditEventsTable = pgTable("user_audit_events", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  actorUserId: integer().references((): AnyPgColumn => usersTable.id, { onDelete: "set null" }),
  targetUserId: integer().references((): AnyPgColumn => usersTable.id, { onDelete: "set null" }),
  action: userAuditActionEnum().notNull(),
  source: userAuditSourceEnum().notNull().default("ui_admin"),
  metadataJson: text().notNull().default("{}"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type UserAuditEvent = typeof userAuditEventsTable.$inferSelect;
export type UserAuditEventInsert = typeof userAuditEventsTable.$inferInsert;
export type UserAuditAction = typeof userAuditActionEnum.enumValues[number];

// Alert email config (single row): sender email, encrypted app password, recipients as JSON array of email strings.
export const alertEmailConfigTable = pgTable("alert_email_config", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  senderEmail: varchar({ length: 255 }).notNull().default(""),
  appPasswordEncrypted: text().notNull().default(""),
  recipient: varchar({ length: 255 }).notNull().default(""), // legacy single recipient fallback
  recipientsJson: text().notNull().default("[]"),
  alertMessage: text().notNull().default("Alert: {deviceName} - {propertyName} is out of range (value: {value})."),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type AlertEmailConfig = typeof alertEmailConfigTable.$inferSelect;
export type AlertEmailConfigInsert = typeof alertEmailConfigTable.$inferInsert;

// Tracks which (thing, property) alerts have already triggered an email this episode.
export const alertNotificationsTable = pgTable("alert_notifications", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  thingId: varchar({ length: 255 }).notNull(),
  propertyId: varchar({ length: 255 }).notNull(),
  notifiedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type AlertNotification = typeof alertNotificationsTable.$inferSelect;
export type AlertNotificationInsert = typeof alertNotificationsTable.$inferInsert;

// Tracks currently active alert episodes by (thing, property) to detect new alert starts.
export const activeAlertEpisodesTable = pgTable(
  "active_alert_episodes",
  {
    thingId: varchar({ length: 255 }).notNull(),
    propertyId: varchar({ length: 255 }).notNull(),
    thingName: varchar({ length: 255 }).notNull(),
    propertyName: varchar({ length: 255 }).notNull(),
    propertyType: varchar({ length: 64 }).notNull(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.thingId, table.propertyId] }),
  ]
);

export type ActiveAlertEpisode = typeof activeAlertEpisodesTable.$inferSelect;
export type ActiveAlertEpisodeInsert = typeof activeAlertEpisodesTable.$inferInsert;

// Alert history rows for dashboard preview and CSV export.
export const alertEventsTable = pgTable("alert_events", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  thingId: varchar({ length: 255 }).notNull(),
  thingName: varchar({ length: 255 }).notNull(),
  propertyId: varchar({ length: 255 }).notNull(),
  propertyName: varchar({ length: 255 }).notNull(),
  propertyType: varchar({ length: 64 }).notNull(),
  valueRaw: text().notNull(),
  occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type AlertEvent = typeof alertEventsTable.$inferSelect;
export type AlertEventInsert = typeof alertEventsTable.$inferInsert;

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

// User-defined center map locations/layout.
export const centerMapLocationsTable = pgTable("center_map_locations", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  left: real().notNull(),
  top: real().notNull(),
  width: real().notNull().default(9),
  height: real().notNull().default(26),
  rotate: real(),
  sortOrder: integer().notNull().default(0),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type CenterMapLocation = typeof centerMapLocationsTable.$inferSelect;
export type CenterMapLocationInsert = typeof centerMapLocationsTable.$inferInsert;

// Global assignment of center map locations to PLC device IDs.
export const centerMapAssignmentsTable = pgTable("center_map_assignments", {
  locationId: integer().primaryKey().references(() => centerMapLocationsTable.id, { onDelete: "cascade" }),
  deviceId: varchar({ length: 255 }),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type CenterMapAssignment = typeof centerMapAssignmentsTable.$inferSelect;
export type CenterMapAssignmentInsert = typeof centerMapAssignmentsTable.$inferInsert;
