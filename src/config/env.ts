type Environment = "development" | "production";

function getEnv(): Environment {
  const env = process.env.NODE_ENV?.toLowerCase();
  if (env === "production" || env === "prod") return "production";
  return "development";
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Variável de ambiente obrigatória não encontrada: ${key}`);
  }
  return value;
}

function getEnvOptional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const env = {
  NODE_ENV: getEnv(),
  PORT: Number(getEnvOptional("PORT", "3000")),
  DATABASE_URL: requireEnv("DATABASE_URL"),
  PNCP_BASE_URL: getEnvOptional("PNCP_BASE_URL", "https://pncp.gov.br/api/consulta/v1"),
  BRASILAPI_BASE_URL: getEnvOptional("BRASILAPI_BASE_URL", "https://brasilapi.com.br/api"),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",

  isDevelopment: () => env.NODE_ENV === "development",
  isProduction: () => env.NODE_ENV === "production",
  hasOpenAI: () => !!env.OPENAI_API_KEY,
};

export default env;
