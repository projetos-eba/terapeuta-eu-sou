# Fundação de Terapias e Serviços - Fase 1

Data: 2026-07-28

## Diagnóstico Anterior

- `therapist_services.therapy_id` já existia e preservava a relação canônica.
- `therapies` tinha `status`, `is_public_visible` e dados editoriais, mas não
  tinha um flag explícito para novos serviços.
- `service_status` tinha `draft`, `active`, `paused`, `archived`; não havia
  `version`, `position`, `is_bookable` nem ledger de idempotência.
- Views públicas já filtravam `published`, mas não sabiam diferenciar serviço
  ativo de serviço ativo porém não reservável.

## Fontes de Verdade

| Entidade              | Fonte canônica                                       | Quem altera                     | Observação                                             |
| --------------------- | ---------------------------------------------------- | ------------------------------- | ------------------------------------------------------ |
| Terapia da plataforma | `therapies`                                          | Plataforma/Admin                | Não nasce por texto livre do terapeuta.                |
| Categoria             | `therapy_categories`                                 | Plataforma/Admin                | Categoria precisa estar ativa para criação de serviço. |
| Conteúdo editorial    | `therapy_public_content`, highlights, benefits, FAQs | Plataforma/Admin                | Não é duplicado em serviço.                            |
| Match                 | `matching_therapy_settings`, `matching_weights`      | Plataforma/Admin                | Independente de publicação e de novos serviços.        |
| Serviço do terapeuta  | `therapist_services`                                 | Edge Function autenticada + RPC | Pertence ao terapeuta e aponta para `therapy_id`.      |
| Temas do serviço      | `therapist_service_matching_themes`                  | Terapeuta via RPC transacional  | Subconjunto dos temas administrados da terapia.        |
| Refinamentos serviço  | `therapist_service_matching_interests`               | Terapeuta via RPC transacional  | Até 3 por tema escolhido no serviço.                   |
| Reservas/snapshots    | `bookings`, `booking_holds`, `session_payments`      | RPCs A2/A6 e webhooks           | Mantêm histórico mesmo se serviço/terapia mudar.       |

## Estados

Terapias aceitas pelo schema: `draft`, `active` legado, `in_review`,
`published`, `deprecated`, `inactive` legado e `archived`.

Serviços aceitos pelo schema: `draft`, `active`, `paused`, `requires_review`,
`rejected`, `archived`.

Regras:

- criação de serviço exige terapia `published`, categoria ativa e
  `is_available_for_services = true`;
- criação e edição de serviço exigem 1 a 3 temas válidos da terapia e
  refinamentos opcionais limitados a 3 por tema;
- criação e edição de serviço exigem duração em minutos inteiros entre 20 e 120,
  inclusive; a duração salva alimenta os slots e o snapshot da reserva;
- a quantidade de serviços cadastrados é ilimitada para os planos `free`,
  `premium` e `premium_plus`; o campo de limite permanece apenas por
  compatibilidade histórica;
- `published` não implica Match, catálogo de criação ou visibilidade universal;
- serviço `paused`, `draft`, `rejected`, `requires_review` ou `archived` não é
  reservável;
- métricas agregadas retornam variação percentual como `null` enquanto não há
  série confiável.

## Relacionamento

```text
therapy_categories 1---n therapies 1---n therapist_services 1---n bookings
                              |                  |
                              |                  +--- therapist_service_booking_settings
                              +--- matching_therapy_settings
                              +--- therapy_public_content/highlights/benefits/faqs
```

## APIs e RPCs

Edge Function autenticada:

- `therapist-services-command`

Rota Next fina:

- `POST /api/therapist/services`

Ações:

- `catalog`: chama `list_therapist_service_catalog_v1`;
- `list`: chama `list_private_therapist_services_v1`;
- `create`: chama `create_therapist_service_v1` com `requestId` e `therapyId`;
- `update`: chama `update_therapist_service_v1` com `expectedVersion`;
- `activate`, `pause`, `archive`: chamam `transition_therapist_service_v1`;
- `reorder`: chama `reorder_therapist_services_v1`.

As RPCs de mutação são `service_role` only. A Edge Function valida o token do
terapeuta e passa `actor_user_id` derivado da sessão, não do navegador.

## Views

- `therapist_service_allowed_catalog_v1`: catálogo permitido para criação.
- `therapist_private_services_v1`: lista privada do shell.
- `therapist_service_metrics_v1`: agregados por serviço.
- `public_therapies_v`: catálogo público.
- `public_therapist_search`: busca pública.
- `public_therapist_profile_services_v`: serviços do perfil público.
- `public_matching_therapies_v`: Match, mantida separada via settings.

## Plano de Migração

1. Expandir enums sem remover valores legados.
2. Adicionar flags/colunas compatíveis em `therapies` e `therapist_services`.
3. Criar ledger idempotente e eventos.
4. Criar RPCs de leitura/mutação.
5. Ajustar views públicas para `is_bookable`.
6. Atualizar seeds e contratos TypeScript.

## Riscos e Decisões

- Valores legados `active`/`inactive` em terapia continuam por compatibilidade.
- Não foi criado índice único global de duplicidade por causa de fixtures e
  histórico; novas mutações bloqueiam duplicidade por RPC.
- O Admin completo de terapias permanece fora do escopo.
