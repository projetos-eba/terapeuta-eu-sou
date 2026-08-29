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
- A solicitação aceita exclusivamente de um a três temas ativos do Match.
  Referências históricas de categoria permanecem somente no JSON de auditoria
  da solicitação e não são lidas pelo produto.
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

## Confirmação de envio

- Ao concluir a quinta etapa válida, abrir `TESDialog` de confirmação antes de
  executar o comando autenticado.
- A confirmação exige aceite explícito da responsabilidade pelas informações,
  da ausência de promessas de cura ou resultados e da possibilidade de não
  aprovação. O botão de envio permanece indisponível sem esse aceite.
- Após resposta positiva do comando (e materiais enviados), abrir o diálogo de
  sucesso. Erros de envio permanecem no diálogo de confirmação e não podem
  produzir uma tela de sucesso.
- Não comunicar prazo de análise não documentado nem prometer aprovação,
  publicação ou disponibilidade automática da prática.

## QA

- Verificar as cinco etapas em desktop, tablet e mobile; no mobile a coluna é
  única e o progresso e a ação principal permanecem acessíveis.
- Validar dados obrigatórios, temas ativos, duplicidade, idempotência, reenvio,
  1 a 3 temas do Match e limites de arquivo.
- Validar que a confirmação aparece antes de qualquer chamada de envio, exige
  aceite explícito, mantém erro sem falso sucesso e exibe sucesso somente após
  resposta positiva.
- Validar acesso cruzado entre terapeutas, URL temporária para admin e ausência
  de publicação automática após aprovação.
