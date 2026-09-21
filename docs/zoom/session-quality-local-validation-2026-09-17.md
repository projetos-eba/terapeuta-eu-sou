# Sessão, qualidade e confirmação — validação local

Data: 17/09/2026. Contrato vigente: ADR-023.

## Entrega e limites

Implementação exclusivamente local. Nenhum deploy, commit, push, alteração em
HML/produção, regularização da sessão testada, chamada real ao Zoom ou
movimentação Stripe foi executado. Alterações preexistentes foram preservadas.

Realização, qualidade, confirmação individual e financeiro são separados.
Após T+10 ultrapassado, a ausência bloqueia o acesso mesmo antes da persistência
do finalizador; T+10 exato permanece inclusivo. Apenas entrada confiável de ambos
na tentativa atual permite avaliação após encerramento. Transfer não confirma
sessão nem gera resposta em nome dos participantes.

Resposta negativa de qualidade mantém a realização e abre ticket privado
individual com prazo de cinco dias corridos. Só resposta pública do TES no
ticket correto encerra o relato. Confirmações automáticas respeitam os
vencimentos originais de sete/trinta dias após o fim previsto, suspendendo novas
confirmações durante os cinco dias de qualquer relato ainda não respondido.
Depois do vencimento, a análise e o alerta continuam, mas a automação retoma.
Sessão não realizada nunca é confirmada automaticamente.

Classificação, qualidade, análise e confirmação não escrevem em pagamentos,
Transfers, jobs de Transfer, Reversals ou Refunds. Ausência do terapeuta, sozinho
ou junto do cliente, permite somente reembolso integral explicitamente autorizado
pelo Admin, sem reagendamento ou execução automática. A decisão financeira
explícita continua no procedimento próprio; análise de qualidade oferece apenas
auditoria e resposta pelo suporte.

## Evidências executadas

- 129 verificações pgTAP aprovadas: 126 (18), 127 (23), 128 (7), 129 (10),
  130 (39), 131 (21), 132 (11). Cada suíte termina em rollback; os snapshots
  financeiros permanecem iguais nas ações operacionais e de qualidade.
- 371 testes Vitest aprovados em 58 arquivos do fluxo. Adapter Zoom e inbox
  Admin também passaram isoladamente (86 testes); após a última correção das
  mensagens financeiras, os três arquivos de apresentação passaram novamente
  (43 testes). Esses números de reexecução não são somados como casos novos.
- 26 testes Deno aprovados: Zoom (23) e contrato de feedback (3). Autorização
  cobre ausência calculada antes do finalizador, evidência ausente sem liberação,
  presença própria, reentrada, tolerância inclusiva e identidade exata da sala.
- `deno check` aprovado nas três Edge Functions alteradas; `npm run typecheck`,
  `npm run lint` e `git diff --check` aprovados. Lint sem avisos de ESLint;
  322 nomes de migrações válidos e únicos.
- 48 testes Playwright aprovados em Edge/Chromium, nos tamanhos 1440×900 e
  390×844: ausência nos três perfis, formulário positivo/negativo, análise aberta,
  vencida e respondida no cliente/terapeuta, auditoria de qualidade no Admin sem
  ações de reembolso/reagendamento. Sem scroll horizontal ou erros de execução.
  A primeira ampliação teve quatro falhas de seletor do teste, pois o Admin
  apresenta o status em três lugares; após corrigir a seleção, a suíte completa
  foi reexecutada e os 48 casos passaram.

## Banco isolado e instalação

A sequência foi aplicada em `tes_quality_fresh_20260917`, nova cópia do banco
local, sem schemas de cron/realtime/Vault. Permissões relevantes public/auth
foram restauradas; pgTAP foi instalado somente nessa cópia.

O banco original possuía histórico até `20260916060000`, mas isso não significa
que todas as versões anteriores estavam aplicadas. Os pré-requisitos de presença
`20260916040500`, `20260916041000`, `20260916041500`, `20260916042000` e
`20260916043000` estavam ausentes e foram aplicados apenas na cópia, antes da
sequência `20260916080000`–`20260916095000`. Todas as migrações compilaram;
as suítes 126–132 passaram nessa instalação nova.

Uma primeira restauração da cópia parou nas permissões de schemas excluídos.
Somente essa cópia temporária incompleta foi removida e recriada; seus dados
continuam recuperáveis a partir do original intacto. A cópia anterior
`tes_quality_validation_20260916` foi preservada, assim como a cópia nova.
O volume local e o banco original não foram substituídos, apagados ou migrados.
Conferência somente de leitura no original: zero jobs cron ativos e histórico
mantido até `20260916060000`.

Execução reproduzível, apontando obrigatoriamente para a cópia:

```powershell
Get-Content -Raw <migration-ou-teste.sql> |
  docker exec -i supabase_db_terapeuta-eu-sou psql -X -U postgres `
    -d tes_quality_fresh_20260917 -v ON_ERROR_STOP=1 -tA
```

Não considerar somente o exit code do pgTAP: qualquer linha `not ok` também
reprova a validação.

## Cobertura e limitações

Banco: T+10 exato/ultrapassado; ausência de cada participante e de ambos;
entradas antigas após reagendamento; histórico sem herança; 7/30 dias exatos;
5 dias exatos; dois relatos com prazos diferentes; nota interna/status sem
resposta; idempotência; evidência recuperada com resolução técnica; nenhuma
confirmação individual inventada. Privacidade validada via RLS, leitor SQL e
escolha do cookie correto quando os dois perfis estão no navegador.

Fila: sessões normais antigas não ocupam a página do finalizador. Jobs antigos
em recuperação ou dead letter não impedem encerramentos novos; retry mantém
seu intervalo. Autorizar reembolso antes do fechamento físico não invalida a
fila de ausência. O identificador exato é preservado, e reagendamento concorrente
invalida o encerramento pendente associado ao horário anterior.

As verificações de navegador montam componentes/páginas reais com fronteiras
de servidor/autenticação simuladas, bloqueando requests externos. Não são prova
de sessão Zoom real, entrega de e-mail, rota autenticada completa em HML ou
movimentação Stripe. A decisão de não modificar HML foi preservada.

Operações pesadas foram executadas em série, com snapshots de CPU/RAM. A máquina
oscilou entre aproximadamente 1,6–2,9 GiB livres em 15,8 GiB, e atingiu pressão alta
durante o navegador. Build de produção não foi executado nesta etapa; typecheck,
lint e testes funcionais passaram. Essa pendência e os testes externos exigem
etapa posterior, sem reaproveitar esta evidência como autorização de implantação.

As skills de feedback, detalhe do cliente, agenda/reviews do terapeuta e Zoom
orientaram a preservação da estrutura visual, o uso dos componentes existentes
e a privacidade por perfil. ADRs e orientações operacionais foram atualizados.
