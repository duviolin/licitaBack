import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Loader2, FileText, CheckCircle2,
  XCircle, AlertTriangle, Clock, Calendar, Shield, Info,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../lib/constants';
import { PageHeader } from '../components/PageHeader';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import type {
  LicitacaoExec, LicitacaoExecStatus, DocumentoExigido,
  ConformidadeDocumento, PrazosEdital, ParticipacaoPreparada,
  ConformidadeStatus,
} from '../types';

const STATUS_CONFIG: Record<LicitacaoExecStatus, { label: string; color: string }> = {
  ANALISE: { label: 'Em Análise', color: 'bg-blue-100 text-blue-700' },
  DOCUMENTOS_OK: { label: 'Documentos OK', color: 'bg-green-100 text-green-700' },
  PENDENTE_DOC: { label: 'Pendente Doc', color: 'bg-amber-100 text-amber-700' },
  PRONTO_ENVIO: { label: 'Pronto p/ Envio', color: 'bg-teal-100 text-teal-700' },
  ENVIADO: { label: 'Enviado', color: 'bg-purple-100 text-purple-700' },
};

const CONFORMIDADE_CONFIG: Record<ConformidadeStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  OK: { label: 'OK', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  AUSENTE: { label: 'Ausente', color: 'bg-red-100 text-red-700', icon: XCircle },
  VENCIDO: { label: 'Vencido', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  INCOMPATIVEL: { label: 'Incompatível', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
};

const SECAO_LABELS: Record<string, string> = {
  HABILITACAO_GERAL: 'Habilitação Geral',
  HABILITACAO_JURIDICA: 'Habilitação Jurídica',
  REGULARIDADE_FISCAL: 'Regularidade Fiscal e Trabalhista',
  QUALIFICACAO_TECNICA: 'Qualificação Técnica',
  QUALIFICACAO_ECONOMICA: 'Qualificação Econômico-Financeira',
  OUTRO: 'Outros',
};

export function LicitacaoExecDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [exec, setExec] = useState<LicitacaoExec | null>(null);
  const [docs, setDocs] = useState<DocumentoExigido[]>([]);
  const [conformidades, setConformidades] = useState<ConformidadeDocumento[]>([]);
  const [prazos, setPrazos] = useState<PrazosEdital | null>(null);
  const [checklist, setChecklist] = useState<ParticipacaoPreparada | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [execData, docsData, confData, prazosData, checklistData] = await Promise.all([
        api.get<LicitacaoExec>(`/licitacao-exec/${id}`),
        api.get<DocumentoExigido[]>(`/licitacao-exec/${id}/documentos-exigidos`),
        api.get<ConformidadeDocumento[]>(`/licitacao-exec/${id}/conformidade`),
        api.get<PrazosEdital>(`/licitacao-exec/${id}/prazos`),
        api.get<ParticipacaoPreparada>(`/licitacao-exec/${id}/checklist`).catch(() => null),
      ]);
      setExec(execData);
      setDocs(docsData);
      setConformidades(confData);
      setPrazos(prazosData);
      setChecklist(checklistData);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao carregar análise');
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleReprocessar() {
    if (!id) return;
    try {
      setReprocessing(true);
      await api.post(`/licitacao-exec/${id}/reprocessar-docs`);
      addToast('success', 'Conformidade reprocessada com sucesso!');
      await loadData();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao reprocessar');
    } finally {
      setReprocessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 size={32} className="animate-spin text-teal-600" />
      </div>
    );
  }

  if (!exec) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Análise não encontrada.</p>
        <button onClick={() => navigate('/licitacao-exec')} className="text-teal-600 text-sm font-medium hover:underline mt-2">
          Voltar para lista
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[exec.status];
  const ck = checklist?.checklist;

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <PageHeader
        title="Análise de Edital"
        description={exec.licitacao?.orgao}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/licitacao-exec')}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft size={16} />
              Voltar
            </button>
            <button
              onClick={handleReprocessar}
              disabled={reprocessing}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {reprocessing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Reprocessar Docs
            </button>
          </div>
        }
      />

      {/* Cabeçalho da licitação */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
              {exec.licitacao?.modalidade && (
                <span className="text-xs text-slate-500">{exec.licitacao.modalidade}</span>
              )}
            </div>
            <p className="text-sm text-slate-900 font-medium leading-relaxed">
              {exec.licitacao?.objeto}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-500">
              <span>{exec.licitacao?.uf} — {exec.licitacao?.esfera}</span>
              {exec.licitacao?.pncpId && <span>PNCP: {exec.licitacao.pncpId}</span>}
              <span>Criado em {formatDate(exec.createdAt)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            {exec.portalLink && (
              <a
                href={exec.portalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 font-medium"
              >
                <ExternalLink size={12} /> Portal
              </a>
            )}
            {exec.editalUrl && (
              <a
                href={exec.editalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 font-medium"
              >
                <ExternalLink size={12} /> Edital PDF
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      {ck && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatMini label="Documentos Exigidos" value={ck.totalExigidos} color="text-slate-900" />
          <StatMini label="Documentos OK" value={ck.totalOk} color="text-green-600" />
          <StatMini label="Pendentes" value={ck.totalPendentes} color="text-amber-600" />
          <StatMini
            label="Conformidade"
            value={`${ck.percentualConformidade}%`}
            color={ck.aptoParaParticipar ? 'text-green-600' : 'text-amber-600'}
          />
        </div>
      )}

      {/* Apto / Não Apto */}
      {ck && (
        <div className={`rounded-xl border p-4 mb-6 flex items-center gap-3 ${
          ck.aptoParaParticipar
            ? 'bg-green-50 border-green-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          {ck.aptoParaParticipar ? (
            <>
              <CheckCircle2 size={24} className="text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Empresa apta para participar</p>
                <p className="text-xs text-green-600">Todos os documentos obrigatórios estão em conformidade.</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle size={24} className="text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Empresa com pendências documentais</p>
                <p className="text-xs text-amber-600">
                  {ck.totalPendentes} documento{ck.totalPendentes !== 1 ? 's' : ''} pendente{ck.totalPendentes !== 1 ? 's' : ''}.
                  Cadastre os documentos faltantes e reprocesse.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Prazos */}
      <Section title="Prazos do Edital" icon={Calendar}>
        {prazos ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <PrazoItem label="Abertura" date={prazos.dataAbertura} />
            <PrazoItem label="Sessão Pública" date={prazos.dataSessao} />
            <PrazoItem label="Impugnação" date={prazos.prazoImpugnacao} />
            <PrazoItem label="Esclarecimento" date={prazos.prazoEsclarecimento} />
            <PrazoItem label="Recurso" date={prazos.prazoRecurso} />
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nenhum prazo extraído do edital.</p>
        )}
      </Section>

      {/* Conformidade / Checklist */}
      <Section title="Checklist de Conformidade" icon={Shield}>
        {conformidades.length > 0 ? (
          <div className="space-y-2">
            {conformidades.map((c) => {
              const cfg = CONFORMIDADE_CONFIG[c.status];
              const ConfIcon = cfg.icon;
              return (
                <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                  <ConfIcon size={18} className={cfg.color.replace('bg-', 'text-').replace('100', '600').replace('text-green-700', 'text-green-600').replace('text-red-700', 'text-red-500').replace('text-amber-700', 'text-amber-500').replace('text-orange-700', 'text-orange-500')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {c.documentoExigido?.nome ?? c.documentoExigidoId.slice(0, 8)}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.color}`}>{cfg.label}</span>
                      {c.documentoExigido?.obrigatorio && (
                        <span className="text-xs text-slate-400">Obrigatório</span>
                      )}
                    </div>
                    {c.observacao && (
                      <p className="text-xs text-slate-500 mt-0.5">{c.observacao}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nenhuma conformidade avaliada.</p>
        )}
      </Section>

      {/* Documentos Exigidos */}
      <Section title="Documentos Exigidos pelo Edital" icon={FileText}>
        {docs.length > 0 ? (
          <div className="space-y-2">
            {docs.map((doc) => (
              <DocumentoExigidoCard key={doc.id} doc={doc} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nenhum documento exigido identificado.</p>
        )}
      </Section>
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className="text-teal-600" />
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function PrazoItem({ label, date }: { label: string; date: string | null }) {
  const isPast = date ? new Date(date) < new Date() : false;
  return (
    <div className={`rounded-lg border p-3 text-center ${date ? 'border-slate-200' : 'border-dashed border-slate-200'}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      {date ? (
        <p className={`text-sm font-semibold ${isPast ? 'text-red-500' : 'text-slate-900'}`}>
          {formatDate(date)}
        </p>
      ) : (
        <p className="text-sm text-slate-300">—</p>
      )}
    </div>
  );
}

function DocumentoExigidoCard({ doc }: { doc: DocumentoExigido }) {
  const [expanded, setExpanded] = useState(false);
  const secaoLabel = SECAO_LABELS[doc.secaoEdital] ?? doc.secaoEdital;

  return (
    <div className="border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition-colors">
      <div className="flex items-start gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <FileText size={16} className="text-teal-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-900">{doc.nome}</span>
            <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{secaoLabel}</span>
            {doc.obrigatorio && <span className="text-xs text-red-500 font-medium">Obrigatório</span>}
            {doc.autenticacaoExigida && <span className="text-xs text-amber-600">Autenticação exigida</span>}
            {doc.validadeDias && <span className="text-xs text-slate-400">Validade: {doc.validadeDias} dias</span>}
          </div>
        </div>
        <div className="shrink-0 text-slate-400">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>
      {expanded && doc.referenciaEdital && (
        <div className="mt-3 ml-7 bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Info size={12} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-500">Trecho do Edital</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{doc.referenciaEdital}</p>
        </div>
      )}
    </div>
  );
}
