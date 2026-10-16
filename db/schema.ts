import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const inventoryRecords = pgTable("inventory_records", {
  key: text("key").primaryKey(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
});

export const inventoryRevision = pgTable("inventory_revision", {
  id: integer("id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  mutation: text("mutation").notNull().default(""),
  nextId: integer("next_id").notNull().default(1),
});
