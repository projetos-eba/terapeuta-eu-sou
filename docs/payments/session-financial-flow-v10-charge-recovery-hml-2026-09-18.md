# Cobrança agendada e recuperação V10 — HML, 18/09/2026

Status: homologação em andamento; não aprova produção nem encerra a Fase 7.

## Limites da rodada

- Projeto HML: `emzwqkmrryuqvqiohqnu`; Stripe exclusivamente Test.
- Reserva descartável criada pelo checkout no IAB: `1b94d3c8-9e6c-4f89-bf8a-de8ef862b7f2`.
- Sessão em 19/09/2026, 09:00 Brasília; vencimento da cobrança em 18/09/2026, 09:00 Brasília.
- Cartão fictício de cadastro permitido e cobrança recusada, conforme a [documentação Stripe](https://docs.stripe.com/testing#declined-payments). Nenhum dado de cartão, senha ou secret é registrado neste relatório.
- O usuário executou o clique final de salvar o cartão. O navegador bloqueou a execução dessa ação pelo agente; não foi utilizado caminho alternativo para contornar o bloqueio.
- Não antecipar a cobrança, alterar o vencimento no banco ou disparar o worker manualmente: observar o cron real.
- Preservados o canário de 15/09 e `cf95afc2-8aeb-4e91-8461-4da6e427e334`.

## Evidências anteriores à cobrança

- Setup bem-sucedido, `usage=off_session`, uma tentativa de cadastro concluída e um único cartão vinculado ao setup ativo.
- Pagamento canônico V10 pendente, sem PaymentIntent, Charge, obrigação de repasse ou Transfer.
- Um único schedule `scheduled`, zero tentativas, vencimento `2026-09-18T12:00:00Z`.
- IAB: detalhe mostra `Reservado`, cobrança programada e sala indisponível; não afirma pagamento confirmado.
- Os e-mails de reserva do cliente e terapeuta constam como `delivered`, uma tentativa cada, com log de envio `success` ao papel correspondente em 11:52 UTC. Aceitação pelo serviço não comprova leitura na caixa de entrada.
- Código publicado de `process-session-charges`, `prepare-session-charge-recovery`, `email-outbox-dispatch`, `stripe-billing-webhook` e suas dependências: 33 arquivos TypeScript comparados após normalizar finais de linha; 33 correspondências, zero divergências. Downloads isolados em `.tmp/`, ignorada pelo Git; nenhum deploy realizado.
- Verificador read-only Stripe Test: três destinos corretos para HML, contratos de 27/8/11 eventos satisfeitos. Nenhuma ativação adicional de evento foi necessária.
- Política V10 ativa e V9 inativa; cron de cobrança e repasse ativos a cada minuto. Execução cron bem-sucedida apenas confirma a chamada agendada, não uma cobrança.
- Os três e-mails históricos de falha encontrados pertencem a V9; não são evidência de falha agendada V10. Não existe override desativando a ação `session_payment_declined`; o serviço usa envio automático por padrão quando não há configuração específica.

## Falha real e comunicação comprovadas

- O cron real iniciou a cobrança no vencimento, sem ajuste de relógio, antecipação de schedule ou chamada manual do worker.
- Em `2026-09-18T12:00:03.337099Z`, houve uma tentativa de cobrança e transição para `requires_customer_action`, com `last_error_code=payment_method_declined` e PaymentIntent vinculado ao schedule. Não houve Charge bem-sucedida nem Transfer.
- O evento `payment_intent.payment_failed` está `processed`, uma tentativa e nenhum erro de processamento. A Function publicada verifica a assinatura antes de processar.
- Uma única notificação `session_payment_declined`, título “Confirme o pagamento”, foi criada para o usuário paciente correto. O popover do IAB apresenta o aviso e o link deste encontro.
- Um único e-mail `session_payment_declined` ao paciente correto consta como `delivered`, uma tentativa, sem revisão ou erro do serviço. O log `success` registra envio em `2026-09-18T12:01:03.766Z`. Isso comprova aceitação pelo serviço, não recebimento ou leitura na caixa de entrada.
- IAB: encontro permanece `Reservado`, entrada bloqueada, ações de cancelamento/reagendamento indisponíveis na janela inferior a 24 horas e recuperação oferecida no detalhe.

## Bloqueio encontrado na abertura da recuperação

O clique em “Concluir pagamento” no HML apresentou “Não foi possível abrir a confirmação agora.”; não abriu o formulário Stripe.

Causa reproduzida em teste: `prepare-session-charge-recovery` usa o contrato compartilhado `ApiSuccess<T>` (`{ ok: true, data: T }`). `invokeSupabaseFunction` retorna o JSON completo, sem remover esse envelope. A rota Next tratava esse resultado como `T` e adicionava outro envelope, retornando `{ ok: true, data: { ok: true, data: T } }`. O componente procura `data.clientSecret`; com o contrato duplicado, não encontra o campo e interrompe a abertura. O teste anterior simulava incorretamente um resultado sem envelope.

Correção exclusivamente local: a rota valida o envelope e os campos de recuperação, extrai apenas `clientSecret` e um estado recuperável e devolve um único envelope ao componente. Respostas inválidas, incompletas, já concluídas ou com envelope duplicado retornam indisponibilidade em linguagem de produto, sem dados internos. Não modifica o pagamento, cria PaymentIntent, confirma cobrança ou altera permissões. Preserva o preflight autenticado da Function e a recuperação do mesmo pagamento.

Regressão: o teste com o formato real falhou antes da correção, demonstrando o envelope duplicado; após a correção, API e componente passaram nos 18 testes focados. Testes adicionais cobrem substituição de cartão, resposta malformada, estado não recuperável, autenticação e exclusão de campos internos.

Gates locais adicionais: `npm run typecheck`, `npm run lint` e `npm run build` concluíram com código zero. `git diff --check` não apontou problemas. A suíte Vitest integral foi iniciada com um worker, mas permaneceu sem resultado final por tempo excessivo; a execução foi interrompida e não é contabilizada como aprovada. Ela precisa ser repetida ou particionada antes do gate global.

O HML continua com a versão anterior da rota até o PR manual. Não foi usado caminho alternativo para efetuar o pagamento ou contornar a falha. Após a tentativa malsucedida de abrir a recuperação, uma segunda leitura confirmou que o schedule ainda possui uma tentativa, o mesmo PaymentIntent vinculado e zero Transfers ou jobs de repasse. O pagamento canônico permanece `pending`, sem Charge concluída e sem sessão de vídeo provisionada.

## Gates ainda em observação

1. Falha real da cobrança agendada persistida, webhook processado e ausência de repasse: comprovados nesta fixture.
2. Aviso único com link do encontro e e-mail de falha aceito pelo serviço ao cliente correto: comprovados; recebimento ainda depende da confirmação do usuário.
3. Após o PR manual, retestar abertura autenticada da recuperação no IAB, tentativa novamente e substituição por cartão de teste válido, reutilizando o mesmo pagamento pendente antes do início em 19/09/2026, 09h Brasília.
4. Uma única cobrança bem-sucedida e um único repasse, atualização dos badges e comunicações sem duplicação.
5. Autenticação bancária, repetição/concorrência, evento atrasado e limite de início da sessão seguem gates distintos e não podem ser presumidos aprovados por este caso.

Nenhuma migration, configuração remota ou deploy foi realizada nesta rodada. Houve correção local da rota Next, regressões e documentação; publicação permanece por PR manual. Evidências financeiras são consultas HML, Stripe Test e navegação real; testes locais de contrato não substituem a recuperação real pendente.
