import { Router } from "express";
import * as controller from "../controllers/licitacaoExecController.js";

const router = Router();

router.post("/iniciar", controller.iniciar);
router.get("/", controller.listar);
router.get("/:id", controller.obter);
router.get("/:id/documentos-exigidos", controller.documentosExigidos);
router.get("/:id/conformidade", controller.conformidade);
router.get("/:id/prazos", controller.prazos);
router.get("/:id/checklist", controller.checklist);
router.post("/:id/reprocessar-docs", controller.reprocessarDocs);

export default router;
