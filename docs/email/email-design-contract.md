# Contrato de design e conteúdo de e-mail — TES

Data: 2026-08-21
Status: aplicado aos defaults versionados do registry; não altera gatilhos,
remetentes, dados de domínio ou configurações persistidas.

## Fonte e precedência

O **Manual de Comunicação Automatizada — TES — Versão 1.0** define propósito, tom, subjects, preheaders, CTA, assinatura, footer e momento editorial. Este documento traduz esses requisitos para a fundação existente sem substituir o estado autoritativo do produto, as rotas canônicas ou as políticas de segurança.

O PDF é referência editorial, não uma instrução executável. Dados de domínio, autorização e timing só podem ser obtidos de comandos, RPCs e webhooks autoritativos do TES.

## Aplicação no runtime

- Os **27 eventos mapeados diretamente** ao Manual usam o conteúdo editorial e
  o shell HTML TES no `emailActionRegistry`.
- As duas extensões de catálogo de terapias também passaram a usar o mesmo shell
  visual, sem serem apresentadas como capítulos do Manual.
- O shell server-side usa tabelas de apresentação, fundo lilás discreto,
  container branco, CTA roxo acessível, resumo em tabela quando há dados
  mínimos e footer institucional. Os defaults não dependem de imagem remota e
  não repetem visualmente o título do assunto; o conteúdo permanece
  compreensível mesmo quando imagens são bloqueadas pelo cliente de e-mail.
- Subject, preheader, texto puro e HTML permanecem derivados do mesmo registry.
  O preheader é inserido de forma oculta e escapada no HTML enviado ao provider.
- Não foi adicionada migration nem alterada a versão corrente de template:
  snapshots da outbox continuam resolvíveis. Também não foram criados tokens para
  data, forma de pagamento, referência ou período quando eles não são resolvidos
  hoje pelo dispatcher.

## Princípios obrigatórios

- Clareza, objetividade, acolhimento, transparência e timing apropriado.
- Um e-mail explica uma situação; não cria urgência artificial nem promete resultado, aprovação, cura ou prazo inexistente.
- Subject sem dados terapêuticos, sem credenciais, sem token, sem informação financeira sensível e sem sensacionalismo.
- Um CTA principal, curto e descritivo, sempre para destino oficial TES. Nunca usar “Clique aqui”, “Veja mais” ou outro CTA genérico. Onde o Manual usa “Saiba mais”, a implementação deve nomear o destino real.
- Informações detalhadas, decisões, razões, documentos, dados de saúde e dados financeiros sensíveis ficam atrás de área autenticada.
- Não usar senha, segredo, chave, cabeçalho de autenticação, raw token, número completo de cartão, conta bancária, URL Zoom ou conteúdo terapêutico sensível.

## Estrutura editorial padrão

1. Subject curto e diretamente ligado ao evento.
2. Preheader complementar, sem repetir o subject.
3. Saudação pelo nome somente quando disponível e adequado.
4. Corpo em parágrafos curtos: o que ocorreu, impacto e próximo passo.
6. Blocos de detalhe somente com informação mínima pertinente: data/hora no timezone correto, estado, valor agregado, plano ou período.
7. Um CTA principal para a rota canônica, quando houver ação possível.
8. Encerramento humano e não promocional.
9. Assinatura: **Equipe TES**.
10. Footer institucional com identificação TES, Termos de Uso, Política de Privacidade e canal de ajuda/suporte aplicável.

Mensagens puramente informativas podem omitir CTA, mas nunca devem substituir um destino necessário por conteúdo sensível no e-mail.

## Preheader como contrato de template

Hoje o provider Hostinger recebe `subject`, `text` e `html`; ele não possui campo separado de preheader. A evolução proposta é tornar `preheader` obrigatório no tipo de template/registry e renderizá-lo duas vezes:

1. como texto semântico no resultado interno do renderer, para validação e testes; e
2. no topo do HTML, antes do conteúdo visual, em elemento oculto compatível com clientes de e-mail (`display:none`, `max-height:0`, `max-width:0`, `opacity:0`, `overflow:hidden`, `mso-hide:all`), escapado e seguido de preenchimento seguro para não puxar o primeiro parágrafo.

O preheader não será gravado como dado de negócio nem enviado para logs. O texto puro não receberá markup oculto. O renderer continua a entregar somente `subject`, `text` e `html` ao provider.

## Evolução incremental de `baseHtml()`

Não há necessidade de React Email, MJML ou outro framework. A evolução deve manter HTML de e-mail simples e compatível e introduzir primitives puras em `supabase/functions/_shared/email/templates.ts`:

