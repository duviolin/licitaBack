import * as participacaoRepo from "../repositories/participacaoRepository.js";
import * as empresaRepo from "../repositories/empresaRepository.js";
import * as licitacaoRepo from "../repositories/licitacaoRepository.js";
import { ParticipacaoStatus } from "../generated/prisma/client.js";

const STATUS_VALIDOS = new Set<string>(Object.values(ParticipacaoStatus));

export async function registrar(params: {
  empresaId: string;
  licitacaoId: string;
  valorProposta?: number;
  observacoes?: string;
}) {
  const empresa = await empresaRepo.findById(params.empresaId);
  if (!empresa) throw new Error("Empresa não encontrada");

  const licitacao = await licitacaoRepo.findById(params.licitacaoId);
  if (!licitacao) throw new Error("Licitação não encontrada");

  const existente = await participacaoRepo.findByEmpresaAndLicitacao(
    params.empresaId,
    params.licitacaoId
  );
  if (existente) throw new Error("Participação já registrada para esta empresa e licitação");

  return participacaoRepo.create({
    empresaId: params.empresaId,
    licitacaoId: params.licitacaoId,
    valorProposta: params.valorProposta ?? null,
    observacoes: params.observacoes ?? "",
  });
}

export async function atualizar(
  id: string,
  dados: {
    status?: string;
    valorProposta?: number;
    observacoes?: string;
  }
) {
  const participacao = await participacaoRepo.findById(id);
  if (!participacao) throw new Error("Participação não encontrada");

  if (dados.status && !STATUS_VALIDOS.has(dados.status)) {
    throw new Error(
      `Status inválido. Valores aceitos: ${[...STATUS_VALIDOS].join(", ")}`
    );
  }

  const updateData: Record<string, unknown> = {};
  if (dados.status !== undefined) updateData.status = dados.status;
  if (dados.valorProposta !== undefined) updateData.valorProposta = dados.valorProposta;
  if (dados.observacoes !== undefined) updateData.observacoes = dados.observacoes;

  return participacaoRepo.update(id, updateData);
}

export async function remover(id: string) {
  const participacao = await participacaoRepo.findById(id);
  if (!participacao) throw new Error("Participação não encontrada");
  await participacaoRepo.deleteById(id);
}

export async function listar(filtros: participacaoRepo.ParticipacaoFiltros) {
  return participacaoRepo.findWithFilters(filtros);
}
