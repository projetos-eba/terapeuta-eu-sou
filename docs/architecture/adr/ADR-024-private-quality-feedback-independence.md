# ADR-024 — Avaliação privada independente de confirmação

Data: 2026-09-18  
Status: aceito.

## Decisão

A avaliação privada da qualidade da sessão é um sinal restrito ao TES. Seu
envio grava somente a resposta de qualidade da pessoa autora e, quando
aplicável, o relato privado para atendimento pelo Suporte.

Ela não cria, atualiza ou substitui confirmação individual, presença,
realização, classificação de ausência, pagamento, repasse, reembolso ou
qualquer decisão financeira. Esses processos permanecem independentes e são
controlados pelas respectivas evidências e rotinas autorizadas.

Um relato privado aberto também não pausa os prazos nem as rotinas de
confirmação automática. A análise permanece restrita ao TES até sua resposta,
sem alterar o status de realização nem criar efeito operacional para paciente
ou terapeuta.

Confirmações e seus prazos são informação operacional do TES. As superfícies
de paciente e terapeuta não apresentam confirmação como consequência, benefício
ou requisito do feedback privado.

Avaliações privadas já gravadas e confirmações históricas permanecem íntegras:
a mudança não apaga nem reclassifica registros anteriores.

## Consequências

- `submit_session_quality_feedback_v1` persiste somente qualidade.
- O estado `submitted` continua removendo a ação de avaliar para a pessoa que
  já respondeu, sem depender de confirmação individual.
- A avaliação pública do terapeuta continua opcional, é separada e só é
  apresentada ao paciente após uma avaliação privada positiva de encontro
  realizado.
- ADR-023 fica substituída apenas na seção “Envio único de avaliação e
  confirmação individual”.
