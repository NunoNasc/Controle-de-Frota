# Painel Operacional

Rota `/painel`, acessível pelo menu administrativo. Layout independente, sem menu lateral, voltado a monitor/TV. Mantém a proteção administrativa existente; o QR Code do motorista não autoriza este painel.

- Atualização automática a cada 30 segundos, sem requisições simultâneas. Consulta também ao voltar à aba ou recuperar conexão.
- Falha de consulta preserva os últimos dados e mostra aviso. Horário de atualização só muda após sucesso; após 65 segundos sem atualização há sinalização de dados antigos. Timeout de requisição: 20 segundos.
- Relógio e datas em America/Bahia. Tela cheia pela API do navegador; Esc sai. Navegadores sem suporte recebem orientação para usar F11.
- Disponibilidade: ativos aptos, incluindo em uso e sem restrição. Cadastro incompleto ou frota vazia exibe “Sem base”.
- Parados: veículos ativos indisponíveis, em manutenção, parados ou com restrição, sem dupla contagem.
- Alertas críticos: prioridade crítica nas etapas Novo/Em andamento da fila persistente. Tratados não entram novamente pela simples consulta.
- Manutenções: etapas Em manutenção/Teste.
- Checklists com problema: enviados com não conformidade e ainda não revisados.
- Preventivas vencidas: veículos ativos distintos com plano vencido conforme data/KM/tolerância, ou preventiva legada pendente vencida.
- Ocorrências sem responsável: abertas, sem vínculo de responsável e sem etapa final.

As filas mostram até quatro alertas críticos (mais antigos) e quatro ocorrências sem responsável (maior criticidade, depois mais antigas). Os totais sempre abrangem a fila completa, com indicação do limite exibido. Os links abrem os módulos/registros. Não há animação, rotação de páginas ou avanço automático de listas.

`scripts/verify-operational-panel.ts` valida consultas reais, atualização automática, falha/recuperação, relógio, timestamp, tela cheia, navegação e dimensões 1920×1080, 1366×768, 768×1024 e 390×844. Registros temporários são removidos; a frota real é comparada antes/depois.
