import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import empresaRoutes from "./routes/empresaRoutes.js";
import licitacaoRoutes from "./routes/licitacaoRoutes.js";
import participacaoRoutes from "./routes/participacaoRoutes.js";
import licitacaoExecRoutes from "./modules/licitacaoExec/routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/empresas", empresaRoutes);
app.use("/licitacoes", licitacaoRoutes);
app.use("/participacoes", participacaoRoutes);
app.use("/licitacao-exec", licitacaoExecRoutes);

const frontendDist = join(__dirname, "..", "frontend", "dist");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(join(frontendDist, "index.html"));
  });
}

app.use(errorHandler);

export default app;
