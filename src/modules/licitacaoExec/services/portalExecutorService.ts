import type { PortalCredenciais, PortalEnvioResult } from "../types/index.js";

/**
 * Stub para futura integração com RPA de portais (BLL/BNC/ComprasNet).
 * Nenhuma automação real é executada nesta versão.
 */

export async function loginPortal(
  _credenciais: PortalCredenciais
): Promise<{ sucesso: boolean; mensagem: string }> {
  console.log("[PortalExecutor] STUB: loginPortal chamado");
  return {
    sucesso: false,
    mensagem: "Funcionalidade de login no portal ainda não implementada (stub)",
  };
}

export async function abrirLicitacao(
  _portalLink: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  console.log("[PortalExecutor] STUB: abrirLicitacao chamado");
  return {
    sucesso: false,
    mensagem:
      "Funcionalidade de abrir licitação no portal ainda não implementada (stub)",
  };
}

export async function anexarDocumentos(
  _portalLink: string,
  _documentos: { nome: string; arquivoUrl: string }[]
): Promise<{ sucesso: boolean; mensagem: string }> {
  console.log("[PortalExecutor] STUB: anexarDocumentos chamado");
  return {
    sucesso: false,
    mensagem:
      "Funcionalidade de anexar documentos ainda não implementada (stub)",
  };
}

export async function enviarProposta(
  _portalLink: string,
  _valorProposta: number
): Promise<PortalEnvioResult> {
  console.log("[PortalExecutor] STUB: enviarProposta chamado");
  return {
    sucesso: false,
    mensagem:
      "Funcionalidade de envio de proposta ainda não implementada (stub)",
  };
}
