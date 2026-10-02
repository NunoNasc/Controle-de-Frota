# Conferência rápida do checklist

- Identificação obrigatória, sem aceitar somente espaços; KM inteiro entre 0 e 9.999.999.
- Último KM, placa, modelo e prefixo ficam visíveis antes do preenchimento.
- Leitura inferior ou aumento acima de 1.000 km solicita conferência do hodômetro com uma opção de confirmação, sem justificativa escrita. O limite é um aviso, não uma proibição de viagem longa; a regra compartilhada está em `src/lib/mileage-validation.ts`.
- Editar o KM desfaz a confirmação. O servidor exige confirmação contra o último KM disponível, dentro da transação. Se esse valor mudou, as respostas são preservadas e o formulário solicita nova conferência.
- Leituras inferiores continuam no histórico e geram alerta; nunca reduzem automaticamente o KM cadastrado. Aumentos confirmados atualizam o cadastro.
- Problemas usam opções administráveis. Foto é obrigatória somente quando configurada; observação permanece opcional.
- O resumo permite editar respostas. O botão Enviar checklist confirma a inspeção. Durante o envio, há trava contra cliques repetidos; retentativas usam a mesma chave única e retornam o registro existente.
- Data e hora são geradas pelo banco. A conclusão mostra sucesso, protocolo e horário do registro (no fuso do dispositivo).

Validação automatizada: `tests/mileage-validation.test.ts`, `tests/driver-inspection.test.ts` e `scripts/verify-driver-checklist.ts`, incluindo mudança concorrente do KM, foto obrigatória, falha de rede, reenvio e tamanhos 390/768/1440.
