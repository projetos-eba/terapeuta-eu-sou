# Vinculação tardia da prévia local no mobile — 2026-08-28

## Ativação após a entrada

Em navegadores móveis, a câmera escolhida na sala de espera não é publicada
automaticamente ao entrar na sala ativa. O paciente vê o botão **Ativar minha
câmera** somente depois que o container da sala foi montado; o clique chama
`startVideo()` diretamente no gesto do usuário e, em seguida, reconcilia o
self-view. Isso evita que o `join`, a rede ou a renderização React consumam a
janela de ativação exigida pelo Safari/iOS.

Se a câmera já estiver publicada, a ação manual apenas refaz o vínculo do
self-view. O navegador não permite revogar programaticamente uma permissão já
concedida; `stopVideo()` libera a captura, mas não redefine a permissão do
site. Em caso de permissão negada/resetada, a interface orienta a revisão nas
configurações do Safari/iOS, sem repetir tentativas em loop.

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

A correção inicial ainda deixava uma condição indevida: bloqueava
`attachVideo(7, 2, localPlayer)` enquanto o roster local informava
`bVideoOn=false`. Em iPhone esse campo pode atrasar ou permanecer defasado após
`startVideo()` já ter publicado a mídia; esperar por ele impede precisamente a
self-view de aparecer, sem impedir que o terapeuta receba os frames.

## Contrato corrigido

- O React monta e preserva um único `<video-player>` dentro do container local.
- Quando a câmera vem habilitada da sala de espera, o adapter aguarda o React
  montar esse container e player antes de chamar `startVideo()`. A montagem
  tardia também dispara reconciliação automática; um diálogo de permissão não
  pode ser necessário para a self-view aparecer.
- `startVideo()` confirma publicação, não prévia.
- Depois de `startVideo()` e de identificar o participante local, o adapter
  chama `attachVideo(localUserId, quality, localPlayer)` imediatamente. O
  `bVideoOn` do roster é telemetria e gatilho de reconciliação, não
  pré-requisito de attachment.
- O retorno de `attachVideo()` inicia o estado `binding`; sucesso só ocorre
  quando `node-id` corresponde ao `userId` local.
- Estar conectado ao DOM, isoladamente, nunca confirma self-view.
- O ciclo interno distingue `attaching`, `binding`, `attached` e `degraded`.
- Timeout de vínculo desanexa exatamente o player local e permite nova
  reconciliação sem repetir captura, join, acesso ou JWT. Quando o player
  persistente não recebe `node-id`, o fallback criado pelo SDK ocupa a mesma
  camada visual do tile local, sem entrar no container remoto.
- Observer, timer e Promise validam `generation + client + stream +
captureEpoch + localUserId` antes de alterar UI. Cleanup invalida a geração,
  aguarda a operação limitada e desanexa o mesmo player.
- O nó local pertence ao React e nunca é removido manualmente. Desligar e
  religar a câmera reutiliza esse nó.

Os eventos `user-updated`, `video-capturing-change: Started`,
`connection-change: Connected`, `visibilitychange` e
`video-detailed-data-change` são somente gatilhos. O roster completo do SDK
continua sendo a fonte de reconciliação, mas não pode atrasar o primeiro attach
de uma captura local que `startVideo()` já confirmou.

A montagem do renderer local é um gatilho adicional e explícito. Ela resolve a
barreira da transição espera → sala sem depender de tempo arbitrário, do prompt
de microfone ou de qualquer evento remoto.

## Diferença para as correções anteriores

As correções de identidade e reentrada garantiram que o adapter conhecesse o
participante local correto e recuperasse uma captura tardia. Esta correção atua
depois dessas etapas: confirma que o player já existente recebeu efetivamente
os frames do participante local. Nenhuma regra de identidade remota, seleção
1:1, `userKey`, retry de conexão, `leave(false)` ou lifecycle backend mudou.

## Observabilidade

Os logs sanitizados são:

- `LOCAL_RENDER_ROSTER_LAG`: o roster local ainda informa vídeo desligado,
  embora a captura publicada já esteja sendo vinculada;
- `LOCAL_RENDER_BOUND`: player confirmado para o participante local;
- `LOCAL_RENDER_TIMEOUT`: `node-id` não confirmou dentro do deadline.

Eles não incluem `userId`, `userKey`, JWT, session name, nome de pessoa nem
user-agent completo.

## Regressões

- publicação ativa com `bVideoOn=false` chama attach local sem nova captura,
  join ou JWT;
- câmera pré-ativada só inicia após o `<video-player>` local estar montado;
- montagem tardia do renderer recupera a self-view automaticamente, sem clique
  no microfone, nova captura, join ou JWT;
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

Não houve migration, banco, RPC, Edge Function, webhook, rota ou dependência.
A saída da sala de espera passa a parar sincronamente as faixas nativas de
câmera e áudio antes de iniciar o join do SDK, eliminando a disputa de captura
na transição móvel. Frame dedicado da chamada no Figma:
`Não identificado nos arquivos analisados.`

## Validação local

| Gate                          | Resultado                                                 |
| ----------------------------- | --------------------------------------------------------- |
| Regressão antes da correção   | Falha esperada: o attach local foi bloqueado por `bVideoOn=false` |
| Vitest dirigido               | 93 testes aprovados em stage, sala de espera e adapter    |
| `npm run zoom:video-sdk:test` | 21 testes Deno + 115 testes Vitest aprovados              |
| Playwright Chromium mobile    | 4 cenários aprovados                                      |
| Playwright WebKit mobile      | 4 cenários aprovados                                      |
| `npm run typecheck`           | Aprovado                                                  |
| `npm run lint`                | Aprovado, sem avisos do projeto                           |
| `npm run build`               | Aprovado; artefatos de produção gerados                   |
| iPhone/Safari físico          | Pendente; gate manual obrigatório                         |

`git diff --check` é executado no fechamento da entrega. Nenhuma etapa desta
investigação escreveu em HML ou produção.
