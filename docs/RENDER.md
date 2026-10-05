# Piloto gratuito: Render + Supabase

O render.yaml cria somente um serviço Next.js Free, com deploy da main. Não cria banco pago no Render. Configurar PostgreSQL no Supabase Free e conferir os custos exibidos antes de aplicar.

## Sequência de implantação

1. Criar projeto Supabase Free e guardar a senha em local privado. Para uso somente via Prisma, desabilitar a Data API antes de importar dados: não expor tabelas operacionais sem RLS. Auth e Storage serão configurados separadamente.
2. Configurar DATABASE_URL no ambiente seguro do servidor. Para Prisma 6 em servidor Node, usar conexão direta ou Supavisor Session na porta 5432, conforme conectividade, com TLS. Copiar host e usuário do painel; não publicar credenciais. Não usar transaction pooling para migrations.
3. Fazer backup atualizado e inspecionar o destino. Executar prisma migrate deploy de forma controlada contra o Supabase, sem reset ou seeds e sem substituir o .env local. Render Free não suporta preDeployCommand; migrations não são automáticas neste Blueprint.
4. Transferir dados preservando IDs, relações, tokens e históricos. Validar contagens e conteúdo. A exportação JSON existente ainda precisa de procedimento de restauração testado. Não apagar o banco local.
5. Conectar o repositório NunoNasc/Controle-de-Frota ao Render e importar render.yaml. Preencher DATABASE_URL e APP_URL com os valores reais; APP_URL deve ser a URL HTTPS do serviço.
6. Validar deploy, acesso ao banco e checklist com foto. A checagem TCP padrão do Render não comprova funcionamento do banco.

## Pendências antes do uso operacional

- Implementar login e autorização administrativos. Manter os bloqueios atuais de produção; não contornar com ALLOW_DEV_ADMIN.
- Implementar armazenamento privado de fotos, limites e acesso autorizado. Não gravar arquivos no disco temporário do Render. Supabase Storage ainda não está integrado.
- Configurar backup externo periódico e testar restauração; este arquivo não cria automação de backup.
- Iniciar com poucos veículos, mantendo o controle operacional atual durante a validação.

Render Free dorme após inatividade; Supabase Free tem cotas e pode pausar. Monitorar uso sem ativar upgrades pagos. O Blueprint não cria conta Supabase nem transfere dados.

Se já existir uma implantação antiga com banco Render, revisar a sincronização antes de aplicar e não excluir dados. Revisar os projetos Vercel após validar a hospedagem nova.

Referências: https://render.com/docs/free e https://supabase.com/docs/guides/database/prisma
