import { config } from "dotenv";
import { resolve } from "path";
import { defineConfig } from "prisma/config";

const nodeEnv = process.env.NODE_ENV?.toLowerCase() || "development";

const envMap: Record<string, string> = {
  "dev": "development",
  "development": "development",
  "prod": "production",
  "production": "production",
};

const envName = envMap[nodeEnv] || "development";
const envFile = `.env.${envName}`;
const envPath = resolve(process.cwd(), envFile);

const result = config({ path: envPath });

if (result.error) {
  const fallbackPath = resolve(process.cwd(), ".env");
  config({ path: fallbackPath });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
