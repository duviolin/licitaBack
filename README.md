# Licitações MVP — Recomendação e Gestão de Licitações Públicas

Sistema completo (backend + frontend) para recomendar licitações públicas a empresas brasileiras com base em score de aderência NLP.

**Status: ✅ MVP Completo — Backend (4 etapas) + Frontend Dashboard (4 etapas) + Importação Inteligente (Score-First)**

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
| React 19 + Vite 7 | Frontend SPA |
| Tailwind CSS 4 | Estilização |
| Lucide React | Ícones |
| React Router 7 | Navegação |

---

## Setup

```bash
# 1. Instalar dependências (backend + frontend)
npm install
cd frontend && npm install && cd ..

# 2. Configurar variáveis de ambiente
cp .env.example .env.development
# Editar .env.development com sua DATABASE_URL

# 3. Iniciar backend (porta 3000)
npm run dev

# 4. Iniciar frontend (porta 5173 com proxy para API)
npm run dev:front
```

### Produção
```bash
npm run build:all   # Compila backend + frontend
npm run start       # Express serve API + frontend estático
```

---

## Scripts

| Script | Descrição |
|---|---|
| `dev` | Setup automático + servidor backend com hot-reload |
| `dev:front` | Dev server frontend (Vite + proxy) |
| `build` | Build backend (Prisma generate + tsc) |
| `build:front` | Build frontend (tsc + vite build) |
| `build:all` | Build backend + frontend |
| `start` | Produção (migrate + serve) |
| `db:generate` | Gerar Prisma Client |
| `db:migrate` | Aplicar migrations |
| `db:push` | Sincronizar schema |
| `db:studio` | Interface visual do banco |

---

## Arquitetura

```
┌──────────────────────────────────────────────┐
│                  Frontend                     │
│  React 19 + Vite + Tailwind + React Router   │
│  (porta 5173 dev / estático em produção)      │
└───────────────────┬──────────────────────────┘
                    │ /api/* proxy
┌───────────────────▼──────────────────────────┐
│                  Backend                      │
│  Express 5 + TypeScript ESM                   │
│  Routes → Controllers → Services → Repos      │
│                    ↓                          │
│              Clients (BrasilAPI, PNCP)         │
│              Utils (NLP, Score)                │
└───────────────────┬──────────────────────────┘
                    │
              PostgreSQL (Neon)
```

---

## Importação Inteligente (Score-First)

O sistema usa uma abordagem inteligente para importação de licitações:

```
PNCP → Busca licitações → Calcula score EM MEMÓRIA → Só salva as relevantes
```

| Aspecto | Como funciona |
|---|---|
| **Pre-filtering** | Score é calculado ANTES de salvar no banco |
| **Score mínimo** | Configurável (0% a 70%, padrão 30%) |
| **Por empresa** | Pode importar focado em uma empresa específica |
| **Resultado detalhado** | Mostra: consultadas, duplicadas, descartadas (score baixo), importadas |
| **Banco limpo** | Só licitações relevantes ocupam espaço |

### Exemplo de resultado:
```
327 consultadas no PNCP
 → 12 já existiam (duplicatas)
 → 270 descartadas (score < 30%)
 → 45 importadas (relevantes)
 → 68 matches calculados
```

---

## Frontend — Dashboard

5 páginas com interface auto-explicativa:

| Página | Funcionalidades |
|---|---|
| **Dashboard** | Cards de resumo, top matches, participações recentes, fluxo de uso |
| **Empresas** | Lista com busca/filtro, cadastro por CNPJ, editar preferências (tags), detalhe com matches |
| **Licitações** | Lista paginada, filtros avançados (UF, modalidade, esfera, situação), importar do PNCP |
| **Matches** | Visão cruzada empresa×licitação, filtro por score, breakdown (textual/geo/valor), tooltips |
| **Participações** | CRUD completo, status visual (Analisando→Enviada→Disputa→Ganho/Perdido), filtros |

Todos os formulários possuem textos explicativos detalhados sobre cada campo.

---

## Endpoints — Referência

### Health Check
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/health` | Status da API |

### Empresas — `/empresas`
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/empresas/cnpj` | Cadastra via BrasilAPI. Gera stems NLP. Calcula matches. |
| PATCH | `/empresas/:id/preferencias` | Atualiza preferências. Recalcula matches. |
| GET | `/empresas` | Lista todas. |
| GET | `/empresas/:id` | Detalhe completo. |
| GET | `/empresas/:id/matches` | Matches por score. Filtros: `scoreMin`, `apenasAbertas`, `limit`. |

