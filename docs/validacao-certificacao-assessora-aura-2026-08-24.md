# Validação e certificação da Assessora Aura — 2026-08-24

## 1. Resultado

```text
AURA LOCAL: PASS
AURA SECURITY: PASS
AURA E2E: BLOCKED
HML: BLOCKED
SUÍTE GLOBAL: PASS
PRODUCTION READY: NO
```

O código, o banco local, as regressões de segurança, os testes direcionados,
TypeScript, ESLint, build e seed guard estão verdes. A certificação para
produção permanece bloqueada exclusivamente porque não houve uma sessão
Premium Plus autorizada para validação visual real e não houve execução em HML.

## 2. Contrato definitivo

### Nome e escopo

- O nome público é **Assessora Aura**. `Aura IA` é apenas nomenclatura
  histórica de referência visual; não é uma segunda funcionalidade.
- A implementação é determinística, com regras versionadas (`ruleVersion = 1`).
- Não há LLM, chat, embeddings, análise de sentimento, texto clínico ou
  recomendação generativa.
- A rota canônica é `/terapeuta/assessor-ia`, com capability `aura_full`,
  exclusiva de terapeuta Premium Plus ativo.

### Período

30 e 90 dias significam janelas históricas completas, no fuso configurado do
terapeuta, com intervalo semiaberto `[periodStart, periodEnd)`. A data de hoje
fica fora da janela histórica; disponibilidade futura continua sendo tratada
separadamente pelos próximos 14 dias.

### Recomendações persistidas

Uma recomendação persistida só é elegível quando todas as condições abaixo são
verdadeiras:

1. pertence ao `therapist_profile_id` derivado de `auth.uid()`;
2. está ativa, não expirada e com `is_active = true`;
3. não possui paciente ou booking individual associado;
4. não é seed/demo (`context.source` ou `evidence.source`);
5. usa uma regra registrada e a versão ativa conhecida;
6. possui `generated_at >= periodStart` e `generated_at < periodEnd`.

Assim, uma geração de 10 dias aparece em 30 e 90; uma geração de 60 dias não
aparece em 30, aparece em 90 quando ainda válida; uma geração de 365 dias não
aparece em nenhuma das janelas. Expirada, inativa, descartada ou pertencente a
outro terapeuta não participa da resposta.

### Avaliações pendentes

O contador de avaliações publicadas sem resposta usa exatamente a janela
selecionada. A resposta também informa `windowDays`, e a UI exibe “últimos 30”
ou “últimos 90 dias completos”, evitando misturar contador global com painel
contextualizado.

### Identidade e dismiss

O navegador envia somente:

- `recommendationKey` opaca;
- `periodStart`;
- `periodEnd`;
- `requestId` criado no servidor.

O contrato v2 não aceita `ruleKey` nem `ruleVersion` do cliente. O servidor:

- rejeita período adulterado;
- confirma terapeuta, plano Premium Plus e tenant;
- valida chave canônica contra a registry de regras;
- recalcula os sinais atuais e confirma que a regra poderia ser emitida;
- para registros persistidos, confirma UUID, dono, regra, versão, estado,
  validade, evidência e `generated_at`;
- grava somente a janela atual;
- mantém replay idempotente sem criar uma segunda linha.

Os RPCs v1 de leitura/dismiss que permitiam o bypass foram retirados do alcance
dos papéis de API. O cliente usa `get_therapist_aura_signals_v2` e
`dismiss_therapist_aura_signal_v2`.

### Privacidade

A resposta contém somente status, contagens, taxas protegidas por amostra
mínima, períodos, regras e evidência agregada. Não contém IDs de pacientes,
IDs de bookings individuais, nomes, comentários, textos clínicos, mensagens,
anotações privadas ou intake.

## 3. Causas, correções e evidências

### P0 — Persistência ignorava o período

- **Causa raiz:** `get_therapist_aura_signals_v1` filtrava status, validade,
  origem e tenant, mas não usava `generated_at` como pertencimento à janela.
- **Correção:** `get_therapist_aura_signals_v2` filtra por período completo,
  registry e geração histórica; a aplicação passou a consumir v2.
- **Evidência antes:** recomendação gerada há 365 dias aparecia em 30 e 90.
- **Evidência depois:** `083_aura_contract_security.sql` prova 10/60/365 dias,
  expirada, inativa, dismissed e outro terapeuta.
- **Resultado:** PASS local, 34/34 pgTAP Aura.

### P0 — Dismiss aceitava identidade inventada

- **Causa raiz:** a RPC v1 aceitava `rule_key`, `rule_version`, chave e período
  enviados pelo navegador e apenas validava formato/autorização superficial.
- **Correção:** v2 recebe chave/período, reconstrói a regra no servidor, prova a
  emissão atual e mantém apenas grant authenticated.
