import { Router } from "express";
import * as participacaoController from "../controllers/participacaoController.js";

const router = Router();

router.post("/", participacaoController.registrar);
router.get("/", participacaoController.listar);
router.get("/:id", participacaoController.obterDetalhe);
router.patch("/:id", participacaoController.atualizar);
router.delete("/:id", participacaoController.remover);
router.post("/:id/reprocessar", participacaoController.reprocessarDocumentos);

export default router;
