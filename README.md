# Licitações MVP — Recomendação, Gestão e Disputa de Licitações Públicas

Sistema completo (backend + frontend) para recomendar licitações públicas a empresas brasileiras com base em score de aderência NLP, analisar editais automaticamente e preparar participação em certames.

---

## Status Atual — O que funciona e o que não funciona

### Funcional (pode usar agora)

| Funcionalidade | Descrição |
|---|---|
| **Cadastro de empresa por CNPJ** | Consulta BrasilAPI, extrai CNAEs, gera stems NLP automaticamente |
| **Configuração de preferências** | Palavras-chave, UFs, modalidades, faixa de valor — impactam o score |
| **Importação de licitações do PNCP** | Busca por período/UF/modalidade, calcula score antes de salvar (score-first) |
| **Score de aderência NLP** | 60% textual (Jaccard stems) + 25% geográfico + 15% valor |
| **Matches empresa×licitação** | Ranking, favoritar, descartar, filtrar por score |
| **Participações** | Registrar, acompanhar status (Analisando→Enviada→Disputa→Ganho/Perdido) |
| **Documentos da empresa** | Cadastrar CNDs, FGTS, Contrato Social, Atestados, etc. com validade |
| **Análise automática de edital** | Baixa PDF, extrai texto, identifica documentos exigidos e prazos |
| **Verificação de conformidade** | Compara docs da empresa × exigências do edital, indica faltantes/vencidos |
| **Checklist de participação** | Percentual de conformidade, indicação se empresa está apta |
| **Reprocessamento** | Após cadastrar novos docs, reavalia conformidade automaticamente |

### NÃO funcional (ainda não existe)

| Item | Status |
|---|---|
| **Autenticação / Login** | Não existe. O sistema é aberto, sem controle de acesso |
| **Login em portais (BLL/BNC/ComprasNet)** | Stub. Não há integração real com portais de compras |
| **Envio automático de proposta** | Stub. O `portalExecutorService` tem apenas funções placeholder |
| **Upload de arquivos de documentos** | Não existe. O campo `arquivoUrl` é preenchido manualmente |
| **OCR para editais escaneados** | O parser só funciona com PDFs que possuem texto extraível |
| **Extração de prazos com alta precisão** | Pode pegar datas de referências legislativas ao invés de datas do edital |
| **Multi-tenant / Multi-usuário** | Não existe separação de dados por usuário |

---

## Stack

| Tecnologia | Uso |
|---|---|
| Node.js 20+ / TypeScript | Runtime + linguagem (ESM strict) |
| Express 5 | HTTP server |
| PostgreSQL (Neon) | Banco de dados |
| Prisma 7 + adapter-pg | ORM com driver adapter |
| @nlpjs/lang-pt | Tokenização, stemming e stopwords PT-BR |
| pdf-parse | Extração de texto de PDFs de editais |
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

## Fluxo de Uso Completo

```
1. Cadastrar empresa por CNPJ
   └→ Configurar preferências (palavras-chave, UFs, modalidades, valor)

2. Importar licitações do PNCP
   └→ Sistema calcula score e mostra matches relevantes

3. Cadastrar documentos da empresa
   └→ CNDs, FGTS, Contrato Social, Atestados, etc.

4. Iniciar análise de edital (Disputas)
   └→ Baixa PDF → Extrai texto → Identifica requisitos → Verifica conformidade
   └→ Gera checklist: "14 documentos exigidos, 10 OK, 4 pendentes, 71% conformidade"

5. Corrigir pendências
   └→ Cadastrar docs faltantes → Reprocessar → Verificar se ficou 100%

6. [FUTURO] Enviar proposta via portal
   └→ Ainda não implementado — stub para automação futura
```

---

## Frontend — 6 Páginas

