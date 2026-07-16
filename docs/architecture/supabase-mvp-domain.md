# Supabase MVP Domain

Este documento descreve a base recomendada para o domínio transacional do MVP do Terapeuta Eu Sou usando Supabase como backend futuro: Postgres, Auth, Storage e Edge Functions.

Status: proposta técnica inicial e parcialmente superada pelas migrations posteriores. Para estado operacional atual de rotas, views e skills, consultar `docs/product/integration-map.md`, `docs/product/routes-map.md` e `docs/product/page-inventory.md`.

## Decisões Assumidas

- O MVP é transacional: descoberta, match determinístico, terapia, terapeuta, horário, cadastro/login, pré-checkout, pagamento futuro, sessão online e áreas logadas.
- Supabase Auth será a origem de identidade; `profiles.id` deve apontar para `auth.users.id`.
- Stripe será o provedor de pagamento futuro, mas a migration só prepara campos.
- Zoom ou ferramenta similar será integração futura, representada por campos opcionais de reunião.
- Aura IA no MVP é nome de produto para recomendações por regras, pesos e condições. Não há IA generativa nem OpenAI neste recorte.
- Os planos técnicos atuais são `free`, `premium` e `premium_plus`. Eles substituem a linguagem anterior Básico, Pro e Plus na camada de domínio.
- Dados públicos de terapeutas devem ser expostos preferencialmente por views ou Edge Functions, não por liberar a tabela operacional inteira.

## Base Local

A primeira base local vive em `supabase/`:

- `config.toml`: configuração local da Supabase CLI.
- `migrations/20260708090000_initial_mvp_domain.sql`: schema inicial do domínio.
- `seed.sql`: catálogo mínimo de terapias, temas, interesses e pesos.
- `functions/match-therapies`: Edge Function legada; a jornada pública atual usa `/api/public/matching/config` e `/api/public/matching/calculate`.

O Match público atual consulta `public_matching_config` e calcula recomendações com `matching_versions`, `matching_weights` e `matching_therapy_settings`, sem expor pesos ao navegador.

## Schema Recomendado

### 1. `profiles`

Usuário base ligado ao Supabase Auth.

Campos principais:

- `id`: UUID, FK para `auth.users.id`.
- `role`: `patient | therapist | admin`.
- `display_name`, `email`, `phone`, `avatar_url`.
- `created_at`, `updated_at`.

RLS sugerida:

- Usuário autenticado pode ler o próprio profile.
- Atualizações e criação devem ser feitas por fluxo controlado ou trigger de Auth.
- Admin deve usar policy própria depois da definição do guarda admin.

### 2. `patient_profiles`

Dados complementares do paciente.

Campos principais:

- `user_id`: FK para `profiles.id`.
- `display_name`, `birth_date`, `timezone`.
- consentimentos, especialmente para dados sensíveis.
- `metadata` para preferências não críticas.

RLS sugerida:

- Paciente pode ler o próprio perfil.
- Escrita deve ser limitada ao próprio usuário e validada no backend.

### 3. `therapist_profiles`

Dados públicos e operacionais do terapeuta.

Campos principais:

- `user_id`: FK para `profiles.id`.
- `plan`: `free | premium | premium_plus`.
- `status`: `draft | submitted | in_review | changes_requested | approved | rejected | suspended`.
- `slug`, `public_name`, `legal_name`, `headline`, `bio`, `photo_url`.
- flags: `is_public`, `is_accepting_bookings`, `accepts_online_sessions`.
- `visibility_flags`, `metadata`.

RLS sugerida:

- Terapeuta pode ler o próprio perfil.
- Atualização direta pelo cliente deve ser evitada até existirem regras por campo.
- Público deve consultar uma view segura de terapeutas aprovados e visíveis.

### 4. `therapist_verifications`

Estado de análise/moderação do terapeuta.

Campos principais:

- `therapist_profile_id`.
- `status`.
- `documents_metadata` para referências futuras a documentos.
- `rejection_reason`, `changes_requested`.
- `reviewed_by`, `reviewed_at`.

