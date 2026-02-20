import { Request, Response, NextFunction } from "express";
import * as empresaService from "../services/empresaService.js";

export async function cadastrarPorCnpj(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { cnpj } = req.body;

    if (!cnpj || typeof cnpj !== "string") {
      res.status(400).json({ error: "Campo 'cnpj' é obrigatório e deve ser string" });
      return;
    }

    const limpo = cnpj.replace(/[.\-/]/g, "");
    if (!/^\d{14}$/.test(limpo)) {
      res.status(400).json({ error: "CNPJ inválido — deve conter 14 dígitos numéricos" });
      return;
    }

    const empresa = await empresaService.cadastrarPorCnpj(cnpj);
    res.status(201).json(empresa);
  } catch (err) {
    next(err);
  }
}

export async function atualizarPreferencias(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const { palavrasChave, ufsInteresse, modalidadesInteresse, valorMinimo, valorMaximo } = req.body;

    if (palavrasChave !== undefined && !Array.isArray(palavrasChave)) {
      res.status(400).json({ error: "'palavrasChave' deve ser um array de strings" });
      return;
    }
    if (ufsInteresse !== undefined && !Array.isArray(ufsInteresse)) {
      res.status(400).json({ error: "'ufsInteresse' deve ser um array de strings" });
      return;
    }
    if (modalidadesInteresse !== undefined && !Array.isArray(modalidadesInteresse)) {
      res.status(400).json({ error: "'modalidadesInteresse' deve ser um array de strings" });
      return;
    }
    if (valorMinimo !== undefined && typeof valorMinimo !== "number") {
      res.status(400).json({ error: "'valorMinimo' deve ser um número" });
      return;
    }
    if (valorMaximo !== undefined && typeof valorMaximo !== "number") {
      res.status(400).json({ error: "'valorMaximo' deve ser um número" });
      return;
    }

    const empresa = await empresaService.atualizarPreferencias(id as string, {
      palavrasChave,
      ufsInteresse,
      modalidadesInteresse,
      valorMinimo,
      valorMaximo,
    });

    res.json(empresa);
  } catch (err) {
    next(err);
  }
}

export async function listarEmpresas(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const empresas = await empresaService.listarEmpresas();
    res.json(empresas);
  } catch (err) {
    next(err);
  }
}

export async function obterEmpresa(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const empresa = await empresaService.obterEmpresa(req.params.id as string);
    res.json(empresa);
  } catch (err) {
    next(err);
  }
}

export async function obterMatches(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const scoreMin = req.query.scoreMin ? Number(req.query.scoreMin) : 0;
    const apenasAbertas = req.query.apenasAbertas === "true";
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const matches = await empresaService.obterMatches(id as string, {
      scoreMin,
      apenasAbertas,
      limit,
    });

    res.json(matches);
  } catch (err) {
    next(err);
  }
}
