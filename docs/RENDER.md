# Implantação no Render

O `render.yaml` prepara um serviço Next.js e PostgreSQL na mesma região, com deploy automático da branch `main`. Os planos são pagos: revisar o orçamento exibido pelo Render e aprovar antes de aplicar. O arquivo no GitHub não cria recursos por si só.

## Publicação

1. Confirmar a conta Render por email e conectar somente o repositório `NunoNasc/Controle-de-Frota`.
2. Criar um Blueprint usando `render.yaml` na raiz do repositório e revisar recursos e custos. Se já houver serviços, inspecioná-los antes para evitar duplicação.
3. Definir `APP_URL` com a URL HTTPS efetivamente atribuída ao serviço (ou domínio próprio). Não usar localhost nem presumir disponibilidade do nome. Se necessário, corrigir a variável após provisionar e antes de distribuir QR Codes.
4. Conferir build, migrations e inicialização. O comando de produção escuta `0.0.0.0` na porta fornecida pelo Render, sem mudar o servidor de desenvolvimento local.
5. Verificar o deploy associado ao commit, o acesso e o envio de checklist com foto. Sem healthCheckPath, o Render usa verificação TCP; isso não atesta acesso ao banco nem funcionamento do checklist.

## Banco e dados existentes

A conexão interna é injetada pelo Render, sem credenciais no Git. O banco não aceita conexões externas por padrão. Migrations são executadas antes da inicialização; seed e reset não são executados automaticamente.

O banco novo começa vazio. Planejar backup e restauração controlada do banco operacional antes de usar, preservando veículos, históricos, anexos e tokens dos QR Codes. Não apontar a migração para o banco local nem substituir os dados por seeds. Conferir compatibilidade da versão PostgreSQL de origem e destino e validar contagens após restauração. Uma migração de dados não foi realizada apenas por preparar este Blueprint.

## Pendências de produção

O administrativo ainda bloqueia produção no proxy, layout e APIs até existir autenticação e autorização reais. Não ativar `ALLOW_DEV_ADMIN` nem remover os bloqueios para contornar essa pendência.

Dimensionar memória, armazenamento e backups conforme o uso e testar fotos no ambiente publicado. Os planos mínimos propostos são um ponto de partida, não garantia de capacidade. Não armazenar anexos permanentemente no filesystem temporário do serviço.

Após validar o Render, revisar as integrações Vercel existentes para evitar deploys duplicados. Não excluir serviços ou bancos existentes durante a preparação.

Referências: https://render.com/docs/blueprint-spec e https://render.com/docs/deploy-nextjs-app