RLS sugerida:

- Fechada por padrão.
- Admin/moderação acessa via policy específica ou Edge Function.

### 5. `therapy_categories`

Categorias editoriais do catálogo de terapias.

Campos principais:

- `name`, `slug`, `description`.
- `sort_order`, `is_active`.

RLS sugerida:

- Leitura pública apenas para categorias ativas.
- Escrita somente admin.

### 6. `therapies`

Terapias cadastradas e curadas pela plataforma.

Campos principais:

- `category_id`.
- `name`, `slug`, `short_description`, `description`.
- `status`: `draft | active | published | inactive | archived` no estado atual do projeto; `published` é o estado editorial público definitivo.
- `is_featured`, `safety_note`.

- Leitura pública apenas para terapias publicadas e visíveis publicamente.
- Escrita somente admin.

### 7. `matching_themes`

Temas usados pela jornada e pelo match determinístico.

Campos principais:

- `name`, `slug`, `description`.
- `is_active`.

RLS sugerida:

- Leitura pública apenas para temas ativos.
- Escrita somente admin.

### 8. `matching_interests`

Interesses usados pela jornada. Cada interesse pertence a exatamente um tema.

Campos principais:

- `theme_id`.
- `name`, `slug`, `sort_order`.
- `is_active`.

### 9. `matching_versions` e `matching_weights`

Base do match determinístico por pesos versionados.

Campos principais:

- `version_id`.
- `therapy_id`.
- `theme_id`.
- `interest_id`.
- `weight`.
- `reason`, `is_active`.

RLS sugerida:

- Fechada por padrão no MVP.
- O cálculo roda no backend/API para não expor pesos editoriais.

### 9. `therapist_services`

Serviços oferecidos por terapeutas, sempre apontando para terapias cadastradas na plataforma.

Campos principais:

- `therapist_profile_id`, `therapy_id`.
- `title`, `description`.
- `duration_minutes`, `price_cents`, `currency`.
- `status`: `draft | active | paused | archived`.
- `online_only`.

RLS sugerida:

- Terapeuta lê seus próprios serviços.
- Público deve acessar apenas serviços ativos por view segura.
- Escrita deve validar plano, status do terapeuta e limites.

### 10. `availability_rules`

Regras semanais de disponibilidade.

Campos principais:

- `therapist_profile_id`, `service_id`.
- `day_of_week`, `start_time`, `end_time`, `timezone`.
- `is_active`.

RLS sugerida:

- Terapeuta lê sua própria disponibilidade.
- Escrita deve ser validada por Edge Function para evitar conflito de horários.

### 11. `availability_exceptions`

Bloqueios e exceções por data.

Campos principais:

- `therapist_profile_id`, `service_id`.
- `starts_at`, `ends_at`.
- `is_available`, `reason`.

RLS sugerida:

- Terapeuta lê suas próprias exceções.
- Escrita deve validar conflitos.

### 12. `bookings`

Agendamento/sessão.

Campos principais:

- `patient_profile_id`, `therapist_profile_id`, `service_id`.
- `starts_at`, `ends_at`, `timezone`.
- `status`.
- `payment_status`.
- `meeting_url`, `meeting_provider` para integração futura.

RLS sugerida:

- Paciente e terapeuta envolvidos podem ler.
- Escrita deve ocorrer por Edge Function para validar horário, pagamento e status.

### 13. `pre_checkout_intakes`

Pré-checkout com objetivo, expectativa e contexto inicial.

Campos principais:

- `booking_id`, `patient_profile_id`, `service_id`.
- `objective`, `expectation`, `initial_context`.
- `sensitive_data_acknowledged`, `consent_accepted_at`.

RLS sugerida:

- Fechada por padrão até definição fina de minimização de dados.
- Evitar coletar conteúdo clínico desnecessário.

### 14. `payments`

Preparação para Stripe.

Campos principais:

