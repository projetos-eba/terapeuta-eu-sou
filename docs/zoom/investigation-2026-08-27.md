# Investigação local Zoom — 2026-08-27

> Atualização de lifecycle em 2026-08-28: a conclusão histórica deste relatório
> de que a grace de 120s poderia encerrar ausência/orfandade foi substituída
> pela regra de reentrada até `scheduled_ends_at`. Consulte
> [reentry-lifecycle-2026-08-28.md](./reentry-lifecycle-2026-08-28.md).

## Evidência antes da correção

- HML foi apenas evidência já capturada: código 2 / fase `join`, falha de
  `destroyClient`, depois 5012; paciente aguardando presença do terapeuta.
  O log sozinho não distingue rejeição bruta de mídia, falha real de join e
  erro sintético criado pelo adapter. Atribuir o primeiro código ao serviço
  Zoom, como na conclusão anterior, não estava comprovado.
- No pacote **instalado 2.4.5**, `dist/index.esm.js`: `VideoClient.join`
  devolve `joinInstant`, que usa `Ka(Fr.JoinMeeting)`. O sucesso é o evento
  `ADD_CURRENT_USER_PARTICIPANT_ATTRIBUTE`; `Ka` resolve com seu payload.
  O adapter, introduzido no hardening posterior a `Zoom fortalecido`, aceita
  somente `""`: um participante resolvido vira `unexpected_sdk_result`,
  código **2 fabricado no TES**, e desencadeia `leave(false)`.
- No mesmo bundle, `ZoomVideo.destroyClient` lê `this.videoClient` e chama
  `this.videoClient.leave()` antes de limpar o singleton. Extrair o método e
  chamá-lo como função perde o receiver. O adapter faz exatamente isso.
  Os mocks antigos de destroy ignoravam `this`; os de join só retornavam `""`.
  Portanto, repetir destroy após 750 ms não corrige a causa.
- Rejeições de Promise escapam de `awaitExecutedZoomOperation` sem receber a
  fase específica; o catch externo normaliza tudo como `join`. É necessário
  preservar operação exata, confirmação de join e estado de conexão, sem
  registrar payload do participante, token ou mensagem bruta.
- A migration anterior já impede atualizar presença quando o status é terminal.
  Ainda é necessário testar a janela entre solicitação e confirmação do fim e
  as participações da instância anterior: limpar o ID do provider sem uma
  fronteira de eventos pode restaurar presença antiga após fim técnico.

## Escopo e limites

### Prova local antes da migration adicional

`060_zoom_provider_lifecycle_fences.sql` contra a função de `20260827031000`:
Na matriz consolidada, 7 das primeiras 20 verificações falham com a função
antiga (2, 5, 6, 7, 9, 13, 16). Eventos antigos reassociam a instância encerrada e
contaminam a presença da instância nova; presença reaparece durante encerramento solicitado
e depois do fim agendado. O deadline também é limitado ao horário na função de
eventos, divergindo do watchdog que o webhook sincroniza depois. A proteção
de status já terminal passa e deve ser preservada. É necessária uma nova
migration, sem reescrever a histórica, para fechar essas fronteiras.

Após os primeiros 20 gates, mais 6 testes de manutenção detectaram 3 falhas:
`reconcile_orphan` usava a idade total do encontro e podia contornar a grace
logo após fim técnico; um job de ausência antigo ainda era reservado após a
volta do terapeuta; reservar o job não impedia um join concorrente antes do
pedido de encerramento. A mesma migration passa a revalidar e bloquear essa
fronteira transacional, sem acionar cron ou REST real no teste.

O histórico local tem lacunas anteriores (20260826020500/21000/22000/23000):
`supabase migration up --local` recusou prosseguir. Para não aplicar mudanças
de outros domínios, a baseline Zoom foi aplicada pelo arquivo versionado via
`psql` no contêiner `supabase_db_terapeuta-eu-sou`. Isso não altera histórico
nem banco remoto. Cron local confirmado com zero jobs ativos.

Somente código, migrations versionadas e testes no Supabase local. Nenhum
deploy, db push, configuração/secrets, função ou escrita remota. Nenhuma nova
sessão real será iniciada. Figma não está disponível por conector nesta rodada;
as correções preservam composição e rotas, usando fontes locais e screenshot.

