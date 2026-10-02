# Dashboard Operacional

O dashboard consulta os registros existentes e não grava nem altera dados de negócio. Não foram necessárias migrations ou novas cargas de seed nesta entrega. A leitura usa uma transação `RepeatableRead`, mantendo consistência entre indicadores e listas dentro da mesma atualização.

## Indicadores

| Card | Critério |
| --- | --- |
| Frota Total | Veículos cadastrados que correspondem ao recorte, incluindo inativos |
| Disponíveis | Ativos, status `AVAILABLE` e disponibilidade `AVAILABLE`; veículos em uso não são contados como prontos para saída |
| Em Manutenção | Veículos com status `MAINTENANCE`; é quantidade de veículos, não de OS |
| Parados | Veículos ativos com status `STOPPED` |
| Alertas Críticos | Registros de `Alert` com prioridade crítica e status aberto/em andamento |
| Checklists Pendentes | Veículos ativos aptos à operação, disponíveis ou em uso, sem checklist de saída válido no dia da Bahia |
| Preventivas Vencidas | Preventivas não concluídas de veículos ativos, com data anterior a hoje ou quilometragem limite atingida |
| Ocorrências Abertas | Ocorrências `OPEN` ou `IN_PROGRESS` |

Os oito cards abrem `/painel/[view]` com os filtros preservados. A listagem usa a mesma função de cálculo do card. Atualizações concorrentes legítimas podem alterar os números entre dois acessos. Os registros de uma lista abrem o veículo ou o módulo existente com `?record=id`; o módulo permite voltar à lista completa.

## Requer ação

A tabela mostra prioridade, placa, veículo, problema, origem, data de detecção, tempo em aberto, responsável, status e ação. A ordenação global acontece antes da paginação: crítico, urgente, atenção e normal; depois, registros mais antigos. Datas desconhecidas ficam no fim da respectiva prioridade.

Entram na fila:

- Ocorrências e alertas ainda não resolvidos.
- Checklist diário ausente.
- Não conformidades de checklists enviados e ainda não revisados.
- Preventivas vencidas por prazo ou km.
- Manutenções aguardando início na data programada ou com previsão de entrega excedida.
- Documentos vencidos de veículos ativos.
- Veículo parado sem ocorrência aberta para acompanhamento.

Não entram manutenções em execução dentro do prazo, registros concluídos/cancelados, checklists conformes ou já revisados, nem preventivas distantes do vencimento.

Um alerta que repete exatamente o problema do mesmo veículo de uma ocorrência aberta é representado pela ocorrência, desde que ela tenha prioridade igual ou maior. Uma não conformidade com ocorrência aberta visível é representada por essa ocorrência na fila; o checklist continua disponível em sua seção. Alertas com gravidade superior não são descartados. Os cards de alertas e ocorrências continuam medindo suas entidades separadamente.

Registros sem responsável mostram **Não atribuído**, sem presumir que o motorista seja o analista responsável. Para vencimento exclusivamente por km e veículo parado sem histórico de detecção, data e idade mostram **Não registrado**. Não se usa a última edição do veículo como se fosse uma detecção real. No vencimento por data, a detecção corresponde ao início do dia seguinte ao prazo, no fuso `America/Bahia`.

## Seções operacionais

- **Status da frota:** contagem por estado atual, sem gráfico decorativo. Cada estado abre os veículos relacionados.
- **Manutenções em andamento:** OS em execução, fornecedor, previsão e responsável; atraso ganha prioridade urgente.
- **Preventivas próximas do vencimento:** até 7 dias ou 1.000 km restantes, excluindo as já vencidas. Mostra ambos os limites para planejar a parada.
- **Checklists com não conformidade:** enviados com problema e aguardando revisão; mostra motorista e conformidade, preservando o responsável operacional quando há ocorrência vinculada.

## Filtros e períodos

Centro de custo, veículo e status do veículo delimitam o conjunto da frota e os registros associados. **Não informado** permite consultar os veículos antigos sem centro de custo, sem confundir centro de custo com unidade. Ao mudar o centro, o filtro de veículo é limpo para evitar seleções incompatíveis.

Criticidade filtra os registros por prioridade e restringe a frota aos veículos associados a registros dessa prioridade nas seções operacionais. Alertas gerais sem veículo permanecem visíveis apenas quando não há recorte por centro, veículo ou status.

O período padrão é **Todas as datas**, preservando pendências antigas. Há opções Hoje, últimos 7 dias e últimos 30 dias, contadas pelo calendário da Bahia. O período atua na data de detecção de ocorrências, alertas, não conformidades, documentos, serviços pendentes e preventivas vencidas por data; nas manutenções em execução, usa a entrada ou programação quando não há entrada conhecida. Pendências sem data conhecida não desaparecem ao aplicar um período.

Os números de veículos representam o estado atual, não uma reconstrução histórica. O checklist diário sempre considera hoje; as preventivas próximas usam o horizonte futuro. Essas diferenças são indicadas no painel para evitar interpretação incorreta.

## Regras configuráveis

A tabela `Setting` pode conter a chave `dashboardPolicy` com o valor:

```json
{"upcomingDays": 7, "upcomingKm": 1000}
```

Os limites aceitos são 1–90 dias e 1–10.000 km. Na ausência de configuração válida são usados 7 dias e 1.000 km. Não foi acrescentado formulário de configuração nesta etapa.

O checklist diário é considerado cumprido por inspeção `PRE_TRIP` ou legado `UNSPECIFIED`, enviada/revisada hoje e com resultado avaliado. Rascunhos, cancelados, pós-viagem e inspeções inteiramente não aplicáveis não satisfazem a inspeção de saída. Uma ressalva não torna o checklist ausente: sua intervenção aparece como não conformidade/ocorrência.

## Atualização e validação

Atualização automática a cada 30 segundos enquanto a aba estiver visível, com botão de atualização manual. Filtros ficam na URL; a paginação é reiniciada quando eles mudam.

Testes de domínio em `tests/dashboard.test.ts` cobrem limites de data/km, meia-noite da Bahia, prioridade, deduplicação, filtros e exclusão de concluídos. `scripts/verify-dashboard.mjs` confere cards com o banco, links, filtros combinados, ordenação paginada, estado vazio e telas de 1920, 1440, 820 e 390 pixels. `scripts/verify.mjs` continua verificando os módulos e o fluxo de envio do motorista.

As ações desta entrega abrem registros existentes; não simulam atribuição de responsável, revisão ou encerramento ainda não implementados nos módulos administrativos.
