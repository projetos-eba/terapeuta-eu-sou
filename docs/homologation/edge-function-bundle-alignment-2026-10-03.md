# Alinhamento de bundles de Edge Functions — 2026-10-03

## Escopo

Este plano trata exclusivamente dos bundles:

- `admin-email-management-command`: publicar em Produção o contrato já
  validado em HML/local;
- `therapist-profile-command`: publicar em HML e, após os gates de HML, em
  Produção.

Não há migration, alteração de schema, cron, Vault, secret, Stripe, agenda ou
movimentação financeira neste escopo. A migration de privilégios de
`SECURITY DEFINER` está explicitamente fora deste trabalho.

## Contratos esperados

### `admin-email-management-command`

- A listagem expõe somente a projeção sanitizada necessária ao painel.
- O detalhe informa `allowedTokens` a partir do registry canônico.
- `template.defaults` é resolvido a partir do template canônico quando não há
  override.
- O acesso continua restrito a JWT válido e papel administrativo.
- Publicação necessária: Produção. HML já corresponde ao repositório.

### `therapist-profile-command`

- `PROFILE_SUSPENDED` é traduzido para o contrato público existente
  `PROFILE_LOCKED`, sem vazar detalhe interno.
- A tentativa de transição com análise já em andamento é traduzida para
  `PROFILE_REVIEW_IN_PROGRESS`.
- A Function continua usando `verify_jwt = false` no gateway e autenticação
  obrigatória dentro do handler com `requireTherapist`; a ausência de bearer
  válido falha antes de qualquer comando.
- Publicação necessária: HML e Produção.

## Contrato explícito de autenticação no repositório

Os blocos abaixo reproduzem o comportamento remoto já observado; eles não
alteram a política efetiva dos ambientes:

| Function                         | `verify_jwt` | Defesa no handler                         |
| -------------------------------- | ------------ | ----------------------------------------- |
| `admin-email-management-command` | `true`       | `requireUser` + papel `admin`             |
| `patient-account-command`        | `true`       | `requirePatient`                          |
| `session-feedback-command`       | `false`      | `requireUser`                             |
| `therapist-private-documents`    | `true`       | `requireTherapist`/`requireUser` por ação |
| `therapist-profile-command`      | `false`      | `requireTherapist`                        |
| `therapist-services-command`     | `false`      | `requireTherapist`                        |

Risco residual: um deploy futuro que ignore `supabase/config.toml` e também
omita o flag correspondente da CLI pode divergir novamente. Por isso, a
verificação de metadata remota faz parte do gate pós-publicação.

## Ordem segura de publicação

1. Confirmar worktree sem alterações não relacionadas e executar testes Deno
   dos contratos compartilhados de e-mail e perfil.
2. Publicar `therapist-profile-command` em HML preservando
   `verify_jwt = false`.
3. Confirmar versão ativa, metadata `verify_jwt`, preflight CORS e recusa de
   chamada sem autenticação; inspecionar logs sem executar mutação de perfil.
4. Executar o plano funcional de HML descrito abaixo com conta de teste.
5. Somente depois dos gates de HML, publicar em Produção:
   `admin-email-management-command` com `verify_jwt = true` e
   `therapist-profile-command` com `verify_jwt = false`.
6. Repetir em Produção apenas os smokes não mutantes e verificar logs. Qualquer
   mutação produtiva exige uma autorização específica e uma conta controlada.

## Resultado da publicação de 2026-10-03

| Ambiente | Function                         | Versão | Estado   | `verify_jwt` | Smoke não mutante                           |
| -------- | -------------------------------- | ------ | -------- | ------------ | ------------------------------------------- |
| HML      | `admin-email-management-command` | 24     | `ACTIVE` | `true`       | Já alinhada; não foi republicada            |
| HML      | `therapist-profile-command`      | 24     | `ACTIVE` | `false`      | `OPTIONS 204`; sem bearer: `401` no handler |
| Produção | `admin-email-management-command` | 13     | `ACTIVE` | `true`       | `OPTIONS 204`; sem bearer: `401` no gateway |
| Produção | `therapist-profile-command`      | 14     | `ACTIVE` | `false`      | `OPTIONS 204`; sem bearer: `401` no handler |

Os deploys foram feitos individualmente e a segunda Function só avançou após o
gate da anterior. O smoke não executou envio de e-mail, salvamento, publicação,
alteração de slug, upload ou qualquer outra mutação. O teste funcional
autenticado de perfil permanece como etapa posterior deliberada, conforme o
plano abaixo.

## Plano de teste pós-publicação de `therapist-profile-command`

### Smoke técnico obrigatório em cada ambiente

- A Function aparece `ACTIVE` e com o `verify_jwt` esperado.
- `OPTIONS` responde sem erro de aplicação.
- `POST` sem bearer não executa comando e retorna falha de autenticação.
- Não há novo 5xx, timeout ou erro de importação nos logs após a publicação.

### Homologação funcional em HML

1. Autenticar um terapeuta de teste ativo e abrir `/terapeuta/perfil/editar`.
2. Executar a leitura do editor e confirmar rascunho, versão publicada,
   documentos privados resumidos e estado de análise sem perda de campos.
3. Salvar um rascunho idempotente e recarregar a página; confirmar persistência
   e ausência de publicação involuntária.
4. Em fixture suspensa, tentar publicar e confirmar erro de produto compatível
   com `PROFILE_LOCKED`, sem 500 e sem alteração da versão publicada.
5. Em fixture com análise já em andamento, repetir o envio e confirmar
   `PROFILE_REVIEW_IN_PROGRESS`, sem duplicar solicitação ou versão.
6. Confirmar que consulta/alteração de slug, validação de capability e bloqueio
   de tema por plano mantêm os contratos existentes.
7. Validar a página pública antes e depois: nenhum documento privado, estado
   interno ou detalhe de análise pode ser exposto.
8. Conferir os logs pelo `requestId` e confirmar ausência de erro inesperado.

### Regressão adjacente

- `therapist-services-command` continua listando o catálogo e os serviços do
  mesmo terapeuta autenticado.
- `therapist-private-documents` continua lendo a central privada sem expor
  objetos do bucket.
- O painel administrativo continua exibindo o estado de análise sem permitir
  que o terapeuta contorne a fila.
- Nenhum worker financeiro, cron, webhook Stripe ou regra de agenda é chamado
  por estes testes.

## Plano de teste pós-publicação de `admin-email-management-command`

- Sem JWT: bloqueio no gateway.
- JWT não administrativo: `403`, sem dados de template ou remetente.
- Admin, ação `list`: somente projeção sanitizada; nenhum secret, credencial do
  provedor ou HTML não sanitizado.
- Admin, ação de detalhe: `allowedTokens` e `template.defaults` correspondem ao
  registry local.
- Preview com HTML inseguro: elementos e atributos proibidos permanecem
  removidos.
- Não executar envio real durante o smoke de bundle.

## Critério de rollback

Rollback é redeploy do bundle remoto anterior da Function afetada. Como este
escopo não altera banco, secrets ou jobs, não há rollback de migration nem
compensação financeira. Em caso de regressão em HML, interromper antes de
Produção. Em caso de falha em Produção, preservar evidências e reimplantar o
bundle anterior sem executar comandos de perfil ou envio de e-mail.
