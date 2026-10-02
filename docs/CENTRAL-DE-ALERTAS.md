# Central de Alertas

`/alertas` mostra a fila persistente de **novos** e **em atendimento**. Abrir um alerta não altera seu status. Há visões separadas de encerrados e de todos os registros, com filtros por categoria, prioridade, veículo, responsável (inclusive não atribuído), período de abertura e texto. A ordenação é crítica, alta, média, baixa e, dentro da prioridade, maior tempo aguardando primeiro. Tabelas e histórico são paginados.

## Atendimento e histórico

Em `/alertas/ID`, informe responsável, ação necessária e motivo do atendimento. As saídas manuais da fila são **Resolvido**, **Tratado** e **Não procedente**. O motivo e a identificação do operador são obrigatórios; a identificação segue o ambiente administrativo local e é autodeclarada. É possível cadastrar responsável ou selecionar um existente. Novo atendimento com o mesmo status registra um comentário. Reabrir exige novo atendimento com motivo.

**Encerrado por regra** é exclusivo das rotinas automáticas e registra a condição de encerramento. O alerta e seu histórico continuam consultáveis. Atender um alerta não conclui sua manutenção, não altera respostas de checklist e não libera o veículo. Use o registro de origem para essas decisões.

`AlertEvent` armazena usuário, data, motivo e snapshots anteriores/posteriores. Triggers registram também alterações feitas por outros módulos, protegem eventos contra sobrescrita e impedem excluir um alerta com histórico. Não há API de exclusão. Controle de revisão e transação serializável rejeitam atendimentos concorrentes desatualizados. As decisões aparecem também na timeline da ficha do veículo.

O tempo aguardando para no encerramento. A reabertura inicia outro ciclo; os tempos e decisões anteriores permanecem nos snapshots. Alertas antigos são preservados com um evento de implantação, sem inventar histórico anterior. Nos registros antigos encerrados, a última atualização é usada como aproximação e essa limitação fica registrada.

## Geração e encerramento automático

| Categoria | Origem / condição | Encerramento automático |
|---|---|---|
| Checklist | Resposta negativa processada pelo motor | Quando a ocorrência vinculada é encerrada; sem ocorrência, exige atendimento manual |
| Manutenção | Atraso, indisponibilidade ou previsão ultrapassada, conforme limites existentes | Serviço encerrado ou condição de atraso deixa de existir |
| Preventiva | Faixa próxima, atenção ou vencida do plano; erro de KM também é preservado | Plano em dia, veículo inativo ou ausência de critério avaliável; erro de KM exige atendimento manual |
| Documentação | Validade anterior ao dia atual, calendário da Bahia | Validade regularizada |
| Pedido | Dias sem mudança de status atingem o limite configurado | Nova etapa sem atraso ou pedido encerrado |
| Pneu | Condição explicitamente cadastrada como atenção, urgente ou crítica | Condição cadastrada deixa essas faixas |
| Ocorrência | Ocorrência aberta sem alerta de checklist já vinculado | Status final conforme o módulo de ocorrências |

Pneus não recebem um limite técnico de sulco inventado pelo sistema. O alerta solicita avaliação técnica. Os textos de detecção são snapshots; a origem fornece a situação atual.

Alertas tratados não são reabertos a cada atualização da tela. Uma condição que deixa de existir e retorna, ou uma elevação da prioridade após atendimento, inicia novo ciclo com evento explícito. Uma redução de prioridade não reabre o alerta. Duplicações são evitadas por vínculos únicos e chave de origem.

A reconciliação ocorre ao acessar a Central de Alertas ou o dashboard, incluindo atualização automática a cada 30 segundos quando a página está visível. Manutenção, preventiva e checklist também mantêm seus pontos existentes de gravação. Não há serviço externo nem monitoramento em segundo plano com o aplicativo fechado.

## Validação

`scripts/verify-alerts.ts` usa um veículo temporário para testar as sete categorias, atendimento pela interface, filtros, encerramentos, regras, recorrência, agravamento, concorrência, histórico imutável e telas de 1440/768/390 px. Ao terminar, remove apenas seus registros e confere a preservação da frota. Execute os verificadores de integração sequencialmente.
