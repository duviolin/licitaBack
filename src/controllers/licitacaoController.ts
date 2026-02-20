import { Request, Response, NextFunction } from "express";
import * as licitacaoService from "../services/licitacaoService.js";

export async function importar(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { dataInicial, dataFinal, uf, codigoModalidade, paginas, apenasPropostasAbertas } =
      req.body;

    if (!dataInicial || !dataFinal) {
      res.status(400).json({ error: "'dataInicial' e 'dataFinal' são obrigatórios (YYYYMMDD)" });
      return;
    }

    if (!/^\d{8}$/.test(dataInicial) || !/^\d{8}$/.test(dataFinal)) {
      res.status(400).json({ error: "Datas devem estar no formato YYYYMMDD" });
      return;
    }

    const resultado = await licitacaoService.importarDosPncp({
      dataInicial,
      dataFinal,
      uf: uf || undefined,
      codigoModalidade: codigoModalidade ? Number(codigoModalidade) : undefined,
      paginas: paginas ? Number(paginas) : undefined,
      apenasPropostasAbertas: apenasPropostasAbertas === true,
    });

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
    const q = req.query;

    const resultado = await licitacaoService.listarLicitacoes({
      empresaId: q.empresaId ? String(q.empresaId) : undefined,
      scoreMin: q.scoreMin ? Number(q.scoreMin) : undefined,
      modalidade: q.modalidade ? String(q.modalidade) : undefined,
      uf: q.uf ? String(q.uf) : undefined,
      esfera: q.esfera ? String(q.esfera) : undefined,
      situacao: q.situacao ? String(q.situacao) : undefined,
      valorMin: q.valorMin ? Number(q.valorMin) : undefined,
      valorMax: q.valorMax ? Number(q.valorMax) : undefined,
      apenasAbertas: q.apenasAbertas === "true",
      dataMinima: q.dataMinima ? String(q.dataMinima) : undefined,
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 20,
    });

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function obterPorId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const licitacao = await licitacaoService.obterLicitacao(req.params.id as string);
    res.json(licitacao);
  } catch (err) {
    next(err);
  }
}
