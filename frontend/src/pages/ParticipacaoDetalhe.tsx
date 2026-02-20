import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2,
  Calendar, FileText, RefreshCw, Trash2, XCircle,
  ExternalLink, Clock, Shield, Handshake, ChevronDown, ChevronUp,
  Link2, Send, Upload, Bot, Sparkles, BookOpen, Gavel, DollarSign, Scale,
  FolderOpen, Download, AlertTriangle, ShieldAlert, ThumbsUp, ThumbsDown,
  ClipboardList, Copy,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatCurrency } from '../lib/constants';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import type {
  Participacao, ParticipacaoStatus, ConformidadeStatus,
  DocumentoExigido, ConformidadeDocumento, PrazosEdital, ResumoEdital,
  DocumentoProcesso, TipoDocumentoProcesso, AnaliseRisco,
} from '../types';

interface RoboLogEntry {
  etapa: string;
  mensagem: string;
  tipo: 'info' | 'sucesso' | 'erro' | 'detalhe' | 'resultado';
  ts: number;
}

const STATUS_CFG: Record<ParticipacaoStatus, { label: string; color: string; bg: string }> = {
  ANALISANDO: { label: 'Analisando Edital', color: 'text-blue-700', bg: 'bg-blue-100' },
  PENDENTE_DOC: { label: 'Pendente de Documentos', color: 'text-amber-700', bg: 'bg-amber-100' },
  APTA: { label: 'Apta para Participar', color: 'text-green-700', bg: 'bg-green-100' },
  ENVIADA: { label: 'Proposta Enviada', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  EM_DISPUTA: { label: 'Em Disputa', color: 'text-purple-700', bg: 'bg-purple-100' },
  GANHA: { label: 'Ganha!', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  PERDIDA: { label: 'Perdida', color: 'text-red-700', bg: 'bg-red-100' },
};

const CONFORMIDADE_CFG: Record<ConformidadeStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  OK: { label: 'OK', color: 'text-green-600', icon: CheckCircle2 },
  AUSENTE: { label: 'Ausente', color: 'text-red-500', icon: XCircle },
  VENCIDO: { label: 'Vencido', color: 'text-amber-600', icon: AlertCircle },
  INCOMPATIVEL: { label: 'Incompatível', color: 'text-orange-500', icon: AlertCircle },
};

const STATUS_ORDER: ParticipacaoStatus[] = ['ANALISANDO', 'PENDENTE_DOC', 'APTA', 'ENVIADA', 'EM_DISPUTA', 'GANHA', 'PERDIDA'];

export function ParticipacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [participacao, setParticipacao] = useState<Participacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessando, setReprocessando] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  const [docsExpanded, setDocsExpanded] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [roboLog, setRoboLog] = useState<RoboLogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const roboAutoIniciado = useRef(false);

  useEffect(() => {
    if (id) loadDetalhe(id);
  }, [id]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roboLog]);

  useEffect(() => {
    if (
      participacao
      && !participacao.editalTexto
      && participacao.documentosExigidos?.length === 0
      && (participacao.portalLink || participacao.licitacao?.linkPortal)
      && !analisando
      && !roboAutoIniciado.current
    ) {
      roboAutoIniciado.current = true;
      handleBuscarViaRobo();
    }
  }, [participacao]);

  async function loadDetalhe(pid: string) {
    try {
      setLoading(true);
      const data = await api.get<Participacao>(`/participacoes/${pid}`);
      setParticipacao(data);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  async function handleReprocessar() {
    if (!id) return;
    try {
      setReprocessando(true);
      const data = await api.post<Participacao>(`/participacoes/${id}/reprocessar`);
      setParticipacao(data);
      addToast('success', 'Documentos reavaliados!');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao reprocessar');
    } finally {
      setReprocessando(false);
    }
  }

  async function handleBuscarViaRobo() {
    if (!id) return;
    setAnalisando(true);
    setRoboLog([{ etapa: 'inicio', mensagem: 'Iniciando robô...', tipo: 'info', ts: Date.now() }]);

    try {
      const response = await fetch(`/api/participacoes/${id}/buscar-edital-robo`, { method: 'POST' });

      if (!response.body) {
        throw new Error('Navegador não suporta streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evento = JSON.parse(line.slice(6));
            if (evento.tipo === 'resultado' && evento.dados) {
              setParticipacao(evento.dados as Participacao);
              addToast('success', 'Robô encontrou e analisou o edital!');
            } else {
              setRoboLog((prev) => [...prev, { ...evento, ts: Date.now() }]);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setRoboLog((prev) => [...prev, { etapa: 'erro', mensagem: msg, tipo: 'erro', ts: Date.now() }]);
      addToast('error', msg);
    } finally {
      setAnalisando(false);
    }
  }

  async function handleRemove() {
    if (!id) return;
    try {
      await api.delete(`/participacoes/${id}`);
      addToast('success', 'Participação removida');
      navigate('/participacoes');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao remover');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-purple-600" />
      </div>
    );
  }

  if (!participacao) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
        <AlertCircle size={20} />
        <span>Participação não encontrada</span>
      </div>
    );
  }

  const p = participacao;
  const statusCfg = STATUS_CFG[p.status];
  const prazos = p.prazos;
  const conformidades = p.conformidades ?? [];
  const docsExigidos = p.documentosExigidos ?? [];
  const checklist = p.checklist;

  const confOk = conformidades.filter((c) => c.status === 'OK').length;
  const confTotal = conformidades.length;

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <button
        onClick={() => navigate('/participacoes')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        Voltar para Participações
      </button>

      <PageHeader
        title={p.licitacao?.objeto ?? 'Participação'}
        description={`${p.empresa?.nomeFantasia || p.empresa?.razaoSocial || ''} • ${p.licitacao?.orgao || ''}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Editar
            </button>
            {docsExigidos.length > 0 && (
              <button
                onClick={handleReprocessar}
                disabled={reprocessando}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {reprocessando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Reavaliar Docs
              </button>
            )}
          </div>
        }
      />

      {/* Status banner */}
      <div className={`rounded-xl p-4 mb-4 flex items-center justify-between ${statusCfg.bg}`}>
        <div className="flex items-center gap-3">
          {p.status === 'APTA' || p.status === 'GANHA' ? (
            <CheckCircle2 size={24} className="text-green-600" />
          ) : p.status === 'PENDENTE_DOC' ? (
            <AlertCircle size={24} className="text-amber-600" />
          ) : p.status === 'PERDIDA' ? (
            <XCircle size={24} className="text-red-500" />
          ) : (
            <Handshake size={24} className={statusCfg.color} />
          )}
          <div>
            <p className={`font-bold text-lg ${statusCfg.color}`}>{statusCfg.label}</p>
            {checklist && (
              <p className="text-sm opacity-75">
                {checklist.totalOk}/{checklist.totalExigidos} documentos OK — {checklist.percentualConformidade}% conformidade
              </p>
            )}
          </div>
        </div>
        {p.percentualConformidade > 0 && (
          <div className="text-right">
            <p className={`text-3xl font-bold ${statusCfg.color}`}>{p.percentualConformidade}%</p>
            <p className="text-xs opacity-60">conformidade</p>
          </div>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <InfoCard label="Valor Estimado" value={formatCurrency(p.licitacao?.valorEstimado)} />
        <InfoCard label="Valor Proposta" value={p.valorProposta ? formatCurrency(p.valorProposta) : '—'} />
        <InfoCard label="Modalidade" value={p.licitacao?.modalidade ?? '—'} />
        <InfoCard label="Registrada em" value={formatDate(p.createdAt)} />
      </div>

      {/* Links */}
      {(p.editalUrl || p.portalLink || p.licitacao?.linkPortal) && (
        <div className="flex gap-3 mb-4">
          {p.editalUrl && (
            <a href={p.editalUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium bg-white px-3 py-2 rounded-lg border border-slate-200">
              <FileText size={14} /> Ver Edital PDF
            </a>
          )}
          {(p.portalLink || p.licitacao?.linkPortal) && (
            <a href={p.portalLink || p.licitacao?.linkPortal} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium bg-white px-3 py-2 rounded-lg border border-slate-200">
              <ExternalLink size={14} /> Portal da Licitação
            </a>
          )}
        </div>
      )}

      {/* Badge IA */}
      {p.usouLLM && (
        <div className="flex items-center gap-1.5 mb-4">
          <Sparkles size={14} className="text-purple-500" />
          <span className="text-xs text-purple-600 font-medium">
            Análise realizada com inteligência artificial
          </span>
        </div>
      )}

      {/* 1. Resumo Executivo — o que é esta licitação */}
      {p.resumoEdital && (
        <ResumoEditalCard resumo={p.resumoEdital} />
      )}

      {/* 2. Prazos — quando vencem as datas críticas */}
      {prazos && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-900">Prazos</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <PrazoItem label="Abertura" value={prazos.dataAbertura} />
            <PrazoItem label="Sessão" value={prazos.dataSessao} />
            <PrazoItem label="Impugnação" value={prazos.prazoImpugnacao} />
            <PrazoItem label="Esclarecimento" value={prazos.prazoEsclarecimento} />
            <PrazoItem label="Recurso" value={prazos.prazoRecurso} />
          </div>
        </div>
      )}

      {/* 3. Risco + Recomendação — devemos participar? */}
      {(p.analiseRisco || p.scoreRecomendacao !== null) && (
        <RiscoRecomendacaoCard
          analiseRisco={p.analiseRisco}
          scoreRecomendacao={p.scoreRecomendacao}
        />
      )}

      {/* 4. Conformidade — a empresa tem os docs necessários? */}
      {conformidades.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-teal-600" />
            <h2 className="font-semibold text-slate-900">Conformidade Documental</h2>
            <span className="text-xs text-slate-400 ml-auto">{confOk}/{confTotal} OK</span>
          </div>
          <div className="space-y-2">
            {conformidades.map((c) => {
              const cfg = CONFORMIDADE_CFG[c.status];
              const Icon = cfg.icon;
              const isSemanticMatch = c.observacao?.includes('Match semântico');
              return (
                <div key={c.id} className={`p-3 rounded-lg border ${
                  c.sugestao ? 'border-l-4' : ''
                } ${
                  c.status === 'OK' ? 'border-slate-100' :
                  c.status === 'VENCIDO' ? 'border-amber-200' :
                  c.status === 'AUSENTE' ? 'border-red-200' :
                  'border-orange-200'
                } hover:bg-slate-50`}>
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={cfg.color} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900">
                          {c.documentoExigido?.nome ?? c.documentoExigidoId.slice(0, 8)}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          c.status === 'OK' ? 'bg-green-100 text-green-700' :
                          c.status === 'VENCIDO' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>{cfg.label}</span>
                        {isSemanticMatch && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                            Match IA
                          </span>
                        )}
                      </div>
                      {c.observacao && (
                        <p className="text-xs text-slate-500 mt-0.5">{c.observacao}</p>
                      )}
                      {c.empresaDocumento && (
                        <p className="text-xs text-teal-600 mt-0.5">
                          Vinculado: {c.empresaDocumento.nome}
                          {c.empresaDocumento.validade && ` • Validade: ${formatDate(c.empresaDocumento.validade)}`}
                        </p>
                      )}
                    </div>
                    <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 shrink-0">
                      {c.documentoExigido?.tipo}
                    </span>
                  </div>
                  {c.sugestao && (
                    <div className="mt-2 ml-8 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                      <Sparkles size={14} className="text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-blue-700">Sugestão</p>
                        <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">{c.sugestao}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Documentos Exigidos pelo Edital (expandível) */}
      {docsExigidos.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
          <button
            onClick={() => setDocsExpanded(!docsExpanded)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-slate-600" />
              <h2 className="font-semibold text-slate-900">
                Documentos Exigidos pelo Edital ({docsExigidos.length})
              </h2>
            </div>
            {docsExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>
          {docsExpanded && (
            <div className="px-5 pb-5 space-y-2 border-t border-slate-100 pt-4">
              {docsExigidos.map((doc) => (
                <DocExigidoRow key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Proposta — rascunho automático */}
      {p.rascunhoProposta && (
        <PropostaCard rascunho={p.rascunhoProposta} />
      )}

      {/* 7. Documentos do Processo — arquivos encontrados (referência) */}
      <DocumentosProcessoSection
        documentos={p.documentosProcesso ?? []}
        participacaoId={p.id}
        onUploadSuccess={(data) => { setParticipacao(data); addToast('success', 'Documentos adicionados e analisados!'); }}
        onUploadError={(msg) => addToast('error', msg)}
      />

      {/* Painel de análise documental */}
      {docsExigidos.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800">Análise documental pendente</p>
              <p className="text-sm text-amber-700 mt-0.5">
                O robô navega até o portal, encontra todos os documentos do processo, baixa, classifica e analisa cada um automaticamente.
              </p>
            </div>
          </div>

          {/* Log do robô */}
          {roboLog.length > 0 && (
            <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden mb-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-xs text-slate-400 font-mono ml-2">robô — análise documental</span>
                {analisando && <Loader2 size={12} className="animate-spin text-purple-400 ml-auto" />}
              </div>
              <div className="p-3 max-h-96 overflow-y-auto font-mono text-xs space-y-0.5">
                {roboLog.map((entry, i) => (
                  <RoboLogLine key={i} entry={entry} />
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* Botão do robô */}
          <button
            onClick={handleBuscarViaRobo}
            disabled={analisando || (!p.portalLink && !p.licitacao?.linkPortal)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 mb-3"
          >
            {analisando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Robô trabalhando...
              </>
            ) : roboLog.length > 0 ? (
              <>
                <RefreshCw size={16} />
                Tentar Novamente
              </>
            ) : (
              <>
                <Bot size={16} />
                Iniciar Análise Automática
              </>
            )}
          </button>

          {!p.portalLink && !p.licitacao?.linkPortal && (
            <p className="text-xs text-red-600 text-center mb-3">
              Sem link do portal disponível. Envie os documentos manualmente abaixo.
            </p>
          )}

          {/* Upload manual de documentos */}
          <div className="border-t border-amber-200 pt-3">
            <p className="text-xs font-medium text-amber-800 mb-2">
              Ou envie documentos manualmente (edital, anexos, retificações, etc.)
            </p>
            <UploadMultiplosDocs
              participacaoId={p.id}
              analisando={analisando}
              onSuccess={(data) => { setParticipacao(data); addToast('success', 'Documentos enviados e analisados!'); }}
              onError={(msg) => addToast('error', msg)}
            />
          </div>
        </div>
      )}

      {/* Remove */}
      <div className="flex justify-end mt-4">
        <button
          onClick={() => setShowRemove(true)}
          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
        >
          <Trash2 size={13} /> Remover participação
        </button>
      </div>

      {/* Modal Editar */}
      {showEdit && (
        <EditModal
          participacao={p}
          onClose={() => setShowEdit(false)}
          onSuccess={(updated) => {
            setParticipacao(updated as Participacao);
            setShowEdit(false);
            addToast('success', 'Atualizada!');
          }}
          onError={(msg) => addToast('error', msg)}
        />
      )}

      {/* Modal Confirmar remoção */}
      <Modal open={showRemove} onClose={() => setShowRemove(false)} title="Remover Participação" size="sm">
        <p className="text-sm text-slate-600 mb-4">Tem certeza? Todos os dados de análise serão perdidos.</p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowRemove(false)}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleRemove}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            Sim, remover
          </button>
        </div>
      </Modal>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}

function PrazoItem({ label, value }: { label: string; value: string | null }) {
  const isPassado = value ? new Date(value) < new Date() : false;
  return (
    <div className="text-center">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {value ? (
        <div className="flex items-center justify-center gap-1">
          <Clock size={12} className={isPassado ? 'text-red-400' : 'text-blue-400'} />
          <p className={`text-sm font-medium ${isPassado ? 'text-red-600 line-through' : 'text-slate-800'}`}>
            {formatDate(value)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-300">—</p>
      )}
    </div>
  );
}

const TIPO_DOC_PROCESSO: Record<TipoDocumentoProcesso, { label: string; color: string; bg: string }> = {
  EDITAL: { label: 'Edital', color: 'text-blue-700', bg: 'bg-blue-100' },
  RETIFICACAO: { label: 'Retificação', color: 'text-red-700', bg: 'bg-red-100' },
  ESCLARECIMENTO: { label: 'Esclarecimento', color: 'text-amber-700', bg: 'bg-amber-100' },
  IMPUGNACAO: { label: 'Impugnação', color: 'text-orange-700', bg: 'bg-orange-100' },
  TERMO_REFERENCIA: { label: 'Termo de Referência', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  ORCAMENTO: { label: 'Orçamento', color: 'text-green-700', bg: 'bg-green-100' },
  ATA: { label: 'Ata', color: 'text-slate-700', bg: 'bg-slate-100' },
  RECURSO: { label: 'Recurso', color: 'text-purple-700', bg: 'bg-purple-100' },
  RESULTADO: { label: 'Resultado', color: 'text-teal-700', bg: 'bg-teal-100' },
  CONTRATO: { label: 'Contrato', color: 'text-cyan-700', bg: 'bg-cyan-100' },
  OUTRO: { label: 'Outro', color: 'text-slate-600', bg: 'bg-slate-100' },
};

const RELEVANCIA_STYLES: Record<string, string> = {
  critica: 'border-l-red-500 bg-red-50/50',
  alta: 'border-l-amber-400 bg-amber-50/30',
  normal: 'border-l-slate-200',
  baixa: 'border-l-slate-100',
};

function DocumentosProcessoSection({ documentos, participacaoId, onUploadSuccess, onUploadError }: {
  documentos: DocumentoProcesso[];
  participacaoId: string;
  onUploadSuccess: (data: Participacao) => void;
  onUploadError: (msg: string) => void;
}) {
  const [expandido, setExpandido] = useState<string | null>(null);
  const temRetificacao = documentos.some((d) => d.tipo === 'RETIFICACAO');
  const analisados = documentos.filter((d) => d.analisado).length;
  const naoAnalisados = documentos.length - analisados;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <FolderOpen size={18} className="text-indigo-600" />
        <h2 className="font-semibold text-slate-900">Documentos do Processo</h2>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">
            {analisados} analisado{analisados !== 1 ? 's' : ''}
          </span>
          {naoAnalisados > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
              {naoAnalisados} pendente{naoAnalisados !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {temRetificacao && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs font-semibold text-red-800">Retificação encontrada — requisitos podem ter sido alterados</p>
        </div>
      )}

      <div className="space-y-1">
        {documentos.map((doc) => {
          const tipoCfg = TIPO_DOC_PROCESSO[doc.tipo] || TIPO_DOC_PROCESSO.OUTRO;
          const relStyle = RELEVANCIA_STYLES[doc.relevancia] || '';
          const impacto = doc.analiseImpacto as any;
          const temImpacto = impacto && (impacto.alteracoes?.length > 0 || impacto.resumoConteudo);
          const aberto = expandido === doc.id;

          return (
            <div key={doc.id}>
              <div
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border border-l-4 ${relStyle} hover:bg-slate-50 transition-colors ${temImpacto ? 'cursor-pointer' : ''}`}
                onClick={() => temImpacto && setExpandido(aberto ? null : doc.id)}
              >
                {temImpacto && (
                  <ChevronDown size={12} className={`text-slate-400 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                )}
                <span className="text-sm text-slate-800 truncate flex-1">{doc.nomeArquivo}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${tipoCfg.bg} ${tipoCfg.color}`}>
                  {tipoCfg.label}
                </span>
                {doc.relevancia === 'critica' && doc.tipo !== 'EDITAL' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 shrink-0">
                    CRÍTICO
                  </span>
                )}
                {doc.analisado && (
                  <CheckCircle2 size={12} className="text-green-500 shrink-0" title="Analisado" />
                )}
                {doc.urlDownload && (
                  <a
                    href={doc.urlDownload}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 shrink-0"
                    title="Baixar"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download size={12} />
                  </a>
                )}
              </div>

              {aberto && impacto && (
                <div className="ml-6 mt-1 mb-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                  {impacto.resumoConteudo && (
                    <p className="text-slate-700">{impacto.resumoConteudo}</p>
                  )}
                  {impacto.alteracoes?.length > 0 && (
                    <div>
                      <p className="font-semibold text-slate-600 mb-0.5">Alterações:</p>
                      <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                        {impacto.alteracoes.map((alt: string, i: number) => (
                          <li key={i}>{alt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {impacto.novosDocumentosExigidos?.length > 0 && (
                    <p className="text-red-700 font-medium">+ Novos docs exigidos: {impacto.novosDocumentosExigidos.join(', ')}</p>
                  )}
                  {impacto.documentosRemovidos?.length > 0 && (
                    <p className="text-green-700 font-medium">− Docs removidos: {impacto.documentosRemovidos.join(', ')}</p>
                  )}
                  {impacto.prazosAlterados?.length > 0 && (
                    <p className="text-amber-700 font-medium">Prazos alterados: {impacto.prazosAlterados.join(', ')}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upload de documentos adicionais */}
      <div className="border-t border-slate-100 pt-3 mt-3">
        <p className="text-xs font-medium text-slate-500 mb-2">
          {documentos.length > 0
            ? 'Adicionar mais documentos manualmente'
            : 'Enviar documentos do processo (edital, anexos, retificações, etc.)'}
        </p>
        <UploadMultiplosDocs
          participacaoId={participacaoId}
          analisando={false}
          onSuccess={onUploadSuccess}
          onError={onUploadError}
        />
      </div>
    </div>
  );
}

const RISCO_CORES: Record<string, { bg: string; text: string; bar: string }> = {
  baixo: { bg: 'bg-green-50', text: 'text-green-700', bar: 'bg-green-500' },
  moderado: { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500' },
  alto: { bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-500' },
  critico: { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500' },
};

function RiscoRecomendacaoCard({ analiseRisco, scoreRecomendacao }: {
  analiseRisco: AnaliseRisco | null;
  scoreRecomendacao: number | null;
}) {
  const [expandRiscos, setExpandRiscos] = useState(false);
  const risco = analiseRisco;
  const riscoCfg = risco ? RISCO_CORES[risco.nivelRisco] || RISCO_CORES.moderado : RISCO_CORES.moderado;

  const recColor = scoreRecomendacao !== null
    ? scoreRecomendacao >= 70 ? 'text-green-600' : scoreRecomendacao >= 40 ? 'text-amber-600' : 'text-red-600'
    : 'text-slate-400';
  const recLabel = scoreRecomendacao !== null
    ? scoreRecomendacao >= 70 ? 'Participar' : scoreRecomendacao >= 40 ? 'Avaliar' : 'Evitar'
    : '—';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      {/* Risco */}
      {risco && (
        <div className={`rounded-xl border p-5 shadow-sm ${riscoCfg.bg} border-slate-200`}>
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={18} className={riscoCfg.text} />
            <h2 className="font-semibold text-slate-900">Análise de Risco</h2>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl font-bold tabular-nums" style={{ color: riscoCfg.bar.replace('bg-', 'var(--') }}>{risco.scoreRisco}</div>
            <div>
              <span className={`text-sm font-bold uppercase ${riscoCfg.text}`}>{risco.nivelRisco}</span>
              <p className="text-xs text-slate-500">{risco.riscos.length} risco(s) identificado(s)</p>
            </div>
            <div className="flex-1 ml-3">
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className={`h-2 rounded-full ${riscoCfg.bar}`} style={{ width: `${risco.scoreRisco}%` }} />
              </div>
            </div>
          </div>

          {risco.riscos.length > 0 && (
            <div>
              <button
                onClick={() => setExpandRiscos(!expandRiscos)}
                className="text-xs font-medium text-slate-600 flex items-center gap-1 hover:text-slate-800"
              >
                <ChevronDown size={12} className={expandRiscos ? 'rotate-180' : ''} />
                {expandRiscos ? 'Ocultar' : 'Ver'} riscos
              </button>
              {expandRiscos && (
                <div className="mt-2 space-y-1.5">
                  {risco.riscos.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs bg-white/60 rounded-lg p-2 border border-slate-200">
                      <span className={`font-bold shrink-0 px-1.5 py-0.5 rounded ${
                        r.severidade === 'alta' ? 'bg-red-100 text-red-700'
                          : r.severidade === 'media' ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>{r.severidade}</span>
                      <div>
                        <span className="font-medium text-slate-700">{r.categoria}:</span>{' '}
                        <span className="text-slate-600">{r.descricao}</span>
                        {r.clausula && <span className="text-slate-400 ml-1">({r.clausula})</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recomendação */}
      {scoreRecomendacao !== null && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            {scoreRecomendacao >= 70 ? <ThumbsUp size={18} className="text-green-600" /> : <ThumbsDown size={18} className={recColor} />}
            <h2 className="font-semibold text-slate-900">Recomendação</h2>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className={`text-3xl font-bold tabular-nums ${recColor}`}>{scoreRecomendacao}</div>
            <div>
              <span className={`text-sm font-bold uppercase ${recColor}`}>{recLabel}</span>
              <p className="text-xs text-slate-500">de 0 a 100</p>
            </div>
            <div className="flex-1 ml-3">
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${scoreRecomendacao >= 70 ? 'bg-green-500' : scoreRecomendacao >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${scoreRecomendacao}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PropostaCard({ rascunho }: { rascunho: string }) {
  const [expandido, setExpandido] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    navigator.clipboard.writeText(rascunho);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList size={18} className="text-indigo-600" />
        <h2 className="font-semibold text-slate-900">Rascunho de Proposta</h2>
        <div className="ml-auto flex gap-2">
          <button
            onClick={copiar}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100"
          >
            <Copy size={12} />
            {copiado ? 'Copiado!' : 'Copiar'}
          </button>
          <button
            onClick={() => setExpandido(!expandido)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <ChevronDown size={12} className={expandido ? 'rotate-180' : ''} />
            {expandido ? 'Recolher' : 'Expandir'}
          </button>
        </div>
      </div>
      <div className={`prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap text-xs leading-relaxed ${
        expandido ? '' : 'max-h-40 overflow-hidden relative'
      }`}>
        {rascunho}
        {!expandido && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
        )}
      </div>
      {!expandido && (
        <button
          onClick={() => setExpandido(true)}
          className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Ver proposta completa
        </button>
      )}
    </div>
  );
}

function ResumoEditalCard({ resumo }: { resumo: ResumoEdital }) {
  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-5 mb-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
          <Sparkles size={16} className="text-purple-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Resumo Executivo</h2>
          <p className="text-xs text-purple-600">Gerado por IA</p>
        </div>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed mb-4">
        {resumo.resumo}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {resumo.objeto && (
          <div className="flex items-start gap-2.5 bg-white/70 rounded-lg p-3">
            <BookOpen size={16} className="text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-400 font-medium">Objeto</p>
              <p className="text-sm text-slate-800">{resumo.objeto}</p>
            </div>
          </div>
        )}
        {resumo.modalidade && (
          <div className="flex items-start gap-2.5 bg-white/70 rounded-lg p-3">
            <Gavel size={16} className="text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-400 font-medium">Modalidade</p>
              <p className="text-sm text-slate-800">{resumo.modalidade}</p>
            </div>
          </div>
        )}
        {resumo.valorEstimado && (
          <div className="flex items-start gap-2.5 bg-white/70 rounded-lg p-3">
            <DollarSign size={16} className="text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-400 font-medium">Valor Estimado</p>
              <p className="text-sm text-slate-800 font-medium">{resumo.valorEstimado}</p>
            </div>
          </div>
        )}
        {resumo.criterioJulgamento && (
          <div className="flex items-start gap-2.5 bg-white/70 rounded-lg p-3">
            <Scale size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-400 font-medium">Critério de Julgamento</p>
              <p className="text-sm text-slate-800">{resumo.criterioJulgamento}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DocExigidoRow({ doc }: { doc: DocumentoExigido }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-slate-100 rounded-lg">
      <div
        onClick={() => doc.referenciaEdital && setExpanded(!expanded)}
        className={`flex items-center gap-3 p-3 ${doc.referenciaEdital ? 'cursor-pointer hover:bg-slate-50' : ''}`}
      >
        <FileText size={14} className="text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-800">{doc.nome}</span>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span className="bg-slate-100 px-1.5 py-0.5 rounded">{doc.tipo}</span>
            {doc.secaoEdital && <span>{doc.secaoEdital}</span>}
            {doc.obrigatorio && <span className="text-red-500 font-medium">Obrigatório</span>}
            {doc.validadeDias && <span>Validade: {doc.validadeDias}d</span>}
          </div>
        </div>
        {doc.referenciaEdital && (
          expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />
        )}
      </div>
      {expanded && doc.referenciaEdital && (
        <div className="px-3 pb-3">
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
            {doc.referenciaEdital}
          </div>
        </div>
      )}
    </div>
  );
}

function EditModal({ participacao, onClose, onSuccess, onError }: {
  participacao: Participacao;
  onClose: () => void;
  onSuccess: (p: Participacao) => void;
  onError: (msg: string) => void;
}) {
  const [status, setStatus] = useState<ParticipacaoStatus>(participacao.status);
  const [valorProposta, setValorProposta] = useState(participacao.valorProposta?.toString() ?? '');
  const [observacoes, setObservacoes] = useState(participacao.observacoes ?? '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      const body: Record<string, unknown> = { status, observacoes };
      if (valorProposta) body.valorProposta = Number(valorProposta);

      const result = await api.patch<Participacao>(`/participacoes/${participacao.id}`, body);
      onSuccess(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Atualizar Participação" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
          <div className="grid grid-cols-1 gap-2">
            {STATUS_ORDER.map((s) => {
              const cfg = STATUS_CFG[s];
              return (
                <label
                  key={s}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    status === s ? 'border-purple-400 bg-purple-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={status === s}
                    onChange={() => setStatus(s)}
                    className="accent-purple-600"
                  />
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Valor proposta (R$)</label>
          <input
            type="number"
            value={valorProposta}
            onChange={(e) => setValorProposta(e.target.value)}
            placeholder="Ex: 50000"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            disabled={loading}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

const LOG_TIPO_STYLES: Record<string, string> = {
  info: 'text-blue-400',
  sucesso: 'text-green-400',
  erro: 'text-red-400',
  detalhe: 'text-slate-500',
};

const LOG_TIPO_PREFIX: Record<string, string> = {
  info: '►',
  sucesso: '✓',
  erro: '✗',
  detalhe: '  •',
};

function UploadMultiplosDocs({ participacaoId, analisando, onSuccess, onError }: {
  participacaoId: string;
  analisando: boolean;
  onSuccess: (data: Participacao) => void;
  onError: (msg: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected) return;
    setFiles((prev) => [...prev, ...Array.from(selected)]);
    e.target.value = '';
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('documentos', f));

      const res = await fetch(`/api/participacoes/${participacaoId}/upload-documentos`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Erro ${res.status}`);
      }
      const data: Participacao = await res.json();
      setFiles([]);
      onSuccess(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao enviar documentos');
    } finally {
      setUploading(false);
    }
  }

  const disabled = analisando || uploading;

  return (
    <div className="space-y-2">
      <label
        className={`flex flex-col items-center justify-center gap-1.5 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          files.length > 0 ? 'border-purple-400 bg-purple-50/50' : 'border-amber-300 bg-white hover:border-amber-400'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          multiple
          disabled={disabled}
          onChange={handleFilesChange}
        />
        <Upload size={18} className="text-amber-500" />
        <p className="text-xs font-medium text-amber-800">Selecionar PDFs (múltiplos)</p>
      </label>

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-2.5 py-1.5">
              <FileText size={13} className="text-purple-500 shrink-0" />
              <span className="text-xs text-slate-700 flex-1 truncate">{f.name}</span>
              <span className="text-[10px] text-slate-400">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600" disabled={disabled}>
                <XCircle size={13} />
              </button>
            </div>
          ))}
          <button
            onClick={handleUpload}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Enviar {files.length} documento(s) e analisar
          </button>
        </div>
      )}
    </div>
  );
}

function RoboLogLine({ entry }: { entry: RoboLogEntry }) {
  const color = LOG_TIPO_STYLES[entry.tipo] || 'text-slate-400';
  const prefix = LOG_TIPO_PREFIX[entry.tipo] || '►';
  const time = new Date(entry.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className={`flex gap-2 leading-relaxed ${color}`}>
      <span className="text-slate-600 shrink-0 select-none">{time}</span>
      <span className="shrink-0 w-3 text-center select-none">{prefix}</span>
      <span className={entry.tipo === 'detalhe' ? 'text-slate-500 italic' : ''}>{entry.mensagem}</span>
    </div>
  );
}
