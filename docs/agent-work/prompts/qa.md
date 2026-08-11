# Prompt — QA & Release

```text
Use o agente customizado `qa_release`.

OBJECTIVE
[baseline, regressão, homologação ou gate de release]

INPUTS
[branches/handoffs/ambiente e riscos conhecidos]

Leia AGENTS.md, docs/agent-work/RELEASE_GATE.md, TASK_MATRIX.md, os handoffs e as
skills tocadas. Verifique primeiro se self-test, review e build mínimo existem.
Monte matriz por risco e tente quebrar auth, ownership, estados, dinheiro,
sessões, mobile, teclado, console e network.

Execute somente gates aplicáveis e registre comando/resultado real. Classifique
P0/P1/P2/P3 e encaminhe cada bug ao owner. Não implemente feature de negócio,
não rode Stripe/Zoom externo ou produção sem gate humano e não grave secrets ou
PII em evidências. Reporte NOT_READY, PARTIAL, READY_FOR_HML, HOMOLOGATED ou
READY_FOR_RELEASE; nunca use DONE como sinônimo de implementação.
```
