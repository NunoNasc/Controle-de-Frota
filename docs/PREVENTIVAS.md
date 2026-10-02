# Controle preventivo e quilometragem

Em **Preventivas**, escolha um veículo para configurar intervalo, última preventiva (KM e data), próximo KM, data prevista, antecedência e tolerância. O próximo KM é calculado como última preventiva + intervalo. Quando o último KM é desconhecido, é possível informar diretamente o próximo limite. Datas são independentes do intervalo em KM; nenhuma data é estimada sem informação da Frota.

Os estados usam o critério mais grave entre KM e data:

- **Em dia:** ainda fora da faixa de antecedência.
- **Próxima:** faltam até os KM ou dias configurados como antecedência.
- **Atenção:** limite atingido e tolerância ainda não esgotada.
- **Vencida:** tolerância esgotada. Sem tolerância de KM, vence ao atingir o limite. Datas usam calendário de Brasília/Bahia: a data prevista fica em atenção até o fim do dia; sem tolerância, vence no dia seguinte. Com tolerância de dois dias, vence no início do segundo dia após a data prevista.

Valores padrão de um novo formulário: antecedência de 1.000 km / 7 dias, tolerância zero. Os valores são gravados por veículo e podem ser alterados. Não existe autorização automática para rodar dentro da tolerância. O plano técnico e a avaliação da empresa permanecem necessários.

KM ou limites desconhecidos são explicitamente indicados como não avaliados. O dashboard possui contadores dos quatro estados, pendências e próximos vencimentos, respeitando os filtros de frota e criticidade. Configurações anteriores dos campos de preventiva no veículo são preservadas pela migration; programações antigas em `Preventive` continuam visíveis e consideradas no dashboard, sem exclusão ou transformação destrutiva.

## Leituras

Todo novo checklist válido registra uma leitura com data/hora, identificação, KM informado, KM anterior e vínculo ao original. Se o KM for maior, atualiza o veículo; se igual, registra sem alterar; se inferior, preserva o veículo e o checklist, marca a leitura como possível erro e cria alerta na Central de Alertas. O motorista recebe aviso antes de iniciar e na confirmação de envio.

Reenvios com a mesma chave não duplicam checklist, leitura ou alerta. Transação serializável e bloqueio do veículo protegem leituras concorrentes. Conflitos solicitam reenvio com a mesma chave. O cadastro administrativo não permite redução; novas leituras maiores digitadas pela Frota também entram no histórico. Correção de hodômetro/troca de instrumento exige um fluxo futuro específico: não há redução automática nem botão para apagar leituras.

A migration registra o valor atual conhecido como **Cadastro anterior**, na data de introdução do histórico, sem inventar a data da medição. Checklists antigos permanecem disponíveis em sua origem e não recebem leituras históricas inferidas. Leituras novas são paginadas na tela do veículo. Configurações mantêm snapshots de antes/depois; leituras e snapshots não podem ser sobrescritos.

## Alertas e próximos ciclos

Alertas preventivos são atualizados imediatamente após leituras/configuração e ao abrir Dashboard, Preventivas ou Central de Alertas. Listas abertas atualizam a cada 30 segundos. Não há processamento periódico com a aplicação fechada nem integração externa. Corrigir o plano ou registrar a última preventiva inicia um novo ciclo e encerra o alerta preventivo anterior quando fica em dia. Alertas de leitura inferior permanecem registrados para conferência; um KM posterior maior não apaga a divergência.

Concluir uma ordem de manutenção não altera automaticamente o plano: a Frota registra o KM/data efetivamente atendidos e o novo prazo na configuração, com justificativa. Nenhuma mudança de preventiva libera restrições operacionais.

## Validação

`tests/preventive.test.ts` cobre fronteiras, tolerâncias, datas, cálculo e dashboard. `scripts/verify-preventives.ts` valida configuração na interface, envio maior/igual/menor, reenvio idempotente, concorrência, histórico, alertas e larguras 1440/768/390, usando registros temporários removidos ao final. Execute com banco e servidor ativos:

```sh
node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/verify-preventives.ts
```
