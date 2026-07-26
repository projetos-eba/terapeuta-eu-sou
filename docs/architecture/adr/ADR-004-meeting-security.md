# ADR-004 - Segurança da reunião online

Data: 2026-07-25

Status: aceito e implementado como fundação; homologação de produção pendente.

## Contexto

Paciente e terapeuta precisam acessar a mesma sessão, mas credenciais de host
não podem ser expostas ao paciente nem armazenadas em DTOs comuns.

## Decisão

- Reunião só pode ser criada após pagamento confirmado por webhook.
- `zoom_meetings` é a fonte operacional local; `bookings.meeting_url` é legado.
- O navegador não recebe `start_url`, token S2S, Account ID ou Client Secret.
- O paciente recebe somente payload Meeting SDK de participante.
- O terapeuta responsável recebe payload de host e ZAK efêmero sob demanda.
- ZAK e `start_url` não são persistidos. Se uma necessidade futura exigir
  persistência, o campo deve ser criptografado, versionado e inacessível por
  leitura autenticada direta.
- Abertura da sala respeita janela temporal e status do booking.
- A decisão autorizada retorna `allowed`, `reason`, `availableFrom`,
  `availableUntil` e `meetingStatus`.
- A rota Next exige `actorRole` e usa o cookie correspondente quando sessões
  de paciente e terapeuta coexistem.
- Pagamento é lido de `session_payments`; o campo legado do booking não
  participa da autorização.
- Terapeuta suspenso ou rejeitado não recebe payload de host.
- Reagendamento ou cancelamento invalida dados antigos da reunião.
- `SharedBookingSummary` não contém URL de host.
- Jobs e webhooks usam inbox/outbox idempotentes e RPCs privadas.
- Tópicos, logs e eventos não contêm conteúdo clínico.

## Alternativas

- Um único link para todos: rejeitada por permitir elevação de privilégio.
- Gerar reunião no frontend: rejeitada por expor credenciais e confiar no
  cliente.

## Consequências

Zoom é integrado por backend autorizado. Logs e erros nunca devem incluir
tokens ou URLs sensíveis. Antes do go-live ainda é obrigatório homologar ZAK,
definir alocação/capacidade de hosts, configurar cron e webhook remotos,
estabelecer retenção e executar testes reais no ambiente alvo.
