# Ocorrências

`/ocorrencias` lista registros reais, com busca, filtros de status/criticidade, ordenação por gravidade e antiguidade e paginação de 20 registros. `/ocorrencias/[id]` contém atendimento, timeline, anexos e rastreabilidade do checklist original.

## Modelo e compatibilidade

- `Incident.publicNumber`: número anual imutável `OC-AAAA-000001`, atribuído por trigger e contador transacional (`IncidentCounter`). O ano considera a abertura no fuso America/Bahia. O número legado permanece preservado. Contadores não devem ser reiniciados nem números reutilizados.
- `Incident.stage`: os 13 status de atendimento. O trigger espelha esse campo no `WorkStatus` anterior para manter dashboards e relatórios compatíveis. Novos consumidores devem escrever `stage`, não `status` diretamente. Liberado/concluído equivalem a COMPLETED; não procede/cancelado a CANCELED; novo a OPEN; demais a IN_PROGRESS.
- `Incident.revision`: controle de concorrência. Cada atendimento incrementa a revisão; alterações desatualizadas retornam HTTP 409 e precisam ser conferidas antes de reenviar.
- Fornecedor, SC e pedido são relacionamentos com cadastros existentes. Uma manutenção só pode ser vinculada ao mesmo veículo e não pode ser retirada de outra ocorrência implicitamente.
- A migration registra um snapshot dos registros legados, sem inventar eventos anteriores. Os seeds continuam idempotentes e não criam dados operacionais fictícios.

## Auditoria

`IncidentEvent` guarda autor, data/hora, tipo, justificativa e snapshots antes/depois. Criação e alterações da ocorrência são auditadas por trigger; comentários, anexos e vínculos de manutenção são eventos adicionais na mesma transação. Um trigger rejeita UPDATE dos eventos e dos anexos. Não existem endpoints de exclusão ou edição do histórico. Chaves restritivas impedem exclusão acidental dos registros relacionados.

Eventos automáticos de checklist preservam seus horários reais. Respostas, fotos e regras originais do checklist não são alteradas durante o atendimento. Datas de auditoria são armazenadas em UTC e exibidas em America/Bahia.

O ambiente existente ainda não tem autenticação administrativa. O formulário exige nome e matrícula/identificação do operador e os registra explicitamente como **autodeclarados**. Isso não comprova a identidade. O proxy e a API mantêm o bloqueio administrativo em produção; substituir a identificação autodeclarada por uma sessão autenticada é requisito para publicação administrativa. Não há conta de usuário fictícia nem senha padrão.

## Regras de atendimento

- Mudança de criticidade exige justificativa; reabertura também.
- Liberado, concluído, não procede e cancelado exigem solução/motivo e registram `resolvedAt`; reabrir limpa somente o estado atual, preservando os encerramentos anteriores no histórico.
- O alerta ligado à avaliação acompanha a criticidade e o estado da ocorrência. A avaliação original permanece imutável.
- Encerrar uma ocorrência **não libera o veículo automaticamente**: outros bloqueios ou manutenções podem existir. O formulário explicita essa regra e oferece acesso à Frota.
- Anexos JPEG, PNG e PDF são armazenados no PostgreSQL (até 5 MB por arquivo), com nome, tipo, tamanho, autor e data. O download administrativo usa `attachment`, `nosniff` e `no-store`; não é exposto na URL pública do motorista.

## Validação

`node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/verify-incidents.ts` requer banco e servidor local ativos e Microsoft Edge. Cria apenas fixtures identificadas pelo teste, valida concorrência, virada anual, status, auditoria, vínculos, anexos, formulário e larguras 1440/768/390. Remove essas fixtures ao terminar e compara toda a frota original. Números consumidos por testes não são reutilizados. Os testes não executam limpeza de dados operacionais reais.
