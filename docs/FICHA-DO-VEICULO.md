# Ficha do veículo

Endereço canônico: `/frota/PLACA`, por exemplo `/frota/QTO6479`. Links anteriores por ID continuam válidos. Placas em minúsculas ou com hífen também são reconhecidas. A tabela Frota abre a ficha pela placa.

As dez abas consultam o PostgreSQL, sem dados operacionais fictícios. Listas e histórico possuem paginação. O resumo apresenta o estado operacional registrado, quilometragem, centro de custo, próxima preventiva, disponibilidade e contagem de ocorrências abertas. O motorista apresentado é explicitamente o do último checklist válido; não representa uma atribuição permanente.

## Histórico

A timeline combina registros e eventos originais de checklists, respostas negativas, ocorrências, manutenções, compras, SCs, restrições, preventivas, leituras de KM, abastecimentos, documentos e pneus. Cada evento aponta para seu módulo de origem. A consulta não reescreve históricos nem cria eventos retrospectivos baseados no status atual.

Uma decisão de liberação de restrição só aparece como “Veículo liberado” quando seu snapshot registra situação operacional livre e veículo disponível. Caso contrário, aparece como “Restrição liberada”. Datas de serviço podem anteceder o cadastro; as datas originais são preservadas. Eventos com datas iguais têm ordenação estável.

SCs e compras usam os vínculos atuais; eventos de compras também conservam a participação anterior do veículo pelos snapshots. Pneus exibem o vínculo atual: o cadastro existente ainda não registra todo o histórico de alocações. Documentos mostram validade e arquivo quando cadastrado; protocolos executáveis são rejeitados.

## Custos e abastecimentos

Valores realizados de manutenção, abastecimentos e compromissos de compra são apresentados separadamente. Não há soma duplicada de um pedido já incorporado à manutenção. Valores desconhecidos permanecem identificados como não informados. Os indicadores cobrem todo o período registrado, não constituindo fechamento contábil.

A aba Abastecimentos permite registro manual de data/hora, KM, combustível/insumo, litros, valor, posto, observação e identificação do operador. Não há integração externa. O registro não modifica o hodômetro atual. A API valida precisão e campos obrigatórios, rejeita datas futuras e impede duplicação por chave de envio. A migration `202609300002_vehicle_fuel_records` adiciona a tabela sem alterar a frota; um trigger impede sobrescrever abastecimentos. Não há edição ou exclusão pela interface. A identificação do operador é autodeclarada, conforme o ambiente administrativo local existente.

## Validação

Com PostgreSQL e `pnpm dev` em execução:

```sh
node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/verify-vehicle-record.ts
```

O verificador cria um veículo isolado, testa as dez abas, timeline, paginação, cadastro manual, API, imutabilidade, custos e larguras de 1440, 768 e 390 px. Remove seus registros ao terminar e compara a frota com o snapshot anterior. Execute os verificadores de integração sequencialmente, sem outros processos de edição de dados.
