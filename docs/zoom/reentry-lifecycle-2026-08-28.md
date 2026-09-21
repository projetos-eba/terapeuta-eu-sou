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
- O terapeuta que chegou ou entrou até T+10 pode reentrar durante toda a janela.
- O paciente que chegou até T+10 inclusive, ou que já possui
  `session.user_joined` confiável até T+10, preserva o direito até o fim agendado.
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
do paciente. Cada participante preserva seu próprio direito de reentrada até
o fim agendado. A chegada do cliente não autoriza uma primeira chegada tardia
do terapeuta. Se ambos chegaram até T+10, o terapeuta pode reentrar em T+15
e o cliente entra assim que a presença atual do terapeuta for confirmada.

O job `end_patient_no_show` revalida a evidência sob o lock consultado pela
chegada da espera. Ele não reutiliza `end_therapist_absent` ou
`reconcile_orphan`; saída e reconexão do terapeuta pontual seguem reentrantes.
O backend bloqueia a emissão de novos acessos imediatamente e a maintenance
encerra a instância remota no ciclo seguinte.

Uma decisão pendente de alteração solicitada pela terapeuta bloqueia a reserva
de `end_patient_no_show`, inclusive para job que foi criado antes do pedido.
Essa proteção é separada da presença: impede que a ausência automática decida
um encontro que ainda aguarda escolha de reagendamento ou reembolso.

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

## Complemento — reuso de identificador do provider (2026-09-17)

O `provider_session_id` não é uma fronteira suficiente de instância: depois de
uma sala vazia ser tecnicamente encerrada, o Zoom pode reutilizar esse mesmo
identificador quando o terapeuta retorna. A presença atual passa a usar uma
época interna aberta por `session.started` ou `session.user_joined` confiável,
posterior ao fechamento anterior. A época é registrada somente em metadata
operacional sanitizada da `video_sessions` e das participações; não cria uma
nova tentativa de reserva nem altera chegada, no-show, qualidade ou financeiro.

Eventos anteriores ao início da época atual são descartados, inclusive um
`session.ended` atrasado com o mesmo identificador do provider. O primeiro join
confiável do terapeuta na nova época restaura `therapist_present=true`, para que
o paciente já legitimado volte a receber acesso host-first. Encerramento manual,
fim agendado, hard timeout e status terminal continuam sem reabertura.

A regressão `137_zoom_same_provider_reentry_epoch.sql` cobre: entrada de ambos,
fechamento técnico, reentrada do terapeuta com o mesmo identificador, bloqueio
de evento antigo, nova entrada do paciente e manutenção da ACL exclusiva de
`service_role`.

Nenhuma alteração deste trabalho deve ser aplicada diretamente em HML ou
produção. HML serve somente como fonte read-only de evidência.
