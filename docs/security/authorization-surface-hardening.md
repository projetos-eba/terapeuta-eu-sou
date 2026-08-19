# Security Advisor E Superficie De Autorizacao

Data: 2026-08-09

Escopo desta fase: validacao local e versionada. Nenhuma migration deve ser
aplicada em HML ou producao a partir deste documento sem uma janela propria de
deploy.

## Objetivo

Zerar risco de autorizacao nao compreendido nas superficies:

- Admin;
- financeiro privado;
- dados privados de terapeutas e pacientes;
- views publicas que dependem de RLS;
- RPCs `SECURITY DEFINER` expostas a `anon` ou `authenticated`.

## Regras Aplicadas

- RPCs Admin ficam executaveis por `authenticated` somente para permitir a
  chamada inicial; a autorizacao real e interna e exige usuario com
  `profiles.role = 'admin'`.
- Nenhuma RPC Admin deve ser executavel por `anon`.
- RPCs financeiras privadas de terapeuta nao devem ser executaveis por `anon`.
- Read models privados/internos que leem tabelas protegidas usam
  `security_invoker=true`.
- Views publicas de perfil de terapeuta permanecem como DTOs `SECURITY DEFINER`
  intencionais quando trocar para invoker exigiria grants anon diretos em
  tabelas com metadados, bookings ou pagamentos.
- DTOs publicos nao expoem documentos privados, dados bancarios, identificadores
  Stripe internos, `legal_name`, caminhos de storage ou metadados
  administrativos.
- As unicas RPCs `SECURITY DEFINER` intencionalmente executaveis por `anon`
  nesta fase sao as projeções públicas e seus predicados de elegibilidade:
  - `get_public_therapy_therapists_v1(text, uuid[], uuid[], integer)`;
  - `get_service_available_slots_v1(uuid, timestamptz, timestamptz, integer)`;
  - `record_public_therapist_metric_events_v1(uuid, jsonb)`;
  - `is_therapist_publication_eligible_v1(uuid)`;
  - `is_public_service_booking_eligible_v1(uuid)`;
  - `public_therapist_slug_redirect_rows_v1()`.
- `reserve_booking_hold_v1` e seu RPC interno de disponibilidade são somente
  `service_role`; o navegador usa a Edge Function
  `session-booking-checkout`.
- Views do schema `public` são read models: `anon` e `authenticated` não têm
  privilégios de escrita, DDL ou referência nelas.

## Testes De Ataque

O teste `supabase/tests/044_security_authorization_surface.sql` cria um
inventario auditavel e falha se surgir exposicao fora da allowlist.

Cenarios cobertos:

- `anonymous -> RPC Admin`: negado.
- `anonymous -> RPC financeira privada`: negado.
- `patient_A -> patient_B`: zero linhas em dados privados.
- `therapist_A -> documentos therapist_B`: zero linhas.
- `therapist_A -> financeiro therapist_B`: DTO sem ids de pagamento do outro
  terapeuta.
- `patient -> RPC Admin`: `42501 admin permission required`.
- `therapist -> RPC Admin`: `42501 admin permission required`.
- `admin -> read models Admin`: permitido.
- `admin -> comando de verificacao`: permitido com auditoria append-only,
  `actor`, `reason` e `requestId`.
- `authenticated -> reserve_booking_hold_v1`: negado; somente a Edge Function
  transacional pode criar hold.
- `anon/authenticated -> views`: sem `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`,
  `REFERENCES` ou `TRIGGER`.

## Hardening De 2026-08-19

As migrations `20260819161000_restore_booking_rpc_privilege_boundary.sql` e
`20260819162000_harden_view_privilege_boundaries.sql` corrigem permissões que
o PostgreSQL havia restaurado ao recriar funções e views. A segunda migration
também remove os grants padrão permissivos do owner `postgres` no schema
`public`, portanto novos objetos devem declarar o menor privilégio necessário
explicitamente.

`supabase/tests/044_security_authorization_surface.sql` verifica agora a
allowlist de `SECURITY DEFINER`, o bloqueio do comando de hold e que toda view
do schema público é somente leitura para os papéis de API.

## Leaked Password Protection

Status: preparado/documentado, nao ativado nesta fase.

Checklist de ativacao futura no Supabase Auth:

1. Confirmar janela de homologacao e producao separadas.
2. Ativar primeiro em HML.
3. Executar cadastro, login, reset de senha e troca de senha com contas de teste.
4. Validar mensagens de erro sem vazar detalhes de politica interna.
5. Confirmar que suporte/Admin possuem orientacao para orientar usuarios
   bloqueados por senha vazada.
6. Ativar em producao somente apos evidencias HML.

## Achados Classificados

| Finding                                         | Severidade | Estado      | Prova                                                                                                                                   |
| ----------------------------------------------- | ---------: | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Views publicas de perfil sem `security_invoker` |         P2 | INTENTIONAL | migration `20260809183000_security_authorization_surface_hardening.sql` + pgTAP `044`: DTO selecionavel por anon e sem colunas privadas |
| Views privadas/internas sem `security_invoker`  |         P1 | FIXED       | migration `20260809183000_security_authorization_surface_hardening.sql` + pgTAP `044`                                                   |
| RPC Admin executavel por papel indevido         |         P1 | FIXED       | pgTAP `044`: `anon` sem execute; paciente/terapeuta recebem `42501`                                                                     |
| RPC financeira privada executavel por `anon`    |         P1 | FIXED       | pgTAP `044`: `anon` sem execute e chamada negada                                                                                        |
| DTO publico expondo documento/Stripe/admin      |         P1 | FIXED       | pgTAP `044`: inventario de colunas proibidas                                                                                            |
| Hold transacional executável pelo browser       |         P0 | FIXED       | migration `20260819161000` + pgTAP `003` e `044`                                                                                        |
| Views com DML/DDL para papéis de API            |         P1 | FIXED       | migration `20260819162000` + pgTAP `044`                                                                                                |
| Funcoes antigas com `search_path=public`        |         P2 | DEFERRED    | catalogo local; requer recriacao qualificada dos corpos antes de alterar para `search_path=''`                                          |
| Leaked Password Protection                      |         P2 | PREPARED    | checklist acima; ativacao operacional fora desta fase                                                                                   |

## Observacao Sobre `search_path`

Foram identificadas funcoes legadas `SECURITY DEFINER` com
`search_path=public`. A troca mecanica para `search_path=''` nao e segura quando
o corpo da funcao usa referencias nao qualificadas. A correcao adequada e
recriar cada funcao com referencias `public.<objeto>` ou schema explicito e so
entao endurecer o `search_path`.

Esta pendencia fica classificada como P2 porque os testes desta fase provam que
as superficies P0/P1 de autorizacao estao bloqueadas. Ela deve ser tratada em
rodada propria de hardening SQL.
