import { pgTable, serial, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";

// Cola de trabajos en Postgres (sin Redis). El resto del esquema llega en la Épica 2.
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
