# Central de Controle de Frota

Base profissional de uma aplicação de gestão de frota. Next.js App Router, React, TypeScript estrito, Tailwind CSS, componentes shadcn/ui, PostgreSQL e Prisma ORM. Interface em português, com sidebar recolhível e adaptação para desktop, tablet e celular.

## Executar localmente

Requisitos: Node.js 22.18+ e pnpm. A versão utilizada está indicada em `package.json`; as dependências estão fixadas em `pnpm-lock.yaml`.

```sh
pnpm install
cp .env.example .env
pnpm db:generate
```

No PowerShell, use `Copy-Item .env.example .env` no lugar de `cp`. Não sobrescreva seu `.env` caso já esteja configurado.

Inicie o banco em um terminal e mantenha-o aberto:

```sh
pnpm db:local
```

Esse comando inicia um PostgreSQL real, persistido em `.local-db`, somente na interface local e na porta 54329. No Windows, os binários são copiados para `.pg-runtime` para evitar o limite de tamanho de caminhos. Esses diretórios e o `.env` são ignorados pelo Git. A senha do exemplo é exclusiva de desenvolvimento.

Alternativa: `docker compose up -d`. Use apenas uma das opções de banco, pois ambas utilizam a mesma porta. Para outro servidor PostgreSQL, ajuste `DATABASE_URL`.

Em outro terminal:

