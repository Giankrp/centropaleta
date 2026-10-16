import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle/pg",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://centropaleta:centropaleta@localhost:5433/centropaleta",
  },
});
