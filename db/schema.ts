import {
  bigserial,
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const products = pgTable("productos", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull(),
  type: text("type").notNull(),
  setName: text("set_name").notNull().default(""),
  code: text("code").notNull().unique(),
  priceCents: integer("price_cents").notNull(),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(3),
  targetStock: integer("target_stock").notNull().default(10),
  condition: text("condition").notNull().default(""),
  badge: text("badge"),
  barcodes: text("barcodes").array().notNull().default([]),
  art: text("art").notNull().default("📦"),
  imageUrl: text("image_url"),
  offerActive: boolean("offer_active").notNull().default(false),
  offerPercent: integer("offer_percent"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .unique()
    .references(() => products.id, { onDelete: "cascade" }),
  mime: text("mime").notNull().default("image/jpeg"),
  data: text("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sales = pgTable("sales", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  token: text("token").notNull().unique(),
  channel: text("channel").notNull(),
  payment: text("payment").notNull(),
  customerId: text("customer_id"),
  customerProfile: jsonb("customer_profile"),
  delivery: text("delivery"),
  subtotalCents: integer("subtotal_cents").notNull(),
  shippingCents: integer("shipping_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  receivedCents: integer("received_cents"),
  changeCents: integer("change_cents"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const salesLines = pgTable("sales_lines", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  qty: integer("qty").notNull(),
  unitCents: integer("unit_cents").notNull(),
});

export const moves = pgTable("moves", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  kind: text("kind").notNull(),
  productName: text("product_name").notNull(),
  qty: integer("qty").notNull(),
  productId: integer("product_id"),
  token: text("token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryMeta = pgTable("inventory_meta", {
  id: integer("id").primaryKey(),
  nextProductId: integer("next_product_id").notNull().default(1),
});

export const mutationResults = pgTable("mutation_results", {
  id: text("id").primaryKey(),
  result: jsonb("result").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  username: text("username").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  avatar: text("avatar"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const carts = pgTable("carts", {
  session: text("session").primaryKey(),
  owner: text("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    cart: text("cart")
      .notNull()
      .references(() => carts.session, { onDelete: "cascade" }),
    productId: integer("product_id").notNull(),
    qty: integer("qty").notNull(),
  },
  (tabla) => [unique("cart_items_cart_product").on(tabla.cart, tabla.productId)],
);

export const favorites = pgTable(
  "favorites",
  {
    username: text("username").notNull(),
    productId: integer("product_id").notNull(),
  },
  (tabla) => [unique("favorites_user_product").on(tabla.username, tabla.productId)],
);

export const orders = pgTable("orders", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  token: text("token").notNull().unique(),
  code: text("code").notNull().unique(),
  channel: text("channel").notNull(),
  status: text("status").notNull(),
  payment: text("payment").notNull(),
  customer: text("customer"),
  session: text("session"),
  delivery: text("delivery").notNull(),
  address: text("address"),
  lines: jsonb("lines").notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
  shippingCents: integer("shipping_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const encargos = pgTable("encargos", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  product: text("product").notNull(),
  universe: text("universe"),
  quantity: integer("quantity").notNull().default(1),
  productType: text("product_type"),
  setName: text("set_name"),
  condition: text("condition"),
  budgetCents: integer("budget_cents"),
  priceCents: integer("price_cents"),
  url: text("url"),
  notes: text("notes"),
  customer: text("customer"),
  email: text("email"),
  phone: text("phone"),
  customerProfile: jsonb("customer_profile"),
  photos: jsonb("photos"),
  status: text("status").notNull().default("Pendiente"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