| Página | Rota | Funcionalidades |
|---|---|---|
| **Dashboard** | `/` | Cards de resumo, top matches, participações recentes |
| **Empresas** | `/empresas` | Lista, cadastro por CNPJ, detalhe com matches e **documentos** |
| **Empresa Detalhe** | `/empresas/:id` | Dados cadastrais, CNAEs, NLP, preferências, **documentos (CRUD)**, matches |
| **Matches** | `/matches` | Empresa×licitação, score breakdown, favoritar/descartar |
| **Participações** | `/participacoes` | CRUD, funil de status, filtros |
| **Disputas** | `/licitacao-exec` | Lista de análises, iniciar nova análise de edital |
| **Disputa Detalhe** | `/licitacao-exec/:id` | Prazos, documentos exigidos, conformidade, checklist, reprocessar |

---

## Endpoints — Referência

### Health Check
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/health` | Status da API |

### Empresas — `/empresas`
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/empresas/cnpj` | Cadastra via BrasilAPI. Gera stems NLP. |
| PATCH | `/empresas/:id/preferencias` | Atualiza preferências. Recalcula matches. |
| GET | `/empresas` | Lista todas. |
| GET | `/empresas/:id` | Detalhe completo. |
| GET | `/empresas/:id/matches` | Matches por score. Filtros: `scoreMin`, `limit`. |
| GET | `/empresas/:id/documentos` | Lista documentos da empresa. |
| POST | `/empresas/:id/documentos` | Cadastra documento (tipo, nome, validade, emissor). |
| PATCH | `/empresas/:id/documentos/:docId` | Atualiza documento. |
| DELETE | `/empresas/:id/documentos/:docId` | Remove documento. |

### Licitações — `/licitacoes`
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/licitacoes/importar` | Importação score-first do PNCP. |
| GET | `/licitacoes` | Filtros: `uf`, `modalidade`, `esfera`, `situacao`, etc. |
| GET | `/licitacoes/:id` | Detalhe com matches por empresa. |

### Participações — `/participacoes`
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/participacoes` | Registra participação. |
| GET | `/participacoes` | Filtros: `empresaId`, `status`. |
| PATCH | `/participacoes/:id` | Atualiza status/valor/observações. |
| DELETE | `/participacoes/:id` | Remove. |