O comportamento interno original do navegador HML não pode ser reconstruído
integralmente a partir do log sanitizado antigo. Os defeitos acima são
reproduzíveis localmente; homologação com mídia e webhooks reais continua
separada e não será declarada concluída por testes simulados.

## Comparação com os commits

- `f105cde1` — “Zoom fortalecido”: aguardava `join` sem validar o retorno
  como string vazia e chamava destroy como método do módulo. Entretanto,
  rejeição de áudio ainda caía no catch geral da conexão.
- `ccf2330a` — “ajustes visuais e zomm e tela feedback”: introduziu a validação
  estrita usada no join e a extração de `destroyClient` que perde `this`.
- `de90e8c2` — “Zoom ajustado 2”, baseline desta rodada: protege falha resolvida
  de áudio e adiciona duas tentativas de destroy com 750 ms, mas os mocks
  continuam sem retorno participante e sem dependência do receiver.
- Agora os testes exercitam o participante resolvido, o receiver de destroy,
  rejeição/resolução de áudio, conexão parcial seguida de cleanup falho, e
  nova tentativa/remount sem novo JWT nem reutilização do client inválido.

## Fluxo reconstruído e invariantes

1. UI consulta preview; o Next encaminha à Edge autenticada. Ownership, papel,
   elegibilidade profissional, pagamento canônico e janelas são validados no
   backend. Preview não emite JWT. Chegada pontual do paciente é persistida
   pelo fluxo canônico, não por relógio ou storage de um dispositivo.
2. Join autorizado reserva a emissão no rate limit distribuído (4/60s) e gera
   JWT com `role_type=1` para terapeuta ou `0` para paciente. JWT do terapeuta
   não equivale a presença; paciente ainda depende de webhook confiável.
3. Adapter aguarda cleanup global, cria/inicializa client e chama join. O
   sucesso do join confirmado pelo SDK precede `media_initializing`; áudio
   começa silenciado (`startAudio({mute:true})`), depois aplica preferências.
   Falha de mídia sem perda de conexão vira `media_degraded`, não `leave`.
   Logs distinguem `audio.start`, `audio.mute`, `join` e confirmação da conexão.
4. `Reconnecting → Connected` preserva o client e eventual mídia degradada.
   `Closed` transitório usa no máximo três tentativas, com client novo após
   cleanup bem-sucedido e o mesmo JWT. Falha/timeout de destroy exige recarga:
   botão/reentrada/remount não fazem nova emissão nem recriam o singleton.
5. `leave(false)` remove somente a participação local. Webhook assinado de
   `user_left` retira presença; `session.ended` precoce aposenta aquela
   instância e zera presença, mas não finaliza o encontro reentrante.
   Eventos antigos não reassociam a instância nem contaminam presença nova.
6. Presença confiável nova reabilita o paciente. Cada dispositivo continua
   atualizando preview mesmo depois da liberação. Falha de preview desabilita
   a entrada; resposta tardia não sobrescreve mensagem/estado da chamada.
7. Maintenance respeita a grace de 120s inclusive em `reconcile_orphan`.
   A reserva revalida o motivo e marca solicitação de fim sob lock da sessão,
   antes do REST, impedindo corrida com reentrada. Instância já fechada com
   evidência confiável não exige REST por ID inexistente para finalizar.
8. Pedido autorizado, confirmação de fim, status terminal, fim agendado e
   watchdog bloqueiam reentrada. `hard_ends_at` não é renovado pelo retry.
   Término explícito continua pelo backend; o navegador nunca usa `leave(true)`.
   Zoom não confirma pagamento, repasse ou realização clínica.

### Estados de acesso

| Motivo                            | Apresentação                              |
| --------------------------------- | ----------------------------------------- |
| `TOO_LATE`                        | Horário encerrado                         |
| `SESSION_ENDED` / status terminal | Encontro encerrado                        |
| `ARRIVAL_WINDOW_EXPIRED`          | Prazo de chegada de 10 minutos encerrado  |
| `TECHNICAL_UNAVAILABLE`           | Sala indisponível, com atualização        |
| `THERAPIST_NOT_IN_SESSION`        | Aguardando terapeuta, sem JWT do paciente |

