import { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Info, ShieldCheck, RefreshCw, Calendar, X, CheckCircle2, AlertTriangle, Ban, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { FieldHelp } from './FieldHelp';
import { UFS } from '../lib/constants';

interface ImportResult {
  totalConsultadas: number;
  totalDuplicadas: number;
  totalDescartadas: number;
  totalImportadas: number;
  matchesCalculados: number;
  scoreMinUsado: number;
  paginasConsultadas: number;
}

interface Progresso {
  fase: 'preparando' | 'buscando' | 'analisando' | 'concluido' | 'cancelado' | 'erro';
  mensagem: string;
  progresso: number;
  detalhes: {
    consultadas: number;
    duplicadas: number;
    descartadas: number;
    importadas: number;
    matches: number;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: ImportResult) => void;
  onError: (msg: string) => void;
  preEmpresaId?: string;
  preEmpresaNome?: string;
}

const MODALIDADE_OPCOES = [
  { value: '', label: 'Todas as modalidades' },
  { value: '6', label: 'Pregão Eletrônico' },
  { value: '8', label: 'Concorrência' },
  { value: '4', label: 'Dispensa de Licitação' },
  { value: '5', label: 'Inexigibilidade' },
  { value: '9', label: 'Diálogo Competitivo' },
];

const SCORE_OPCOES = [
  { value: 0, label: '0%', desc: 'Importar tudo' },
  { value: 0.2, label: '20%', desc: 'Mínima relevância' },
  { value: 0.3, label: '30%', desc: 'Recomendado' },
  { value: 0.5, label: '50%', desc: 'Apenas relevantes' },
  { value: 0.7, label: '70%', desc: 'Muito relevantes' },
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function toYYYYMMDD(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

const FASE_CONFIG: Record<string, { emoji: string; color: string; barColor: string; label: string }> = {
  preparando: { emoji: '⏳', color: 'text-blue-600',   barColor: 'bg-blue-500',    label: 'Preparando...' },
  buscando:   { emoji: '🔍', color: 'text-indigo-600', barColor: 'bg-indigo-500',  label: 'Buscando no PNCP' },
  analisando: { emoji: '🧠', color: 'text-purple-600', barColor: 'bg-purple-500',  label: 'Analisando relevância' },
  concluido:  { emoji: '✅', color: 'text-green-600',  barColor: 'bg-green-500',   label: 'Concluído!' },
  cancelado:  { emoji: '⏹️', color: 'text-amber-600',  barColor: 'bg-amber-500',   label: 'Cancelado' },
  erro:       { emoji: '❌', color: 'text-red-600',    barColor: 'bg-red-500',     label: 'Erro' },
};

const POLL_INTERVAL = 1000;

export function ImportarLicitacoesModal({ open, onClose, onSuccess, onError, preEmpresaId, preEmpresaNome }: Props) {
  const [dataInicial, setDataInicial] = useState(daysAgo(90));
  const [dataFinal, setDataFinal] = useState(todayStr());
  const [uf, setUf] = useState('');
  const [modalidade, setModalidade] = useState('');
  const [scoreMinimo, setScoreMinimo] = useState(0.3);
  const [showAvancado, setShowAvancado] = useState(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDone = !!result || progresso?.fase === 'cancelado' || progresso?.fase === 'erro';

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/licitacoes/importar/status/${id}`);
      if (!res.ok) {
        stopPolling();
        setIsProcessing(false);
        setProgresso({ fase: 'erro', mensagem: 'Erro ao consultar status', progresso: 0, detalhes: { consultadas: 0, duplicadas: 0, descartadas: 0, importadas: 0, matches: 0 } });
        return;
      }
      const data = await res.json();

      setProgresso(data.progresso);

      if (data.status === 'done') {
        stopPolling();
        setIsProcessing(false);
        if (data.resultado) {
          setResult(data.resultado);
          onSuccess(data.resultado);
        }
      } else if (data.status === 'error' || data.status === 'cancelled') {
        stopPolling();
        setIsProcessing(false);
        if (data.status === 'error') {
          onError(data.progresso?.mensagem || 'Erro desconhecido');
        }
      }
    } catch {
      stopPolling();
      setIsProcessing(false);
      setProgresso({ fase: 'erro', mensagem: 'Sem conexão com o servidor', progresso: 0, detalhes: { consultadas: 0, duplicadas: 0, descartadas: 0, importadas: 0, matches: 0 } });
    }
  }, [stopPolling, onSuccess, onError]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  async function handleImportar(diasOverride?: number) {
    if (isProcessing) return;

    const ini = diasOverride ? daysAgo(diasOverride) : dataInicial;
    const fim = todayStr();

    if (diasOverride) {
      setDataInicial(ini);
      setDataFinal(fim);
    }

    setIsProcessing(true);
    setResult(null);
    setProgresso({ fase: 'preparando', mensagem: 'Conectando...', progresso: 0, detalhes: { consultadas: 0, duplicadas: 0, descartadas: 0, importadas: 0, matches: 0 } });

    try {
      const body: Record<string, unknown> = {
        dataInicial: toYYYYMMDD(ini),
        dataFinal: toYYYYMMDD(fim),
        scoreMinimo,
        apenasPropostasAbertas: true,
      };
      if (uf) body.uf = uf;
      if (modalidade) body.codigoModalidade = Number(modalidade);
      if (preEmpresaId) body.empresaId = preEmpresaId;

      const response = await fetch('/api/licitacoes/importar/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erro na importação' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const { jobId: newJobId } = await response.json();
      setJobId(newJobId);

      stopPolling();
      pollingRef.current = setInterval(() => pollStatus(newJobId), POLL_INTERVAL);
      pollStatus(newJobId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setProgresso({ fase: 'erro', mensagem: msg, progresso: 0, detalhes: { consultadas: 0, duplicadas: 0, descartadas: 0, importadas: 0, matches: 0 } });
      setIsProcessing(false);
      onError(msg);
    }
  }

  async function handleCancelar() {
    if (!jobId) return;
    try {
      await fetch(`/api/licitacoes/importar/cancelar/${jobId}`, { method: 'POST' });
    } catch { /* best effort */ }
  }

  function handleClose() {
    if (isProcessing && jobId) {
      handleCancelar();
    }
    stopPolling();
    setResult(null);
    setProgresso(null);
    setJobId(null);
    setIsProcessing(false);
    onClose();
  }

  function handleNovo() {
    setResult(null);
    setProgresso(null);
    setJobId(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleImportar();
  }

  const fase = progresso ? FASE_CONFIG[progresso.fase] || FASE_CONFIG.preparando : null;
  const pct = progresso?.progresso ?? 0;
  const det = progresso?.detalhes;

  return (
    <Modal open={open} onClose={handleClose} title={preEmpresaId ? `Buscar licitações — ${preEmpresaNome}` : 'Importar Licitações'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* === PROCESSO EM ANDAMENTO === */}
        {isProcessing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <Loader2 size={20} className="animate-spin text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${fase?.color}`}>{fase?.emoji} {fase?.label}</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">{progresso?.mensagem}</p>
              </div>
              <button
                type="button"
                onClick={handleCancelar}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shrink-0"
              >
                <X size={14} />
                Parar
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span className="font-medium">{pct}%</span>
                <span>
                  {progresso?.fase === 'buscando' && 'Consultando portal do governo...'}
                  {progresso?.fase === 'analisando' && det && `${det.importadas} salvas de ${det.consultadas}`}
                  {progresso?.fase === 'preparando' && 'Carregando dados...'}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${fase?.barColor || 'bg-blue-500'}`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>

            {det && (
              <div className="grid grid-cols-5 gap-2">
                <Counter label="Consultadas" value={det.consultadas} color="text-slate-700" bg="bg-white border-slate-100" />
                <Counter label="Duplicatas" value={det.duplicadas} color="text-slate-400" bg="bg-white border-slate-100" />
                <Counter label="Descartadas" value={det.descartadas} color="text-red-500" bg="bg-red-50 border-red-100" />
                <Counter label="Importadas" value={det.importadas} color="text-green-600" bg="bg-green-50 border-green-100" />
                <Counter label="Matches" value={det.matches} color="text-blue-600" bg="bg-blue-50 border-blue-100" />
              </div>
            )}
          </div>
        )}

        {/* === RESULTADO FINAL === */}
        {result && !isProcessing && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 size={22} className="text-green-600" />
                <p className="font-bold text-green-800 text-lg">Importação concluída!</p>
              </div>
              <div className="grid grid-cols-5 gap-2">
                <Counter label="Consultadas" value={result.totalConsultadas} color="text-slate-700" bg="bg-white border-green-100" />
                <Counter label="Duplicatas" value={result.totalDuplicadas} color="text-slate-400" bg="bg-white border-green-100" />
                <Counter label="Descartadas" value={result.totalDescartadas} color="text-red-500" bg="bg-white border-red-100" />
                <Counter label="Importadas" value={result.totalImportadas} color="text-green-700" bg="bg-green-100 border-green-200" large />
                <Counter label="Matches" value={result.matchesCalculados} color="text-blue-600" bg="bg-blue-50 border-blue-100" />
              </div>
              {result.totalDescartadas > 0 && (
                <p className="text-xs text-green-600 mt-3">
                  {result.totalDescartadas} licitações com score &lt; {(result.scoreMinUsado * 100).toFixed(0)}% não foram salvas.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={handleClose}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                Fechar
              </button>
              <button type="button" onClick={handleNovo}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                <RefreshCw size={14} /> Nova importação
              </button>
            </div>
          </div>
        )}

        {/* === CANCELADO / ERRO === */}
        {!isProcessing && !result && progresso?.fase === 'cancelado' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <Ban size={18} className="text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Importação cancelada</p>
                <p className="text-xs text-amber-600 mt-0.5">{progresso.mensagem}</p>
              </div>
            </div>
            {det && det.importadas > 0 && (
              <p className="text-xs text-slate-500">{det.importadas} licitações já tinham sido salvas antes do cancelamento.</p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={handleClose}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">Fechar</button>
              <button type="button" onClick={handleNovo}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Tentar novamente</button>
            </div>
          </div>
        )}

        {!isProcessing && !result && progresso?.fase === 'erro' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertTriangle size={18} className="text-red-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">Erro na importação</p>
                <p className="text-xs text-red-600 mt-0.5">{progresso.mensagem}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={handleClose}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">Fechar</button>
              <button type="button" onClick={handleNovo}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Tentar novamente</button>
            </div>
          </div>
        )}

        {/* === FORMULÁRIO (só aparece quando idle) === */}
        {!isProcessing && !isDone && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 text-sm text-blue-700">
              <Info size={16} className="mt-0.5 shrink-0" />
              <p>
                Busca apenas licitações <strong>com propostas em aberto</strong>, calcula relevância
                antes de salvar, e descarta as irrelevantes.
              </p>
            </div>

            {preEmpresaId && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
                <strong>Buscando para:</strong> {preEmpresaNome}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleImportar(90)}
                className="flex flex-col items-center gap-1.5 px-4 py-4 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Download size={20} />
                <span>Carga inicial</span>
                <span className="text-xs text-blue-200">Últimos 90 dias</span>
              </button>
              <button
                type="button"
                onClick={() => handleImportar(7)}
                className="flex flex-col items-center gap-1.5 px-4 py-4 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <RefreshCw size={20} />
                <span>Atualizar</span>
                <span className="text-xs text-emerald-200">Últimos 7 dias</span>
              </button>
            </div>
            <FieldHelp text="'Carga inicial' busca os últimos 90 dias — use na primeira vez. 'Atualizar' busca novidades recentes. Duplicatas são ignoradas." />

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={14} className="text-amber-600" />
                <label className="text-sm font-semibold text-amber-800">Score mínimo</label>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {SCORE_OPCOES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setScoreMinimo(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      scoreMinimo === opt.value
                        ? 'bg-amber-300 text-amber-900 border border-amber-400'
                        : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    {opt.label} <span className="text-[10px] opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl">
              <button
                type="button"
                onClick={() => setShowAvancado(!showAvancado)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <span className="flex items-center gap-2"><Calendar size={14} /> Ajustar datas e filtros</span>
                <span className="text-xs">{showAvancado ? '▲' : '▼'}</span>
              </button>

              {showAvancado && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-200 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Data inicial</label>
                      <input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Data final</label>
                      <input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">UF</label>
                      <select value={uf} onChange={(e) => setUf(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                        <option value="">Todos</option>
                        {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Modalidade</label>
                      <select value={modalidade} onChange={(e) => setModalidade(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                        {MODALIDADE_OPCOES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <button type="submit"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
                    <Download size={16} /> Importar com filtros
                  </button>
                </div>
              )}
            </div>

            <button type="button" onClick={handleClose}
              className="w-full px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
          </>
        )}
      </form>
    </Modal>
  );
}

function Counter({ label, value, color, bg, large }: {
  label: string; value: number; color: string; bg: string; large?: boolean;
}) {
  return (
    <div className={`rounded-lg p-2 border text-center ${bg}`}>
      <p className={`${large ? 'text-2xl' : 'text-lg'} font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-400 leading-tight">{label}</p>
    </div>
  );
}
