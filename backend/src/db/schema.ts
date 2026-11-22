import {
  pgTable, serial, text, jsonb, timestamp, integer, boolean, uuid, uniqueIndex, index, numeric, date,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();

// Cola de trabajos en Postgres (sin Redis).
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  runAt: ts("run_at"),
  createdAt: ts("created_at"),
});

// ---- Usuarios y sesiones ----
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash"),
  name: text("name"),
  role: text("role").notNull().default("user"), // user | owner | admin | support
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  blockedAt: timestamp("blocked_at", { withTimezone: true }),
  totpSecret: text("totp_secret"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: ts("created_at"),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // hash del token
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: ts("created_at"),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

// ---- Negocios (el tenant) ----
export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  industry: text("industry").notNull().default("otro"),
  description: text("description").notNull().default(""),
  tagline: text("tagline"),
  whatsapp: text("whatsapp"),
  instagram: text("instagram"),
  address: text("address"),
  deliveryZone: text("delivery_zone"),
  hours: jsonb("hours").notNull().default({}),
  design: jsonb("design").notNull().default({ layout: "vidriera", theme: "blanco", fontPair: "moderna", brandColor: null }),
  settings: jsonb("settings").notNull().default({}),
  status: text("status").notNull().default("draft"), // draft | published | suspended
  planId: text("plan_id").notNull().default("gratis"),
  planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: ts("created_at"),
}, (t) => [uniqueIndex("businesses_slug_idx").on(t.slug), index("businesses_owner_idx").on(t.ownerId)]);

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("owner"),
}, (t) => [uniqueIndex("memberships_biz_user_idx").on(t.businessId, t.userId)]);

// ---- Catálogo (todo con business_id) ----
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
}, (t) => [index("categories_biz_idx").on(t.businessId)]);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 12, scale: 2 }),
  comparePrice: numeric("compare_price", { precision: 12, scale: 2 }), // precio tachado
  available: boolean("available").notNull().default(true),
  stock: integer("stock"), // null = sin control de stock
  position: integer("position").notNull().default(0),
  isExample: boolean("is_example").notNull().default(false),
  createdAt: ts("created_at"),
}, (t) => [index("products_biz_idx").on(t.businessId)]);

export const productOptions = pgTable("product_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // "Docena", "M / Rojo"
  axis1: text("axis1"),
  axis2: text("axis2"),
  price: numeric("price", { precision: 12, scale: 2 }),
  stock: integer("stock"),
  soldOut: boolean("sold_out").notNull().default(false),
  position: integer("position").notNull().default(0),
}, (t) => [index("product_options_biz_idx").on(t.businessId, t.productId)]);

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("image"), // image | video
  path: text("path").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: ts("created_at"),
}, (t) => [index("media_biz_idx").on(t.businessId)]);

// ---- Pedidos ----
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  status: text("status").notNull().default("nuevo"), // nuevo | confirmado | listo | entregado | cancelado
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  notes: text("notes"),
  eventDate: date("event_date"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  source: text("source"),
  createdAt: ts("created_at"),
}, (t) => [uniqueIndex("orders_biz_number_idx").on(t.businessId, t.number), index("orders_biz_status_idx").on(t.businessId, t.status)]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  optionLabel: text("option_label"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  quantity: integer("quantity").notNull().default(1),
}, (t) => [index("order_items_biz_order_idx").on(t.businessId, t.orderId)]);

// ---- Planes y cobro manual ----
export const plans = pgTable("plans", {
  id: text("id").primaryKey(), // gratis | emprende | pro
  name: text("name").notNull(),
  priceMonthly: numeric("price_monthly", { precision: 12, scale: 2 }).notNull().default("0"),
  limits: jsonb("limits").notNull().default({}),
  features: jsonb("features").notNull().default([]),
  active: boolean("active").notNull().default(true),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull().references(() => plans.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  createdAt: ts("created_at"),
}, (t) => [index("subscriptions_biz_idx").on(t.businessId)]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull().references(() => plans.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  months: integer("months").notNull().default(1),
  method: text("method").notNull().default("transferencia"),
  status: text("status").notNull().default("pendiente"), // pendiente | confirmado | rechazado
  receiptPath: text("receipt_path"),
  note: text("note"),
  rejectReason: text("reject_reason"),
  createdAt: ts("created_at"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (t) => [index("payments_status_idx").on(t.status)]);

// ---- Auditoría (solo se inserta) ----
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: text("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  ip: text("ip"),
  createdAt: ts("created_at"),
}, (t) => [index("audit_entity_idx").on(t.entity, t.entityId)]);

// ---- Denuncias de páginas públicas (la cola de revisión se arma en el admin, Épica 13) ----
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(), // contenido_ilegal | estafa | ofensivo | otro
  detail: text("detail"),
  status: text("status").notNull().default("nuevo"), // nuevo | revisado | accion_tomada
  createdAt: ts("created_at"),
}, (t) => [index("reports_status_idx").on(t.status, t.createdAt)]);
