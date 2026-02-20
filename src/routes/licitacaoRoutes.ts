import { Router } from "express";
import * as licitacaoController from "../controllers/licitacaoController.js";

const router = Router();

router.post("/importar", licitacaoController.importar);
router.get("/", licitacaoController.listar);
router.get("/:id", licitacaoController.obterPorId);

export default router;
