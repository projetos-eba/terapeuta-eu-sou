# Solicitação de nova terapia

## Escopo

Fluxo estruturado de uma pessoa terapeuta para sugerir uma terapia ausente no
catálogo. A rota canônica é `/terapeuta/mensagens/solicitar-terapia` e começa
no CTA “Não encontrou sua terapia?” do diálogo de Novo serviço.

## Fontes e regras

- Rota: `src/lib/routes.ts` (`routes.therapist.therapyCatalogRequest`).
- Entrada: `src/features/therapist-services/components/therapy-catalog-picker.tsx`.
- UI: `src/features/therapy-catalog-requests/therapy-catalog-request-page.tsx`.
- Comando autenticado: `therapy-catalog-request-command`; nunca usar o comando
  administrativo para envio por terapeutas.
- Referência visual raster: telas “Sugerir nova prática” fornecidas em
  16/08/2026. O Figma acessível não identificou um node específico deste fluxo.

## Dados e segurança

- `therapy_catalog_requests` guarda o payload versionado e idempotente.
- O payload v2 usa os temas ativos do Match como classificação principal da
  prática, com seleção obrigatória de 1 a 3 temas em `submission.themeIds`.
- `suggested_category_id` permanece apenas como compatibilidade histórica; não é
  mais a classificação principal exigida na solicitação do terapeuta.
- `therapy_catalog_request_materials` guarda somente metadados; arquivos ficam
  no bucket privado `therapy-catalog-request-materials`.
- Aceitar somente PDF, JPG, PNG, WEBP, DOC e DOCX de até 10 MB por arquivo.
- Links para materiais são temporários e emitidos após verificação de ownership
  ou permissão administrativa. Nunca renderizar `storage_object_path`.
- Uma solicitação aberta com o mesmo nome não pode ser duplicada pela mesma
  pessoa terapeuta. O estado `needs_information` permite reenvio.
- A aprovação não cria, publica ou altera uma terapia automaticamente.

## Estados e comunicação

`submitted`, `under_review`, `needs_information`, `approved`, `merged` e
`rejected`. Toda mudança administrativa requer motivo, grava auditoria, cria
notificação interna e tenta enviar e-mail transacional. Falha de e-mail não
desfaz a decisão.

## QA

- Verificar as cinco etapas em desktop, tablet e mobile; no mobile a coluna é
  única e o progresso e a ação principal permanecem acessíveis.
- Validar dados obrigatórios, temas ativos, compatibilidade de categoria legada,
  duplicidade, idempotência, reenvio, 1 a 3 temas do Match e limites de arquivo.
- Validar acesso cruzado entre terapeutas, URL temporária para admin e ausência
  de publicação automática após aprovação.
