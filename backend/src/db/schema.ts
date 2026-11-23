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
  totpSecret: text("totp_secret"), // cifrado (AES-256-GCM)
  totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
  /** Permisos a medida del equipo (área -> view|manage). null = los de su plantilla de rol. Ver lib/permissions.ts. */
  permissions: jsonb("permissions"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  /** Se dio de baja de las novedades (los avisos del servicio y de la cuenta se siguen mandando). */
  newsletterOptoutAt: timestamp("newsletter_optout_at", { withTimezone: true }),
  /** De dónde llegó al registrarse (utm_source o sitio de origen): base para saber qué canal trae leads. */
  signupSource: text("signup_source"),
  /** Código para invitar a otras personas (se genera la primera vez que lo pide). */
  referralCode: text("referral_code"),
  /** Quién lo invitó (si se registró con el link de otra persona). */
  referredBy: uuid("referred_by"),
  /** Última vez que le escribimos para retomar su página (manual o automático): evita insistir. */
  lastNudgeAt: timestamp("last_nudge_at", { withTimezone: true }),
  createdAt: ts("created_at"),
}, (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_referral_code_idx").on(t.referralCode)]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // hash del token
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  adminVerifiedAt: timestamp("admin_verified_at", { withTimezone: true }),
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
  planReminderFor: timestamp("plan_reminder_for", { withTimezone: true }), // vencimiento para el cual ya se mandó el recordatorio
  internalNote: text("internal_note"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  // Sube en cada guardado del editor: detecta ediciones simultáneas desde dos dispositivos.
  contentVersion: integer("content_version").notNull().default(0),
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
  clientId: text("client_id"), // id que le puso el editor; permite sincronizar sin perder la identidad de cada fila
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
}, (t) => [index("categories_biz_idx").on(t.businessId), uniqueIndex("categories_biz_client_idx").on(t.businessId, t.clientId)]);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  clientId: text("client_id"),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 12, scale: 2 }),
  comparePrice: numeric("compare_price", { precision: 12, scale: 2 }), // precio tachado
  available: boolean("available").notNull().default(true),
  stock: integer("stock"), // null = sin control de stock
  position: integer("position").notNull().default(0),
  isExample: boolean("is_example").notNull().default(false),
  createdAt: ts("created_at"),
}, (t) => [index("products_biz_idx").on(t.businessId), uniqueIndex("products_biz_client_idx").on(t.businessId, t.clientId)]);

export const productOptions = pgTable("product_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  clientId: text("client_id"),
  label: text("label").notNull(), // "Docena", "M / Rojo"
  axis1: text("axis1"),
  axis2: text("axis2"),
  price: numeric("price", { precision: 12, scale: 2 }),
  stock: integer("stock"),
  soldOut: boolean("sold_out").notNull().default(false),
  position: integer("position").notNull().default(0),
}, (t) => [index("product_options_biz_idx").on(t.businessId, t.productId), uniqueIndex("product_options_biz_client_idx").on(t.businessId, t.clientId)]);

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
  couponId: uuid("coupon_id"),
  couponCode: text("coupon_code"),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: ts("created_at"),
}, (t) => [uniqueIndex("orders_biz_number_idx").on(t.businessId, t.number), index("orders_biz_status_idx").on(t.businessId, t.status)]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  optionId: uuid("option_id").references(() => productOptions.id, { onDelete: "set null" }), // para reponer el stock al cancelar
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
  resolvedBy: uuid("resolved_by"),
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

// ---- Tokens de un solo uso: verificar email, restablecer contraseña, enlace mágico ----
// Solo se guarda el hash: si se filtra la base, los enlaces no sirven.
export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  type: text("type").notNull(), // verify | reset | magic
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: ts("created_at"),
}, (t) => [uniqueIndex("auth_tokens_hash_idx").on(t.tokenHash), index("auth_tokens_email_idx").on(t.email, t.type)]);

// ---- Pedidos de contacto: botón de arrepentimiento (Argentina) y consultas ----
export const contactRequests = pgTable("contact_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(), // arrepentimiento | contacto
  name: text("name").notNull(),
  email: text("email").notNull(),
  reference: text("reference"), // email de la cuenta, link de la página o número de pago
  message: text("message"),
  status: text("status").notNull().default("nuevo"), // nuevo | resuelto
  handledBy: uuid("handled_by").references(() => users.id, { onDelete: "set null" }),
  handledAt: timestamp("handled_at", { withTimezone: true }),
  internalNote: text("internal_note"),
  repliedAt: timestamp("replied_at", { withTimezone: true }),
  createdAt: ts("created_at"),
}, (t) => [index("contact_requests_status_idx").on(t.status, t.createdAt)]);

