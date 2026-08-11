---
name: public-therapist-profile
description: Use when implementing, refactoring, auditing, or documenting the public therapist profile page `/terapeutas/:slug`, including Figma node 13273:3393, public Supabase views, therapist profile content, services, availability slots, booking handoff, reviews carousel, SEO, redirects, seeds, and QA.
---

# Public Therapist Profile

## Fontes obrigatórias

Consultar antes de alterar:

1. `AGENTS.md`
2. Figma `Projeto Terapeuta Eu Sou Atualizado`, node `13273:3393`
3. `src/lib/routes.ts`
4. `src/app/terapeutas/[slug]/`
5. `src/features/therapist-profile/`
6. `src/features/availability/`
7. `src/features/booking/`
8. `supabase/migrations/*public_therapist_profile*.sql`
9. `supabase/seed.sql`
10. `docs/product/routes-map.md` e `docs/product/page-inventory.md`

## Contrato

- Rota canônica: `/terapeutas/:slug`.
- Rota singular `/terapeuta/:slug`: redirect para a plural.
- Figma: `13273:3393`.
- Perfil principal de teste: `ana-oliveira`.
- Slugs seedados como `rafael-santos` devem aparecer quando tiverem perfil aprovado, serviço ativo e terapia `published` com `is_public_visible = true`.
- O fallback local de desenvolvimento cobre `ana-oliveira` e `rafael-santos` para evitar tela de não encontrado quando o Supabase local estiver indisponível.
- Fotos públicas devem apontar para assets versionados em `public/therapists/`. Não usar URLs temporárias, imagens externas ou nomes novos sem atualizar seeds, fallbacks e documentação.
- Não expor email, telefone, dados internos de paciente, `meeting_url`, dados de pagamento ou campos privados.

## Dados

- Views públicas:
  - `public_therapist_profiles_v`
  - `public_therapist_profile_services_v`
  - `public_therapist_profile_reviews_v`
  - `public_therapist_profile_content_v`
  - `public_therapist_slug_redirects_v`
- Conteúdo editorial publicado vem de `therapist_profile_content_versions` e tabelas filhas.
- Terapias e serviços são gerenciados pela plataforma/Admin, não pela copy livre do terapeuta.
- Avaliações públicas devem estar vinculadas a booking `completed` e `paid`.
- Disponibilidade deve vir do RPC autoritativo `get_service_available_slots_v1`, que deriva regras semanais, exceções, bookings existentes, buffers, antecedência mínima, duração e timezone do serviço. Não recalcular slots públicos no runtime Next.
- Cada serviço deve carregar sua própria grade de horários calculada; Reiki 50min, Tarô 60min e Constelação Familiar 60min não podem compartilhar uma lista fixa de slots.
- O painel compacto de disponibilidade mostra somente os próximos 3 dias com horários disponíveis; dias corridos sem slot não devem aparecer como linhas vazias.
- A agenda mensal usa o mesmo payload calculado por serviço e destaca apenas dias disponíveis, listando horários após a seleção do dia.
- As views de perfil público devem usar o status atual do catálogo público: `therapies.status = 'published'` e `therapies.is_public_visible = true`.

## UI

Preservar o padrão do node:

- Hero com foto grande, badges, tags, avaliação, CTA e ações favoritar/compartilhar.
- Cards `Minha essência`, `Como posso te guiar` e `Um convite para você`.
- Seção `Vivências e terapias` com serviços, duração, preço e CTA.
- A seção `Vivências e terapias` usa a terapia canônica como identidade
  pública. Não exibir títulos operacionais de serviço como chip/aba, por
  exemplo “Reiki online”.
- Painel roxo `Próximos horários disponíveis` com seleção de serviço quando houver mais de uma oferta ativa.
- Avaliações em carrossel automático sem dependência nova. Respostas do
  terapeuta aparecem inicialmente com uma frase e expandem sob ação explícita.
- Copy responsável, sem promessa de cura, diagnóstico ou resultado garantido.

## QA

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx supabase db lint`
- Se Docker estiver disponível: `npx supabase db reset`
- Validar `/terapeutas/ana-oliveira`, `/terapeuta/ana-oliveira`, perfil inexistente, sem avaliações, agenda indisponível e slots diferentes para 50min vs 60min.
