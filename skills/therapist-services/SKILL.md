# Therapist Services Skill

Use esta skill ao criar, revisar ou refatorar o dominio de Serviços do
Terapeuta, a API `/api/therapist/services`, a Edge Function
`therapist-services-command`, ou a tela `/terapeuta/servicos`.

## Fontes Obrigatórias

- `AGENTS.md`
- `docs/architecture/adr/ADR-008-platform-therapy-service-boundary.md`
- `docs/architecture/therapy-service-foundation-phase1.md`
- `docs/product/integration-map.md`
- `docs/product/page-inventory.md`
- `docs/product/routes-map.md`
- `docs/design-system/design-system.md`
- `src/features/therapist-services/`
- `src/lib/permissions.ts`
- `supabase/migrations/*therapy_service*`
- `supabase/functions/therapist-services-command/`

## Rotas e APIs

- UI canonica: `/terapeuta/servicos`
- Subrota equivalente: `/terapeuta/servicos/meus` redireciona para
  `/terapeuta/servicos`
- Figma de referencia: arquivo `OSXJi8tknHHCj82MTY2NbG`, node `13366:1943`
- API Next fina: `POST /api/therapist/services`
- Edge Function: `therapist-services-command`
- RPCs:
  - `list_therapist_service_catalog_v1`
  - `list_private_therapist_services_v1`
  - `create_therapist_service_v1`
  - `update_therapist_service_v1`
  - `transition_therapist_service_v1`
  - `reorder_therapist_services_v1`

## Regras de Dominio

- Terapia da plataforma e servico do terapeuta sao entidades diferentes.
- Terapeuta nunca cria terapia por texto livre.
- Criacao de servico exige `therapyId` valido, `requestId` UUID e validacao
  server-side.
- A terapia precisa estar `published`, com categoria ativa e
  `is_available_for_services = true`.
- Terapia sem visibilidade pública não deve ficar disponível para criação de
  novos serviços. Serviços históricos/arquivados podem permanecer para
  rastreabilidade, mas não aparecem no filtro padrão “Todos”.
- `matching_therapy_settings` continua separado da criacao de servicos.
- Quando a terapia não estiver no catálogo, o CTA deve abrir
  `/terapeuta/mensagens/solicitar-terapia`. Essa solicitação é estruturada,
  passa por análise e nunca cria uma terapia ou serviço automaticamente.
- Ao criar/editar serviço, terapeuta escolhe de 1 a 3 temas entre os temas
  vinculados administrativamente à terapia e até 3 refinamentos por tema.
- Refinamentos pertencem ao serviço específico, não ao perfil genérico.
- Backend valida que tema pertence à terapia e refinamento pertence a tema
  escolhido no serviço; navegador não é fonte de autoridade.
- Metrica percentual sem serie confiavel deve ser `null`.
- Mutacoes usam `version` otimista e ledger de idempotencia.
- Next nunca usa service role; service role fica em Edge Functions/RPCs
  restritas.
- TES é online-only. `deliveryFormat` pode aparecer no contrato por
  compatibilidade, mas deve ser omitido ou enviado como `online`; a UI não deve
  oferecer escolha de formato.

## Dados

- `therapies`: catalogo canonico da plataforma.
- `therapy_categories`: categoria canonica.
- `therapist_services`: oferta comercial do terapeuta.
- `therapist_service_booking_settings`: regras de reserva do servico.
- `therapist_service_mutation_requests`: idempotencia.
- `therapist_service_events`: auditoria.
- `therapist_service_matching_themes`: temas escolhidos pelo terapeuta no
  serviço.
- `therapist_service_matching_interests`: refinamentos escolhidos pelo
  terapeuta no serviço.
- `bookings` e `session_payments`: historico/snapshots, nao reescrever.
- Imagem exibida em `/terapeuta/servicos` vem da terapia administrada pela
  plataforma: `therapy_public_content.hero_image_url` com fallback para
  `therapies.image_url`. O terapeuta nao envia imagem propria do servico nesta
  tela.

## QA

- Tela principal deve ter hero, lista de servicos, filtros, ordenacao, limite de
  plano, lateral de dicas e ranking apenas com dados reais.
- Estados obrigatorios: loading, erro com retry, vazio, lista, aviso de serviços sem limite por plano,
  conflito de versao e terapia indisponivel.
- Responsividade minima: 320, 375, 768, 1024 e 1440px. Mobile nao usa tabela
  horizontal; cards e metricas colapsam em uma coluna/grid compacto.
- Strings sem espaços (por exemplo, uma palavra com 200 caracteres) devem usar
  quebra segura dentro do card, da seção e do `TESDialog`, sem overflow
  horizontal da página ou do modal. A descrição da revisão deve permanecer em
  uma área limitada com scroll interno quando necessário.
- O ranking “Serviços mais agendados” exibe a imagem da terapia administrada no
  catálogo; quando a imagem estiver ausente, usa fallback visual sem quebrar a
  composição.
- Formulario de criacao tem 3 passos: catalogo canonico, configuracao da oferta
  e revisao. O dado preenchido deve persistir ao voltar.
- Formulario informa “Atendimento online” como regra fixa, sem seletor de
  formato.
- CTA "Nao encontrou sua terapia?" e apenas informativo/futuro; nunca cria
  terapia.
- Catalogo permitido nao inclui terapia `draft`, `deprecated`, `archived` ou
  com categoria inativa.
- Criacao por `therapyName` falha.
- Replay com mesmo `requestId` e mesmo payload retorna replay idempotente.
- Mesmo `requestId` com payload diferente retorna conflito.
- Terapeuta nao ve/altera servico de outro terapeuta.
- Paciente nao acessa a projecao privada.
- Serviço pausado não aparece em views públicas reserváveis.
- Motivos técnicos de bloqueio devem ser traduzidos para texto de produto na UI.
- A UI fala em `Suas terapias`, `Adicionar terapia`, `Ativar terapia` e
  `Terapias mais agendadas`. `serviço` permanece apenas como nome de domínio ou
  contrato interno quando necessário.
- Nos cards, a categoria da terapia permanece visível e os temas selecionados
  pelo terapeuta aparecem em um badge circular `+N`, limitado a `+2`. O badge
  abre um tooltip acessível por mouse, foco, clique e teclado com os nomes dos
  temas selecionados.

Rodar:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:deno`
- `npm run build`
- `npx supabase db reset`
- `npx supabase db lint --schema public`
- `npx supabase test db`

## Pendencias

- Admin completo para terapias da plataforma.
- Configuracoes avancadas de reserva por servico continuam centralizadas em
  Agenda/Horarios ate a Fase 3.
- E2E completo depende do Supabase local ativo para login, criacao, ativacao,
  verificacao do perfil publico e pausa.
- Possivel indice unico parcial para terapeuta/terapia depois de limpar
  fixtures historicas duplicadas.

## Assets da plataforma

- O hero de `/terapeuta/servicos` usa `therapistServicesHero` com fade à
  esquerda. A imagem dos cards de serviço continua vindo da terapia do catálogo.
- Consulte `docs/design-system/platform-assets.md`.