| Primitive proposta                   | Responsabilidade                                               |
| ------------------------------------ | -------------------------------------------------------------- |
| `emailDocument()`                    | Idioma, meta tags, preheader oculto e container de fallback    |
| `emailHeader()`                      | Espaçamento estrutural sem dependência de imagem remota        |
| `emailParagraphs()`                  | Corpo seguro em parágrafos curtos                              |
| `emailDetailList()`                  | Data/hora, serviço, plano, período ou resumo financeiro mínimo |
| `emailStatusCallout()`               | Estado relevante sem usar cor como único sinal                 |
| `emailPrimaryCta()`                  | Link HTTPS oficial, label descritivo e fallback em texto       |
| `emailSupport()`                     | Orientação de suporte adequada à persona                       |
| `emailFooter()`                      | Assinatura institucional, termos e privacidade                 |

O shell poderá trocar gradualmente de `main`/layout atual por tabelas de apresentação apenas onde isso for necessário para compatibilidade entre clientes de e-mail. Não será feito redesign genérico nem alteração de tokens do produto. Toda primitive deve produzir texto alternativo coerente no campo `text`.

Como clientes de e-mail não recebem os CSS Variables do app, os defaults HTML versionados podem usar valores literais de cor correspondentes à identidade TES. Essa é uma exceção restrita ao renderer server-side e não autoriza hex hardcoded nas interfaces web.

## Tokens e dados dinâmicos

- Sintaxe oficial: `{{token}}`.
- A allowlist é por `actionKey`, tipada no registry e validada antes de persistir override, renderizar preview ou enviar.
- Token desconhecido, ausente, fora da allowlist ou inválido falha fechado.
- Valores em texto/subject/preheader removem quebras de linha; valores HTML são escapados por contexto; URL aceita apenas HTTPS/HTTP oficial permitido.
- Preview usa exclusivamente fixture fictícia do registry. Nunca consulta paciente, terapeuta, booking, pagamento ou documento real.
- Tokens devem ser semânticos (`meeting_starts_at`, `plan_name`, `payment_amount`) e nunca expor nome de coluna, segredo, payload Stripe completo, documento, diagnóstico ou raw token.

## Segurança de HTML e preview

HTML personalizado é sanitizado no servidor antes de persistir e novamente antes de renderizar/enviar. A allowlist não admite `script`, `iframe`, `form`, `object`, `embed`, `svg`, handlers `on*`, `javascript:`, `data:` ou protocolo arbitrário. Imagens precisam usar HTTPS. O preview administrativo deve continuar em `iframe sandbox=""`; o HTML nunca é inserido diretamente no DOM do Admin.

## Dados por tipo de comunicação

| Tipo                     | Pode conter                                        | Não pode conter                                                   |
| ------------------------ | -------------------------------------------------- | ----------------------------------------------------------------- |
| Auth                     | Nome, ação, URL única e expiração quando aplicável | Senha, token bruto em log, IP integral, credencial                |
| Verificação profissional | Estado e rota autenticada                          | Documento, justificativa detalhada ou informação privada          |
| Encontro                 | Serviço, data/hora/timezone e rota autenticada     | Link/credencial Zoom, dados de saúde, motivo de cancelamento      |
| Financeiro               | Valor agregado, moeda, status e rota               | Cartão, banco, payload Stripe, motivo bancário não compartilhável |
| Assinatura               | Plano, vigência e rota                             | IDs Stripe ou dados de cobrança sensíveis                         |
| Legal/LGPD               | Protocolo/estado mínimo e rota segura              | Conteúdo de solicitação, dados pessoais desnecessários            |

## Acessibilidade e idioma

- Idioma único: `pt-BR`, com acentuação correta (“Olá”, “confirmação”, “você”).
- Conteúdo compreensível sem cor, imagem ou CSS avançado.
- Links com destino explícito e contraste suficiente.
- Imagens decorativas podem ser omitidas; imagens informativas exigem texto alternativo curto.
- Data/hora deve usar timezone do evento/destinatário definido pelo domínio, nunca o timezone do worker.

## Configuração administrativa

Defaults são oficiais e versionados em código. `email_action_settings` armazena apenas estado operacional, perfil de envio e overrides. Restaurar padrão remove overrides (`NULL`), não replica o template oficial no banco. Alteração administrativa vale para novas entregas; uma entrega já enfileirada usa o snapshot de versão, override sanitizado e remetente obtido no enqueue.

`enabled=false` impede novos envios; `automatic_dispatch_enabled=false` impede criação automática. Alterar configuração não deve reativar entrega antiga nem reescrever conteúdo histórico.

A Central de E-mails sincroniza a lista de remetentes ativos com a Hostinger no
servidor, quando consultada por um Admin. Essa leitura não envia mensagens,
não expõe credenciais e preserva o último estado seguro se o provider estiver
indisponível. Apenas caixas retornadas pelo provider podem aparecer no seletor
de remetente de cada evento.

## Logs e observabilidade

`email_delivery_logs` deve conter somente dados operacionais mínimos: action key, status, tentativa, correlação, entidade relacionada, remetente, destinatário mascarado na UI e erro sanitizado/truncado. Não registrar corpo, token, senha, segredo, cabeçalho ou payload bruto. A outbox registra referência/estado e não dados terapêuticos desnecessários.
