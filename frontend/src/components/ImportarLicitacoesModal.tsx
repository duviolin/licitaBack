import { useState } from 'react';
import { Loader2, Download, Info } from 'lucide-react';
import { Modal } from './Modal';
import { api } from '../lib/api';
import { UFS } from '../lib/constants';

interface ImportResult {
  totalConsultadas: number;
  totalImportadas: number;
  totalIgnoradas: number;
  matchesCalculados: number;
  paginasConsultadas: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: ImportResult) => void;
  onError: (msg: string) => void;
}

const MODALIDADE_OPCOES = [
  { value: '', label: 'Todas as modalidades' },
  { value: '6', label: 'Pregão Eletrônico' },
  { value: '8', label: 'Concorrência' },
  { value: '4', label: 'Dispensa de Licitação' },
  { value: '5', label: 'Inexigibilidade' },
  { value: '9', label: 'Diálogo Competitivo' },
];

function todayStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function toYYYYMMDD(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

export function ImportarLicitacoesModal({ open, onClose, onSuccess, onError }: Props) {
  const [dataInicial, setDataInicial] = useState(daysAgo(7));
  const [dataFinal, setDataFinal] = useState(todayStr());
  const [uf, setUf] = useState('');
  const [modalidade, setModalidade] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!dataInicial || !dataFinal) {
      onError('Preencha as datas');
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      const body: Record<string, unknown> = {
        dataInicial: toYYYYMMDD(dataInicial),
        dataFinal: toYYYYMMDD(dataFinal),
      };
      if (uf) body.uf = uf;
      if (modalidade) body.codigoModalidade = Number(modalidade);

      const res = await api.post<ImportResult>('/licitacoes/importar', body);
      setResult(res);
      onSuccess(res);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao importar');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setResult(null);
    onClose();
  }

  function applyPreset(days: number) {
    setDataInicial(daysAgo(days));
    setDataFinal(todayStr());
  }

  return (
    <Modal open={open} onClose={handleClose} title="Importar Licitações do PNCP" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 text-sm text-blue-700">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>
            Importa licitações do Portal Nacional de Contratações Públicas. Duplicatas são ignoradas automaticamente.
          </span>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Período rápido</label>
          <div className="flex gap-2">
            {[
              { label: '7 dias', days: 7 },
              { label: '15 dias', days: 15 },
              { label: '30 dias', days: 30 },
            ].map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => applyPreset(p.days)}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Últimos {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Data inicial</label>
            <input
              type="date"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Data final</label>
            <input
              type="date"
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              disabled={loading}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">UF (opcional)</label>
            <select
              value={uf}
              onChange={(e) => setUf(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              disabled={loading}
            >
              <option value="">Todos os estados</option>
              {UFS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Modalidade (opcional)</label>
            <select
              value={modalidade}
              onChange={(e) => setModalidade(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              disabled={loading}
            >
              {MODALIDADE_OPCOES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1 text-sm">
            <p className="font-semibold text-green-800">Importação concluída!</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-green-700">
              <span>Consultadas:</span><span className="font-medium">{result.totalConsultadas}</span>
              <span>Importadas (novas):</span><span className="font-medium">{result.totalImportadas}</span>
              <span>Ignoradas (duplicatas):</span><span className="font-medium">{result.totalIgnoradas}</span>
              <span>Matches calculados:</span><span className="font-medium">{result.matchesCalculados}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            disabled={loading}
          >
            {result ? 'Fechar' : 'Cancelar'}
          </button>
          {!result && (
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Importar
                </>
              )}
            </button>
          )}
        </div>

        {loading && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
            Consultando o PNCP e calculando matches... Isso pode demorar de 10s a 2min dependendo do período.
          </div>
        )}
      </form>
    </Modal>
  );
}
