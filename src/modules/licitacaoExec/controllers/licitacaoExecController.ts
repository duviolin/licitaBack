import { Request, Response, NextFunction } from "express";
import * as licitacaoExecService from "../services/licitacaoExecService.js";

export async function iniciar(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { licitacaoId, editalUrl, portalLink, empresaId } = req.body;

    if (!licitacaoId || typeof licitacaoId !== "string") {
      res.status(400).json({ error: "'licitacaoId' é obrigatório" });
      return;
    }
    if (!editalUrl || typeof editalUrl !== "string") {
      res.status(400).json({ error: "'editalUrl' é obrigatório" });
      return;
    }
    if (!empresaId || typeof empresaId !== "string") {
      res.status(400).json({ error: "'empresaId' é obrigatório" });
      return;
    }

    const resultado = await licitacaoExecService.iniciarAnalise({
      licitacaoId,
      editalUrl,
      portalLink,
      empresaId,
    });

    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function obter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const resultado = await licitacaoExecService.obterVisaoGeral(
      req.params.id as string
    );
    res.json(resultado);
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
    const empresaId = req.query.empresaId
      ? String(req.query.empresaId)
      : undefined;
    const resultado = await licitacaoExecService.listar(empresaId);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function documentosExigidos(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const resultado = await licitacaoExecService.obterDocumentosExigidos(
      req.params.id as string
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function conformidade(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const resultado = await licitacaoExecService.obterConformidade(
      req.params.id as string
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function prazos(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const resultado = await licitacaoExecService.obterPrazos(
      req.params.id as string
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function checklist(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const resultado = await licitacaoExecService.obterChecklist(
      req.params.id as string
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function reprocessarDocs(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const resultado = await licitacaoExecService.reprocessarDocumentos(
      req.params.id as string
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}
