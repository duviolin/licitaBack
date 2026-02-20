import { Request, Response, NextFunction } from "express";
import * as participacaoService from "../services/participacaoService.js";

export async function registrar(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { empresaId, licitacaoId, valorProposta, observacoes } = req.body;

    if (!empresaId || typeof empresaId !== "string") {
      res.status(400).json({ error: "'empresaId' é obrigatório" });
      return;
    }
    if (!licitacaoId || typeof licitacaoId !== "string") {
      res.status(400).json({ error: "'licitacaoId' é obrigatório" });
      return;
    }
    if (valorProposta !== undefined && typeof valorProposta !== "number") {
      res.status(400).json({ error: "'valorProposta' deve ser um número" });
      return;
    }

    const participacao = await participacaoService.registrar({
      empresaId,
      licitacaoId,
      valorProposta,
      observacoes: observacoes ?? "",
    });

    res.status(201).json(participacao);
  } catch (err) {
    next(err);
  }
}

export async function atualizar(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const { status, valorProposta, observacoes } = req.body;

    if (valorProposta !== undefined && typeof valorProposta !== "number") {
      res.status(400).json({ error: "'valorProposta' deve ser um número" });
      return;
    }

    const participacao = await participacaoService.atualizar(id as string, {
      status,
      valorProposta,
      observacoes,
    });

    res.json(participacao);
  } catch (err) {
    next(err);
  }
}

export async function listar(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const q = req.query;

    const participacoes = await participacaoService.listar({
      empresaId: q.empresaId ? String(q.empresaId) : undefined,
      status: q.status ? String(q.status) : undefined,
    });

    res.json(participacoes);
  } catch (err) {
    next(err);
  }
}
