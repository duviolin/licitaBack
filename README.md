# Licitações MVP — Recomendação e Gestão de Licitações Públicas

API backend para recomendar licitações públicas a empresas brasileiras com base em score de aderência NLP.

**Status: ✅ MVP Completo — Todas as 4 etapas implementadas e testadas com dados reais.**

---

## Stack

| Tecnologia | Uso |
|---|---|
| Node.js 20+ / TypeScript | Runtime + linguagem (ESM strict) |
| Express 5 | HTTP server |
| PostgreSQL (Neon) | Banco de dados |
| Prisma 7 + adapter-pg | ORM com driver adapter |
| @nlpjs/lang-pt | Tokenização, stemming e stopwords PT-BR |
| BrasilAPI | Consulta CNPJ (gratuita, sem auth) |
| PNCP | Portal Nacional de Contratações Públicas |

---

## Setup

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.development
# Editar .env.development com sua DATABASE_URL

# 3. Gerar client + aplicar schema + iniciar servidor
npm run dev
```

O script `dev-setup.js` faz automaticamente: `prisma generate` → `prisma db push` → inicia o servidor com hot-reload.

---

## Scripts

| Script | Comando | Descrição |
|---|---|---|
| `dev` | `node scripts/dev-setup.js && cross-env NODE_ENV=development tsx watch src/server.ts` | Setup + servidor com hot-reload |
| `build` | `prisma generate && tsc` | Build para produção |
| `start` | `npm run db:generate && npm run db:migrate && node dist/server.js` | Produção |
| `db:generate` | `prisma generate` | Gerar Prisma Client |
| `db:migrate` | `prisma migrate deploy` | Aplicar migrations |
| `db:migrate:dev` | `prisma migrate dev` | Criar migration (dev) |
| `db:push` | `prisma db push` | Sincronizar schema (sem migration) |
| `db:studio` | `prisma studio` | Interface visual do banco |

---

## Arquitetura

```
Routes → Controllers → Services → Repositories → Prisma/DB
                          ↓
                    Clients (APIs externas)
                    Utils (NLP, Score)
```

3 camadas simples. Sem DDD, sem abstrações desnecessárias.

---

## Estrutura do Projeto

```
licitaBack/
├── prisma/
│   └── schema.prisma                  # 4 models + enum
├── prisma.config.ts                   # Config Prisma v7 (datasource URL)
├── scripts/
│   └── dev-setup.js                   # Setup automático (generate + push + retry)
├── src/
│   ├── config/
│   │   ├── load-env.ts                # Carrega .env.{NODE_ENV} com fallback
│   │   └── env.ts                     # Variáveis tipadas (requireEnv/getEnvOptional)
│   ├── lib/
│   │   └── prisma.ts                  # Singleton PrismaClient com adapter-pg
│   ├── generated/
│   │   └── prisma/                    # Prisma Client gerado (gitignored)
│   ├── types/
│   │   └── nlpjs.d.ts                 # Declarações @nlpjs/lang-pt
│   ├── clients/
│   │   ├── brasilApiClient.ts         ✅ Consulta CNPJ na BrasilAPI
│   │   └── pncpClient.ts             ✅ Importação PNCP com paginação + retry
│   ├── utils/
│   │   ├── text.ts                    ✅ NLP: processarTexto, extrairStems, encontrarPalavrasOriginais
│   │   └── score.ts                   ✅ Score composto: textual (60%) + geográfico (25%) + valor (15%)
│   ├── repositories/
│   │   ├── empresaRepository.ts       ✅ CRUD Empresa
│   │   ├── licitacaoMatchRepository.ts ✅ CRUD LicitacaoMatch
│   │   ├── licitacaoRepository.ts     ✅ CRUD Licitacao + filtros ricos + paginação
│   │   └── participacaoRepository.ts  ✅ CRUD Participacao + filtros
│   ├── services/
│   │   ├── empresaService.ts          ✅ Cadastro CNPJ + preferências + recálculo matches
│   │   ├── licitacaoService.ts        ✅ Importação PNCP + cálculo matches + listagem
│   │   └── participacaoService.ts     ✅ Registro + atualização status + listagem
│   ├── controllers/
│   │   ├── empresaController.ts       ✅ Validação + delegação
│   │   ├── licitacaoController.ts     ✅ Validação datas + delegação
│   │   └── participacaoController.ts  ✅ Validação + delegação
│   ├── routes/
│   │   ├── empresaRoutes.ts           ✅ 5 endpoints
│   │   ├── licitacaoRoutes.ts         ✅ 3 endpoints
│   │   └── participacaoRoutes.ts      ✅ 3 endpoints
│   ├── middleware/
│   │   └── errorHandler.ts            ✅ Prisma errors + heurísticas de mensagem
│   ├── app.ts                         ✅ Express app com health + rotas + error handler
│   └── server.ts                      ✅ Entry point com load-env
├── API.json                           ✅ Coleção Insomnia (importar para testar)
├── .env.development                   # Config Neon (gitignored)
├── .env.example                       # Template de variáveis
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Endpoints — Referência Completa

