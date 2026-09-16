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

## Unicidade para terapeutas

Desde a migration de transição de telefone, um novo telefone normalizado
(`DDI + dígitos nacionais`) só pode pertencer a uma conta de terapeuta. A regra
é aplicada no PostgreSQL e alcança cadastro, configurações e qualquer escrita
autorizada fora da interface. DDI e telefone são comparados somente por seus
dígitos; DDI ausente em dado legado equivale a `55`.

Duplicidades históricas entre terapeutas não são reescritas nem bloqueiam a
atualização da própria conta; apenas novas colisões são rejeitadas. A regra não
se aplica a pacientes, e telefone vazio continua permitido nas configurações
existentes. Não há índice único definitivo enquanto a reconciliação desses
legados não for aprovada.

### Preflight de deploy

Antes de publicar a migration, a operação deve executar uma consulta
administrativa que devolva somente a quantidade de grupos duplicados e de
perfis afetados, agrupando por DDI normalizado e dígitos nacionais. A consulta
não pode selecionar, registrar em log ou exportar o telefone; a correção de um
grupo legado exige processo administrativo separado e autorização explícita.
