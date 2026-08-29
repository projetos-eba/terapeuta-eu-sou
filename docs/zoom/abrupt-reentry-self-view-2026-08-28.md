# Self-view após reentrada abrupta — 2026-08-28

## Evidência e causa

Em um iPhone, a primeira entrada exibiu os dois vídeos. Depois que o aparelho
desligou sem uma saída normal, a nova entrada continuou publicando a câmera do
paciente para o terapeuta, mas o próprio paciente ficou sem prévia. A captura
fornecida mostrava câmera em uso, controle de câmera ligado, remoto visível e o
estado “sem prévia neste dispositivo”. Isso isola a falha no attach local; não é
evidência de falha de autorização, `join`, permissão ou publicação.

A regressão determinística reproduziu a sequência no adapter anterior:

1. a conexão antiga desaparece sem `leave`/`pagehide` confiável;
2. a reentrada recebe novo `userId` e preserva o mesmo `userKey`;
3. o roster ainda contém a instância antiga da mesma pessoa;
4. o remoto é renderizado e `startVideo()` confirma a publicação;
5. `attachVideo(localUserId)` falha enquanto o pipeline móvel ainda aquece;
6. as três reconciliações de `0`, `350` e `1.200 ms` se esgotam;
7. o SDK anuncia `video-capturing-change: Started` depois, mas o adapter antigo
   não escutava esse evento e a prévia permanecia indisponível.

A regressão falhou antes da correção e passou depois dela. O código exato
devolvido pelo SDK no iPhone real não foi capturado; o diagnóstico não presume
um erro específico do provider.

## Correção

- A captura local possui estado e ciclo próprios por geração:
  `off`, `starting`, `published`, `ready` e `failed`.
- `video-capturing-change: Started` é o sinal autoritativo que reabre o
  orçamento de attach e reconcilia a prévia.
- Um `user-updated` local com `bVideoOn=true`, `Connected`, retorno à
  visibilidade e a ação manual continuam como sinais auxiliares.
- O sinal pode chegar enquanto `startVideo` ou um attach provisório ainda está
  pendente. A recuperação aguarda as Promises capturadas e revalida
  `generation + client + captureEpoch` antes de alterar refs, estado ou DOM.
- Tentativas anteriores à prontidão não consomem o orçamento reaberto pelo
  evento `Started`.
- A recuperação não repete `startVideo`, `join`, emissão de JWT ou access.
- A publicação e o vídeo remoto permanecem ativos quando somente o self-view
  falha.
- A instância antiga com o mesmo `userKey` continua excluída da seleção remota.

As preferências da sala de espera permanecem transitórias por privacidade. Um
processo de navegador novo entra com mídia desligada até nova escolha do
usuário; depois que a câmera é ativada, sua publicação e prévia seguem os
estados independentes acima.

## Regressões

- captura tardia após reentrada abrupta, com novo `userId` e participante
  antigo de mesmo `userKey`;
- `Started` chegando durante attach provisório pendente;
- processo de navegador descartado e novo contexto móvel no Playwright;
- remoto anexado antes da câmera local;
- nenhuma repetição de captura, join ou JWT durante a recuperação.

O harness usa componentes reais com SDK/acesso simulados e mídia sintética.
Safari/iPhone físico continua sendo gate manual obrigatório; viewport Chromium
não substitui o comportamento real do WebKit nem comprova o código retornado
pelo SDK no aparelho.

Uma navegação que dispara `pagehide` continua executando cleanup por
privacidade. A correção não mantém câmera ativa em uma página armazenada em
BFCache; a reentrada posterior cria um novo ciclo normal.

## Complemento: vínculo tardio do player

Esta correção tratou identidade e prontidão tardias da captura. Uma corrida
posterior foi isolada entre o retorno de `attachVideo()` e a vinculação interna
do `<video-player>` no mobile. O adapter agora espera `bVideoOn=true`, reutiliza
um player local persistente e só confirma a prévia quando seu `node-id`
corresponde ao participante local. Ver
[vinculação tardia da prévia mobile](./mobile-self-view-binding-2026-08-28.md).

## Segurança e escopo

Os logs permanecem sanitizados e agora distinguem estado/ciclo da captura,
tentativa e origem da reconciliação sem registrar `userId`, `userKey`, JWT,
session name ou dados pessoais. Não houve alteração de banco, migration, RPC,
Edge Function, access policy, rate limit, rota ou lifecycle lógico.

Frame dedicado da chamada no Figma: `Não identificado nos arquivos analisados.`

## Validação local

| Gate                                        | Resultado                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| Regressão isolada antes da correção         | 1 falha esperada: três attaches esgotados e self-view ausente           |
| `npm run zoom:video-sdk:test`               | 21 Deno + 107 Vitest aprovados em 6 arquivos                            |
| Playwright `zoom-preview.spec.ts`, Chromium | 3 cenários aprovados; reentrada abrupta também aprovada em modo visível |
| `npm run typecheck`                         | Aprovado                                                                |
| `npm run lint`                              | Aprovado; somente o aviso informativo de depreciação do `next lint`     |
| `npm run build`                             | Aprovado; 121 páginas estáticas geradas                                 |
| Prettier dirigido e `git diff --check`      | Aprovados                                                               |

Nenhum teste ou serviço dessa validação escreveu em HML ou produção. Não houve
deploy, migration, `db push`, alteração de secret ou configuração remota.
