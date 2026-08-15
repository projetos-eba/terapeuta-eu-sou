# Admin People Operations

Use esta skill ao alterar módulos admin de pessoas, operação e moderação:
profissionais, verificações, clientes/pacientes, sessões, suporte e avaliações.

## Fontes obrigatórias

- `AGENTS.md`
- `docs/architecture/admin-plan.md`
- `docs/product/routes-map.md`
- `docs/product/page-inventory.md`
- `docs/product/integration-map.md`
- `docs/design-system/design-system.md`
- `src/lib/routes.ts`
- `src/features/admin-shell/admin-shell-config.ts`
- `src/features/admin-operations/*`
- `src/features/admin-dashboard/*`
- `supabase/migrations/*profile*`
- `supabase/migrations/*booking*`
- `supabase/migrations/*reviews*`
- `supabase/migrations/*support*`
- `supabase/migrations/*payments*`

## Rotas

- `/admin/profissionais`
- `/admin/profissionais/verificacoes`
- `/admin/pacientes` exibida como `Clientes`
- `/admin/sessoes`
- `/admin/sessoes/[sessionId]`
- `/admin/suporte`
- `/admin/suporte/[ticketId]`
- `/admin/avaliacoes`

## Componentes e dados

- Página compartilhada: `AdminOperationPage`
- Página dedicada de profissionais: `AdminProfessionalsPage`
- Página dedicada de clientes: `AdminPatientsPage`
- Detalhe dedicado de sessão: `AdminSessionDetailPage`
- Detalhe dedicado de suporte: `AdminSupportDetailPage`
- Consulta compartilhada: `getAdminOperationPage`
- Mapeadores: `mapAdminOperationRows`
- Read model: `admin_get_operation_module_v2(p_module, p_query)` para listas
  com `search`, `status`, `sort`, `page` e `pageSize`.
- Detalhe: `admin_get_operation_detail_v1(p_module, p_id)`.
- Comandos: `admin_execute_operation_command_v2(...)`, delegando comandos
  legados para v1 e cobrindo `verification.pause_review` e
  `verification.reopen_review`.
- Fontes:
  - `therapist_profiles`
  - `therapist_verifications`
  - `patient_profiles`
  - `bookings`
  - `support_tickets`
  - `reviews`

As páginas usam token admin autenticado no servidor Next e RPC Supabase sem
`service_role`. Leituras bloqueadas por RLS/grants aparecem como
`Indisponível`, nunca como zero. Filtros e paginação vivem na URL para suportar
refresh, cópia de link e QA com Playwright.

## Referências visuais

- Figma `Page / Admin Plataforma / Profissionais — editável` (`13425:1020`):
  hero, KPIs, painéis de apoio e tabela operacional da rota
  `/admin/profissionais`.
- Figma `Page / Admin Plataforma / Clientes — editável` (`13425:1394`):
  hero, KPIs, painéis de apoio e tabela operacional da rota `/admin/pacientes`.
  A implementação atual substitui o card de suporte por faixas de tempo desde a
  última atividade disponível na lista; só chamar de "última sessão" quando o
  contrato expuser esse dado diretamente. Títulos dos cards analíticos devem
  seguir o padrão compacto com ícone e `text-lg`.
- Raster `Detalhe do profissional`:
  `/Users/antoniofelipe/Downloads/ChatGPT Image Aug 10, 2026, 11_25_43 PM (1).png`
  como direção visual para `/admin/profissionais/[professionalId]`, usando
  somente monograma, tiles reais e seções honestas.
- Raster `Detalhes do cliente`:
  `/Users/antoniofelipe/Downloads/ChatGPT Image Aug 10, 2026, 11_25_43 PM (2).png`
  como direção visual para `/admin/pacientes/[patientId]`, sem objetivo,
  progresso, contato ou histórico clínico.
- Raster `Verificações de profissionais — fila`:
  `/Users/antoniofelipe/Downloads/ChatGPT Image Aug 10, 2026, 11_25_44 PM (3).png`
  como direção visual para `/admin/profissionais/verificacoes`, preservando só
  métricas reais total/pendentes, filtros atuais e links de detalhe.
- Raster `Verificações de profissionais — detalhe`:
  mesma referência raster acima, usando o painel direito apenas como direção
  de hierarquia para `/admin/profissionais/verificacoes/[verificationId]`,
  sem documentos, checklist, observação persistida ou PII extra.
- Figma `Design System / Componentes / 09 Patterns administrativos`
  (`12857:666`): referência estrutural para `/admin/sessoes` e
  `/admin/suporte`, com cabeçalho editorial, KPIs escaneáveis, resumo
  contextual e tabela responsiva contida no grid.

