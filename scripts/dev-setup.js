#!/usr/bin/env node
import { execSync } from "child_process";
import { config } from "dotenv";
import { resolve } from "path";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const nodeEnv = process.env.NODE_ENV?.toLowerCase() || "development";
const envMap = {
  dev: "development",
  development: "development",
  prod: "production",
  production: "production",
};

const envName = envMap[nodeEnv] || "development";
const envFile = `.env.${envName}`;
const envPath = resolve(process.cwd(), envFile);
config({ path: envPath });

(async () => {
  console.log("🚀 Iniciando setup de desenvolvimento...\n");

  console.log("📦 Gerando Prisma Client...");
  try {
    execSync("npx prisma generate", { stdio: "inherit" });
    console.log("✅ Prisma Client gerado com sucesso!\n");
  } catch (error) {
    console.error("❌ Erro ao gerar Prisma Client:", error.message);
    process.exit(1);
  }

  console.log("🔄 Aplicando schema no banco (db push)...");
  let pushSuccess = false;
  const maxRetries = 3;
  const retryDelay = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      execSync("npx prisma db push", {
        stdio: "inherit",
        env: { ...process.env, NODE_ENV: "development" },
      });
      pushSuccess = true;
      console.log("✅ Schema aplicado com sucesso!\n");
      break;
    } catch (error) {
      if (attempt < maxRetries) {
        console.log(
          `⚠️  Tentativa ${attempt}/${maxRetries} falhou. Aguardando ${retryDelay}ms...`
        );
        await sleep(retryDelay);
      } else {
        console.warn(
          "⚠️  Não foi possível aplicar schema após",
          maxRetries,
          "tentativas."
        );
        console.warn(
          "⚠️  O servidor iniciará mesmo assim. Verifique a conexão com o banco.\n"
        );
      }
    }
  }

  console.log("✅ Setup concluído! Iniciando servidor...\n");
})();
