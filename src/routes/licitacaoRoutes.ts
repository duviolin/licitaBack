import { Router } from "express";
import * as licitacaoController from "../controllers/licitacaoController.js";

const router = Router();

router.post("/importar", licitacaoController.importar);
router.post("/importar/iniciar", licitacaoController.iniciarImportacao);
router.get("/importar/status/:jobId", licitacaoController.statusImportacao);
router.post("/importar/cancelar/:jobId", licitacaoController.cancelarImportacao);
router.patch("/matches/:matchId/status", licitacaoController.atualizarStatusMatch);
router.get("/limpeza/preview", licitacaoController.previewLimpeza);
router.post("/limpeza/executar", licitacaoController.executarLimpeza);
router.get("/", licitacaoController.listar);
router.get("/:id", licitacaoController.obterPorId);

export default router;