### Sessões e suporte

- `/admin/sessoes` usa `AdminOperationalOverviewPage` com agenda em tabela no
  desktop e cards no mobile. Exibe somente sessão, profissional, cliente,
  horário, duração, pagamento, status e link de detalhe já existentes no DTO.
- `/admin/suporte` reutiliza a mesma estrutura visual com colunas específicas
  para assunto, solicitante, categoria, prioridade, status e detalhe.
- Os resumos por status são derivados exclusivamente de `data.rows` e devem ser
  descritos como recorte da página atual, nunca como distribuição da base.
- O identificador técnico `Booking` não deve ser renderizado na lista de
  sessões. Referências internas continuam disponíveis apenas no detalhe quando
  forem apresentadas em linguagem de produto.
- Estados vazio, restrito e indisponível usam copy específica do módulo e não
  propagam mensagens recebidas da infraestrutura.
- Os detalhes de Sessão e Suporte seguem a hierarquia visual dos detalhes de
  Profissional e Cliente: breadcrumb, título editorial, hero de identidade,
  KPIs, seções de dados e histórico lateral.
- O detalhe de Sessão exibe agenda, duração, participantes, formato online,
  pagamento, estado, presença na sala, horários reais, motivo de encerramento,
  resumo de participação e acompanhamentos automáticos presentes no DTO seguro.
  Identificadores do provedor, nome interno da sala, chaves, correlações e IDs de
  perfil não aparecem na interface.
- O detalhe de Suporte exibe solicitante, categoria, prioridade, urgência,
  vínculo com reserva, rastreabilidade e os comandos já autorizados. Não
  inventar descrição, SLA, responsável ou conversa quando ausentes.

## Fluxo crítico

- Ao publicar ou reenviar um perfil de terapeuta, o banco deve sincronizar a
  fila na mesma transação da publicação por meio de
  `sync_therapist_verification_queue_on_publish_v1`:
  - cria `therapist_verifications` quando o perfil publicado ainda não entrou
    na fila;
  - reenfileira registros em `changes_requested` ou `rejected` como
    `submitted`;
  - ajusta `therapist_profiles.status` para `submitted` quando o perfil entrou
    em revisão e ainda não estava aprovado/suspenso.
- A nomenclatura administrativa deve distinguir:
  - `draft`: `Perfil em construção`;
  - `submitted`: `Aguardando análise`;
  - `in_review`: `Em análise`.
- Ações seguem a sequência `submitted` → `in_review` → decisão. Os comandos
  administrativos de decisão preservam a experiência de uma ação e fazem a
  passagem por `in_review` atomicamente no servidor; uma atualização direta de
  `submitted` para um estado final continua bloqueada. Reabrir somente após
  ajuste solicitado ou não aprovação; não oferecer nova decisão para registro
  já aprovado.
- `enforce_therapist_verification_transition_v1` deve preservar essa sequência
  no banco mesmo quando um comando for chamado fora da interface.
- A lista `/admin/profissionais/verificacoes` continua lendo apenas
  `therapist_verifications`; perfis aptos não devem depender de inferência
  client-side para aparecer.
- `professional.publish` é o único comando administrativo que pode ativar a
  presença pública e as reservas. Ele exige `admin.professionals.verify`,
  motivo, `request_id`, auditoria e critérios autoritativos satisfeitos; nunca
  é uma exceção aos blockers de serviço, terapia, categoria ou online-only.
- Relações entre profissional e verificação existem apenas nos DTOs seguros
  para decidir o destino de navegação. Não renderizar UUIDs técnicos na tela.
- O reparo de inconsistências nunca aprova automaticamente: perfis publicados
  elegíveis sem fila entram como `submitted`; aprovados e suspensos permanecem
  inalterados.

## Regras

- Não expor conteúdo clínico, intake, mensagens privadas, URL secreta de
  reunião, descrição completa de ticket ou comentário de review em listas.
- Documentos de verificação não devem ser enviados em payload de listagem.
- Ações críticas só podem existir por comando allowlisted com permissão
  server-side, motivo, `requestId` e auditoria append-only.
- Suspensão, aprovação, reprovação, reembolso, reagendamento, ocultação de
  avaliação e resolução de suporte devem preservar histórico.
- Sessões usam `bookings` como fonte operacional; Zoom e financeiro continuam
  subordinados aos domínios próprios.
- Reviews em listagem devem mostrar estado/moderação, não comentário completo.
- Telas admin não devem expor termos de desenvolvimento no front-end, como
  nomes de tabela, read model, stack, ambiente, debug, mock, seed, TODO ou erro
  interno. Usar linguagem de produto para estados indisponíveis e registrar
  detalhes técnicos apenas em logs, testes ou documentação.

