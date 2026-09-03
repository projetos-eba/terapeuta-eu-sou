# Lifecycle de reentrada Zoom — 2026-08-28

## Causa-raiz comprovada

Uma observação read-only em HML mostrou uma reserva com janela local
22h25–22h45. Terapeuta e paciente entraram antecipadamente; a última saída do
terapeuta ocorreu às 22h16:49. O Zoom encerrou tecnicamente a instância às
22h18:48. Às 22h19:00, a maintenance reservou
`end_therapist_absent` após 120 segundos e, às 22h19:01, confirmou
`video_sessions.status=ended` com `termination_reason=therapist_absent`. O
webhook atrasado de `session.ended` só foi processado depois dessa confirmação.

A falha não estava no botão nem na emissão de JWT. A migration
`20260827040000_zoom_provider_lifecycle_fences.sql` transformava ausência
temporária e orphaning do provider em fim lógico. A access policy então
retornava corretamente `SESSION_ENDED`, apesar de ainda haver tempo agendado.

## Invariantes corrigidos

- A janela geral é T-15 até `scheduled_ends_at` exclusivo.
- O terapeuta elegível pode entrar e reentrar durante toda a janela.
- O paciente que chegou até T+10 inclusive, ou que já possui
  `session.user_joined` confiável, preserva o direito até o fim agendado.
- Cada entrada do paciente continua host-first. Sem presença atual do
  terapeuta, o estado é `THERAPIST_NOT_IN_SESSION`; um novo join confiável do
  host libera o acesso.
- `leave(false)`, ausência temporária e `session.ended` precoce encerram apenas
  a participação ou a instância remota, nunca o encontro TES.
- A grace de 120 segundos é mantida apenas por compatibilidade técnica.
- São terminais: encerramento manual autorizado pelo terapeuta em T-5, fim
  agendado, hard timeout e estados terminais da reserva/pagamento.
- Sessões com término já confirmado não são reabertas automaticamente.

## Exceção terminal: não comparecimento do paciente

Após T+10 estrito, uma sessão ativa somente recebe o término
`patient_no_show` quando não existe, para a versão e horário atuais da reserva,
nem chegada autenticada na sala de espera nem `session.user_joined` confiável
do paciente. A mesma evidência libera ambos até o fim agendado: se o paciente
chegou no prazo e o terapeuta entra em T+15, a sala continua host-first e o
paciente pode entrar assim que a presença atual do terapeuta for confirmada.

O job `end_patient_no_show` revalida a evidência sob o lock consultado pela
chegada da espera. Ele não reutiliza `end_therapist_absent` ou
`reconcile_orphan`; atraso, saída e reconexão do terapeuta seguem reentrantes.
O backend bloqueia a emissão de novos acessos imediatamente e a maintenance
encerra a instância remota no ciclo seguinte.

## Implementação local

A migration `zoom_preserve_reentry_until_scheduled_end`:

- deixa de enfileirar e reservar `end_therapist_absent` e
  `reconcile_orphan`;
- preserva assinaturas, enums e grants `service_role`;
- impede que os RPCs de pedido/confirmação criem fim lógico por razões legadas;
- conclui jobs pendentes legados como superseded;
- limpa apenas fences legadas não confirmadas de sessões ativas ainda dentro da
  janela, sem reabrir sessões terminalizadas.

A maintenance reconhece operações legadas como no-op auditável antes de criar
fence, consultar provider ou chamar a REST API de encerramento.

## Regressão obrigatória

Validar localmente: T-15, entrada de ambos, saída individual de ambos, passagem
de mais de 120 segundos, `session.ended` atrasado e reentrada do terapeuta antes
do fim. O status deve permanecer `active`, sem fence; uma nova instância do
provider deve ser vinculada. O paciente legitimado deve aguardar o host e ser
liberado após a reentrada dele. Fim manual autorizado, fim agendado, hard
timeout e cancelamento devem continuar terminais.

Os contratos defensivos e os três caminhos terminais são cobertos por
`060_zoom_provider_lifecycle_fences.sql` e
`099_zoom_reentry_terminal_fences.sql`.

A transformação one-shot também foi exercitada no Supabase local a partir da
migration imediatamente anterior: um job `processing` e um job `queued`
viraram `done/superseded`, a fence legada ativa foi limpa e uma sessão com
término já confirmado permaneceu inalterada.

Nenhuma alteração deste trabalho deve ser aplicada diretamente em HML ou
produção. HML serve somente como fonte read-only de evidência.
