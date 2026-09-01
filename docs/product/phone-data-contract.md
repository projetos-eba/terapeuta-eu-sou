# Contrato de telefone

## Pontos de cadastro

- `/cliente/cadastro` (paciente antes da autenticação);
- `/terapeuta/cadastro` (cadastro do terapeuta);
- `/app/configuracoes/perfil` (conta do paciente);
- `/terapeuta/configuracoes` (conta do terapeuta).

Todos usam o componente `PhoneInput`, com DDI selecionável e número nacional
formatado enquanto é digitado. A validação ocorre no navegador, na rota Next e
na Edge Function antes de persistir.

## Persistência

`profiles.phone` e `patient_profiles.phone` continuam contendo somente os
dígitos nacionais para preservar integrações existentes. O DDI selecionado é
armazenado em `phone_country_code` nas duas tabelas quando aplicável. Linhas
legadas sem DDI são interpretadas como Brasil (`55`) somente para exibição e
edição; nenhum número histórico é reescrito automaticamente.

O valor completo para integrações deve ser composto como `+<DDI><número>` após
as validações, sem expor dados de telefone em logs.
