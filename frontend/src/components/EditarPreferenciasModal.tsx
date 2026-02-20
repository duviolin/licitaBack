import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { TagInput } from './TagInput';
import { FieldHelp } from './FieldHelp';
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
    <Modal open={open} onClose={onClose} title="Editar Preferências de Busca" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-sm font-medium text-slate-900">
            {empresa.nomeFantasia || empresa.razaoSocial}
          </p>
          <p className="text-xs text-slate-500 font-mono">{formatCnpj(empresa.cnpj)}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          <p className="font-medium mb-1">Para que servem as preferências?</p>
          <p>
            Elas definem <strong>quais licitações são relevantes</strong> para esta empresa. O sistema
            usa essas informações para calcular um <strong>score de compatibilidade</strong> (0-100%)
            com cada licitação. Quanto mais detalhadas, melhores as recomendações.
          </p>
        </div>

        <div>
          <TagInput
            label="Palavras-chave"
            tags={palavrasChave}
            onChange={setPalavrasChave}
            suggestions={PALAVRAS_CHAVE_SUGESTOES}
            placeholder="Digite e pressione Enter..."
          />
          <FieldHelp text="Termos que descrevem o que a empresa fornece. Impactam 60% do score. Ex: 'software', 'manutenção predial', 'equipamentos hospitalares'. Digite e pressione Enter para adicionar, ou escolha das sugestões." />
        </div>

        <div>
          <TagInput
            label="UFs de interesse"
            tags={ufsInteresse}
            onChange={setUfsInteresse}
            suggestions={UFS}
            placeholder="Digite a sigla: SP, RJ..."
          />
          <FieldHelp text="Estados onde a empresa deseja participar de licitações. Use a sigla de 2 letras (ex: SP, RJ, MG). Impactam 25% do score. Se vazio, todas as UFs são consideradas." />
        </div>

        <div>
          <TagInput
            label="Modalidades de interesse"
            tags={modalidades}
            onChange={setModalidades}
            suggestions={MODALIDADES}
            placeholder="Escolha das sugestões..."
          />
          <FieldHelp text="Tipos de processo licitatório que a empresa participa. Ex: 'Pregão Eletrônico' (mais comum), 'Concorrência', 'Dispensa'. Se vazio, todas as modalidades são consideradas." />
        </div>

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
            <FieldHelp text="Valor estimado mínimo da licitação em reais. Licitações abaixo deste valor recebem score menor. Deixe 0 para não limitar." />
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
            <FieldHelp text="Valor máximo que a empresa costuma operar. Licitações acima deste valor recebem score menor. Deixe vazio para sem limite." />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          <strong>Composição do score:</strong> Textual (palavras-chave + CNAE) = 60% | Geográfico (UFs) = 25% | Valor (faixa) = 15%.
          Ao salvar, todos os matches serão recalculados automaticamente.
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
                Salvando e recalculando...
              </>
            ) : (
              'Salvar Preferências'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