```sh
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Acesse http://127.0.0.1:3000. O seed agora cadastra apenas os 24 veículos reais de `prisma/fleet-data.ts`, transcritos da relação enviada em 28/09/2026. É idempotente, preserva cadastros existentes e não é executado automaticamente. QTO6109 estava duplicada na imagem e foi registrada uma única vez. Placas são armazenadas sem hífen. Perfil e cubagem foram preservados como informados, incluindo 85 m³ para o TOCO; a cubagem do CAVALO não foi informada.

Quilometragem, prefixo, unidade e centro de custo permanecem nulos quando não informados. Status e disponibilidade usam `UNKNOWN` até confirmação operacional; não são contabilizados como disponíveis nem geram pendências diárias fictícias. O primeiro checklist registra a quilometragem real, sem liberar automaticamente o veículo.

Os dados de demonstração foram removidos após conferência integral e backup local em `.local-backups/before-real-fleet-1790619760906.json`. `scripts/remove-reviewed-demo.mjs` registra a limpeza pontual, exige igualdade com esse backup e aborta diante de novos registros ou alterações. Não é parte da inicialização. Não execute os verificadores históricos que dependem de fixtures de demonstração na base operacional; utilize testes unitários e `scripts/verify-real-fleet.ts`.

### Central de Alertas

`/alertas` possui fila persistente, filtros, responsáveis e histórico de atendimento. Resolver, tratar, classificar como não procedente ou encerrar por regra retira da fila, mantendo o registro. Confira [regras e validação da Central de Alertas](docs/CENTRAL-DE-ALERTAS.md).

### Ficha do veículo

Abra um veículo na Frota ou acesse `/frota/QTO6479`. A ficha reúne dez abas, resumo operacional, timeline dos módulos, custos separados por origem, documentos e registro manual de abastecimento. Os links anteriores por ID e o QR Code do checklist continuam disponíveis. Veja [funcionamento e validação da ficha](docs/FICHA-DO-VEICULO.md).

### Checklist do motorista

O acesso público por placa, como `/checklist/QTO6479`, identifica o veículo e orienta a leitura da etiqueta segura. Preencher e enviar exige `/checklist/TOKEN` válido. Tokens UUID anteriores são preservados até regeneração. Não há menu administrativo. Matrícula/identificação e hodômetro são obrigatórios; a matrícula é vinculada ao motorista cadastrado quando encontrada, e a identificação informada é preservada no checklist. Uma identificação sem cadastro também é aceita, sem criar motoristas fictícios.

Os itens são carregados do PostgreSQL conforme o tipo/perfil do veículo, um por tela. OK avança diretamente; PROBLEMA exige uma opção pronta e foto somente quando configurada, com observação opcional (inclusive para Outro). Itens condicionais permitem “Não se aplica”, que não conta como problema nem entra no cálculo de conformidade. O resumo permite corrigir respostas antes do envio. Após uma falha incerta de conexão, o reenvio mantém a mesma chave para evitar duplicatas. Respostas, fotos, ocorrência e atualização do hodômetro são gravadas na mesma transação. Ocorrências e bloqueios seguem as regras dos itens; respostas OK não liberam automaticamente o veículo.

### Motor de criticidade e rastreabilidade

O motor avalia cada resposta PROBLEMA a partir da criticidade padrão e das regras configuradas no item: NORMAL (`LOW`), ATENÇÃO (`MEDIUM`), URGENTE (`HIGH`) e CRÍTICO (`CRITICAL`). Não infere gravidade por palavras no texto livre nem aceita prioridade ou bloqueio enviados pelo motorista. Ajuste a criticidade dos itens na configuração para situações como pneus sem condição de rodagem, superaquecimento ou vazamentos significativos. Configurações existentes são preservadas.

Cada resposta negativa gera um `ChecklistEvaluation` e um alerta, inclusive quando a criação automática de ocorrência está desligada. Quando ligada, uma ocorrência própria é criada por resposta, com a prioridade aplicada. Bloqueio segue a regra do item independentemente da geração de ocorrência ou do nível de criticidade. OK e Não se aplica não acionam o motor nem liberam veículos.

O registro de avaliação mantém a resposta original, regra aplicada, versão da configuração e do motor, data/hora e situação/disponibilidade do veículo antes e após a transação. Respostas e fotos não são apagadas nem substituídas. Chaves únicas impedem avaliações e alertas duplicados; vínculos restritivos protegem a resposta e a ocorrência contra exclusão. A gravação é atômica junto ao checklist, e o reprocessamento não volta a bloquear um veículo liberado posteriormente.

Central de Alertas → Abrir exibe os vínculos para ocorrência e checklist com evidências. Os detalhes do checklist e da ocorrência permitem percorrer a mesma trilha. Registros anteriores ao motor são mantidos sem inventar avaliações retrospectivas.

Teste transacional: `node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/verify-criticality-engine.ts`. Cobre todas as combinações de prioridade/ocorrência/bloqueio e reverte todos os dados ao terminar.

### Administração dos itens

Acesse Configurações → Configurar itens do checklist (`/configuracoes/checklist`). A administração permite criar, editar, desativar e reativar itens, alterar categoria, nome, orientação, ordem, opções de problema, criticidade, obrigatoriedade de foto, geração de ocorrência, bloqueio e permissão de “Não se aplica”. O filtro de tipos usa `Vehicle.profile` (3/4, TRUCK, TOCO, CAVALO na frota atual), ou `Vehicle.category` quando não há perfil. Lista vazia significa todos os tipos, incluindo tipos futuros.

O seed inicial idempotente cadastra 10 categorias e 40 itens; nunca sobrescreve personalizações ou reativa itens desativados. Documento e extintor permitem “Não se aplica”. Inicialmente as fotos e ocorrências estão habilitadas, e os itens de freios/direção têm criticidade crítica e bloqueio. Todas essas regras podem ser ajustadas na administração. Foto, ocorrência e bloqueio são independentes e só se aplicam a respostas PROBLEMA.

Cada envio valida no servidor o conjunto completo aplicável e a versão apresentada. Uma alteração de configuração durante o preenchimento exige recarregar o checklist; reenvios já gravados continuam idempotentes. Cada resposta preserva nome, categoria, criticidade e regras em campos de histórico. Edição e desativação não alteram inspeções anteriores. Edições administrativas concorrentes são detectadas por `updatedAt`.

As configurações ficam em `ChecklistCategory` e `ChecklistItemConfig`; o frontend não possui catálogo definitivo de itens. O conteúdo em `prisma/seed-checklist-config.ts` é apenas a carga inicial. Até 100 itens cadastrados e 30 MB por envio de checklist. Não há exclusão física pela interface.

Validação administrativa: `node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/verify-checklist-config.ts`, com servidor ativo. Usa um perfil e um item temporários e preserva a frota real.

Fotos JPG/PNG/WebP de até 20 MB são convertidas no navegador em JPEG, sem metadados da câmera, até 450 KB. O servidor valida formato, limites e campos obrigatórios. O conteúdo fica no PostgreSQL junto ao registro, sem integração externa; as evidências podem ser vistas em Checklists → Abrir. A migração é aditiva e preserva os registros antigos.

Validação de ponta a ponta: `node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/verify-driver-checklist.ts` com o servidor local ativo. Usa um veículo temporário e o remove ao final, verificando que a frota real não foi alterada.

## Escopo desta entrega

- Dashboard operacional calculado por consultas Prisma, com oito cards clicáveis, fila priorizada de intervenção e filtros de centro de custo, veículo, status, criticidade e período. Consulte [as regras operacionais](docs/DASHBOARD-OPERACIONAL.md).
- Atualização do dashboard a cada 30 segundos enquanto a aba está visível, além de atualização manual. Não utiliza WebSocket.
- Navegação para os 13 módulos solicitados. Listagens consultam o banco e têm pesquisa, filtros, paginação, ordenação textual e exportação CSV com proteção contra fórmulas.
- Documentos acessíveis pelo módulo Frota e pelos relatórios; detalhes do veículo incluem vencimentos.
- Modelos relacionados para veículos, motoristas, checklists e respostas, ocorrências, manutenções, preventivas, pneus, documentos, compras, fornecedores, alertas e configurações.
- Migração SQL versionada e seed separado da interface. Valores monetários são `Decimal` no banco.
- Estados de carregamento, ausência de resultados, erro de banco e página inexistente.

Os módulos administrativos são a estrutura inicial de consulta. Fotos do checklist podem ser consultadas nos detalhes da inspeção. Cadastro/edição completa, aprovação de compras, outros anexos, encerramento de ocorrências e fluxos avançados não fazem parte desta fase. As configurações mostram os parâmetros atuais; não simulam gravação de preferências inexistente.

## Checklist do motorista

Abra Frota → ficha do veículo → Gerar QR Code do Checklist → Visualizar QR Code. É possível imprimir a etiqueta, baixar PDF de 100 × 150 mm ou em A4 e regenerar o token com responsável e motivo. O QR usa um token individual revogável; a placa isolada não autoriza envio. Veja [QR Codes, impressão e revogação](docs/QR-CODES.md).

O servidor valida identificação, quilometragem e os itens aplicáveis, usando as regras configuradas de foto, ocorrência e bloqueio. Um identificador de envio único impede duplicação ao repetir uma solicitação já concluída. Veículos inativos não aceitam novos checklists. A identificação do motorista é autodeclarada nesta fase.

`APP_URL` define o endereço codificado no QR. O valor local não funciona em outro aparelho: para teste físico no celular, configure uma origem alcançável pelo aparelho e execute o servidor em uma interface de rede apropriada. Não exponha a administração sem autenticação.

## Segurança e implantação

Nenhuma integração externa foi implementada. Esta entrega roda localmente: não foi publicada. O ambiente de hospedagem Sites não oferece conexão TCP direta com o PostgreSQL local, portanto o projeto preserva a stack solicitada em vez de trocar seu banco por outro serviço.

O acesso administrativo de desenvolvimento exige `ALLOW_DEV_ADMIN=true`. Em produção, o proxy bloqueia a administração com HTTP 403 independentemente dessa variável. Antes de uma implantação operacional, implementar autenticação de funcionários, autorização por perfil/unidade, política de acesso ao checklist, limitação de requisições, auditoria e infraestrutura PostgreSQL com backup. Não remova o bloqueio sem substituir por autenticação efetiva. O QR é um link de acesso ao formulário, não uma identidade autenticada do condutor.

Os arquivos `.env`, dados do PostgreSQL e binários locais não devem ser versionados. `pnpm start` serve a build e mantém o bloqueio administrativo de produção; para a prévia desta fase use `pnpm dev`.

## Validação

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/verify-real-fleet.ts
node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/verify-driver-checklist.ts
```

