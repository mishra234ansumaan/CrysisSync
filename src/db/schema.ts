/**
 * CrisisSync production schema — PostgreSQL via Drizzle ORM.
 *
 * Production uses Supabase PostgreSQL through DATABASE_URL; local VS Code uses
 * the same schema against local PostgreSQL. Tables store emergency reports,
 * volunteers, medical profiles, rescue matches, Web Push subscriptions and
 * persistent public-API quota windows. Private evidence objects live in
 * Supabase Storage rather than the relational database.
 */
import {
  pgTable,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/** Every incoming distress signal from the Victim PWA. */
export const sosReports = pgTable(
  "sos_reports",
  {
    id: text("id").primaryKey(), // cuid generated in app layer
    userId: text("user_id"),
    transcript: text("transcript").notNull(),
    emergencyType: text("emergency_type").notNull(), // flood|fire|medical|earthquake|other
    severity: integer("severity").notNull(), // 1-10 (AI assessed)
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    imageUrl: text("image_url"),
    trustScore: integer("trust_score").notNull().default(30), // 0-100, AI verification
    isVerified: boolean("is_verified").notNull().default(false),
    isFake: boolean("is_fake").notNull().default(false),
    language: text("language").notNull().default("en"),
    status: text("status").notNull().default("active"), // active|dispatched|resolved
    source: text("source").notNull().default("voice"), // voice|sms|beacon|demo
    aiSummary: text("ai_summary"),
    keywords: text("keywords"), // JSON string array
    verificationNotes: text("verification_notes"), // JSON: per-layer breakdown
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("sos_status_idx").on(t.status),
    index("sos_created_idx").on(t.createdAt),
  ]
);

/** Registered citizen helpers (Volunteer PWA). */
export const volunteers = pgTable("volunteers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  /** JSON string: { boat, first_aid, food, shelter, vehicle } */
  resources: text("resources").notNull().default("{}"),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Offline-capable medical profile, mirrored by the QR Medical Pass. */
export const medicalProfiles = pgTable("medical_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  name: text("name").notNull(),
  bloodGroup: text("blood_group").notNull(),
  allergies: text("allergies"),
  conditions: text("conditions"),
  emergencyContact: text("emergency_contact").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Peer-to-peer micro-rescue match between an SOS and a volunteer. */
export const matches = pgTable(
  "matches",
  {
    id: text("id").primaryKey(),
    sosId: text("sos_id").notNull(),
    volunteerId: text("volunteer_id").notNull(),
    status: text("status").notNull().default("pending"), // pending|accepted|declined|completed
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("match_volunteer_idx").on(t.volunteerId), index("match_sos_idx").on(t.sosId)]
);

/** Browser Push API subscriptions for no-per-message-cost volunteer alerts. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    volunteerId: text("volunteer_id").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_volunteer_idx").on(t.volunteerId)]
);

/** Database-backed quota guard for public, no-login API routes. */
export const apiRateLimits = pgTable("api_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SOSReport = typeof sosReports.$inferSelect;
export type Volunteer = typeof volunteers.$inferSelect;
export type MedicalProfile = typeof medicalProfiles.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
