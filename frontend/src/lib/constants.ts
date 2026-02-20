export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export const MODALIDADES = [
  'Pregão Eletrônico',
  'Concorrência',
  'Dispensa de Licitação',
  'Inexigibilidade',
  'Tomada de Preços',
  'Convite',
  'Leilão',
  'Diálogo Competitivo',
];

export const PALAVRAS_CHAVE_SUGESTOES = [
  'tecnologia da informação',
  'software',
  'hardware',
  'consultoria',
  'engenharia',
  'construção civil',
  'manutenção predial',
  'limpeza',
  'vigilância',
  'segurança',
  'alimentação',
  'transporte',
  'saúde',
  'medicamentos',
  'material hospitalar',
  'educação',
  'material escolar',
  'mobiliário',
  'equipamentos',
  'veículos',
  'combustível',
  'telecomunicações',
  'impressão',
  'publicidade',
  'treinamento',
  'capacitação',
];

export function formatCnpj(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}