O último comando requer o servidor de desenvolvimento e banco ativos, além de Microsoft Edge instalado. Usa Playwright em modo headless para testar o fluxo móvel, fotos, resumo, correções e reenvio. Cria um veículo temporário exclusivo para testar checklist, ocorrência/alerta, idempotência, quilometragem regressiva e origem da requisição. Remove apenas os registros desse veículo ao terminar. Capturas são gravadas em `test-results`.

Para conferir o estado inicial da frota real e do dashboard, use `node --env-file=.env scripts/verify-real-fleet-ui.mjs`. Os scripts históricos `verify.mjs`, `verify-dashboard.mjs` e `verify-data-model.mjs` dependem da antiga base fictícia e não são adequados à base operacional atual.

## Organização

Pedidos de Compras possui nove status, indicadores, controle de paradas e histórico entre módulos. Consulte [o fluxo de compras](docs/COMPRAS.md).

O controle preventivo por veículo e as leituras de KM dos checklists estão documentados em [Preventivas e histórico de quilometragem](docs/PREVENTIVAS.md).

O módulo de manutenção oferece tabela e Kanban, alertas por tempo e histórico de indisponibilidade. Consulte [o fluxo e a validação de manutenções](docs/MANUTENCOES.md).

O módulo de ocorrências possui fluxo de atendimento, numeração anual e histórico preservado. Consulte [regras, auditoria e validação de ocorrências](docs/OCORRENCIAS.md).

O controle de bloqueios e liberações fica nos detalhes do veículo e da ocorrência, com regras em Configurações → Bloqueios e liberações. Consulte [o fluxo e as garantias das restrições operacionais](docs/RESTRICOES-OPERACIONAIS.md).

O modelo foi ampliado sem recriar o projeto. Consulte [o dicionário de dados e relacionamentos](docs/MODELO-DE-DADOS.md) e `prisma/schema.prisma` para os campos, enums, migrações incrementais e política de preservação.

- `src/app/(admin)`: área administrativa e dashboard.
- `src/app/checklist`: formulário independente do motorista.
- `src/app/api/checklist`: persistência transacional do checklist.
- `src/components/ui`: componentes reutilizáveis compatíveis com shadcn/ui.
- `src/lib`: Prisma, consultas, validação e navegação.
- `prisma`: modelos, migração e seed.
- `scripts`: banco local e verificação funcional.

Referências de implementação: [Next.js App Router](https://nextjs.org/docs/app/getting-started) e [Prisma Migrate](https://www.prisma.io/docs/orm/v6/prisma-client/deployment/deploy-migrations-from-a-local-environment).
