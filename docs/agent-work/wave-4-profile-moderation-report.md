# Wave 4 — Moderação do perfil e dados privados de identidade

Data: 2026-08-22

> **Estado atual (substituído parcialmente em 2026-09-02):** esta wave segue
> sendo a origem da fila da primeira publicação e da projeção administrativa
> segura. A regra de reenfileirar toda republicação foi substituída: perfil já
> aprovado publica atualização editorial sem nova análise, preservando auditoria
> e disponibilidade pública.

## Resultado

Implementação local concluída para que toda nova publicação do perfil de
terapeuta passe novamente pela fila de moderação administrativa antes de
voltar a ficar pública. A configuração do terapeuta também ganhou os dados
privados de identidade e endereço necessários para a validação administrativa.
Nenhum deploy remoto foi feito nesta rodada.

## Decisões aplicadas

- Publicar uma nova versão do perfil não aprova automaticamente o conteúdo.
  A transação mantém a versão enviada para a leitura administrativa, cria ou
  reabre `therapist_verifications` em `submitted` e remove a visibilidade e o
  recebimento de reservas até a decisão do Admin.
- O Admin recebe uma projeção segura do conteúdo enviado, serviços e vídeo,
  além dos dados privados de identidade necessários à validação, sem
  documentos privados, credenciais, paths de Storage ou dados técnicos
  desnecessários.
- A tabela `therapist_private_identity` é separada do perfil público e dos
  documentos enviados. Guarda somente o documento escolhido, número
  normalizado e endereço para validação administrativa.
- O terapeuta informa CPF, RG ou passaporte, CEP, endereço, número,
  complemento, bairro, cidade e UF em `Terapeuta → Configurações → Dados da
conta`. O formulário aplica as máscaras de CPF, RG e CEP; passaporte usa
  somente letras e números por não possuir uma máscara brasileira universal.
- O banco valida autoria pela sessão autenticada, normaliza os valores e
  restringe leitura/escrita ao próprio terapeuta. A projeção pública nunca
  lê essa tabela.
- Vídeos YouTube e Vimeo aprovados são renderizados no perfil público com
  URLs de embed allowlisted (`youtube-nocookie.com` e `player.vimeo.com`).
  Links arbitrários nunca viram `iframe`; vídeos enviados continuam sendo
  reproduzidos como mídia pública do perfil.
- A copy do editor foi ajustada para dizer “enviado para revisão”, em vez de
  sugerir que a nova versão já está pública.

## Implementação

### Banco e autorização

- `supabase/migrations/20260822170000_wave4_profile_moderation.sql`
  adiciona a fila transacional de revisão, a projeção Admin sanitizada e a
  tabela/RLS/RPCs da identidade privada.
- A função existente de publicação foi substituída mantendo a assinatura e a
  idempotência. O corpo/base continua sendo resolvido pelo contrato anterior;
  a fila administrativa agora é parte da mesma transação.
- `supabase/tests/073_wave4_profile_moderation.sql` cobre grants, RLS,
  normalização e rejeição de documentos inválidos.

### Admin

- O detalhe de profissional e o detalhe de verificação carregam a projeção
  `admin_get_therapist_profile_review_v1`.
- `AdminProfileReviewPanel` mostra a versão enviada, campos editoriais,
  serviços, vídeo e a identidade privada de validação de forma somente leitura,
  com estados honestos quando o conteúdo ainda não está disponível.

### Configurações do terapeuta

- `therapist-settings-page.tsx` adiciona a seção de dados privados, máscaras e
  validação local.
- `therapist-settings.queries.ts` lê e salva a identidade exclusivamente por
  RPC autenticada; nenhum segredo ou documento é enviado ao browser fora do
  próprio valor de cadastro necessário.
- Parsers, mappers e testes cobrem CPF, RG, passaporte, CEP, limites e
  rejeições.

### Vídeo público

- `src/features/therapist-profile/video-embed.ts` converte apenas URLs
  YouTube/Vimeo permitidas para os hosts de embed oficiais.
- O perfil público usa `iframe` sandboxado para os hosts allowlisted e
  `<video controls>` para mídia carregada pelo próprio perfil.

## Compatibilidade

- Não houve alteração destrutiva de tabelas, views públicas ou documentos
  privados existentes.
- A assinatura da RPC de publicação permanece compatível com a Edge Function
  `therapist-profile-command`.
- Conteúdo histórico continua preservado; após nova publicação ele passa pelo
  novo ciclo de revisão antes de reaparecer publicamente.
- Testes antigos de publicação foram ajustados para refletir a regra aprovada:
  a projeção pública fica vazia até a aprovação administrativa.

## Validação executada

- `npx supabase db reset` — PASS; toda a sequência local, incluindo a
  migration da Wave 4, foi aplicada.
- `npx supabase db lint` — PASS com warnings preexistentes de imutabilidade,
  parâmetros não usados e funções legadas; nenhum warning novo da migration.
- `npx supabase test db` — PASS: 74 arquivos, 1.604 testes.
- `npx supabase test db supabase/tests/073_wave4_profile_moderation.sql` —
  PASS: 16 testes.
- `npm run typecheck` — PASS.
- `npm run lint` — PASS (políticas visual, online-only e ESLint).
- Vitest focal de settings, Admin, profile editor e vídeo — PASS: 23 arquivos,
  124 testes.
- `npm run test` — PASS após atualizar o contrato da rota de configurações:
  151 arquivos, 593 testes.
- `npx prettier --check` nos novos componentes, utilitário de vídeo, skills e
  relatório — PASS.
- `npm run build` — PASS após liberar o artefato gerado `.next`; a geração
  registrou apenas o diagnóstico de dados públicos já conhecido, sem falha de
  compilação.
- HML e produção — não alterados. A aplicação remota exige migration e
  runtime coordenados antes do smoke autenticado.

## Riscos e pendências reais

1. A migration ainda precisa ser promovida para HML em janela coordenada com o
   runtime. Até lá, a rota de configurações não deve ser publicada isolada.
2. O formulário exige dados privados para salvar alterações da conta. Perfis
   históricos sem esses dados continuam legíveis, mas precisarão completá-los
   antes de uma nova validação administrativa.
3. O estado de aprovação continua sendo operado pelo comando Admin existente;
   esta wave adiciona a fila e a leitura segura, não uma nova tela de decisão.
4. O `npm run format:check` global segue com dívida histórica fora do escopo;
   a formatação focal dos arquivos desta wave deve ser mantida no gate.

## Impacto documental

Documentação atualizada: esta nota, `skills/therapist-profile/SKILL.md`,
`skills/admin-professionals/SKILL.md` e `docs/product/integration-map.md`.
Nenhum segredo ou dado jurídico oficial foi inventado.
