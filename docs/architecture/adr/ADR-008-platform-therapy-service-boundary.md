# ADR-008 - Terapia da Plataforma e Serviço do Terapeuta

Data: 2026-07-28

Status: aceito.

## Contexto

O TES usa terapias em catálogo público, Match, perfil público, busca, agenda e
booking. Antes desta fase, `therapist_services` já referenciava `therapy_id`,
mas a fronteira de criação/edição de serviços ainda não estava consolidada como
autoridade server-side idempotente.

## Decisão

- `therapies` continua sendo entidade canônica da plataforma.
- Terapeutas não criam terapias por texto livre.
- Serviços do terapeuta só podem ser criados por `therapyId` validado no
  servidor.
- `therapies.is_available_for_services` controla criação de novos serviços e é
  separado de `status`, visibilidade pública e Match.
- `matching_therapy_settings` continua sendo a única ativação de Match.
- Mutações de serviço passam por RPCs transacionais chamadas por Edge Function
  autenticada; o app Next é apenas adaptador fino.
- Criação e alterações usam `requestId` UUID idempotente e `version` otimista.
- Views públicas só usam serviços ativos, online, bookable e de terapeutas
  aprovados/publicados.

## Consequências

O Admin futuro deve editar terapias por uma superfície própria. O shell do
terapeuta consome o catálogo permitido e a lista privada de serviços, sem
service role no Next. Bookings e snapshots históricos seguem apontando para o
serviço original, mesmo quando a terapia deixa de aceitar novos serviços.

## Alternativas Rejeitadas

- Criar terapia automaticamente a partir de nome digitado: rejeitada por
  duplicidade, risco editorial e quebra do Match.
- Resolver regras de plano no navegador: rejeitada por TOCTOU.
- Índice único global para terapeuta/terapia: adiado porque fixtures e histórico
  existentes podem conter duplicidades; novas mutações já bloqueiam duplicidade.
