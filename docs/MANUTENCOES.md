# Manutenções

O módulo `/manutencoes` oferece tabela e Kanban, filtros por placa/problema/OS/ocorrência, tipo, etapa e alertas. Registra preventiva, corretiva e preditiva, com nove etapas até a conclusão. Abra o cartão para alterar a etapa e identificar o atendimento. Cadastros antigos sem tipo reconhecido permanecem “Não informado” até classificação explícita.

Cada serviço permite relacionar ocorrência, responsável, fornecedor, SC e pedido, além de OS, orçamento, valor aprovado, valor realizado, quilometragem, entrada, programação e previsão. Valores desconhecidos são exibidos como não informados, sem inventar custo zero. A ocorrência oferece atalho para solicitar manutenção e recebe eventos com vínculo ao atendimento.

## Indisponibilidade e restrições

“Indisponível desde” é um registro explícito: solicitar ou programar um serviço não implica retirar o veículo de operação. O início não pode ser substituído após registrado. A conclusão fecha o período e congela a duração em dias, horas e minutos. Períodos de diferentes serviços simultâneos não devem ser somados; o card conta veículos distintos.

Durante uma indisponibilidade ativa, o banco mantém o veículo em manutenção/indisponível. Restrições operacionais têm precedência e mantêm o veículo parado. Concluir manutenção não libera restrições nem confirma disponibilidade: após o último período, a situação fica não informada para conferência da Frota. A avaliação técnica e os procedimentos de segurança permanecem responsabilidade da empresa.

## Alertas e histórico

Limites por manutenção: atenção após 48 horas e crítico após 120 horas, ajustáveis no formulário. O cálculo considera tempo na etapa, indisponibilidade e atraso da previsão. Programação futura não gera atraso de etapa antecipado; comentários não reiniciam o relógio. Previsão vencida gera urgência, escalando conforme o limite crítico.

Alertas são persistidos e atualizados ao abrir Manutenções, Dashboard ou Central de Alertas, e após salvar. As listas abertas atualizam a cada 30 segundos. Não há agendador em segundo plano nem notificações externas com a aplicação fechada.

Cada gravação gera histórico com antes/depois, data/hora e identificação autodeclarada do operador. Histórico não pode ser sobrescrito. Revisões impedem gravações sobre alterações concorrentes; chave de envio evita duplicação por reenvio. Serviços encerrados ficam somente para consulta. O ambiente administrativo continua local e protegido para desenvolvimento; autenticação de produção ainda não foi implementada.

## Validação

Migrações aditivas `202609290007_maintenance_workflow` e `202609290008_maintenance_legacy_status` preservam dados anteriores e compatibilidade com status antigos. Nenhum seed fictício é necessário.

`tests/maintenance.test.ts` valida relógios, limites e campos condicionais. Com servidor e banco ativos, execute `node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/verify-maintenance.ts` para verificar interface, etapas, alertas, bloqueios, concorrência e responsividade. O script usa um veículo temporário e remove seus dados ao final, comparando a frota real antes e depois.
