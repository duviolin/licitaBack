# Licitações MVP — Guia do Usuário

## O que é este sistema?

Este sistema encontra automaticamente **licitações públicas** que combinam com o perfil da sua empresa.

Em vez de você gastar horas por dia vasculhando portais do governo atrás de oportunidades, o sistema faz isso por você: busca as licitações, analisa o objeto de cada uma e **ranqueia por relevância** para o seu negócio.

### O que o sistema faz por você:
- Busca dados da empresa automaticamente pela Receita Federal (só precisa do CNPJ)
- Importa licitações do portal oficial do governo (PNCP)
- Calcula um **score de compatibilidade** inteligente entre sua empresa e cada licitação
- **Só salva licitações relevantes** — descarta automaticamente as que não têm relação com seu negócio
- Permite acompanhar participações com status visual

---

## Como funciona em 5 passos?

### Passo 1 — Cadastre sua empresa

Você informa o **CNPJ** e o sistema busca automaticamente:
- Razão social e nome fantasia
- Atividades da empresa (CNAEs principal e secundários)
- UF e município
- Situação cadastral

Tudo buscado direto da **Receita Federal** — você não precisa digitar nada além do CNPJ.

O sistema processa as descrições das atividades usando **inteligência artificial de texto** para entender o que sua empresa realmente faz.

---

### Passo 2 — Configure suas preferências

Depois de cadastrada, refine a busca informando:

| Preferência | O que é | Impacto no score | Exemplo |
|---|---|---|---|
| **Palavras-chave** | Termos que descrevem o que a empresa oferece | **60% do score** | "software", "ERP", "consultoria" |
| **UFs de interesse** | Estados onde quer concorrer (sigla de 2 letras) | **25% do score** | SP, RJ, MG |
| **Modalidades** | Tipos de licitação que interessam | Filtro adicional | "Pregão Eletrônico" |
| **Faixa de valor** | Valores mínimo e máximo que fazem sentido | **15% do score** | R$ 50.000 a R$ 500.000 |

> **Dica:** Quanto mais informações você der, melhores e mais precisas serão as recomendações.

---

### Passo 3 — Importe licitações (Importação Inteligente)

O sistema busca licitações no **PNCP (Portal Nacional de Contratações Públicas)**.

Você escolhe:
- **Período de datas** (ex: última semana, últimos 30 dias)
- **UF específica** (opcional — deixe vazio para todo o Brasil)
- **Tipo de modalidade** (opcional — Pregão Eletrônico é o mais comum)
- **Score mínimo** — o mais importante!

#### Como funciona a importação inteligente:

```
1. Sistema busca licitações no PNCP (ex: 300 encontradas)
2. Para cada uma, calcula o score de compatibilidade com suas empresas
3. Só salva as que atingem o score mínimo (ex: ≥ 30%)
4. Descarta o resto — NÃO polui seu banco com licitações irrelevantes
```

#### Exemplo real de resultado:
```
327 consultadas no PNCP
 → 12 já existiam (duplicatas ignoradas)
 → 270 descartadas (score abaixo de 30%)
 → 45 importadas (relevantes para suas empresas)
 → 68 matches calculados
```

**Opções de score mínimo:**
| Score | Significado |
|---|---|
| 0% | Importa tudo (não recomendado — banco cresce com lixo) |
| 20% | Mínima relevância |
| **30%** | **Recomendado** — equilíbrio entre quantidade e qualidade |
| 50% | Apenas relevantes |
| 70% | Muito relevantes (poucos resultados) |

**Importação por empresa:** Na página de detalhe da empresa, há um botão "Buscar Licitações" que importa focado nas preferências daquela empresa específica.

---

### Passo 4 — Veja as recomendações

Na página **Matches**, o sistema mostra as licitações **ordenadas por relevância**. Para cada uma, você vê:

- **Score total** — o quanto a licitação combina com sua empresa (0% a 100%)
- **Score textual** — compatibilidade entre atividades da empresa e objeto da licitação
- **Score geográfico** — se a licitação é na sua região de interesse
- **Score de valor** — se o valor está dentro da sua faixa
- **Palavras que combinaram** — quais termos fizeram a conexão

---

### Passo 5 — Registre participações

Achou uma licitação interessante? Registre sua **participação** para acompanhar:

| Status | Significado |
|---|---|
| **ANALISANDO** | Avaliando se vale participar |
| **PROPOSTA ENVIADA** | Proposta foi submetida no portal |
| **EM DISPUTA** | Participando da fase de lances/disputas |
| **GANHO** | Venceu a licitação! |
| **PERDIDO** | Não foi dessa vez |

Você pode registrar o valor da proposta e adicionar observações para manter um histórico organizado.

---

## Como o score de relevância funciona?

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   SCORE FINAL = Texto (60%) + UF (25%) + Valor (15%)│
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 1. Análise de texto (60% do score)

Compara as **atividades da empresa** (CNAEs + palavras-chave) com o **objeto da licitação**.

