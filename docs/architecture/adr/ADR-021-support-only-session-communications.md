# ADR-021 — Suporte TES e comunicações vinculadas à sessão

Data: 2026-09-15  
Status: aceita; implementação concluída em código e pendente de validação local do PostgreSQL.
Substitui a ADR-016 sem apagar seu histórico.

## Contexto

A central anterior mesclava chamados TES, avisos da plataforma e mensagens
estruturadas entre paciente e terapeuta. O plano aprovado separa operação da
sessão e atendimento do TES. A comunicação entre participantes deixa de ser
um canal de mensagem; avisos objetivos e decisões ficam vinculados à reserva.

## Decisão

- `/app/suporte` e `/terapeuta/suporte` são as centrais canônicas. Tickets e
  avisos da plataforma permanecem; `/mensagens` e aliases legados são
  redirects permanentes.
- `conversations` e `messages` são histórico somente leitura. Endpoints
  de prévia e envio retornam canal encerrado, sem excluir registros.
- Atraso é um único `booking_event` por participante e versão da reserva,
  permitido de T−60 a T+10, notificado unilateralmente e sem efeito na
  tolerância. Uma entrada Zoom confiável encerra sua exibição.
- A primeira entrada confiável do terapeuta gera aviso único de sala
  disponível ao paciente; o contrato host-first do Zoom segue autoritativo.
- Reagendamento normal do paciente exige pelo menos 24 horas, com agenda
  autoritativa e transação no mesmo booking.
- Alteração solicitada pelo terapeuta deve usar
  `booking_reschedule_requests`, com escolha posterior do paciente. O prazo
  atual é 48 horas. A regra de 7 dias e reembolso automático por silêncio
  não entram nesta etapa.
- Cancelamento do terapeuta sem solução será
  `pending_admin_review`: sala, falta e repasse bloqueados. Nenhum Refund ou
  Transfer Reversal ocorre sem decisão explícita do Admin TES. O comando
  financeiro existente deve reconciliar reversal aplicável antes do
  reembolso, com idempotência.
- WhatsApp TES é canal operacional para preparação/entrada e sala ativa;
  tickets autenticados permanecem na Central de Suporte.
- A solicitação de terapia pertence a
  `/terapeuta/servicos/solicitar-terapia`, com redirect antigo.

## Estado de implementação em 2026-09-15

Rotas, central de suporte, encerramento do canal participante, aviso de atraso,
aviso de primeira entrada, WhatsApp da sala, corte de 24 horas, solicitação de
alteração pelo terapeuta, escolha do paciente e revisão financeira administrativa
estão implementados em código. A decisão financeira continua sendo exclusivamente
do Admin: o comando existente reconcilia a reversão de Transfer aplicável antes
do reembolso, usando as mesmas chaves idempotentes. A migration e os pgTAP novos
ainda precisam ser executados no PostgreSQL local: o Docker não está expondo o
socket neste ambiente. Nenhuma dessas mudanças é declarada pronta para produção
até que reset, lint do banco e pgTAP sejam concluídos.

## Divergência e risco

A política publicada menciona oferta de outro terapeuta “quando possível”.
Esta decisão oferece na interface desta etapa apenas o mesmo terapeuta ou
revisão de reembolso. Registrar a divergência, sem alterar copy jurídica sem
revisão legal. Não publicar a nova UI financeira antes de fechar os bloqueios,
testes de conciliação e homologação externa.
