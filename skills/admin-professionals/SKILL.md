---
name: admin-professionals
description: Operação de aprovação, publicação e suspensão de profissionais no TES.
---

# Admin Profissionais

## Fontes e rotas

- `therapist_profiles` é a fonte administrativa do cadastro; `therapist_verifications` registra a análise.
- `/admin/profissionais` é a visão operacional canônica; `/admin/profissionais/verificacoes` é a fila.
- A decisão usa `admin_execute_operation_command_v2`; motivo, `request_id`, auditoria e RBAC são obrigatórios.

## Detalhe do profissional

- A rota canônica é `/admin/profissionais/[professionalId]`.
- A tarefa dominante é decidir a próxima ação administrativa com base na
  situação do cadastro, publicação e sinais operacionais — não reproduzir um
  cadastro técnico em tela.
- Densidade: `Operational`. A primeira dobra reúne identidade, estado,
  publicação, fluxo do perfil e ações autorizadas; detalhes ficam em `Visão
  geral`, `Perfil`, `Serviços e terapias`, `Documentos` e `Histórico`.
- O detalhe deve exibir uma linha de progresso do perfil com os marcos
  `Cadastro criado → Enviado → Em análise → Aprovado → Disponível para
  agendamento`, separando claramente aprovação administrativa, publicação e
  recebimento de reservas.
- A aba `Perfil` substitui qualquer referência a formulário. Ela mostra apenas
  a projeção publicada de Meu perfil (`public_therapist_profile_content_v`) e
  os serviços elegíveis (`public_therapist_profile_services_v`). Rascunhos,
  documentos privados, seus metadados, IDs internos e dados de conta não são
  exibidos.
- A aba `Documentos` existe apenas para revisão privada/autorizada, usando o
  fluxo canônico `therapist-private-documents`; a primeira dobra não deve
  transformar anexos em conteúdo editorial.
- A abertura/baixar de documentos no detalhe deve passar por URLs assinadas e
  temporárias geradas para a sessão administrativa atual; nunca expor bucket,
  path interno ou anexos via read model público.
- Quando não houver versão pública elegível, informar a indisponibilidade de
  modo honesto; não inferir ou revelar conteúdo em rascunho.
- `Perfil público` só pode ser aberto quando a projeção segura estiver
  disponível. A aprovação administrativa continua distinta da publicação.
- Usar `StatusCluster` inline, hairlines e seções abertas antes de cards. A
  área de ação é contextual e usa `AdminOperationCommandPanel`; não duplicar
  comandos de verificação nesta rota.
- Desktop pode manter ações em rail; em tablet/mobile elas seguem o resumo e
  as abas viram uma grade acessível. Nenhuma aba pode depender de scroll
  horizontal da página.

## Regra de publicação

`get_therapist_publication_eligibility_v1` é a única regra: perfil aprovado, público, aceitando reservas online e com serviço ativo/reservável/online cuja terapia seja publicada, visível e de categoria ativa.

Verificação aprovada não altera switches públicos. Quando a regra falhar, exibir “Aprovado · publicação pendente” e os blockers devolvidos pela função.

## Estados

- `submitted → in_review → approved | changes_requested | rejected`.
- `changes_requested | rejected → in_review` pela ação de reabertura.
- Suspensão remove a elegibilidade; reativação restabelece somente a aprovação administrativa e deixa a publicação como `unpublished` até nova publicação do profissional.

## QA

- Testar as transições, idempotência, auditoria e bloqueio de não-admin.
- Confirmar que busca, perfil, serviços, slots e reserva aplicam a mesma elegibilidade.
- Validar a aba `Documentos` com pelo menos um anexo presente, um pendente e
  falha honesta quando a leitura privada não estiver disponível.
- Nunca incluir documentos privados ou seus metadados nos DTOs administrativos ou públicos.
