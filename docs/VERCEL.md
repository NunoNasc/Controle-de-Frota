# Integração GitHub → Vercel

Repositório: `NunoNasc/Controle-de-Frota`. A integração nativa da Vercel pode gerar deploys a cada push; não precisa de workflow GitHub Actions nem de token Vercel no repositório.

## Configuração do projeto

- Importar o repositório existente na conta Vercel apropriada, sem criar outra cópia.
- Framework: Next.js.
- Root Directory: raiz do repositório (`.`). O projeto já está na raiz, não em uma subpasta `central-controle-frota` no GitHub.
- Production Branch: `main`.
- Build: `pnpm build` (já executa `prisma generate` antes de `next build`).
- Dependências: versão do pnpm declarada em `package.json`, lockfile versionado.
- A integração deve ser verificada em Settings → Git e por um deploy associado ao commit enviado. Preparar arquivos localmente não significa que a conexão esteja ativa.

## Pendências para operação em produção

1. Configurar PostgreSQL acessível pela hospedagem e `DATABASE_URL` nas variáveis de ambiente da Vercel. O banco local em 127.0.0.1 não é acessível pela hospedagem.
2. Definir `APP_URL` como a URL HTTPS final, usada pelos QR Codes e pela validação de origem.
3. Aplicar migrations com `prisma migrate deploy` de forma controlada no banco correto. Não executar seed ou migração da base operacional automaticamente em previews. Migrar dados existentes por backup/restauração, preservando tokens e histórico.
4. Implementar autenticação e autorização administrativas. Hoje proxy, layout e APIs administrativas bloqueiam produção independentemente de `ALLOW_DEV_ADMIN`. Não remover o bloqueio simplesmente para tornar o deploy acessível.
5. Adequar o envio de fotos: a aplicação aceita requisições de checklist de até 30 MB; Vercel Functions limita o corpo a 4,5 MB. Implementar uma estratégia compatível antes de considerar uploads prontos em produção.
6. Manter banco de preview separado do operacional; configurar os ambientes explicitamente.

`.vercel/`, segredos, banco local e backups não devem entrar no Git. Permissões de integração e contratação de planos devem ser conferidas na conta da Vercel.

Referências oficiais:
- https://vercel.com/docs/git/vercel-for-github
- https://vercel.com/docs/functions/limitations