- **Evidência antes:** regra/chave fabricada podia gerar linha de dismiss.
- **Evidência depois:** chave inexistente, período adulterado, UUID inexistente,
  regra incompatível, Free, Premium, paciente e cross-tenant são rejeitados;
  dismiss inválido deixa zero linha indevida.
- **Resultado:** PASS local, com replay idempotente comprovado.

### P1 — Avaliações pendentes globais

- **Causa raiz:** a contagem não filtrava `published_at` pelo período.
- **Correção:** v2 filtra `published_at` pela mesma janela e devolve
  `windowDays` para o mapper/UI.
- **Evidência:** fixture local passou de histórico 7 para 30 dias 6; 90 dias
  permanece 7.
- **Resultado:** PASS local e semântica do texto alinhada.

### P1 — Dismiss sem feedback visual

- **Causa raiz:** a action podia lançar erro sem estado visual, retry ou
  bloqueio de clique concorrente.
- **Correção:** `TherapistAuraDismissForm` usa estado explícito compatível com
  React 18, bloqueia submissão concorrente, apresenta `role=alert` em erro,
  mantém o card acessível e chama refresh somente após sucesso.
- **Resultado:** coberto no conjunto final de 11/11 testes frontend Aura.

### P1 — Recomendações repetidas entre seções

- **Causa raiz:** o mesmo sinal de avaliações era renderizado como card
  acionável em “Recomendações da Aura” e como card de crescimento em “Leituras
  que merecem atenção”; registros live e persistidos da mesma regra também
  podiam chegar juntos ao mapper.
- **Correção:** enquanto houver sinal de avaliações pendentes, o card
  contextual de crescimento não é renderizado; o mapper deduplica por
  `ruleKey + ruleVersion` e prioriza a recomendação calculada em tempo real.
- **Evidência:** no navegador autenticado, 30 dias exibiu uma recomendação com
  6 avaliações e 90 dias uma com 7; o título contextual repetido não apareceu
  em nenhum dos dois períodos. Regressões cobrem UI e mapper.
- **Resultado:** PASS local, sem redundância observada.

### `cancelled_by_payment`

- **Decisão:** permanece fora da taxa comportamental de cancelamento. É um
  estado terminal de falha de pagamento, não cancelamento atribuído ao paciente
  ou terapeuta, e a sessão não aconteceu.
- **Evidência:** a RPC de sinais conta apenas `cancelled_by_patient` e
  `cancelled_by_therapist`; a regressão 083 verifica que a função não inclui
  `cancelled_by_payment`.

### Falha global externa identificada

As três falhas anteriores do teste global eram grants públicos implícitos em
cinco RPCs de suporte (`admin_get_support_ticket_thread_v2`,
`admin_reply_support_ticket_with_attachments_v1`,
`attach_support_ticket_requester_attachments_v1`,
`create_support_ticket_with_attachments_v1` e
`send_support_ticket_requester_message_with_attachments_v1`). Uma migration
isolada removeu EXECUTE de PUBLIC e preservou authenticated. A suíte global
passou sem alterar o teste.

## 4. Migrations

### Criadas neste ciclo

- `20260824160000_aura_contract_hardening.sql`: cria os RPCs Aura v2, aplica
  período de recomendações persistidas, escopo de avaliações, registry de
  regras, prova server-side do dismiss e revoga os RPCs v1 de bypass.
- `20260824161000_revoke_support_public_execute.sql`: corrige os grants
  públicos implícitos das cinco RPCs de suporte externas à Aura.
- `20260824162000_revoke_aura_v2_public_execute.sql`: remove o EXECUTE público
  implícito dos novos RPCs v2 e concede apenas a authenticated.

### Objetos e grants

- Novos: `get_therapist_aura_signals_v2(integer)` e
  `dismiss_therapist_aura_signal_v2(text,timestamptz,timestamptz,uuid)`.
- Revogados para API: `get_therapist_aura_signals_v1`,
  `dismiss_therapist_aura_signal_v1` e
  `dismiss_therapist_aura_recommendation_v1`.
- `anon` não executa Aura; `authenticated` só executa os v2.
- Nenhuma tabela foi resetada ou apagada.

### Rollback

O caminho é forward-only. Os dismiss já gravados permanecem válidos e podem
ser auditados. Em emergência, o app pode ser revertido somente junto de uma
migration de compatibilidade revisada; reabrir os RPCs v1 ou grants públicos
sem a mesma prova server-side não é um rollback seguro. O banco local foi
atualizado incrementalmente, sem `db reset`.

## 5. Testes e gates

