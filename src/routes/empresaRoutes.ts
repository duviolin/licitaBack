import { Router } from "express";
import * as empresaController from "../controllers/empresaController.js";

const router = Router();

router.post("/cnpj", empresaController.cadastrarPorCnpj);
router.patch("/:id/preferencias", empresaController.atualizarPreferencias);
router.get("/", empresaController.listarEmpresas);
router.get("/:id", empresaController.obterEmpresa);
router.get("/:id/matches", empresaController.obterMatches);

export default router;
