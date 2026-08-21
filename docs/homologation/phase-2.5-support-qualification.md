# Fase 2.5 — QA e Qualificação do Suporte

Data: 2026-08-21  
Ambiente: HML (`Terapeuta-Eu-Sou-Homolog`)  
Status: BLOCKED antes do E2E autenticado

## Deploy de migrations

Preflight remoto confirmou exatamente duas migrations pendentes. Foram aplicadas em HML, sem seeds, roles, Vault ou produção:

1. `20260821210644_harden_structured_participant_messaging.sql`;
2. `20260821213315_therapist_support_ticket_threads.sql`.

A listagem remota posterior confirmou ambas registradas. O projeto de produção não é o projeto vinculado e não recebeu qualquer alteração.

## Bloqueio de qualificação

- O runtime web de HML ainda não foi comprovado no deploy que contém as APIs e páginas da Fase 2. Com a revogação de escrita REST direta, o runtime anterior não pode ser tratado como compatível para abertura de ticket.
- Esta sessão não possui as variáveis efêmeras de QA para terapeuta/Admin/paciente e URL de share necessárias ao harness multi-context.
- Sem runtime compatível e personas autenticadas, não é seguro simular ticket, resposta administrativa, nota interna, reabertura ou responsividade na HML.

## Gatilho de retomada

1. Publicar em HML o artefato que contém as migrations e o runtime Fase 1/2, em uma única janela de compatibilidade.
2. Disponibilizar credenciais QA efêmeras por mecanismo seguro no runtime, sem colocá-las em arquivos ou evidências.
3. Executar BrowserContexts independentes e registrar screenshots sanitizados de desktop, tablet e mobile.
4. Atualizar este relatório com lifecycle, isolamento, ticket histórico e `PARTICIPANT FREE TEXT BYPASS = BLOCKED` em HML.

Nenhum e-mail real, operação financeira, Zoom ou alteração de produção foi executada.
