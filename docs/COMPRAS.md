# Pedidos de Compras

`/compras` concentra solicitações, SC, pedidos e seus vínculos com a operação. A solicitação pode existir antes da SC e do número de pedido. O identificador interno `SOL-...` serve apenas para rastreabilidade e nunca é apresentado como um pedido já gerado. Quando a compra chegar a **Pedido gerado**, preencha o número real, fornecedor e valor.

## Fluxo e indicadores

Status: Pendente, Em aprovação, Aprovado, Recusado, Contingência, Pedido gerado, Aguardando fornecedor, Entregue e Finalizado. Cancelado é preservado para cadastros antigos. As seis categorias solicitadas possuem indicadores clicáveis; busca, veículo, fornecedor e filtro de paradas se aplicam aos indicadores. A tabela tem paginação e rolagem horizontal para todos os campos; status, dias e destaque também ficam junto da descrição.

Dias no status são períodos completos de 24 horas desde a mudança de etapa. O destaque aparece a partir de cinco dias por padrão, ajustável de 1 a 365 dias por solicitação. Alterar observações, valor, responsável ou vínculos não reinicia a contagem. Recusado, Finalizado e Cancelado não são considerados parados. Entregue ainda pode ser destacado enquanto aguarda finalização.

O cálculo é atualizado ao abrir a lista e a cada 30 segundos enquanto ela está aberta. O detalhe tem atualização manual para não substituir campos em edição. Não há notificações externas nem agendador em segundo plano.

## Cadastro e relacionamentos

É possível selecionar ou cadastrar solicitante, responsável, fornecedor e equipamento pelo formulário. Matrícula, CNPJ e código impedem duplicação desses cadastros; o CNPJ exige 14 dígitos, sem consulta externa. Valor desconhecido aparece como “Não informado”, diferente de zero.

SC é compartilhada por pedidos e registros operacionais. Digitar uma SC inexistente cria o cadastro; escolher outra SC religa a compra sem renomear a SC de outros registros. Uma compra pode ser relacionada a várias ocorrências e manutenções do mesmo veículo. O modelo existente permite uma compra por ocorrência/manutenção: vínculos já ocupados não são substituídos silenciosamente. SC e fornecedor são conferidos quando os registros relacionados já possuem esses dados.

Os detalhes de ocorrência e manutenção oferecem atalhos para solicitar ou abrir a compra. Compra vinculada a equipamento não recebe ocorrências/manutenções de veículos. Salvar uma compra nunca altera a disponibilidade ou libera restrições operacionais.

## Histórico e concorrência

Toda alteração exige identificação do operador e motivo/comentário. O banco registra antes/depois com data/hora; o atendimento preserva também os nomes e vínculos que estavam presentes naquele momento. Atualizações de vínculos feitas por Ocorrências ou Manutenções entram no histórico da compra e incrementam sua revisão.

Eventos não podem ser sobrescritos. A interface oferece histórico paginado, sem exclusão. Revisões e transações serializáveis rejeitam gravações sobre um atendimento mais recente. Reenvios de uma nova solicitação usam uma chave única para evitar duplicação. Mudanças de status, inclusive retomada de uma solicitação recusada/finalizada, exigem motivo e permanecem no histórico.

A identificação continua autodeclarada no ambiente local, com a barreira administrativa de desenvolvimento existente. Autenticação de produção e integrações com sistemas de compras não fazem parte deste módulo.

## Migração e validação

A migration `202609300001_purchase_workflow` é aditiva: preserva número, SC, status anterior e vínculos. O status genérico permanece espelhado para compatibilidade. Em registros antigos, o início da etapa usa a última atualização conhecida, explicitamente indicada no evento de migração.

`tests/purchases.test.ts` cobre limites de atraso, dados obrigatórios e coerência dos vínculos. Com banco e servidor ativos, `node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/verify-purchases.ts` verifica cadastro, status, indicadores, filtros, histórico, concorrência e larguras 1440/768/390. Os registros de teste são temporários e removidos ao final; a frota real é comparada antes e depois.
