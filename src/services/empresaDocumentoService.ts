import * as empresaDocRepo from "../modules/licitacaoExec/repositories/empresaDocumentoRepository.js";
import * as empresaRepo from "../repositories/empresaRepository.js";
import { DocumentoTipo, DocumentoStatus } from "../generated/prisma/client.js";

const TIPOS_VALIDOS = new Set<string>(Object.values(DocumentoTipo));
const STATUS_VALIDOS = new Set<string>(Object.values(DocumentoStatus));

export async function listar(empresaId: string) {
  const empresa = await empresaRepo.findById(empresaId);
  if (!empresa) throw new Error("Empresa não encontrada");
  return empresaDocRepo.findByEmpresaId(empresaId);
}

export async function criar(empresaId: string, dados: {
  tipo: string;
  nome: string;
  arquivoUrl?: string;
  validade?: string;
  emissor?: string;
}) {
  const empresa = await empresaRepo.findById(empresaId);
  if (!empresa) throw new Error("Empresa não encontrada");

  if (!dados.tipo || !TIPOS_VALIDOS.has(dados.tipo)) {
    throw new Error(`Tipo inválido. Valores aceitos: ${[...TIPOS_VALIDOS].join(", ")}`);
  }
  if (!dados.nome || typeof dados.nome !== "string") {
    throw new Error("'nome' é obrigatório");
  }

  let validadeDate: Date | null = null;
  if (dados.validade) {
    validadeDate = new Date(dados.validade);
    if (isNaN(validadeDate.getTime())) throw new Error("'validade' deve ser uma data válida");
  }

  const status = validadeDate && validadeDate < new Date() ? "VENCIDO" : "VALIDO";

  return empresaDocRepo.create({
    empresaId,
    tipo: dados.tipo as DocumentoTipo,
    nome: dados.nome,
    arquivoUrl: dados.arquivoUrl ?? "",
    validade: validadeDate,
    emissor: dados.emissor ?? "",
    status: status as DocumentoStatus,
  });
}

export async function atualizar(id: string, dados: {
  nome?: string;
  arquivoUrl?: string;
  validade?: string | null;
  emissor?: string;
  status?: string;
}) {
  const doc = await empresaDocRepo.findById(id);
  if (!doc) throw new Error("Documento não encontrado");

  const updateData: Record<string, unknown> = {};

  if (dados.nome !== undefined) updateData.nome = dados.nome;
  if (dados.arquivoUrl !== undefined) updateData.arquivoUrl = dados.arquivoUrl;
  if (dados.emissor !== undefined) updateData.emissor = dados.emissor;

  if (dados.validade !== undefined) {
    if (dados.validade === null) {
      updateData.validade = null;
    } else {
      const d = new Date(dados.validade);
      if (isNaN(d.getTime())) throw new Error("'validade' deve ser uma data válida");
      updateData.validade = d;
      if (d < new Date()) updateData.status = "VENCIDO";
    }
  }

  if (dados.status !== undefined) {
    if (!STATUS_VALIDOS.has(dados.status)) {
      throw new Error(`Status inválido. Valores aceitos: ${[...STATUS_VALIDOS].join(", ")}`);
    }
    updateData.status = dados.status;
  }

  return empresaDocRepo.update(id, updateData);
}

export async function remover(id: string) {
  const doc = await empresaDocRepo.findById(id);
  if (!doc) throw new Error("Documento não encontrado");
  await empresaDocRepo.deleteById(id);
}