## Arquivos afetados

- `src/features/zoom/zoom-video-session-adapter.tsx` e `.test.tsx`.
- `src/features/zoom/zoom-video-recovery.ts` e `.test.ts`.
- `src/features/zoom/components/zoom-video-controls.tsx`, `zoom-video-stage.tsx`
  e `zoom-waiting-room.tsx`.
- `src/domain/tes/booking-contracts.ts`.
- `src/features/bookings/patient-encounter-state.ts` e `.test.ts`,
  `session-presentation.ts`.
- `supabase/functions/_shared/zoom-video-sdk/access-policy.ts`,
  `booking-authorization.ts`, `session-lifecycle.ts`, `zoom-video-sdk.test.ts`.
- `supabase/functions/zoom-video-session-access/index.ts` e
  `zoom-video-session-maintenance/index.ts` (somente arquivos locais).
- `supabase/migrations/20260827040000_zoom_provider_lifecycle_fences.sql`:
  substitui três funções existentes, sem nova tabela/coluna e sem data repair.
- `supabase/tests/060_zoom_provider_lifecycle_fences.sql`: fixtures em transação
  com rollback; nenhum webhook/REST real nem job de cron executado.
- Este relatório, `docs/zoom/testing.md`, `skills/zoom-integration/SKILL.md` e
  `skills/zoom-video-call/SKILL.md`. Documentação atualizada.

## Validação executada — resultado final

| Validação                                                                                               | Resultado                                                                                     |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npx vitest run src/features/zoom src/features/bookings/patient-encounter-state.test.ts --maxWorkers=1` | 93 passaram em 7 arquivos                                                                     |
| `deno test --config supabase/functions/deno.json --allow-env supabase/functions/_shared/zoom-video-sdk` | 20 passaram; sem permissão de rede                                                            |
| `deno check` das Edge Functions de acesso e manutenção                                                  | Passou                                                                                        |
| `supabase test db --local`, arquivos 006, 007, 047, 048, 060, 081 e 088                                 | 117 passaram em 7 arquivos; 26 são da nova regressão                                          |
| `npx supabase db lint --local --schema public --level error`                                            | Sem erros                                                                                     |
| `npm run typecheck`                                                                                     | Passou                                                                                        |
| `npm run lint`                                                                                          | Passou sem warnings de ESLint; aviso da ferramenta sobre descontinuação futura de `next lint` |
| `npm run build`                                                                                         | Passou, 120 páginas geradas, exit 0                                                           |
| `git diff --check`                                                                                      | Passou                                                                                        |
| Cron local antes/depois                                                                                 | Zero jobs ativos                                                                              |

Operações pesadas executadas serialmente, com snapshots de CPU/RAM. Build
final terminou às 04:05 locais; snapshot final com cerca de 68% CPU ociosa,
7,5 GB de memória usada e sem swap-in/out durante a amostra. Não foram
executados reset de banco, suíte de todos os domínios ou homologação
transacional/Zoom real; os testes usam SDK e respostas de access simulados,
além de fixtures pagas locais já versionadas, exclusivamente para diagnóstico.

## Riscos e limites restantes

- O log antigo `phase:join` não prova qual operação rejeitou no navegador HML.
  O erro sintético 2 e o destroy sem receiver foram reproduzidos; o 5012 é
  compatível com client residual, mas não prova isoladamente sua causa remota.
- Mídia física, permissões de Safari/iPhone e Chrome/Android, conectividade
  real e latência/ordem dos webhooks reais não foram homologadas nesta rodada.
- Dois dispositivos foram simulados por duas montagens de UI, não por dois
  aparelhos físicos. As alterações não foram disponibilizadas em HML.
- Não há reparo automático de sessões já terminalizadas por versões antigas.
  A migration protege eventos futuros; nenhum registro HML foi alterado.
- O histórico local de migrations tem lacunas preexistentes. Foram aplicados
  somente os arquivos Zoom pelo psql local, sem `--include-all`, reset do
  banco ou reparo ad hoc do histórico; alinhar o histórico exige tarefa própria.
- Nenhuma dependência, rota, provider React, secret, configuração remota,
  regra de pagamento ou política financeira foi alterada.
