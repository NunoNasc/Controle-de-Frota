# Restrições operacionais

O sistema registra decisões e controla disponibilidade. Não substitui avaliação técnica ou os procedimentos de segurança da empresa. Essa orientação aparece nos avisos e formulários, inclusive no checklist público do motorista.

## Fluxo

1. Uma resposta negativa a um item cuja regra determina bloqueio cria uma `VehicleRestriction` dentro da mesma transação do checklist, vinculada à avaliação original e à ocorrência, quando a configuração gera ocorrência.
2. O estado inicial é `AWAITING_ASSESSMENT` (Aguardando avaliação) ou `BLOCKED` (Bloqueado), definido em `/configuracoes/restricoes`. Ambos tornam o veículo indisponível. Todas as criticidades continuam obedecendo ao sinalizador de bloqueio do item, inclusive CRÍTICO.
3. A Frota avalia cada restrição em `/frota/[id]` ou na ocorrência vinculada. Pode manter pendente, bloquear ou registrar liberação.
4. A liberação exige nome e identificação do responsável, solução aplicada e observação. Data e hora são registradas pelo servidor. Foto JPEG/PNG ou documento PDF (até 5 MB) é obrigatório quando a regra capturada na abertura exigir. A foto original do problema não substitui automaticamente a evidência da liberação.
5. Liberar um problema não remove outros. Somente a última liberação permite escolher a situação do veículo: disponibilidade não informada, disponível após avaliação técnica, em manutenção ou parado por outro motivo. O sistema não presume disponibilidade: a opção inicial é não informada. Manutenções abertas impedem escolher disponível; veículo inativo também não pode ser disponibilizado.

## Preservação e consistência

- `Vehicle.operationalStatus` agrega as restrições ativas: bloqueado prevalece sobre aguardando avaliação. `CLEAR` significa ausência de restrições ativas neste controle, não certificação de segurança.
- `Vehicle.status` e `availability` mantêm o contrato do dashboard e relatórios existentes: durante restrição, ficam STOPPED/UNAVAILABLE. A interface da Frota exibe o estado operacional específico.
- Triggers impedem marcar disponível um veículo que ainda tenha restrição ativa. Um lock por veículo e transações serializáveis impedem liberações simultâneas de ignorar outras restrições; conflitos retornam 409.
- `RestrictionEvent` registra cada decisão, responsável, solução, observação, data e snapshots. Eventos e evidências não podem ser atualizados. Não existem endpoints de edição/exclusão de histórico. Uma restrição liberada é imutável; novos problemas geram novos registros.
- Uma constraint adiada até o commit impede liberação sem a evidência obrigatória. A decisão e o arquivo são confirmados juntos, ou ambos revertidos.
- Respostas, fotos e regras originais dos checklists permanecem preservadas. Reprocessar o mesmo checklist não cria restrições duplicadas nem bloqueia novamente uma restrição já liberada.
- Concluir ou cancelar uma ocorrência não libera o veículo. A liberação operacional possui seu próprio registro. O marcador atual de bloqueio da ocorrência é atualizado após decisões operacionais, com auditoria na timeline.
- As migrations importam bloqueios anteriores ainda refletidos como STOPPED/UNAVAILABLE, mantendo os vínculos e distinguindo a data da detecção da data de criação do novo controle. Não inferem bloqueios de veículos parados por motivos desconhecidos.

## Configuração e acesso

`Setting.operational-restrictions` controla o estado inicial e a exigência de evidência. O padrão é aguardando avaliação, com evidência obrigatória. A política é capturada em cada nova restrição; mudanças não removem exigências antigas. Alterações administrativas possuem histórico em `RestrictionPolicyEvent`.

O ambiente continua sem autenticação administrativa: responsável e identificação são autodeclarados, explicitamente rotulados assim. O acesso administrativo em produção permanece bloqueado. Antes da publicação, esses dados devem vir de uma sessão autenticada e de permissões de liberação. O checklist público mostra somente o aviso operacional, sem histórico, responsáveis ou evidências administrativas.

## Verificação

- `tests/restrictions.test.ts`: campos obrigatórios, exigência de evidência, estado terminal e revisão.
- `scripts/verify-restrictions.ts`: fluxo completo no Edge, duas restrições simultâneas, bloqueio sem ocorrência, liberação, evidências, manutenção, política, resposta original, reprocessamento e responsividade (1440/768/390).
- `scripts/verify-restriction-guards.ts`: rejeição de liberação sem evidência diretamente no banco, com rollback integral.

Os scripts funcionais usam fixtures próprias e removem somente essas fixtures. O teste completo altera temporariamente a política para exercitar as opções e a restaura ao final; execute-o em ambiente local de desenvolvimento sem atendimento concorrente.
