import { Request, Response, NextFunction } from "express";
import * as licitacaoService from "../services/licitacaoService.js";

function defaultDates() {
  const hoje = new Date();
  const passado = new Date(hoje);
  passado.setDate(passado.getDate() - 90);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  return { dataIni: fmt(passado), dataFim: fmt(hoje) };
}

function parseImportBody(body: Record<string, unknown>) {
  const {
    dataInicial, dataFinal, uf, codigoModalidade,
    paginas, apenasPropostasAbertas, scoreMinimo, empresaId,
  } = body;

  const defaults = defaultDates();
  const dataIni = (dataInicial as string) || defaults.dataIni;
  const dataFim = (dataFinal as string) || defaults.dataFim;

  if (!/^\d{8}$/.test(dataIni) || !/^\d{8}$/.test(dataFim)) {
    return { error: "Datas devem estar no formato YYYYMMDD" };
  }

  if (scoreMinimo !== undefined) {
    const val = Number(scoreMinimo);
    if (isNaN(val) || val < 0 || val > 1) {
      return { error: "'scoreMinimo' deve ser um número entre 0 e 1" };
    }
  }

  return {
    opcoes: {
      dataInicial: dataIni,
      dataFinal: dataFim,
      uf: (uf as string) || undefined,
      codigoModalidade: codigoModalidade ? Number(codigoModalidade) : undefined,
      paginas: paginas ? Number(paginas) : undefined,
      apenasPropostasAbertas: apenasPropostasAbertas !== false,
      scoreMinimo: scoreMinimo !== undefined ? Number(scoreMinimo) : undefined,
      empresaId: (empresaId as string) || undefined,
    },
  };
}

export async function importar(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = parseImportBody(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const resultado = await licitacaoService.importarDosPncp(parsed.opcoes);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function iniciarImportacao(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = parseImportBody(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const jobId = licitacaoService.iniciarImportacao(parsed.opcoes);
    res.json({ jobId });
  } catch (err) {
    next(err);
  }
}

export async function statusImportacao(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const job = licitacaoService.obterJobStatus(req.params.jobId as string);
    if (!job) {
      res.status(404).json({ error: "Job não encontrado" });
      return;
    }
    res.json({
      status: job.status,
      progresso: job.progresso,
      resultado: job.resultado ?? null,
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelarImportacao(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const ok = licitacaoService.cancelarJob(req.params.jobId as string);
    if (!ok) {
      res.status(404).json({ error: "Job não encontrado ou já finalizado" });
      return;
    }
    res.json({ cancelado: true });
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

export async function atualizarStatusMatch(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { status } = req.body;
    const valid = ["NOVO", "FAVORITO", "DESCARTADO"];
    if (!valid.includes(status)) {
      res.status(400).json({ error: `'status' deve ser um de: ${valid.join(", ")}` });
      return;
    }
    const match = await licitacaoService.atualizarStatusMatch(
      req.params.matchId as string,
      status,
    );
    res.json(match);
  } catch (err) {
    next(err);
  }
}

export async function previewLimpeza(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const preview = await licitacaoService.previewLimpeza();
    res.json(preview);
  } catch (err) {
    next(err);
  }
}

export async function executarLimpeza(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const resultado = await licitacaoService.executarLimpeza();
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}