## Benchmark B — Profissionais

O Benchmark B de `/admin/profissionais` usa densidade `Operational` e foi
aprovado com `86,5/100` e foi estruturado para triagem por exceção, não como
dashboard analítico.

Decisões da página:

- header aberto e compacto, específico do Admin; não usar o wrapper card-heavy
  de `AppPageHeader` nem alterá-lo globalmente;
- `MetricStrip` local no desktop/tablet, com somente as quatro métricas
  autoritativas do read model; no mobile a faixa é omitida para colocar a
  primeira entidade na primeira dobra, e o total do recorte permanece no header
  da lista;
- uma única surface operacional, sem sombra, contém filtros, tabela/lista e
  paginação;
- busca permanece visível; status e ordenação ficam visíveis no desktop/tablet
  e recolhidos no mobile;
- desktop usa `OperationalTable` com identidade, situação, disponibilidade,
  contexto e ação textual;
- tablet/mobile usam `ResponsiveEntityList`, com dividers e sem card/caixa para
  cada atributo;
- status usa ponto semântico + texto + orientação curta; plano, publicação e
  reservas não viram pills por padrão;
- `Ver profissional` permanece ação textual visível; aprovação continua na fila
  de verificações e suspensão/reativação no detalhe;
- estados `empty`, filtro sem resultado, `unavailable` e `forbidden` permanecem
  distintos;
- loading route-level preserva a anatomia da operação sem inventar registros;
- `ContextRail`, `CommandBar`, cores semânticas de terapia e componentes locais
  da Agenda não são transferidos para esta página.

Candidates locais até Calibration:

- `OperationalTable`;
- `ResponsiveEntityList`;
- `MetricStrip`;
- `OperationalFilterBar`;
- `EntityIdentity`;
- `OperationalStatus`;
- `OperationalPagination`;
- `ExceptionSummary`.

Não promover esses candidates nem consolidar as duplicações de filtros,
métricas, status e paginação antes do Benchmark C e da Calibration.

## QA

- `npm run test -- admin-professionals-page admin-operations.mappers admin-operations.queries admin-list-query admin-shell-config`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Playwright:
  - sem sessão admin, cada rota redireciona para `/admin-login`;
  - com admin seed, cada rota renderiza título, métricas, filtros, paginação,
    guardrails e lista ou estado indisponível/vazio honesto;
  - confirmar que o menu expõe somente rotas implementadas;
  - confirmar que review comment, ticket description e meeting URL não aparecem
    em listagens.
  - em `/admin/profissionais`, validar busca, zero resultado, limpar filtros,
    detalhe, disclosure mobile e ausência de overflow em 1440, 1024 e 390px;
  - abrir um detalhe real de Sessão e um de Suporte; verificar breadcrumb,
    campos traduzidos, ação de suporte disponível e ausência de termos internos.
  - publicar um perfil elegível e confirmar, na mesma transação, uma única
    verificação `submitted` e o status administrativo `submitted`;
  - confirmar que republicação não duplica a fila nem rebaixa aprovados;
  - em Playwright, validar tanto `Iniciar análise` quanto a decisão administrativa
    auditada a partir de um item aguardando análise.

## Pendências conhecidas

- Evoluir a implementação interna da v2 para busca em toda a base quando volume
  real ultrapassar a janela sanitizada atual de até 50 registros por módulo.
- Abas em detalhes continuam pendentes até existirem contratos funcionais para
  conteúdo e ações adicionais.
- Validar Supabase Advisor em HML/remoto antes de declarar fase homologada.
- Manter a tela dedicada de profissionais alinhada ao Figma `13425:1020` sempre
  que o contrato de dados evoluir para especialidade, crescimento, pacientes,
  sessões e avaliação por profissional.
- Manter a tela dedicada de clientes alinhada ao Figma `13425:1394` quando
  existirem métricas consolidadas de recorrência, ticket médio, responsável,
  próxima sessão, plano e engajamento.
- Os detalhes de profissional e cliente seguem a direção visual dos rasters,
  mas só podem renderizar os campos já mapeados em `admin_get_operation_detail_v1`;
  avatar real, contato, avaliação, receita, retenção, responsável, jornada e
  notas clínicas continuam fora do escopo.
- A fila e o detalhe de verificações não exibem documentos, preview de anexos,
  exportação, prioridade, responsável ou observação persistida enquanto esses
  dados não fizerem parte do contrato seguro do módulo.
- Séries temporais, taxa de conclusão, duração média, SLA de suporte e
  responsável pelo ticket permanecem indisponíveis nas páginas de Sessões e
  Suporte até existirem em contrato seguro e documentado.
