# Integration Contracts

Este arquivo registra contratos cross-domain já presentes nas fontes do TES.
Ele não cria novas regras de produto. Se código, Figma ou documentação divergir,
o Orchestrator registra o conflito e aplica a precedência do `AGENTS.md`.

## Reserva, pagamento e Zoom

```text
Public / Patient inicia reserva autenticada
  -> Sessions & Zoom valida serviço, slot, hold, booking e snapshots
  -> Stripe & Finance cria Checkout idempotente
  -> webhook Stripe assinado confirma session_payments = paid
  -> backend cria video_sessions local idempotente
  -> Sessions & Zoom valida booking, pagamento, ownership, status e janela
  -> terapeuta entra primeiro e webhook confiável registra presença
  -> JWT curto, com role server-side, é emitido ao participante autorizado
```

- Redirect/`checkout=success` não confirma pagamento.
- `bookings.payment_status` é projeção, não autoridade financeira ou Zoom.
- `session_payments` é autoridade financeira; `video_sessions` é autoridade
  operacional local da sessão de vídeo.
- Admin observa read models; não edita booking/pagamento/ledger diretamente.
- Owners: Sessions & Zoom + Stripe & Finance. Reviewer obrigatório: Security &
  Supabase. Consumidores: Public / Patient, Therapist Product e Admin.

## Suspensão de terapeuta

```text
Admin command autorizado e auditado
  -> therapist_profiles.status = suspended
  -> busca, perfil público e nova reserva deixam de aceitar o terapeuta
  -> operações protegidas do shell/agenda/financeiro falham fechado
  -> Zoom não emite payload de host
  -> bookings, pagamentos, ledger e histórico permanecem preservados
```

Owner do comando: Admin. Security revisa autorização/auditoria. Public /
Patient, Therapist Product, Stripe & Finance e Sessions & Zoom revisam os
efeitos em seus consumidores.

## Ciclo de terapia canônica

```text
Admin publica/despublica/descontinua/arquiva por command auditado
  -> catálogo público e Match refletem o estado permitido
  -> catálogo de criação de serviços aplica elegibilidade canônica
  -> serviços e bookings existentes preservam histórico/snapshots
  -> cache e rotas públicas afetadas são revalidados
```

- Despublicar remove catálogo/Match sem alterar serviços ou bookings.
- Descontinuar bloqueia novos serviços e preserva serviços/bookings existentes.
- Arquivar só é permitido sem serviços vinculados e preserva snapshots.
- Owner: Admin. Reviewers: Security & Supabase, Public / Patient e Therapist
  Product.

## Perfil e serviços do terapeuta

```text
Therapist Product salva rascunho privado
  -> nenhuma projeção pública muda
Therapist Product publica via command/RPC idempotente
  -> versão publicada + therapist_profiles alimentam views públicas
  -> busca, perfil, terapias relacionadas, reserva e cache são revalidados
```

- Documentos privados e paths de Storage nunca entram em DTO/HTML público.
- Terapia é entidade canônica da plataforma; serviço é oferta individual do
  terapeuta e não cria terapia por texto livre.
- Owner: Therapist Product. Reviewers: Public / Patient e Security & Supabase.

## Assinatura e capabilities

```text
Therapist Product inicia Checkout de plano
  -> Stripe & Finance resolve catálogo/Price server-side
  -> webhook assinado ou reconciliação autenticada confirma assinatura
  -> plano/capabilities canônicos são atualizados
  -> shell do terapeuta e Admin refletem o novo estado
```

- Query string e redirect não concedem plano ou capability.
- `free`, `premium` e `premium_plus` são os enums canônicos.
- Owner: Stripe & Finance. Reviewers: Security & Supabase, Therapist Product e
  Admin.

## Refund, dispute e repasse

```text
Evento autorizado/Stripe
  -> webhook/reconciliação idempotente
  -> session_payments + evento compensatório
  -> financial_ledger_entries append-only
  -> elegibilidade/lote/transfer são bloqueados ou compensados
  -> paciente, terapeuta e Admin leem projeções atualizadas
```

- Pagamento confirmado não significa serviço realizado.
- Correção nunca apaga ou reescreve histórico financeiro.
- Owner: Stripe & Finance. Security revisa grants/ledger; Sessions & Zoom
  revisa elegibilidade operacional quando o estado da sessão for afetado.

## Match público e governança Admin

```text
Admin altera versão/configuração por domínio autorizado
  -> versão publicada e views públicas seguras mudam
  -> jornada pública recalcula deterministicamente
  -> resultado recomenda terapias
  -> refinamentos preservados apoiam descoberta dentro da terapia
```

- Respostas individuais não são persistidas no banco.
- Fallback demonstrativo exige ativação server-side explícita e observável.
- Owner de governança: Admin. Owner da jornada/algoritmo público: Public /
  Patient. Security revisa exposição e LGPD.

## Auth e identidade

- Cliente, terapeuta e Admin possuem superfícies de login/sessão distintas.
- Backend deriva actor/role de sessão confiável; payload do cliente nunca é
  autoridade.
- Service role e secrets ficam somente em Edge Functions/ambiente server-side.
- Mudanças em auth, cookies, guards ou permissões têm Security & Supabase como
  reviewer obrigatório e QA cross-role.

## Contrato de mudança cross-domain

Qualquer alteração em um contrato acima deve declarar no handoff:

1. owner e reviewers;
2. fonte canônica e projeções afetadas;
3. ordem/evento/idempotência;
4. compatibilidade e preservação de histórico;
5. segurança, cache, observabilidade e rollback/roll-forward;
6. testes por shell e ambiente;
7. documentação atualizada ou pendente.
