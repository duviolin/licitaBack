import { Router } from "express";
import multer from "multer";
import * as participacaoController from "../controllers/participacaoController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();

router.post("/", participacaoController.registrar);
router.get("/", participacaoController.listar);
router.get("/:id", participacaoController.obterDetalhe);
router.patch("/:id", participacaoController.atualizar);
router.delete("/:id", participacaoController.remover);
router.post("/:id/reprocessar", participacaoController.reprocessarDocumentos);
router.post("/:id/analisar-edital", participacaoController.analisarEditalManual);
router.post("/:id/analisar-edital-upload", upload.single("edital"), participacaoController.analisarEditalUpload);
router.post("/:id/upload-documentos", upload.array("documentos", 20), participacaoController.uploadDocumentos);
router.post("/:id/buscar-edital-robo", participacaoController.buscarEditalViaRobo);

export default router;
