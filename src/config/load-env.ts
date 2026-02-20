import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "../..");

const isHostedEnvironment =
  process.env.DATABASE_URL &&
  (process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL || process.env.HEROKU);

if (isHostedEnvironment) {
  if (process.env.NODE_ENV === "development") {
    console.log("✅ Usando variáveis de ambiente do sistema (ambiente de hospedagem)");
  }
} else {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase() || "development";

  const envMap: Record<string, string> = {
    "dev": "development",
    "development": "development",
    "prod": "production",
    "production": "production",
  };

  const envName = envMap[nodeEnv] || "development";
  const envFile = `.env.${envName}`;
  const envPath = resolve(rootDir, envFile);
  const envFileName = envPath.split(/[/\\]/).pop() || ".env";

  const result = config({ path: envPath });

  if (result.error) {
    const fallbackPath = resolve(rootDir, ".env");
    const fallbackResult = config({ path: fallbackPath });

    if (fallbackResult.error) {
      console.warn(`⚠️  Arquivo de ambiente não encontrado: ${envFileName}`);
      console.warn(`⚠️  Certifique-se de que as variáveis estão configuradas no sistema`);
    } else {
      console.log(`ℹ️  Usando arquivo .env (fallback)`);
    }
  } else {
    console.log(`✅ Carregando variáveis de: ${envFileName}`);
  }
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}

export {};