// ---- Reseñas de clientes (moderadas por el dueño: solo las aprobadas se ven en la página) ----
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(), // 1..5
  comment: text("comment"),
  status: text("status").notNull().default("pendiente"), // pendiente | aprobada | rechazada
  reply: text("reply"), // respuesta pública del negocio
  ipHash: text("ip_hash").notNull(), // hash(ip + negocio): solo para frenar repeticiones, no identifica a nadie
  createdAt: ts("created_at"),
}, (t) => [index("reviews_biz_status_idx").on(t.businessId, t.status, t.createdAt)]);

// ---- Plantillas de email editables (si no hay fila, vale el texto por defecto del código) ----
export const emailTemplates = pgTable("email_templates", {
  key: text("key").primaryKey(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: ts("updated_at"),
});

// ---- Comunicados por email a grupos de usuarios (inmediatos o programados) ----
export const emailCampaigns = pgTable("email_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  kind: text("kind").notNull().default("novedades"), // servicio (siempre llega) | novedades (con baja)
  segment: text("segment").notNull().default("todos"),
  status: text("status").notNull().default("borrador"), // borrador | programado | enviando | enviado | cancelado
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  recipients: integer("recipients").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at"),
}, (t) => [index("email_campaigns_status_idx").on(t.status, t.scheduledAt)]);

// ---- Ajustes editables desde el admin (datos para transferir, etc.) ----
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default({}),
  updatedAt: ts("updated_at"),
});

// ---- Estadísticas propias (sin cookies ni IP guardada: el visitante es un hash que cambia cada día) ----
export const siteEvents = pgTable("site_events", {
  id: serial("id").primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  type: text("type").notNull(), // visit | product_view | whatsapp_click
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
  source: text("source"), // utm_source, o el dominio de origen, o "directo"
  visitor: text("visitor").notNull(),
  createdAt: ts("created_at"),
}, (t) => [index("site_events_biz_day_idx").on(t.businessId, t.day, t.type)]);

// ---- Cupones de descuento (el descuento SIEMPRE lo calcula el servidor al crear el pedido) ----
export const coupons = pgTable("coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  code: text("code").notNull(), // siempre en mayúsculas: único por negocio sin distinguir mayúsculas
  kind: text("kind").notNull(), // percent | fixed
  value: numeric("value", { precision: 12, scale: 2 }).notNull(),
  minPurchase: numeric("min_purchase", { precision: 12, scale: 2 }).notNull().default("0"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maxUses: integer("max_uses"),
  maxUsesPerCustomer: integer("max_uses_per_customer"),
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at"),
}, (t) => [uniqueIndex("coupons_biz_code_idx").on(t.businessId, t.code)]);

export const couponRedemptions = pgTable("coupon_redemptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  couponId: uuid("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  customerKey: text("customer_key").notNull().default(""), // dígitos del teléfono
  createdAt: ts("created_at"),
}, (t) => [index("coupon_redemptions_idx").on(t.couponId, t.customerKey), uniqueIndex("coupon_redemptions_order_idx").on(t.orderId)]);

// ---- Turnos / reservas ----
export const appointmentSettings = pgTable("appointment_settings", {
  businessId: uuid("business_id").primaryKey().references(() => businesses.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  slotMinutes: integer("slot_minutes").notNull().default(30),
  minNoticeHours: integer("min_notice_hours").notNull().default(2),
  capacity: integer("capacity").notNull().default(1), // cupos por franja
  horizonDays: integer("horizon_days").notNull().default(30),
  services: jsonb("services").notNull().default([]), // [{ name, minutes|null, price|null }] (los viejos eran solo el nombre)
  staff: jsonb("staff").notNull().default([]), // [{ id, name }]: con profesionales, cada uno atiende un turno a la vez
  updatedAt: ts("updated_at"),
});

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  service: text("service"),
  price: numeric("price", { precision: 12, scale: 2 }),
  staffId: text("staff_id"),
  staffName: text("staff_name"),
  customerEmail: text("customer_email"),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  notes: text("notes"),
  status: text("status").notNull().default("pendiente"), // pendiente | confirmado | cancelado
  createdAt: ts("created_at"),
}, (t) => [index("appointments_biz_start_idx").on(t.businessId, t.startsAt)]);
