# Incidente de roteamento de câmera — 2026-08-28

## Escopo e evidência

Na primeira entrada de uma chamada 1:1, paciente e terapeuta recebiam o vídeo
da contraparte, mas a prévia própria podia ficar vazia. Em algumas sequências,
desligar a câmera remota revelava a câmera local no quadro nomeado como remoto;
refresh ou uma segunda saída/reentrada alteravam o resultado. A observação de
HML foi somente leitura. A correção e a validação foram feitas localmente, sem
deploy, escrita remota ou mudança de banco.

Antes da alteração, cinco regressões determinísticas falharam no adapter:

1. `join()` devolvia `{ userId, userKey }`, enquanto
   `getCurrentUserInfo()` ainda não tinha identidade válida; o próprio usuário
   era anexado como remoto.
2. Um segundo dispositivo com o mesmo `userKey` local era elegível como
   contraparte.
3. Duas conexões da contraparte eram anexadas no mesmo container.
4. Duas identidades remotas diferentes também eram anexadas, em vez de falhar
   fechado.
5. Um `attachVideo` iniciado por uma geração descartada podia resolver depois
   do cleanup e alterar o DOM da tentativa nova.

Essas falhas reproduzem o sintoma sem depender de rede, câmera física, webhook
ou lifecycle do backend.

## Causa-raiz

O Zoom Video SDK 2.4.5 retorna o participante local como resultado bem-sucedido
de `client.join()`. O normalizador anterior apenas aceitava esse formato e
descartava a identidade. O adapter consultava imediatamente
`getCurrentUserInfo()`, que pode estar incompleto na primeira conexão. Com
`localUserId` ausente, o filtro de remotos aceitava o próprio participante.

O problema era ampliado por três decisões de renderização:

- eventos incrementais eram usados como se pudessem decidir o roster;
- todos os IDs diferentes do local eram anexados ao mesmo quadro 1:1;
- attaches, timers e detaches não tinham ownership completo por geração,
  client, stream e elemento.

Assim, o comportamento variável após refresh não era uma correção real: o novo
timing apenas fazia a consulta de identidade chegar completa ou removia um
player antigo.

## Correção

- O normalizador de `join` devolve a identidade local validada e preserva
  `userKey`; ela é registrada antes da mídia e do roster.
- `getCurrentUserInfo()` virou fallback e fonte de renovação no evento
  `connection-change: Connected`.
- Sem identidade local autoritativa, nenhum participante é anexado como remoto.
- `getAllUser()` é o roster autoritativo; eventos apenas pedem reconciliação.
- IDs com o mesmo `userKey` local são excluídos, cobrindo segundo dispositivo
  da mesma pessoa.
- A sala 1:1 mantém uma única identidade remota e um único player. Instâncias
  duplicadas da mesma contraparte têm seleção estável; identidades diferentes
  ou desconhecidas em conflito falham fechado.
- Timers e operações remotas pertencem a `generation + client + stream`. Após
  cada `await`, o ownership é validado novamente.
- O cleanup invalida a geração, aguarda attaches pendentes no deadline e usa
  `detachVideo(userId, element)` para remover somente o player proprietário.
- Um elemento já pertencente ao outro quadro nunca é movido. A prévia local ou
  o remoto falha fechado, preservando a publicação válida e o DOM proprietário.

## Invariantes

- `join` conectado, publicação de câmera, prévia local e vídeo remoto anexado
  são resultados independentes.
- O `VideoPlayer` local nunca é filho do container remoto e vice-versa.
- Cada container possui no máximo um player na chamada 1:1.
- O mesmo `userKey` local nunca representa a contraparte.
- Operação de uma geração encerrada não altera refs, estado ou DOM da geração
  atual.
- Desligar uma câmera não move nem remove o player da outra pessoa.
- Falha apenas da prévia não chama `stopVideo` e não é apresentada como falha
  de permissão/captura.

## Limites

O adapter não infere identidade por nome. Safari/iPhone e aparelhos Android
físicos continuam sendo gate manual posterior; viewport Chromium e mocks não
substituem a validação do comportamento nativo do SDK nesses dispositivos.
Frame dedicado da chamada no Figma: `Não identificado nos arquivos analisados.`

## Validação local

- Regressões direcionadas de adapter/recovery: 81 testes aprovados.
- `npm run zoom:video-sdk:test`: 21 testes Deno e 98 testes Vitest aprovados.
- Playwright Chromium local: gates de acesso e mobile aprovados; o cenário de
  contextos isolados excedeu o timeout na primeira compilação a frio da rota e
  foi aprovado isoladamente após o servidor aquecer.
- `npm run typecheck`, `npm run lint`, `npm run build` e `git diff --check`:
  aprovados.
- Harness Zoom real não executado: depende de habilitação explícita e de uma
  sessão curta real. Nenhuma chamada real foi criada por esta correção.
