# ADR-006 - Configuração de horários do terapeuta

Data: 2026-07-26

Status: aceito e implementado; A3.0-A3.3 concluídos.

## Contexto

O Figma de Horários apresenta disponibilidade semanal, duração, intervalo,
buffer, antecedência e fuso como uma única experiência. No domínio, porém,
esses valores não possuem a mesma autoridade:

- a duração pertence ao serviço;
- buffers, antecedência, horizonte e cadência são configurações do serviço;
- o fuso é uma configuração de negócio do terapeuta;
- as faixas semanais podem ser gerais ou específicas por serviço;
- o preview não pode confirmar disponibilidade transacional.

O schema anterior também não possuía uma versão única para impedir que duas
abas sobrescrevessem a configuração de horários simultaneamente.

## Decisão

- `therapist_schedule_settings` é a fonte canônica do timezone IANA e da versão
  otimista da agenda.
- `therapist_services.duration_minutes` continua sendo a fonte da duração.
- `therapist_service_booking_settings.interval_minutes` permanece no banco por
  compatibilidade e é exposto no contrato como `slotStepMinutes`.
- Descanso e ocupação ao redor da sessão continuam representados por
  `buffer_before_minutes` e `buffer_after_minutes`.
- `availability_rules` continua armazenando as faixas semanais; `service_id`
  nulo representa a regra geral.
- Regras gerais e específicas para um serviço não podem se sobrepor.
- A gravação substitui atomicamente o conjunto de regras e atualiza somente as
  configurações de serviço enviadas.
- Toda gravação exige `expectedVersion` e `requestId`.
- O comando é executado por Edge Function autenticada e RPC restrita a
  `service_role`; o Next.js nunca recebe a chave administrativa.
- `therapist_profiles.metadata.timezone` recebe apenas uma projeção temporária
  de compatibilidade para read models anteriores à A3.
- O read model `get_therapist_schedule_v1()` deriva a identidade de
  `auth.uid()` e não aceita `therapist_profile_id`.
- O preview de A3 é informativo. A5 permanece como autoridade dos slots
  reserváveis.

## Contrato de interface

O formulário de A3.2 deixa claro se o escopo é geral ou de uma terapia. A
cópia implementada atua entre dias do mesmo escopo; uma futura alteração em
massa entre terapias deverá usar uma ação explícita como "Aplicar a todos os
serviços".

O campo visual "Duração da sessão" é somente leitura. "Intervalo entre
sessões" não é usado como sinônimo de `slotStepMinutes`; a interface usa
"Intervalo de oferta".

## Segurança e concorrência

- A Edge Function valida o access token e exige papel de terapeuta.
- Terapeutas suspensos ou rejeitados não podem ler ou alterar a configuração.
- A RPC deriva o perfil a partir do usuário autenticado pela Edge Function.
- Um advisory lock serializa gravações do mesmo terapeuta.
- Versão divergente retorna `schedule_version_conflict`.
- Repetir o mesmo `requestId` não reaplica a operação.
- O evento auditado contém somente ator, versões, contagens e request ID.

## Consequências

- A3.2 carrega e salva o formulário sem queries REST ou regras transacionais no
  componente.
- Atualizações concorrentes não produzem perda silenciosa de dados.
- A5 poderá consumir timezone, regras e configurações sem criar nova fonte.
- A UI ainda deverá tratar preview e confirmação como conceitos diferentes.
- A projeção de timezone em `metadata` deve ser removida quando todos os read
  models anteriores consumirem `therapist_schedule_settings`.

## Evidências A3.3

O fechamento técnico, a matriz de testes e os limites para A4/A5 estão em
`docs/architecture/agenda-a3-closure.md`.

## Alternativas rejeitadas

- Armazenar toda a configuração em `therapist_profiles.metadata`: rejeitada por
  falta de tipagem, versionamento e auditabilidade.
- Transformar duração em preferência global: rejeitada porque serviços podem
  ter durações diferentes.
- Salvar cada faixa diretamente pelo frontend: rejeitada por atualizações
  parciais, concorrência e autorização fragmentada.
- Antecipar o motor A5: rejeitada para preservar a separação entre configuração
  e disponibilidade reservável.
