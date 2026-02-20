import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { TagInput } from './TagInput';
import { api } from '../lib/api';
import { UFS, MODALIDADES, PALAVRAS_CHAVE_SUGESTOES, formatCnpj } from '../lib/constants';
import type { Empresa } from '../types';

interface Props {
  open: boolean;
  empresa: Empresa;
  onClose: () => void;
  onSuccess: (empresa: Empresa) => void;
  onError: (msg: string) => void;
}

export function EditarPreferenciasModal({ open, empresa, onClose, onSuccess, onError }: Props) {
  const [palavrasChave, setPalavrasChave] = useState<string[]>(empresa.palavrasChave);
  const [ufsInteresse, setUfsInteresse] = useState<string[]>(empresa.ufsInteresse);
  const [modalidades, setModalidades] = useState<string[]>(empresa.modalidadesInteresse);
  const [valorMinimo, setValorMinimo] = useState(empresa.valorMinimo?.toString() ?? '');
  const [valorMaximo, setValorMaximo] = useState(empresa.valorMaximo?.toString() ?? '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      const body: Record<string, unknown> = {
        palavrasChave,
        ufsInteresse,
        modalidadesInteresse: modalidades,
      };
      if (valorMinimo) body.valorMinimo = Number(valorMinimo);
      if (valorMaximo) body.valorMaximo = Number(valorMaximo);

      const atualizada = await api.patch<Empresa>(`/empresas/${empresa.id}/preferencias`, body);
      onSuccess(atualizada);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao atualizar preferências');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar Preferências" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">
              {empresa.nomeFantasia || empresa.razaoSocial}
            </p>
            <p className="text-xs text-slate-500 font-mono">{formatCnpj(empresa.cnpj)}</p>
          </div>
        </div>

        <TagInput
          label="Palavras-chave"
          tags={palavrasChave}
          onChange={setPalavrasChave}
          suggestions={PALAVRAS_CHAVE_SUGESTOES}
          placeholder="Ex: tecnologia, software, consultoria..."
        />

        <TagInput
          label="UFs de interesse"
          tags={ufsInteresse}
          onChange={setUfsInteresse}
          suggestions={UFS}
          placeholder="Ex: SP, RJ, MG..."
        />

        <TagInput
          label="Modalidades de interesse"
          tags={modalidades}
          onChange={setModalidades}
          suggestions={MODALIDADES}
          placeholder="Ex: Pregão Eletrônico..."
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Valor mínimo (R$)
            </label>
            <input
              type="number"
              value={valorMinimo}
              onChange={(e) => setValorMinimo(e.target.value)}
              placeholder="0"
              min="0"
              step="1000"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Valor máximo (R$)
            </label>
            <input
              type="number"
              value={valorMaximo}
              onChange={(e) => setValorMaximo(e.target.value)}
              placeholder="Sem limite"
              min="0"
              step="1000"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Preferências'
            )}
          </button>
        </div>

        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            Salvando e recalculando matches... Isso pode levar alguns segundos.
          </div>
        )}
      </form>
    </Modal>
  );
}
