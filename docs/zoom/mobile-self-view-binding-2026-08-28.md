# Vinculação tardia da prévia local no mobile — 2026-08-28

## Sintoma e isolamento

No mobile, o paciente publicava a câmera e era visto pelo terapeuta, mas não
via a própria imagem. O vídeo remoto continuava funcionando. Isso comprova que
permissão, captura, `startVideo()`, publicação e conexão estavam ativas; a
falha estava somente entre `attachVideo()` e a vinculação dos frames ao player
local.

O adapter anterior tratava um elemento retornado e conectado ao DOM como
prévia pronta. No Video SDK 2.4.5, `attachVideo()` pode devolver o
`VideoPlayer` antes de concluir sua vinculação interna. Em aparelhos móveis,
`bVideoOn` e o atributo `node-id` podem aparecer depois. Uma reconciliação
encontrava o elemento conectado, encerrava cedo como sucesso e deixava a capa
“sem prévia neste dispositivo” sem uma recuperação confiável.

A regressão foi escrita antes da correção e falhou porque o adapter chamou
`attachVideo(7, 2)` enquanto o roster ainda informava `bVideoOn=false`. O
harness anterior mascarava a corrida: criava e devolvia um `<video>` já pronto,
sem separar criação do elemento e vinculação do player.

## Contrato corrigido

- O React monta e preserva um único `<video-player>` dentro do container local.
- `startVideo()` confirma publicação, não prévia.
- `attachVideo(localUserId, quality, localPlayer)` só é chamado quando o roster
  autoritativo informa `bVideoOn=true`.
- O retorno de `attachVideo()` inicia o estado `binding`; sucesso só ocorre
  quando `node-id` corresponde ao `userId` local.
- Estar conectado ao DOM, isoladamente, nunca confirma self-view.
- O ciclo interno distingue `waiting_provider`, `attaching`, `binding`,
  `attached` e `degraded`.
- Esperar `bVideoOn` não consome tentativas. Timeout de vínculo desanexa
  exatamente o player local e permite nova reconciliação sem repetir captura,
  join, acesso ou JWT.
- Observer, timer e Promise validam `generation + client + stream +
captureEpoch + localUserId` antes de alterar UI. Cleanup invalida a geração,
  aguarda a operação limitada e desanexa o mesmo player.
- O nó local pertence ao React e nunca é removido manualmente. Desligar e
  religar a câmera reutiliza esse nó.

Os eventos `user-updated`, `video-capturing-change: Started`,
`connection-change: Connected`, `visibilitychange` e
`video-detailed-data-change` são somente gatilhos. A decisão continua baseada
no roster completo do SDK.

## Diferença para as correções anteriores

As correções de identidade e reentrada garantiram que o adapter conhecesse o
participante local correto e recuperasse uma captura tardia. Esta correção atua
depois dessas etapas: confirma que o player já existente recebeu efetivamente
os frames do participante local. Nenhuma regra de identidade remota, seleção
1:1, `userKey`, retry de conexão, `leave(false)` ou lifecycle backend mudou.

## Observabilidade

Os logs sanitizados são:

- `LOCAL_RENDER_PENDING`: publicação ativa, aguardando prontidão do provider;
- `LOCAL_RENDER_BOUND`: player confirmado para o participante local;
- `LOCAL_RENDER_TIMEOUT`: `node-id` não confirmou dentro do deadline.

Eles não incluem `userId`, `userKey`, JWT, session name, nome de pessoa nem
user-agent completo.

## Regressões

- publicação ativa com `bVideoOn=false` não chama attach nem consome retry;
- player conectado e ainda sem `node-id` permanece pendente;
- vínculo tardio recupera a prévia sem novo `startVideo`, join ou JWT;
- timeout desanexa somente o player local e aceita nova tentativa;
- stop, unmount e mudança de identidade invalidam operações anteriores;
- remoto permanece visível durante self-view pendente ou degradado;
- reentrada abrupta, identidade tardia, refresh e StrictMode permanecem
  cobertos;
- cada container mantém no máximo um player e o local nunca entra no tile
  remoto.

O Playwright local modela separadamente prontidão do roster, retorno imediato
de `attachVideo()` e escrita tardia de `node-id`. A mesma suíte roda em
Chromium mobile e WebKit com mídia falsa e sem chamadas ao Zoom, Supabase, HML
ou produção.

## Limites

WebKit emulado reduz regressões, mas não substitui Safari em iPhone físico. O
aceite externo ainda exige aparelho real contra um ambiente local seguro ou
homologação posteriormente autorizada. Não foi adicionado o fallback legado
`startVideo({ videoElement })`; ele só deve ser avaliado se o gate físico ainda
falhar.

Não houve migration, banco, RPC, Edge Function, webhook, rota, dependência ou
mudança visual. Frame dedicado da chamada no Figma:
`Não identificado nos arquivos analisados.`

## Validação local

| Gate                          | Resultado                                                 |
| ----------------------------- | --------------------------------------------------------- |
| Regressão antes da correção   | Falha esperada: attach local ocorreu com `bVideoOn=false` |
| Vitest dirigido               | 79 testes aprovados no adapter e stage após a correção    |
| `npm run zoom:video-sdk:test` | 21 testes Deno + 110 testes Vitest aprovados              |
| Playwright Chromium mobile    | 4 cenários aprovados                                      |
| Playwright WebKit mobile      | 4 cenários aprovados                                      |
| `npm run typecheck`           | Aprovado                                                  |
| `npm run lint`                | Aprovado, sem avisos do projeto                           |
| `npm run build`               | Aprovado; 121 páginas estáticas geradas                   |
| iPhone/Safari físico          | Pendente; gate manual obrigatório                         |

`git diff --check` é executado no fechamento da entrega. Nenhuma etapa desta
investigação escreveu em HML ou produção.
