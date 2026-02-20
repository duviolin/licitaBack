import { useEffect, useState } from 'react';
import { Loader2, ExternalLink, MapPin, Calendar, Banknote, Building2, Star } from 'lucide-react';
import { Modal } from './Modal';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/constants';

interface LicitacaoDetalhe {
  id: string;
  pncpId: string;
  objeto: string;
  orgao: string;
  modalidade: string;
  valorEstimado: number | null;
  uf: string;
  esfera: string;
  dataPublicacao: string;
  dataAbertura: string | null;
  dataEncerramento: string | null;
  situacao: string;
  linkPortal: string;
  linkEdital: string;
  matches: Array<{
    empresaId: string;
    razaoSocial: string;
    score: number;
    scoreTextual: number;
    scoreGeografico: number;
    scoreValor: number;
    palavrasMatch: string[];
  }>;
}

interface Props {
  open: boolean;
  licitacaoId: string | null;
  onClose: () => void;
}

export function LicitacaoDetalheModal({ open, licitacaoId, onClose }: Props) {
  const [data, setData] = useState<LicitacaoDetalhe | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && licitacaoId) {
      setLoading(true);
      api.get<LicitacaoDetalhe>(`/licitacoes/${licitacaoId}`)
        .then(setData)
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    } else {
      setData(null);
    }
  }, [open, licitacaoId]);

  return (
    <Modal open={open} onClose={onClose} title="Detalhes da Licitação" size="lg">
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-blue-600" />
        </div>
      ) : !data ? (
        <p className="text-sm text-slate-400 text-center py-8">Licitação não encontrada</p>
      ) : (
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">{data.objeto}</h3>
            <p className="text-xs text-slate-500">{data.orgao}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoItem icon={MapPin} label="UF / Esfera" value={`${data.uf} — ${data.esfera}`} />
            <InfoItem icon={Banknote} label="Valor estimado" value={formatCurrency(data.valorEstimado)} />
            <InfoItem icon={Calendar} label="Publicação" value={formatDate(data.dataPublicacao)} />
            <InfoItem icon={Calendar} label="Abertura" value={formatDate(data.dataAbertura)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
              {data.modalidade}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              data.situacao?.toLowerCase().includes('aberta') || data.situacao?.toLowerCase().includes('divulgada')
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {data.situacao}
            </span>
            {data.dataEncerramento && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                Encerra {formatDate(data.dataEncerramento)}
              </span>
            )}
          </div>

          {(data.linkPortal || data.linkEdital) && (
            <div className="flex gap-2">
              {data.linkPortal && (
                <a href={data.linkPortal} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                  <ExternalLink size={12} /> Portal
                </a>
              )}
              {data.linkEdital && (
                <a href={data.linkEdital} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                  <ExternalLink size={12} /> Edital
                </a>
              )}
            </div>
          )}

          {/* Matches */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Star size={16} className="text-amber-500" />
              <h4 className="text-sm font-semibold text-slate-900">
                Empresas com match ({data.matches.length})
              </h4>
            </div>

            {data.matches.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Nenhum match para esta licitação</p>
            ) : (
              <div className="space-y-2">
                {data.matches.map((m) => (
                  <div key={m.empresaId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="p-1.5 bg-white rounded">
                      <Building2 size={14} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{m.razaoSocial}</p>
                      {m.palavrasMatch.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {m.palavrasMatch.slice(0, 5).map((w, i) => (
                            <span key={i} className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">{w}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <ScoreBadge label="Txt" value={Number(m.scoreTextual)} />
                      <ScoreBadge label="Geo" value={Number(m.scoreGeografico)} />
                      <ScoreBadge label="Val" value={Number(m.scoreValor)} />
                    </div>
                    <span className={`text-sm font-bold ${Number(m.score) >= 0.7 ? 'text-green-600' : Number(m.score) >= 0.4 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {(Number(m.score) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-slate-400" />
      <div>
        <p className="text-[10px] text-slate-400">{label}</p>
        <p className="text-sm text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="font-medium">{(value * 100).toFixed(0)}%</p>
    </div>
  );
}
