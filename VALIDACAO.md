# Validação da entrega inicial

Data: 28/09/2026. Ambiente: Windows, Node.js 24.19.0, Next.js 16.3.6, PostgreSQL 18.4 e Prisma 6.19.3.

## Verificações executadas

- TypeScript estrito: aprovado.
- ESLint: aprovado, sem avisos.
- Build otimizada Next.js: aprovada.
- Migração inicial SQL: aplicada ao PostgreSQL local.
- Testes unitários da validação: 3 aprovados, cobrindo preenchimento, duplicação/ausência de respostas e valores inválidos.
- Playwright no Microsoft Edge: aprovado, sem erros de JavaScript no navegador.

## Fluxos conferidos

- Carregamento do dashboard e todas as páginas dos módulos, incluindo documentos.
- Menu lateral recolhível e navegação móvel.
- Filtro de unidade e alteração dos indicadores.
- Busca por placa, estado sem resultados e limpeza de filtros.
- Exportação CSV e página de detalhes com QR Code.
- Dashboard em 1440×1100, 820×1180 e 390×844, sem rolagem horizontal da página.
- Formulário móvel do motorista sem navegação administrativa.
- Envio e persistência de checklist com seis respostas.
- Criação transacional de ocorrência e alerta a partir de problema informado.
- Indisponibilidade do veículo quando a ressalva envolve freios.
- Reenvio idempotente, sem duplicar checklist, ocorrência ou alerta.
- Rejeição de quilometragem regressiva e origem não permitida.
- Resposta 404 para token inválido.
- Remoção dos registros temporários de teste ao encerrar.

Capturas locais em `test-results`: `dashboard-desktop.png`, `dashboard-tablet.png`, `dashboard-mobile.png` e `checklist-mobile.png`.

## Limites desta fase

Esta é uma base de desenvolvimento com dados fictícios. A atualização do dashboard ocorre por consulta a cada 30 segundos, não por WebSocket. Os módulos administrativos oferecem consultas e exportação; os fluxos completos de edição/aprovação serão desenvolvidos posteriormente. A administração é bloqueada em produção até a implementação de autenticação. O uso do QR em outro aparelho depende de uma origem configurada e acessível por esse aparelho. Nenhuma integração externa ou publicação foi realizada.

## Evolução do modelo de dados — segunda entrega

- Migração incremental `202609280002_data_model` aplicada, sem reset, exclusão de tabelas ou remoção de colunas.
- Todos os 251 registros anteriores e seus campos originais comparados com o snapshot local: preservados, inclusive QR tokens e timestamps existentes.
- Novas tabelas auxiliares: centro de custo, responsável/solicitante, equipamento, SC e evidência.
- Seed ampliado executado novamente: sem duplicação nem alteração de valores ou timestamps.
- Testes de banco aprovados: limites de conformidade, coordenadas completas/válidas, quilometragem, orçamento e valores de compra não negativos, chaves estrangeiras, proprietário único de anexo, ativo único por pedido, OS única, proteção do histórico, disponibilidade compatível e datas de manutenção.
- Relacionamentos verificados do veículo ao checklist, ocorrência, manutenção, SC, pedido, fornecedor e anexos.
- Numeração automática e timestamps verificados em transações revertidas, sem deixar registros de teste.
- Cinco testes unitários aprovados, incluindo cálculo de conformidade e localização opcional.
- Testes de navegador aprovados novamente: módulos, filtros, exportação, QR, desktop/tablet/celular e envio persistido.
- API validada com vínculo de motorista cadastrado, localização, tipo pós-viagem, criticidade dos itens, bloqueio do veículo, ocorrência vinculada, idempotência e rejeição de motorista inexistente.
- TypeScript, ESLint e build de produção aprovados após as alterações.

Detalhamento em [MODELO-DE-DADOS.md](docs/MODELO-DE-DADOS.md). Fotos/evidências são metadados nesta fase; upload e armazenamento externo não foram implementados.

## Dashboard operacional — terceira entrega

- Oito indicadores clicáveis, com listagens que usam os mesmos critérios e preservam os filtros.
- Fila Requer ação ordenada globalmente por prioridade e antiguidade antes da paginação.
- Seções de status, manutenção em execução, preventivas próximas e checklists com não conformidade.
- Cinco filtros conferidos: centro de custo, veículo, status, criticidade e período.
- 13 testes unitários aprovados: oito de regras do dashboard e cinco de checklist.
- Navegador: cards reconciliados com o banco, destinos dos oito cards, filtros combinados, registro selecionado no módulo e retorno à lista completa, ordenação entre páginas e estado vazio.
- Responsividade conferida em 1920×1080, 1440×1000, 820×1180 e 390×844; as dez colunas da fila cabem no monitor de escritório de 1920 pixels. Em telas menores, a rolagem fica restrita à tabela.
- Regressão dos 13 módulos, exportação, QR e envio do checklist aprovada.
- TypeScript, lint e build aprovados; não houve erros de JavaScript nos testes de navegador.
- Nenhuma alteração de schema/seed foi necessária. Os valores anteriores foram novamente comparados com o snapshot e preservados.

Capturas `test-results/operational-1920.png`, `operational-1440.png`, `operational-820.png` e `operational-390.png`. Regras e limites detalhados em [DASHBOARD-OPERACIONAL.md](docs/DASHBOARD-OPERACIONAL.md).
