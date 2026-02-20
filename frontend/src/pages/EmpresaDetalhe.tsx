import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, MapPin, FileText, Star, Settings,
  RefreshCw, Loader2, AlertCircle, ExternalLink,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCnpj, formatCurrency } from '../lib/constants';
import { PageHeader } from '../components/PageHeader';
import { EditarPreferenciasModal } from '../components/EditarPreferenciasModal';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import type { Empresa, LicitacaoMatch, Licitacao } from '../types';

type MatchComLicitacao = LicitacaoMatch & { licitacao: Licitacao };

export function EmpresaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [matches, setMatches] = useState<MatchComLicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculando, setRecalculando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [scoreMin, setScoreMin] = useState(0);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  async function loadData(empresaId: string) {
    try {
      setLoading(true);
      const [emp, matchesData] = await Promise.all([
        api.get<Empresa>(`/empresas/${empresaId}`),
        api.get<MatchComLicitacao[]>(`/empresas/${empresaId}/matches?scoreMin=0&limit=100`),
      ]);
      setEmpresa(emp);
      setMatches(matchesData);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function handleRecalcular() {
    if (!id) return;
    try {
      setRecalculando(true);
      await api.patch(`/empresas/${id}/preferencias`, {});
      await loadData(id);
      addToast('success', 'Matches recalculados com sucesso!');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao recalcular');
    } finally {
      setRecalculando(false);
    }
  }

  const filteredMatches = matches.filter((m) => Number(m.score) >= scoreMin);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
        <AlertCircle size={20} />
        <span>Empresa não encontrada</span>
      </div>
    );
  }

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <button
        onClick={() => navigate('/empresas')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        Voltar para Empresas
      </button>

      <PageHeader
        title={empresa.nomeFantasia || empresa.razaoSocial}
        description={`${empresa.razaoSocial} — ${formatCnpj(empresa.cnpj)}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setEditando(true)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings size={16} />
              Preferências
            </button>
            <button
              onClick={handleRecalcular}
              disabled={recalculando}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {recalculando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Recalcular
            </button>
          </div>
        }
      />

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <InfoCard icon={Building2} label="Situação" value={empresa.situacaoCadastral || '—'} />
        <InfoCard icon={MapPin} label="Localização" value={empresa.municipio ? `${empresa.municipio}/${empresa.uf}` : empresa.uf || '—'} />
        <InfoCard icon={FileText} label="CNAE Principal" value={empresa.cnaePrincipalDescricao?.slice(0, 50) || '—'} />
      </div>

      {/* Preferências */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-3">Preferências de Busca</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Palavras-chave</p>
            {empresa.palavrasChave.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {empresa.palavrasChave.map((kw, i) => (
                  <span key={i} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">{kw}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Nenhuma definida</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">UFs de interesse</p>
            {empresa.ufsInteresse.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {empresa.ufsInteresse.map((uf, i) => (
                  <span key={i} className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded">{uf}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Todas</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Modalidades</p>
            {empresa.modalidadesInteresse.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {empresa.modalidadesInteresse.map((m, i) => (
                  <span key={i} className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded">{m}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Todas</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Faixa de valor</p>
            <p className="text-sm text-slate-800">
              {formatCurrency(empresa.valorMinimo)} — {empresa.valorMaximo ? formatCurrency(empresa.valorMaximo) : 'Sem limite'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditando(true)}
          className="mt-3 text-sm text-blue-600 hover:underline font-medium"
        >
          Editar preferências
        </button>
      </div>

      {/* Matches */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star size={18} className="text-amber-500" />
            <h2 className="font-semibold text-slate-900">
              Matches ({filteredMatches.length})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Score mínimo:</span>
            <select
              value={scoreMin}
              onChange={(e) => setScoreMin(Number(e.target.value))}
              className="text-sm border border-slate-300 rounded px-2 py-1 outline-none"
            >
              <option value={0}>Todos</option>
              <option value={0.3}>&ge; 30%</option>
              <option value={0.5}>&ge; 50%</option>
              <option value={0.7}>&ge; 70%</option>
            </select>
          </div>
        </div>

        {filteredMatches.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">
            Nenhum match encontrado. Tente importar mais licitações ou ajustar as preferências.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredMatches.map((match) => (
              <MatchRow key={match.id} match={match} onNavigate={() => navigate(`/licitacoes`)} />
            ))}
          </div>
        )}
      </div>

      {editando && (
        <EditarPreferenciasModal
          open={editando}
          empresa={empresa}
          onClose={() => setEditando(false)}
          onSuccess={(atualizada) => {
            setEmpresa(atualizada);
            setEditando(false);
            if (id) loadData(id);
            addToast('success', 'Preferências atualizadas!');
          }}
          onError={(msg) => addToast('error', msg)}
        />
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-slate-100">
        <Icon size={16} className="text-slate-600" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function MatchRow({ match, onNavigate }: { match: MatchComLicitacao; onNavigate: () => void }) {
  const score = Number(match.score);
  const lic = match.licitacao;

  return (
    <div className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
      <div className="flex flex-col items-center gap-0.5">
        <span className={`text-sm font-bold ${score >= 0.7 ? 'text-green-600' : score >= 0.4 ? 'text-amber-600' : 'text-slate-500'}`}>
          {(score * 100).toFixed(0)}%
        </span>
        <div className="w-10 h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full ${score >= 0.7 ? 'bg-green-500' : score >= 0.4 ? 'bg-amber-500' : 'bg-slate-400'}`}
            style={{ width: `${score * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{lic.objeto}</p>
        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
          <span>{lic.orgao.slice(0, 40)}</span>
          <span>{lic.modalidade}</span>
          {lic.uf && <span>{lic.uf}</span>}
          {lic.valorEstimado && <span>{formatCurrency(lic.valorEstimado)}</span>}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <ScoreDetail label="Txt" value={Number(match.scoreTextual)} />
        <ScoreDetail label="Geo" value={Number(match.scoreGeografico)} />
        <ScoreDetail label="Val" value={Number(match.scoreValor)} />
      </div>

      <button onClick={onNavigate} className="p-1.5 text-slate-400 hover:text-blue-600">
        <ExternalLink size={14} />
      </button>
    </div>
  );
}

function ScoreDetail({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="font-medium">{(value * 100).toFixed(0)}%</p>
    </div>
  );
}
