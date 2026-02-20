# Licitações MVP — Guia do Usuário

## O que é este sistema?

Este sistema encontra automaticamente **licitações públicas** que combinam com o perfil da sua empresa.

Em vez de você gastar horas por dia vasculhando portais do governo atrás de oportunidades, o sistema faz isso por você: busca as licitações, analisa o objeto de cada uma e **ranqueia por relevância** para o seu negócio.

---

## Como funciona em 4 passos?

### Passo 1 — Cadastre sua empresa

Você informa o **CNPJ** e o sistema busca automaticamente:
- Razão social e nome fantasia
- Atividades da empresa (CNAEs principal e secundários)
- UF e município
- Situação cadastral

Tudo isso é buscado direto da **Receita Federal** — você não precisa digitar nada além do CNPJ.

O sistema ainda processa as descrições das atividades da empresa usando **inteligência artificial de texto** para entender o que sua empresa realmente faz.

---

### Passo 2 — Configure suas preferências

Depois de cadastrada, você pode refinar a busca informando:

| Preferência | O que é | Exemplo |
|---|---|---|
| **Palavras-chave** | Termos extras que descrevem o que sua empresa oferece | "software", "ERP", "cloud", "consultoria" |
| **UFs de interesse** | Estados onde você quer concorrer | SP, RJ, MG |
| **Modalidades** | Tipos de licitação que te interessam | "Pregão - Eletrônico", "Concorrência - Eletrônica" |
| **Faixa de valor** | Valores mínimo e máximo que fazem sentido para seu porte | R$ 50.000 a R$ 500.000 |

Quanto mais informações você der, **melhores e mais precisas** serão as recomendações.

---

### Passo 3 — Importe licitações

O sistema busca licitações diretamente do **PNCP (Portal Nacional de Contratações Públicas)**, que é o portal oficial do governo federal.

Você escolhe:
- Período de datas (ex: última semana)
- UF específica (opcional)
- Tipo de modalidade (opcional)
- Se quer apenas licitações com prazo ainda aberto

O sistema importa as licitações e **calcula automaticamente um score de 0 a 100%** de compatibilidade com cada empresa cadastrada.

---

### Passo 4 — Veja as recomendações e participe

O sistema mostra as licitações **ordenadas por relevância**. Para cada uma, você vê:

- **Score total** — o quanto aquela licitação combina com sua empresa (0% a 100%)
- **Score textual** — o quanto o objeto da licitação combina com suas atividades
- **Score geográfico** — se a licitação é na sua região de interesse
- **Score de valor** — se o valor está dentro da sua faixa
- **Palavras que combinaram** — quais termos fizeram a conexão (ex: "consultoria", "tecnologia")

Achou uma licitação interessante? Registre sua **participação** no sistema para acompanhar:

| Status | Significado |
|---|---|
| **ANALISANDO** | Você está estudando o edital |
| **PROPOSTA ENVIADA** | Proposta já foi submetida |
| **EM DISPUTA** | Licitação em fase de disputas/lances |
| **GANHO** | Você venceu a licitação |
| **PERDIDO** | Não foi dessa vez |

---

## Como o score de relevância funciona?

O sistema usa 3 critérios para calcular a compatibilidade:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   SCORE FINAL = Texto (60%) + UF (25%) + Valor (15%)│
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 1. Análise de texto (60% do score)

O sistema compara as **atividades da empresa** (CNAEs + palavras-chave) com o **objeto da licitação**.

Usa processamento de linguagem natural em português para entender que:
- "consultoria" e "consultor" são a mesma coisa
- "serviços" e "serviço" são a mesma coisa
- "tecnologia" e "tecnológico" são a mesma coisa

Isso evita que você perca oportunidades por causa de variações de palavras.

### 2. Localização (25% do score)

- A licitação é no seu estado ou nas UFs de interesse? **Score máximo.**
- Não é, mas você não configurou preferência? **Score parcial** (ainda aparece, mas abaixo).
- Está fora das suas UFs de interesse? **Score zero nesse critério.**

### 3. Valor (15% do score)

- O valor estimado está dentro da sua faixa? **Score máximo.**
- Está um pouco acima ou abaixo? **Score proporcional** (quanto mais longe, menor).
- O valor não foi informado na licitação? **Score neutro** (não penaliza).

---

## Exemplo prático

**Empresa:** Consultoria em tecnologia da informação (SP)
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

---

## Cenários de uso

### Para escritórios de advocacia especializados em licitações
Cadastre as empresas dos seus clientes, configure as preferências de cada um, e importe licitações periodicamente. O sistema vai ranquear automaticamente quais oportunidades são mais relevantes para cada cliente.

### Para empresas que participam de licitações
Cadastre sua empresa, defina suas preferências e importe licitações da sua região. Acompanhe as mais relevantes e registre suas participações para manter um histórico organizado.

### Para consultorias
Gerencie múltiplas empresas no sistema. Cada uma terá seu próprio perfil, preferências e score de matches independente.

---

## Perguntas frequentes

**Quanto custa?**
O sistema é gratuito. As APIs do governo (PNCP e BrasilAPI) que ele consulta também são gratuitas.

**De onde vêm as licitações?**
Do PNCP — Portal Nacional de Contratações Públicas, que é o portal oficial do governo federal brasileiro. Todas as licitações são reais e públicas.

**Preciso importar licitações manualmente?**
Sim, nesta versão você aciona a importação informando o período desejado. O sistema busca no PNCP e salva automaticamente.

**Posso cadastrar várias empresas?**
Sim. Cada empresa terá seus próprios matches e scores calculados independentemente.

**O score é confiável?**
O score é uma **estimativa de relevância**, não uma garantia. Ele ajuda a priorizar quais licitações merecem sua atenção primeiro. Sempre leia o edital completo antes de decidir participar.

**O sistema participa da licitação por mim?**
Não. O sistema **encontra e recomenda** licitações relevantes. A participação efetiva (análise do edital, preparação de documentos, envio de proposta) é feita por você nos portais oficiais.

---

## Glossário

| Termo | Significado |
|---|---|
| **CNPJ** | Número de registro da empresa na Receita Federal |
| **CNAE** | Classificação Nacional de Atividades Econômicas — descreve o que a empresa faz |
| **Licitação** | Processo pelo qual o governo compra produtos e serviços |
| **PNCP** | Portal Nacional de Contratações Públicas — portal oficial do governo |
| **Pregão Eletrônico** | Tipo de licitação feita online, mais comum para compras do governo |
| **Modalidade** | Tipo de procedimento da licitação (Pregão, Concorrência, Dispensa, etc.) |
| **Score** | Pontuação de 0% a 100% indicando o quanto uma licitação combina com a empresa |
| **Match** | Quando uma licitação tem score relevante para uma empresa |
| **NLP** | Processamento de Linguagem Natural — técnica de inteligência artificial para entender textos |
| **Stemming** | Técnica que reduz palavras à raiz ("consultoria" e "consultor" viram "consult") |
| **UF** | Unidade Federativa — sigla do estado (SP, RJ, MG, etc.) |
| **Esfera** | Nível do governo: Federal, Estadual ou Municipal |