### Licitações — `/licitacoes`
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/licitacoes/importar` | **Importação Inteligente.** Params: `dataInicial`, `dataFinal`, `uf`, `codigoModalidade`, `scoreMinimo` (0-1, default 0.3), `empresaId` (opcional). |
| GET | `/licitacoes` | Filtros: `empresaId`, `scoreMin`, `modalidade`, `uf`, `esfera`, `situacao`, `valorMin/Max`, `apenasAbertas`, `dataMinima`, `page/limit`. |
| GET | `/licitacoes/:id` | Detalhe com matches por empresa. |

### Participações — `/participacoes`
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/participacoes` | Registra (status: ANALISANDO). Valida empresa+licitação, bloqueia duplicata. |
| GET | `/participacoes` | Filtros: `empresaId`, `status`. |
| PATCH | `/participacoes/:id` | Atualiza `status`, `valorProposta`, `observacoes`. |

---

## Score Composto

```
scoreTotal = scoreTextual × 0.60 + scoreGeográfico × 0.25 + scoreValor × 0.15
```

| Componente | Peso | Lógica |
|---|---|---|
| **Textual** | 60% | Jaccard entre stems empresa (CNAEs + keywords) e stems objeto da licitação |
| **Geográfico** | 25% | 1.0 (UF match) / 0.3 (sem preferência) / 0.0 (fora das UFs) |
| **Valor** | 15% | 1.0 (na faixa) / decaimento proporcional / 0.5 (desconhecido) |

---

## Estrutura do Projeto

```
licitaBack/
├── prisma/
│   └── schema.prisma                  # 4 models + enum
├── prisma.config.ts                   # Config Prisma v7
├── scripts/
│   └── dev-setup.js                   # Setup automático
├── src/
│   ├── config/                        # load-env.ts + env.ts
│   ├── lib/                           # prisma.ts (singleton)
│   ├── clients/
│   │   ├── brasilApiClient.ts         # Consulta CNPJ
│   │   └── pncpClient.ts             # PNCP com paginação + retry
│   ├── utils/
│   │   ├── text.ts                    # NLP pipeline PT-BR
│   │   └── score.ts                   # Score composto
│   ├── repositories/                  # CRUD + filtros ricos
│   ├── services/                      # Lógica de negócio
│   ├── controllers/                   # Validação HTTP
│   ├── routes/                        # 11 endpoints
│   ├── middleware/                     # Error handler
│   ├── app.ts                         # Express app + serve frontend
│   └── server.ts                      # Entry point
├── frontend/                          # React 19 + Vite 7
│   ├── src/
│   │   ├── components/                # Modal, TagInput, Toast, FieldHelp, etc.
│   │   ├── pages/                     # Dashboard, Empresas, Licitações, Matches, Participações
│   │   ├── hooks/                     # useToast
│   │   ├── lib/                       # api.ts, constants.ts
│   │   └── types.ts                   # Tipos alinhados com Prisma schema
│   ├── package.json
│   └── vite.config.ts                 # Proxy /api → localhost:3000
├── docs/
│   └── GUIA_DO_USUARIO.md            # Documentação para cliente não-técnico
├── API.json                           # Coleção Insomnia
├── .env.example
├── package.json
└── README.md
```

---

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Sim | PostgreSQL connection string |
| `PORT` | Não (3000) | Porta do servidor |
| `NODE_ENV` | Não (development) | Ambiente |
| `PNCP_BASE_URL` | Não | URL base PNCP |
| `BRASILAPI_BASE_URL` | Não | URL base BrasilAPI |

---

## Roadmap Concluído

```
Backend
├── Etapa 1 ✅  Fundação (setup, schema, NLP, score, config)
├── Etapa 2 ✅  Módulo Empresas (BrasilAPI, CRUD, matches)
├── Etapa 3 ✅  Módulo Licitações (PNCP, importação, filtros)
└── Etapa 4 ✅  Módulo Participações (CRUD, status workflow)

Frontend
├── Etapa F1 ✅  Setup + Layout + Dashboard
├── Etapa F2 ✅  Módulo Empresas (CRUD, tags, modais)
├── Etapa F3 ✅  Módulo Licitações (importar, filtros, detalhe)
└── Etapa F4 ✅  Módulo Matches + Participações + Auto-explicativo

Melhorias
└── Importação Inteligente ✅  Score-First (calcula antes de salvar)
```