### Health Check

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/health` | Status da API |

### Empresas — `/empresas`

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/empresas/cnpj` | Cadastra empresa via BrasilAPI. Gera stems NLP dos CNAEs. Calcula matches. |
| PATCH | `/empresas/:id/preferencias` | Atualiza palavras-chave, UFs, modalidades, faixa de valor. Recalcula matches. |
| GET | `/empresas` | Lista todas as empresas. |
| GET | `/empresas/:id` | Detalhe completo (stems, preferências). |
| GET | `/empresas/:id/matches` | Matches ordenados por score. Filtros: `scoreMin`, `apenasAbertas`, `limit`. |

### Licitações — `/licitacoes`

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/licitacoes/importar` | Importa do PNCP com paginação. Calcula matches para todas as empresas. |
| GET | `/licitacoes` | Filtros ricos: `empresaId`, `scoreMin`, `modalidade`, `uf`, `esfera`, `situacao`, `valorMin/Max`, `apenasAbertas`, `dataMinima`, `page/limit`. |
| GET | `/licitacoes/:id` | Detalhe com matches por empresa (score breakdown). |

### Participações — `/participacoes`

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/participacoes` | Registra participação (status inicial: ANALISANDO). Valida empresa/licitação existem, bloqueia duplicata (409). |
| GET | `/participacoes` | Lista com filtros: `empresaId`, `status`. Inclui dados da licitação. |
| PATCH | `/participacoes/:id` | Atualiza `status`, `valorProposta`, `observacoes`. Status: ANALISANDO, PROPOSTA_ENVIADA, EM_DISPUTA, GANHO, PERDIDO. |

---

## Score Composto

```
scoreTotal = scoreTextual × 0.60 + scoreGeográfico × 0.25 + scoreValor × 0.15
```

| Componente | Peso | Lógica |
|---|---|---|
| **Textual** | 60% | Jaccard ponderado entre stems da empresa (CNAEs + keywords) e stems do objeto da licitação |
| **Geográfico** | 25% | 1.0 (UF match) / 0.3 (sem preferência, UF diferente) / 0.0 (fora das UFs de interesse) |
| **Valor** | 15% | 1.0 (na faixa) / decaimento proporcional à distância / 0.5 (valor desconhecido) |

### NLP Pipeline

```
Texto → NormalizerPt → TokenizerPt → StopwordsPt → filtro min 3 chars → StemmerPt → dedup → sort
```

Exemplos: "consultoria" → `consult`, "tecnologia" → `tecnolog`, "licitações" → `licit`

---

## Banco de Dados

### Models

