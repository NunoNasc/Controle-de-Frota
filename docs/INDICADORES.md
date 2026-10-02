# Indicadores operacionais

Rota administrativa `/indicadores`, acessível pelo menu e por Relatórios. Consulta parametrizada em `src/lib/indicators.ts`; nenhuma gravação ou dado fictício é usado pelo módulo. Não exige alteração de esquema.

## Filtros

Período inicial/final (padrão: últimos 30 dias), veículo, tipo e centro de custo. Tipo usa o perfil do veículo, com categoria como alternativa. Datas inválidas, invertidas ou futuras são recusadas. Datas representam dias inclusivos em America/Bahia; o fim de hoje é limitado à hora da consulta. A conexão usa UTC dentro da transação para interpretar corretamente as colunas de timestamp do Prisma.

Veículo, tipo e centro de custo valem para todos os indicadores. Classificações usam o cadastro atual. Histórico inclui veículos inativos; posição atual inclui somente ativos não classificados como inativos.

## Critérios

- **Disponibilidade atual:** ativos disponíveis ou em uso, disponibilidade confirmada e sem restrição / ativos. Se houver status ou disponibilidade desconhecida, a taxa fica sem base, com contagens visíveis. Não representa disponibilidade histórica em horas.
- **Parados atuais:** ativos indisponíveis, parados, em manutenção ou restritos, sem duplicar o veículo.
- **Tempo médio parado:** média dos intervalos de manutenção/restrição que intersectam o período, recortados nas datas escolhidas. Sobreposições e intervalos contíguos são unidos por veículo. Falta de início registrado não vira duração zero. Uma parada cancelada que de fato ocorreu permanece no histórico.
- **Ocorrências por veículo/categoria e críticas:** abertura dentro do período, excluindo canceladas e não procedentes; criticidade atual.
- **Reincidência:** ocorrências além da primeira com mesmo veículo, categoria e título normalizado por espaços e caixa dentro do período. É identificação de repetição textual, não diagnóstico técnico.
- **Solução:** média abertura–solução entre ocorrências liberadas/concluídas cuja solução está no período; inclui abertura anterior ao período.
- **Preventivas no prazo:** mudanças de ciclo no histórico do plano, com data da última preventiva no período e comparação aos limites do ciclo anterior, sem tolerância. O cadastro inicial é excluído; eventos repetidos do mesmo ciclo são unidos. Atraso comprovado em uma dimensão é atraso; falta de outra dimensão impede afirmar cumprimento. Legados sem KM realizado ficam sem avaliação quando não há atraso comprovado por data. Registros legados no mesmo dia de ciclo do mesmo veículo não são duplicados. Manutenção sem atualização do ciclo não comprova cumprimento.
- **Preventivas vencidas atuais:** veículos distintos com plano vencido conforme regra de data/KM e tolerância, ou preventiva legada pendente vencida. Veículos sem plano são explicitados.
- **Custos por veículo/tipo:** soma decimal no banco dos custos conhecidos de serviços concluídos no período. Valores zero conhecidos são válidos; valores ausentes não entram na soma e são contados separadamente. Orçamentos e pedidos não são despesas adicionais. Preditiva e tipo não informado continuam separados.
- **Checklists:** enviados/revisados no período; rascunhos e cancelados não contam. Conformidade = respostas OK / respostas aplicáveis; não se aplica fica fora do denominador.
- **Ranking de problemas:** ocorrências válidas abertas no período mais respostas negativas no período sem ocorrência vinculada. A resposta original e a ocorrência vinculada não duplicam o problema. Ranking descendente com link à ficha.

Os cartões mostram denominadores e lacunas. Uma consulta sem base retorna `null`, não uma taxa artificial de zero ou 100%.

## Validação

`tests/indicator-filters.test.ts` cobre datas/fuso e ausência de base. `scripts/verify-indicators.ts` cria e remove registros exclusivos de teste e compara a frota real antes/depois. Cobre sobreposição de paradas, filtro de datas, valores decimais, custos ausentes, repetição, ciclo preventivo, conformidade ponderada, filtro por veículo/tipo/centro, parâmetros adversariais, navegação e larguras 390/768/1440.
