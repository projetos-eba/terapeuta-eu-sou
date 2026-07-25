# ADR-004 - Segurança da reunião online

Data: 2026-07-25

Status: aceito como contrato; implementação de Zoom permanece futura.

## Contexto

Paciente e terapeuta precisam acessar a mesma sessão, mas credenciais de host
não podem ser expostas ao paciente nem armazenadas em DTOs comuns.

## Decisão

- Reunião só pode ser criada após pagamento confirmado por webhook.
- Identificador, URL de participante e credencial de host têm permissões
  diferentes.
- Credencial de host deve ser protegida por criptografia e RLS.
- Abertura da sala respeita janela temporal e status do booking.
- Reagendamento ou cancelamento invalida dados antigos da reunião.
- `SharedBookingSummary` não contém URL de host.

## Alternativas

- Um único link para todos: rejeitada por permitir elevação de privilégio.
- Gerar reunião no frontend: rejeitada por expor credenciais e confiar no
  cliente.

## Consequências

Zoom será integrado por backend autorizado. Logs e erros nunca devem incluir
tokens ou URLs sensíveis.
