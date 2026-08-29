# Recuperação da prévia local do paciente — 2026-08-28

## Evidência e limite do diagnóstico

O usuário relatou que o terapeuta recebia a câmera do paciente, mas o paciente
não via a própria imagem e recebia aviso de encerramento incompleto. Publicação
e prévia são resultados diferentes: a imagem recebida pela contraparte não
comprova que o self-view foi anexado.

Quatro regressões novas foram executadas contra o adapter original do HEAD e
falharam:

1. câmera publicada, identidade local indisponível, depois `Connected` com
   identidade válida: somente o remoto era anexado;
2. a mesma identidade tardia com câmera/microfone ligados no preflight: os
   timers recuperavam o remoto, mas não o self-view;
3. `user-added` do próprio paciente anunciava “A outra pessoa entrou”;
4. falha de detach remoto durante reconciliação ativa exibia “Algumas etapas
   de encerramento falharam”.

São defeitos reproduzidos no código, não nova homologação em HML. A operação
exata que falhou no iPhone da captura não foi identificada sem o console
sanitizado daquela ocorrência. Não atribuir genericamente o sintoma a
permissão negada, falha de join ou limitação do Safari.

## Antes e depois

Antes, `enableVideoForSession` tentava publicação + attach uma vez. O roster
recuperava somente o remoto. A reconexão recuperava o self-view somente na
transição entre dois IDs já conhecidos, não em `null → userId`.

Agora, `ensureLocalPreviewAttached` reconcilia a prévia separadamente da
captura, após ativação, identidade resolvida, timers/eventos e reconexão.
Não repete `startVideo`, não executa leave e não emite JWT para recuperar
apenas a prévia. A rotina:

- preserva a identidade autoritativa e as cercas de roteamento 1:1;
- compartilha a Promise de attach em andamento na mesma geração;
- verifica client, stream, geração, identidade e publicação depois do await;
- descarta elementos obsoletos pelo par `userId + element`;
- limita a três tentativas de attach por ciclo de ativação/reconexão ou
  recuperação explícita; espera por identidade não consome tentativa;
- mantém publicação e remoto quando o self-view falha;
- permite “Tentar mostrar minha câmera”, sem reiniciar a captura.

Desligar para a publicação antes de aguardar o attach pendente, que descarta
seu resultado. Cleanup invalida a geração e aguarda também a Promise de prévia
dentro do deadline existente. Mudança de identidade serializa o detach antigo
antes de reanexar. Um finally antigo só remove seu próprio registro de Promise.

## Erros e presença

`teardownFailures` pertence somente ao cleanup da sessão. O aviso de saída
é restrito a `leaving`, `error` e `reload_required`; cleanup bem-sucedido
limpa o estado. Falhas de detach na chamada ativa geram
`ZOOM_VIDEO_RENDER_CLEANUP_PARTIAL_FAILURE`, sem fabricar um fim de sessão.
Os nomes de operação são sanitizados, sem IDs de participante.

`ZOOM_VIDEO_LOCAL_IDENTITY_PENDING` diferencia identidade ainda indisponível
de erro do SDK. Falha de attach mantém `video.attach.local` no log e a
apresentação existente de câmera ligada sem prévia.
Logs de vídeo também distinguem geração, identidade disponível, câmera
publicando e prévia anexada. Capacidades de múltiplos vídeos/limite renderizável
entram somente quando informadas pelo SDK; uma consulta de capacidade que
falha não interfere na chamada nem presume limitação do navegador.

Eventos locais e de outro dispositivo com o mesmo `userKey` não anunciam
entrada/saída da contraparte. Mesmo eventos locais continuam sendo gatilhos de
reconciliação, nunca snapshots autoritativos do roster.

## Validação

A suíte do adapter inclui identidade tardia por Connected e timers, preferências
de preflight, retry limitado/manual, stop/unmount durante attach de recuperação,
aviso correto de teardown e limpeza do aviso após reentrada. Mantém regressões
de StrictMode, normalizadores do SDK 2.4.5, roteamento 1:1, mídia degradada,
destroy falho, eventos antigos e `leave(false)`.

O harness `tests/e2e/zoom-preview.spec.ts` usa Vite somente no teste local
(sem ler arquivos de ambiente), os componentes reais do TES, contextos isolados
e Chromium com mídia falsa. O SDK é um double determinístico e todo acesso
é interceptado; requisições fora da origem local são bloqueadas. Não valida
Auth, backend, host-first por webhook nem transporte real do Zoom. Cobre:

- terapeuta primeiro, paciente com identidade atrasada e câmera pré-ativada;
- um player em cada quadro, desligamento remoto sem afetar self-view;
- falha de detach ativa, refresh e saída/reentrada;
- falha persistente de prévia seguida de recuperação manual sem novo join;
- controle de recuperação com alvo de toque de pelo menos 44px em 390×844.

Resultados executados:

| Gate                                                      | Resultado                                             |
| --------------------------------------------------------- | ----------------------------------------------------- |
| Quatro regressões contra adapter original                 | 4 falharam, comprovando as lacunas                    |
| Vitest dirigido (Zoom, access route e estado do encontro) | 124 aprovados em 8 arquivos; 72 no adapter            |
| `npm run zoom:video-sdk:test`                             | 21 Deno + 105 Vitest aprovados                        |
| Playwright `zoom-preview.spec.ts`, Chromium               | 2 aprovados headless e 2 aprovados com `--headed`     |
| `npm run typecheck`                                       | Aprovado                                              |
| `npm run lint`                                            | Aprovado; aviso existente de depreciação do next lint |
| `npm run build`                                           | Aprovado, 120 páginas geradas                         |
| `git diff --check`                                        | Aprovado                                              |

O harness teve falhas de preparação corrigidas antes do aceite: middleware
registrado depois do fallback 404 do Vite e ambiente Next ausente no bundle
isolado. A execução headed exigiu autorização de sandbox para o bind local.
Nenhuma dessas falhas era do adapter. As capturas de estado degradado/recuperado
ficam nos artefatos locais ignorados de `test-results/zoom-preview-*/`.
As cores dos players nas capturas são mídia sintética, não uma chamada real.

`quick_validate.py` das skills não executou por ausência de PyYAML. Os
frontmatters foram validados com o `js-yaml` já instalado; fontes e links
adicionados foram revisados. Nenhuma dependência foi instalada.

Gates pesados executados serialmente. Snapshots durante esta rodada mostraram
CPU ociosa entre aproximadamente 16% e 65%; não houve início de outro gate
pesado durante o build. Nenhum serviço Supabase/Docker foi alterado.

## Arquivos alterados

- `src/features/zoom/zoom-video-session-adapter.tsx`
- `src/features/zoom/zoom-video-session-adapter.test.tsx`
- `tests/e2e/zoom-preview.spec.ts`
- `tests/e2e/fixtures/zoom-preview-entry.tsx`
- `tests/e2e/fixtures/zoom-preview-sdk.ts`
- `tests/e2e/fixtures/zoom-preview-image.tsx`
- `docs/zoom/patient-preview-recovery-2026-08-28.md`
- `docs/zoom/architecture.md`
- `docs/zoom/testing.md`
- `docs/zoom/troubleshooting.md`
- `skills/zoom-video-call/SKILL.md`
- `skills/zoom-integration/SKILL.md`
- `README.md`
- `AGENTS.md`

**Documentação atualizada.**

## Escopo e riscos

Sem banco, migration, RPC, Edge Function, JWT, autorização, rota ou mudança no
lifecycle lógico. Sem deploy, escrita HML/produção ou chamada Zoom real.
Nenhuma dependência adicionada; o harness usa o Vite já instalado pelo Vitest.
Testes de banco não se aplicam a esta correção exclusivamente do navegador.

Safari/iPhone e Android físicos continuam gates posteriores, com autorização
própria para homologação real. Chromium móvel não substitui esses dispositivos.
Frame dedicado da chamada no Figma: Não identificado nos arquivos analisados.
Conector Figma indisponível nesta rodada; layout preservado, com ação secundária
de recuperação e aviso funcional de 14px conforme tokens e patterns TES.
O placeholder preexistente dentro do self-view compacto tem texto parcialmente
recortado em 390×844; o novo controle externo de recuperação permanece visível
e operável. A composição interna do tile não foi redesenhada nesta correção.

## Continuidade: reentrada abrupta

Uma ocorrência posterior mostrou que as três tentativas temporizadas ainda
podiam terminar antes de o pipeline móvel anunciar captura pronta após o
aparelho desligar sem cleanup. A continuação orientada por
`video-capturing-change: Started`, novo ciclo de captura e preservação do
cleanup de privacidade em `pagehide` está em
[self-view após reentrada abrupta](./abrupt-reentry-self-view-2026-08-28.md).
