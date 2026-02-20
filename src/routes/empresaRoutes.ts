import { Router } from "express";
import * as empresaController from "../controllers/empresaController.js";

const router = Router();

router.post("/cnpj", empresaController.cadastrarPorCnpj);
router.patch("/:id/preferencias", empresaController.atualizarPreferencias);
router.get("/", empresaController.listarEmpresas);
router.get("/:id", empresaController.obterEmpresa);
router.get("/:id/matches", empresaController.obterMatches);
router.get("/:id/documentos", empresaController.listarDocumentos);
router.post("/:id/documentos", empresaController.criarDocumento);
router.patch("/:id/documentos/:docId", empresaController.atualizarDocumento);
router.delete("/:id/documentos/:docId", empresaController.removerDocumento);

export default router;