- `booking_id`, `patient_profile_id`, `therapist_profile_id`.
- `provider`.
- `stripe_checkout_session_id`, `stripe_payment_intent_id`.
- `amount_cents`, `platform_fee_cents`, `therapist_amount_cents`, `currency`.
- `status`.

RLS sugerida:

- Fechada por padrão até fluxo Stripe existir.
- Leitura do paciente/terapeuta deve ser avaliada por campos expostos.

### 15. `favorite_therapists`

Favoritos de terapeutas do paciente.

Campos principais:

- `patient_profile_id`, `therapist_profile_id`.
- constraint única por par.

RLS sugerida:

- Paciente lê e altera seus próprios favoritos.

### 16. `message_templates`

Templates de comunicação controlada no MVP.

Campos principais:

- `key`, `context`, `title`, `body`.
- `is_active`.

RLS sugerida:

- Leitura de templates ativos quando necessário.
- Escrita somente admin.

### 17. `structured_messages`

Comunicação controlada no MVP.

Campos principais:

- `context`.
- `sender_profile_id`.
- `patient_profile_id`, `therapist_profile_id`, `booking_id`.
- `template_id`, `body`, `metadata`.

RLS sugerida:

- Fechada por padrão até regras de comunicação pré e pós-sessão ficarem claras.

### 18. `reviews`

Avaliação pós-sessão com moderação.

Campos principais:

- `booking_id`, `patient_profile_id`, `therapist_profile_id`.
- `rating`, `comment`.
- `status`: `pending | published | hidden | reported | removed`.
- `moderation_reason`, `published_at`.

RLS sugerida:

- Público lê apenas avaliações publicadas por view segura.
- Paciente cria avaliação apenas para booking concluído.
- Admin modera status.

### 19. `aura_recommendations`

Recomendações por regra, sem IA real.

Campos principais:

- `source_rule_key`.
- `title`, `body`.
- `context` JSON.
- `plan_required`.
- `priority`, `expires_at`, `is_active`.

RLS sugerida:

- Fechada por padrão.
- Exposição depende de plano e contexto.

### 20. `support_tickets`

Suporte operacional.

Campos principais:

- `requester_profile_id`.
- `booking_id`.
- `category`, `subject`, `description`.
- `status`, `priority`.

RLS sugerida:

- Usuário lê seus próprios tickets.
- Admin/suporte vê filas por policy específica.

## Riscos LGPD e Dados Sensíveis

- O pré-checkout pode receber dados pessoais sensíveis. A interface deve orientar a pessoa a compartilhar apenas o necessário.
- Dados de saúde, relatos emocionais, mensagens e avaliações precisam de minimização, consentimento, retenção definida e acesso estrito.
- Campos como `initial_context`, `structured_messages.body`, `reviews.comment` e `support_tickets.description` podem conter dados sensíveis mesmo quando não foram desenhados para isso.
- Publicar perfil, serviços e avaliações exige separar dados públicos de dados operacionais.
- Logs de Edge Functions não devem registrar payloads completos com conteúdo sensível.

## Dúvidas em Aberto

- Qual será o limite de serviços por plano `free`, `premium` e `premium_plus`?
- O terapeuta poderá editar preço livremente ou haverá faixas/regras?
- A plataforma terá repasse manual, Stripe Connect ou outro modelo?
- Quais campos do perfil público precisam virar view dedicada?
- Qual ferramenta de sessão online será escolhida: Zoom, Google Meet, Whereby ou outra?
- Qual janela de cancelamento, reembolso e remarcação será adotada?
- Quais mensagens são livres e quais serão templateadas no MVP?
- Qual retenção de dados será definida para intakes, mensagens e suporte?

## Fora do MVP

- IA generativa real.
- Integração Stripe funcional.
- Integração Zoom funcional.
- Repasses financeiros completos.
- Assinaturas de terapeutas.
- CRM completo para terapeuta.
- Chat livre complexo.
- Armazenamento real de documentos de verificação.
- Observabilidade e auditoria completas.
- Admin completo de moderação e relatórios.