### Disputas — `/licitacao-exec`
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/licitacao-exec/iniciar` | Inicia análise (baixa PDF, extrai requisitos, verifica conformidade). Body: `licitacaoId`, `editalUrl`, `empresaId`, `portalLink?`. |
| GET | `/licitacao-exec` | Lista análises. Filtro: `?empresaId=`. |
| GET | `/licitacao-exec/:id` | Visão geral completa com todas as relações. |
| GET | `/licitacao-exec/:id/documentos-exigidos` | Documentos extraídos do edital. |
| GET | `/licitacao-exec/:id/conformidade` | Resultado da verificação documental. |
| GET | `/licitacao-exec/:id/prazos` | Prazos extraídos (abertura, sessão, impugnação, etc.). |
| GET | `/licitacao-exec/:id/checklist` | Checklist de participação com % conformidade. |
| POST | `/licitacao-exec/:id/reprocessar-docs` | Reavalia conformidade (após cadastrar novos docs). |

---

## Tipos de Documentos Suportados

| Tipo | Descrição | Validade Padrão |
|---|---|---|
| CND_FEDERAL | Certidão Negativa de Débitos Federais | 180 dias |
| CND_ESTADUAL | Certidão Negativa de Débitos Estaduais | 180 dias |
| CND_MUNICIPAL | Certidão Negativa de Débitos Municipais | 180 dias |
| CND_TRABALHISTA | CNDT (TST) | 180 dias |
| FGTS | Certificado de Regularidade (CRF) | 30 dias |
| BALANCO_PATRIMONIAL | Balanço e Demonstrações Contábeis | — |
| ATESTADO_TECNICO | Atestado de Capacidade Técnica | — |
| CONTRATO_SOCIAL | Contrato Social / Ato Constitutivo | — |
| ALVARA | Alvará de Funcionamento | — |
| CERTIDAO_FALENCIA | Certidão Negativa de Falência | 90 dias |
| SICAF | Registro no SICAF | — |
| CNPJ_CARTAO | Comprovante de Inscrição no CNPJ | — |
| PROCURACAO | Procuração / Credenciamento | — |
| DECLARACAO_ME_EPP | Declaração de ME/EPP | — |
| DECLARACAO_INEXISTENCIA_FATO | Declaração de Fato Impeditivo | — |
| DECLARACAO_MENOR | Declaração de Não Emprego de Menores | — |
| REGISTRO_CONSELHO | Registro CREA/CAU/CRA/OAB | — |
| OUTRO | Documento não classificado | — |

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
│   └── schema.prisma                    # 10 models + 6 enums
├── src/
│   ├── config/                          # load-env.ts + env.ts
│   ├── lib/                             # prisma.ts (singleton)
│   ├── clients/
│   │   ├── brasilApiClient.ts           # Consulta CNPJ
│   │   └── pncpClient.ts               # PNCP com paginação + retry
│   ├── utils/
│   │   ├── text.ts                      # NLP pipeline PT-BR
│   │   └── score.ts                     # Score composto
│   ├── repositories/                    # CRUD base (empresa, licitacao, match, participacao)
│   ├── services/                        # Lógica de negócio + empresaDocumentoService
│   ├── controllers/                     # Validação HTTP
│   ├── routes/                          # empresa, licitacao, participacao
│   ├── middleware/                       # Error handler inteligente
│   ├── modules/
│   │   └── licitacaoExec/               # Módulo de Disputas (autocontido)
│   │       ├── types/                   # Interfaces do módulo
│   │       ├── utils/                   # Regex para parsing de editais brasileiros
│   │       ├── repositories/            # 6 repositories (exec, docs, conformidade, prazos...)
│   │       ├── services/                # 7 services (parser, requisitos, prazos, conformidade...)
│   │       ├── controllers/             # Controller único
│   │       └── routes/                  # 8 endpoints
│   ├── app.ts                           # Express app
│   └── server.ts                        # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/                  # Modal, Toast, TagInput, PageHeader, etc.
│   │   ├── pages/                       # 7 páginas (Dashboard, Empresas, Matches, Participações, Disputas...)
│   │   ├── hooks/                       # useToast
│   │   ├── lib/                         # api.ts, constants.ts
│   │   └── types.ts                     # Tipos alinhados com Prisma schema
│   └── vite.config.ts                   # Proxy /api → localhost:3000
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

## Roadmap

```
Backend
├── Etapa 1 ✅  Fundação (setup, schema, NLP, score, config)
├── Etapa 2 ✅  Módulo Empresas (BrasilAPI, CRUD, matches)
├── Etapa 3 ✅  Módulo Licitações (PNCP, importação score-first)
├── Etapa 4 ✅  Módulo Participações (CRUD, status workflow)
├── Etapa 5 ✅  Módulo Disputas (análise edital, conformidade, checklist)
└── Etapa 6 ✅  Documentos da Empresa (CRUD, tipos, validade)

Frontend
├── Etapa F1 ✅  Layout + Dashboard
├── Etapa F2 ✅  Empresas (CRUD, tags, modais)
├── Etapa F3 ✅  Licitações (importar, filtros)
├── Etapa F4 ✅  Matches + Participações
├── Etapa F5 ✅  Disputas (análise, conformidade, checklist)
└── Etapa F6 ✅  Documentos da Empresa (CRUD na página de detalhe)

Próximos passos (não implementado)
├── ⬜ Autenticação (login, multi-usuário)
├── ⬜ Upload de arquivos de documentos (S3/MinIO)
├── ⬜ Integração real com portais (BLL, BNC, ComprasNet via RPA)
├── ⬜ OCR para editais escaneados
├── ⬜ Melhoria na extração de prazos (NLP contextual)
├── ⬜ Notificações (prazos vencendo, docs expirando)
└── ⬜ Dashboard de métricas (taxa de ganho, funil)
```