```
Empresa (cnpj, razaoSocial, CNAEs, stems NLP, preferências)
    │
    ├── LicitacaoMatch (score composto + breakdown + palavrasMatch)
    │       │
    │       └── Licitacao (pncpId, objeto, orgão, modalidade, valor, UF, datas, stems)
    │
    └── Participacao (status, valorProposta, observações)
            │
            └── Licitacao
```

---

## Testando

### Com Insomnia
Importe o arquivo `API.json` no Insomnia e siga o workflow numerado na seção "4. Workflow Completo de Teste".

### Com curl

```bash
# 1. Health check
curl http://localhost:3000/health

# 2. Cadastrar empresa
curl -X POST http://localhost:3000/empresas/cnpj \
  -H "Content-Type: application/json" \
  -d '{"cnpj": "19131243000197"}'

# 3. Configurar preferências
curl -X PATCH http://localhost:3000/empresas/{id}/preferencias \
  -H "Content-Type: application/json" \
  -d '{"palavrasChave":["software","ERP"],"ufsInteresse":["SP","RJ"],"valorMinimo":50000,"valorMaximo":500000}'

# 4. Importar licitações do PNCP
curl -X POST http://localhost:3000/licitacoes/importar \
  -H "Content-Type: application/json" \
  -d '{"dataInicial":"20260213","dataFinal":"20260220","codigoModalidade":6,"paginas":2}'

# 5. Ver matches da empresa
curl "http://localhost:3000/empresas/{id}/matches?scoreMin=0.2&apenasAbertas=true"

# 6. Listar licitações com filtros
curl "http://localhost:3000/licitacoes?uf=SP&modalidade=Pregão&apenasAbertas=true&limit=10"

# 7. Registrar participação
curl -X POST http://localhost:3000/participacoes \
  -H "Content-Type: application/json" \
  -d '{"empresaId":"{id}","licitacaoId":"{id}","observacoes":"Analisando edital"}'

# 8. Atualizar status
curl -X PATCH http://localhost:3000/participacoes/{id} \
  -H "Content-Type: application/json" \
  -d '{"status":"PROPOSTA_ENVIADA","valorProposta":48000}'

# 9. Listar participações
curl "http://localhost:3000/participacoes?empresaId={id}&status=PROPOSTA_ENVIADA"
```

---

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Sim | PostgreSQL connection string |
| `PORT` | Não (default 3000) | Porta do servidor |
| `NODE_ENV` | Não (default development) | Ambiente |
| `PNCP_BASE_URL` | Não | URL base da API PNCP |
| `BRASILAPI_BASE_URL` | Não | URL base da BrasilAPI |

---

## Roadmap Concluído

```
Etapa 1 ✅  Fundação
├── Setup projeto (TypeScript ESM, Prisma 7, Express 5)
├── Schema completo (4 models)
├── NLP: text.ts (stemming PT-BR)
├── Score: score.ts (textual 60% + geográfico 25% + valor 15%)
├── Middleware error handler
├── Config (load-env, env tipado)
├── API.json (Insomnia)
└── dev-setup.js (auto generate + push)

Etapa 2 ✅  Módulo Empresas
├── brasilApiClient.ts (consulta CNPJ)
├── empresaRepository.ts (CRUD)
├── licitacaoMatchRepository.ts (CRUD matches)
├── empresaService.ts (cadastro + preferências + recálculo)
├── empresaController.ts (validação)
└── empresaRoutes.ts (5 endpoints)

Etapa 3 ✅  Módulo Licitações
├── pncpClient.ts (integração PNCP com paginação + retry)
├── licitacaoRepository.ts (CRUD + filtros ricos + paginação)
├── licitacaoService.ts (importação + cálculo matches + listagem)
├── licitacaoController.ts (validação)
└── licitacaoRoutes.ts (3 endpoints)

Etapa 4 ✅  Módulo Participações
├── participacaoRepository.ts (CRUD + filtros)
├── participacaoService.ts (registro + atualização status + validação)
├── participacaoController.ts (validação)
└── participacaoRoutes.ts (3 endpoints)
```
