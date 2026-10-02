# QR Code individual do checklist

Na ficha do veículo, o painel **Gerar QR Code do Checklist** permite visualizar, imprimir, baixar etiqueta PDF de 100 × 150 mm, baixar a mesma etiqueta centralizada em A4 e regenerar o token. Visualizar, imprimir e baixar não trocam a credencial. Use tamanho real (100%), sem ajuste automático, na impressão.

## Endereço e acesso

O QR aponta exclusivamente para `/checklist/TOKEN`. Tokens UUID v4 existentes continuam válidos; a regeneração usa 32 bytes aleatórios criptográficos (256 bits). Placa ou ID interno não autorizam envio. `/checklist/QTO6479` permanece como identificação pública e orientação para ler a etiqueta segura, sem divulgar o token.

O token só permite acessar/enviar o checklist do veículo vinculado. Não é usado como sessão, autenticação ou permissão administrativa. A área administrativa mantém sua proteção existente: disponível somente no ambiente local habilitado; produção permanece bloqueada até implementação de autenticação. Links ou QR Codes não alteram essa regra.

Páginas públicas não possuem menu administrativo. Tokens inválidos, substituídos e veículos inativos apresentam orientação para solicitar a etiqueta atualizada. Respostas públicas e de geração usam `no-store` e política de referência `no-referrer`. Os endpoints de geração e rotação pertencem à área administrativa; a rotação exige origem autorizada e confirmação da substituição das etiquetas.

`APP_URL` define a origem HTTP/HTTPS dos links. Ela não pode conter usuário/senha, caminho, query ou fragmento. Configure um endereço da aplicação que os celulares consigam acessar. Enquanto estiver em `localhost` ou `127.0.0.1`, a interface e as etiquetas informam que o endereço é local. Esta funcionalidade não publica o servidor, abre portas nem configura autenticação ou rede.

## Regeneração e rastreabilidade

A regeneração exige nome, matrícula, motivo e ciência de que etiquetas antigas precisam ser substituídas. Após confirmar:

1. O token anterior deixa de permitir abertura e novos envios, inclusive reenvio de um formulário antigo.
2. O novo token passa a identificar o mesmo veículo.
3. A revisão e data da rotação são atualizadas.
4. Usuário, motivo, data e hashes das credenciais entram em `VehicleQrEvent`, protegido contra sobrescrita. Tokens antigos não são mantidos nesse histórico.
5. Checklists anteriores permanecem inalterados.

Rotação e envio bloqueiam a mesma linha do veículo em transações serializáveis. Um envio confirmado antes da rotação é preservado; uma transação concorrente conflitante é rejeitada e, após a revogação, o token antigo é recusado. Revisões impedem duas rotações simultâneas silenciosas. Um link de impressão/PDF com revisão antiga retorna conflito, solicitando recarregar a ficha.

A migration `202610010001_vehicle_qr` é aditiva: preserva os tokens da frota, sem regeneração em massa. Registra a implantação no histórico, distinguindo-a de uma troca de credencial. Os eventos aparecem também na timeline geral do veículo.

## Etiquetas e verificação

PDFs são gerados localmente por `pdf-lib`, com QR vetorial, preto e branco e margem silenciosa de quatro módulos. A placa identifica a etiqueta; modelo e prefixo ajudam a conferir a aplicação no veículo. Não há serviço externo de QR Code nem envio de dados a terceiros.

`scripts/verify-vehicle-qr.ts` usa um veículo temporário e decodifica os QR Codes da imagem e dos PDFs renderizados. Verifica impressão, dimensões, três larguras de tela, acesso sem menu, bloqueio por placa, revogação, concorrência e preservação dos checklists. O teste de PDF requer Python com `pypdfium2` (caminho opcional em `QR_PYTHON`), apenas para QA; a aplicação usa Node.js. Ao terminar, limpa seus registros e confere a frota real.