| Gate | Resultado | Evidência |
| --- | --- | --- |
| pgTAP Aura | PASS | 34/34 em `083_aura_contract_security.sql`; seed guard 5/5 em `082_aura_seed_origin_guard.sql` |
| Banco completo | PASS | 1.788/1.788 testes, 86 arquivos |
| Frontend Aura | PASS | 11/11 testes diretamente Aura; 16/16 no conjunto Aura + mapper do dashboard, 5 arquivos |
| TypeScript | PASS | `npm.cmd run typecheck` |
| ESLint | PASS | 0 warnings e 0 errors; políticas visual/online-only sem violações |
| Build | PASS | `npm.cmd run build`; 119/119 páginas estáticas e rota Aura presente |
| Seed guard | PASS | 5/5 |
| E2E local | PASS | Playwright real autenticado como Premium Plus; 30/90, massa temporal, dismiss, refresh, vazio e responsividade comprovados |
| HML | BLOCKED | Não houve sessão/fixture Premium Plus HML autorizada nem confirmação do migration head remoto |

`supabase db push --local --dry-run` também retornou `upToDate: true` após a
aplicação incremental das migrations.

## 6. Segurança

```text
Anon: bloqueado na rota e sem EXECUTE nos RPCs Aura v2
Paciente: rejeitado por ausência de perfil de terapeuta
Therapist Free: CAPABILITY_NOT_ALLOWED
Therapist Premium: CAPABILITY_NOT_ALLOWED
Therapist Premium Plus: permitido quando ativo e autenticado
Cross-tenant: PASS; A não lê nem descarta B
IDs de pacientes expostos: não
Textos clínicos expostos: não
Payload arbitrário no dismiss: rejeitado; nenhuma gravação indevida
```

## 7. Validação visual

Os cenários locais foram executados em navegador real, com login normal de uma
conta Premium Plus de teste. A proteção de acesso também foi observada: a conta
sem capability Aura foi redirecionada para o ambiente Premium e não renderizou
a rota Aura.

| Cenário | Resultado | Evidência disponível |
| --- | --- | --- |
| 30 dias | PASS | 6 avaliações pendentes; recomendação de 10 dias presente; 60/365 dias ausentes |
| 90 dias | PASS | 7 avaliações pendentes; recomendações de 10 e 60 dias presentes; 365 dias ausente |
| Empty state | PASS | Após dismiss das recomendações da janela, UI exibiu “Nenhum sinal prioritário agora” |
| Erro | PASS | Payload adulterado foi rejeitado sem gravação; UI mostrou mensagem contextual e retry; fluxo normal voltou sem erro |
| Recomendação ativa | PASS | Card determinístico e cards persistidos renderizados com CTA acessível |
| Dismiss | PASS | Dismiss determinístico e persistido executados pela UI; loading/duplo clique cobertos em teste |
| Refresh pós-dismiss | PASS | Cards permaneceram ausentes após refresh; mapper agora filtra dismiss persistido |

Além disso, a viewport de 390 px e a de 1.440 px foram verificadas sem
overflow horizontal (`hasHorizontalOverflow: false`). O console do navegador
ficou sem erros na validação final.

### Interpretação da mensagem de falha

A mensagem “A Aura não conseguiu confirmar esta recomendação nesta janela” é
um bloqueio de integridade, não uma recomendação de negócio. Ela aparece
somente quando a recomendação mudou, já foi dispensada em outra sessão ou o
payload não corresponde a uma recomendação emitida pelo servidor. O teste local
adulterou deliberadamente o identificador oculto para provar esse bloqueio;
depois do refresh, a recomendação válida voltou normalmente.

No fluxo normal validado, o card exibido foi “Avaliações aguardam uma resposta”
com a ação “Responder avaliações”, baseado em 7 avaliações publicadas sem
resposta nos últimos 90 dias completos. Recomendações fora da janela, expiradas,
inativas, demo ou sem sinal elegível não são apresentadas.

## 8. Homologação

```text
HML: BLOCKED
```

Pré-condições exatas para fechar o gate:

1. URL HML autorizada e migration head confirmada;
2. conta Premium Plus de teste real, com credencial fornecida pelo canal seguro
   de execução, sem colocar senha no chat;
3. fixtures HML para um período com sinais, um período vazio, recomendação
   ativa e recomendação fora da janela;
4. execução headed dos cenários 30/90, erro, dismiss, refresh e isolamento
   entre duas contas;
5. evidência da resposta RPC sem dados individuais.

## 9. Veredito

**RELEASE CANDIDATE LOCAL DA ASSESSORA AURA CERTIFICADO**

- Todos os gates locais, de segurança e E2E autenticados estão verdes.
- A suíte global está verde em 1.788/1.788, sem mascaramento.
- As massas temporárias `aura-local-20260824` foram removidas após a validação;
  os dados demo existentes não foram alterados.
- HML continua sendo uma etapa de promoção separada: não foi executada e não
  pode ser substituída por evidência local.

### Atualização de validação local — 24/08/2026

Depois da revisão original, foi adicionada a regressão do mapper para impedir
que uma recomendação persistida dispensada reapareça após refresh. A massa
local usada foi removida e o banco voltou a `0` registros temporários e `0`
dismissals temporários. O código local está pronto para promoção posterior,
mas a certificação do ambiente HML ainda é obrigatória antes de afirmar a
produção remota como homologada.