Usa processamento de linguagem natural em português para entender que:
- "consultoria" e "consultor" são a mesma coisa
- "serviços" e "serviço" são a mesma coisa
- "tecnologia" e "tecnológico" são a mesma coisa

### 2. Localização (25% do score)

- A licitação é no seu estado ou nas UFs de interesse? **Score máximo.**
- Não configurou preferência de UF? **Score parcial** (ainda aparece, mas abaixo).
- Está fora das suas UFs de interesse? **Score zero nesse critério.**

### 3. Valor (15% do score)

- Valor estimado dentro da sua faixa? **Score máximo.**
- Um pouco acima ou abaixo? **Score proporcional.**
- Valor não informado na licitação? **Score neutro** (não penaliza).

---

## Dashboard — Visão geral

O Dashboard mostra:
- Quantas empresas cadastradas
- Quantas licitações importadas
- Quantos matches acima de 50%
- Quantas participações registradas
- Top 5 melhores matches
- Participações recentes

---

## Exemplo prático

**Empresa:** Consultoria em TI (São Paulo)
**Preferências:** palavras-chave "software, ERP, cloud", UFs "SP, RJ", faixa R$ 50k-500k

**Licitação encontrada:**
> "Contratação de serviço de consultoria em tecnologia da informação"
> Órgão: Universidade de São Paulo | Pregão Eletrônico | R$ 150.000

**Score calculado:**
| Critério | Valor | Por quê |
|---|---|---|
| Texto | 60% | Palavras "consultoria", "tecnologia", "informação" combinaram |
| UF | 100% | SP está nas UFs de interesse |
| Valor | 100% | R$ 150k está dentro de R$ 50k-500k |
| **Score final** | **76%** | Alta relevância — vale a pena analisar! |

**Com a importação inteligente:** Esta licitação seria importada (score 76% > limiar de 30%). Uma licitação de "fornecimento de merenda escolar" com score 2% seria descartada automaticamente.

---

## Cenários de uso

### Para escritórios de advocacia especializados em licitações
Cadastre as empresas dos seus clientes, configure preferências de cada um, e importe licitações periodicamente. O sistema ranqueia automaticamente quais oportunidades são mais relevantes para cada cliente.

### Para empresas que participam de licitações
Cadastre sua empresa, defina preferências e importe licitações da sua região. Acompanhe as mais relevantes e registre participações para manter histórico organizado.

### Para consultorias
Gerencie múltiplas empresas. Cada uma tem perfil, preferências e scores independentes.

---

## Perguntas frequentes

**Quanto custa?**
O sistema é gratuito. As APIs do governo (PNCP e BrasilAPI) também.

**De onde vêm as licitações?**
Do PNCP — Portal Nacional de Contratações Públicas, portal oficial do governo federal. Todas são reais e públicas.

**O sistema importa tudo do PNCP?**
Não! O sistema usa **importação inteligente**: calcula a relevância ANTES de salvar, e só importa licitações que atingem o score mínimo configurado (padrão 30%). Isso evita poluir o banco com licitações irrelevantes.

**Posso importar focado em uma empresa?**
Sim. Na página de detalhe da empresa, há um botão "Buscar Licitações" que importa considerando apenas o perfil daquela empresa.

**Posso cadastrar várias empresas?**
Sim. Cada empresa tem seus próprios matches e scores calculados independentemente.

**O score é confiável?**
O score é uma **estimativa de relevância**, não uma garantia. Ele prioriza quais licitações merecem sua atenção primeiro. Sempre leia o edital completo antes de decidir participar.

**O sistema participa da licitação por mim?**
Não. O sistema **encontra e recomenda** licitações relevantes. A participação efetiva (análise do edital, documentos, proposta) é feita por você nos portais oficiais.

---

## Glossário

| Termo | Significado |
|---|---|
| **CNPJ** | Número de registro da empresa na Receita Federal (14 dígitos) |
| **CNAE** | Classificação Nacional de Atividades Econômicas — descreve o que a empresa faz |
| **Licitação** | Processo pelo qual o governo compra produtos e serviços |
| **PNCP** | Portal Nacional de Contratações Públicas — portal oficial do governo |
| **Pregão Eletrônico** | Tipo de licitação feita online, mais comum para compras do governo |
| **Modalidade** | Tipo de procedimento (Pregão, Concorrência, Dispensa, Inexigibilidade) |
| **Score** | Pontuação de 0% a 100% indicando compatibilidade empresa × licitação |
| **Match** | Quando uma licitação tem score relevante para uma empresa |
| **Score-First** | Técnica de calcular relevância ANTES de salvar, descartando o irrelevante |
| **NLP** | Processamento de Linguagem Natural — IA para entender textos |
| **Stemming** | Técnica que reduz palavras à raiz ("consultoria" → "consult") |
| **UF** | Unidade Federativa — sigla do estado (SP, RJ, MG) |
| **Esfera** | Nível do governo: Federal, Estadual ou Municipal |
