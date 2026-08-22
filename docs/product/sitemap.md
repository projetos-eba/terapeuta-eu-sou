# Sitemap do Produto

Mapa canônico de áreas, rotas e fluxos do Terapeuta Eu Sou. A página Figma `↳ Jornadas dos Usuários`, node `12272:2` (`12272-2` na URL), define navegação, permissões e relação entre páginas.

## Fontes

1. Figma `↳ Jornadas dos Usuários` (`12272:2`, frame principal `12280:2`): sitemap, fluxos e permissões.
2. Documentação de produto: regras de negócio, planos e terminologia.
3. Figma `Design Telas` (`5999:10563`): layout e componentes.
4. Pasta `Referencias`: direção visual por perfil.
5. Inferência controlada: marcada como `inferido`.
6. `docs/product/integration-map.md`: mapa operacional de rotas, páginas, views, APIs e skills.

## Regras

- Rotas técnicas usam hífen, sem acento e sem espaço.
- Labels visuais podem usar acentos.
- A profundidade não é forçada. N4 só existe para detalhe ou subárea real. N5 fica reservado.
- `/app` é a entrada canônica do paciente.
- `/terapeuta` é a entrada canônica de todo terapeuta autenticado.
- Plano e capability alteram acesso e conteúdo, não o namespace.
- `/basico/*`, `/pro/*` e `/plus/*` são redirects temporários para
  `/terapeuta/*`.
- `/terapeutas/*` permanece reservado ao catálogo e ao perfil público.
- `/para-terapeutas` concentra a decisão pública de planos e benefícios.
- Sessões e mensagens do plano Free existem em `/terapeuta/sessoes` e
  `/terapeuta/mensagens`.
- Favoritos do paciente separam terapeutas e terapias.
- Premium Plus concentra histórico operacional do paciente em
  `/terapeuta/pacientes/:slug-do-paciente`, protegido por capability.

## Público

Área aberta para descoberta, educação, busca, reserva e entrada de terapeutas.

### Rotas

- `/`: home pública.
- `/sobre-nos`: apresentação institucional do TES.
- `/sua-jornada`: questionário guiado.
- `/sua-jornada/resultado`: caminhos sugeridos e terapeutas relacionados.
- `/terapeutas`: busca de terapeutas.
- `/terapeutas/:slug`: perfil público do terapeuta.
- `/reserva`: serviço, horário, conta e pagamento.
- `/reserva/sucesso`: confirmação do encontro.
- `/terapias`: catálogo de terapias.
- `/terapias/:slug`: detalhe da terapia.
- `/para-terapeutas`: página pública para terapeutas.
- `/cliente/login`: login separado para cliente.
- `/cliente/cadastro`: cadastro inicial de cliente.
- `/terapeuta/login`: login separado para terapeuta.
- `/terapeuta/cadastro`: cadastro inicial de terapeuta.
- `/terapeuta/checkout`: revisão do plano pago após o cadastro.
- `/admin-login`: login separado para superadmin.
- `/reset-senha`: recuperação de senha.
- `/termos`: termos de uso.
- `/privacidade`: política de privacidade.
- `/cancelamento-reagendamento-reembolso`: política de cancelamento,
  reagendamento e reembolso, bloqueada para publicação até versão jurídica
  aprovada.
- `/ajuda`: central pública de ajuda em revisão interna, bloqueada para
  publicação até canais e SLAs aprovados.

Contrato de navegação pública: o label `Como funciona` aparece no cabeçalho e
no rodapé e aponta para a rota canônica `/sobre-nos`. `/como-funciona` permanece
somente como redirect de compatibilidade e não possui página própria.

Observação: `/ajuda/zoom` e `/status` não possuem página pública nesta fase. A
integração técnica Zoom Video SDK, runbooks e documentação operacional em
`docs/zoom/` permanecem válidos.

### Fluxos

- Jornada guiada: `/` -> `/sobre-nos` -> `/sua-jornada` -> `/sua-jornada/resultado` -> `/terapias/:slug` -> `/terapeutas` -> `/terapeutas/:slug` -> `/reserva` -> `/reserva/sucesso` -> `/app`. O Match é público, anônimo, determinístico, recomenda terapias e guarda escolhas apenas em `sessionStorage`.
- Busca direta: `/` -> `/terapeutas` -> `/terapeutas/:slug` -> `/reserva` -> `/reserva/sucesso`.
- Terapias: `/` -> `/terapias?q=&category=&sort=&page=` -> `/terapias/:slug` -> `/terapeutas?therapy=:slug&source=therapy` -> `/terapeutas/:slug?therapy=:slug&source=therapy`. A listagem usa `public_therapies_v`; o detalhe usa `public_therapy_details_v` e profissionais de `public_therapist_search`. Ambas mostram terapias com `status = published`, categoria ativa e mantêm filtros/origem na URL. O Match só considera terapias publicadas e ativadas em `matching_therapy_settings` e aponta para `/terapias/:slug?source=match`.
- Clientes visitantes: `/` -> `/cliente/cadastro` ou `/cliente/login` -> `/app`.
- Terapeuta Free: `/` -> `/para-terapeutas` -> `/terapeuta/cadastro?plan=free` -> `/terapeuta/login` -> `/terapeuta`.
- Terapeuta de plano pago: `/` -> `/para-terapeutas` -> `/terapeuta/cadastro?plan=premium|premium_plus` -> `/terapeuta/checkout?plan=*`. A conta nasce com plano ativo `free`; Premium ou Premium Plus só é liberado após confirmação do Stripe por webhook.

## Terapeuta autenticado

Todas as experiências compartilham o mesmo shell e as mesmas rotas. Itens
podem estar habilitados, bloqueados ou ocultos conforme plano e capability.

### Rotas canônicas

- `/terapeuta`: dashboard adequado ao plano.
- `/terapeuta/agenda`: agenda.
- `/terapeuta/pacientes`: pacientes.
- `/terapeuta/pacientes/:slug-do-paciente`: histórico operacional protegido.
- `/terapeuta/sessoes`: sessões.
- `/terapeuta/sessoes/:bookingId`: detalhe da sessão.
- `/terapeuta/sessoes/:bookingId/video`: sala dedicada da videochamada.
- `/terapeuta/mensagens`: mensagens.
- `/terapeuta/mensagens/solicitar-terapia`: solicitação estruturada para
  análise de uma terapia ausente no catálogo; não cria terapia automaticamente.
- `/terapeuta/servicos`: serviços.
- `/terapeuta/servicos/meus`: meus serviços.
- `/terapeuta/financeiro`: financeiro operacional por `operation_essentials`.
- `/terapeuta/avaliacoes`: avaliações conforme capability.
- `/terapeuta/metricas`: métricas intermediárias.
- `/terapeuta/insights`: insights avançados.
- `/terapeuta/assessor-ia`: Assistente Aura.
- `/terapeuta/perfil`: perfil público.
- `/terapeuta/plano`: central de comparação e upgrade para planos superiores.
- `/terapeuta/configuracoes`: configurações, incluindo downgrade agendado,
  cancelamento ao fim do período e reversão do cancelamento em `Plano e
assinatura`.
- `/terapeuta/suporte` e os aliases legados `.../suporte`: redirecionam para
  `/terapeuta/mensagens`; não há tela dedicada de Ajuda.

As seções por plano abaixo registram capabilities e destinos legados mantidos
por redirect; elas não definem shells independentes.

### Fluxo de planos

- Free: `/terapeuta/plano` -> Premium ou Premium Plus -> checkout ->
  confirmação segura -> shell atualizado sem novo login.
- Premium: `/terapeuta/plano` -> Premium Plus com prorrata imediata.
- Premium Plus: `/terapeuta/configuracoes#plano-assinatura` -> Premium na
  próxima renovação.
- Premium/Premium Plus: `/terapeuta/configuracoes#plano-assinatura` ->
  cancelamento ao fim do período -> Free somente após a vigência paga.

## Paciente

Área logada para continuidade dos encontros, favoritos, mensagens, pagamentos e preferências.

### Rotas

- `/app`: visão geral.
- `/app/encontros`: área canônica de encontros.
- `/app/encontros/:bookingId`: detalhe canônico do encontro.
- `/app/encontros/:bookingId/video`: sala dedicada da videochamada.
- `/app/mensagens`: mensagens e suporte por templates seguros.
- `/app/favoritos`: hub de favoritos.
- `/app/favoritos/terapeutas`: terapeutas favoritos.
- `/app/favoritos/terapias`: terapias favoritas.
- `/app/pagamentos`: pagamentos.
- `/app/pagamentos/faturas`: faturas.
- `/app/pagamentos/metodos`: métodos de pagamento.
- `/app/configuracoes`: configurações.
- `/app/configuracoes/perfil`: dados pessoais.
- `/app/configuracoes/notificacoes`: notificações.
- `/app/configuracoes/privacidade`: privacidade.
- `/app/configuracoes/seguranca`: segurança.

Observação: não há rota dedicada `/app/ajuda` neste momento. Links de suporte
do paciente devem apontar para `/app/mensagens` com contexto de suporte até
decisão futura de produto para uma central própria.

### Fluxos

- Pós-reserva: `/reserva/sucesso` -> `/app` -> `/app/encontros/:bookingId`.
- Videochamada: `/app/encontros/:bookingId` -> `/app/encontros/:bookingId/video`.
- Favoritos: `/app/favoritos` -> `/app/favoritos/terapeutas` ou `/app/favoritos/terapias` -> perfil ou terapia -> `/reserva`.
- Pagamentos: `/app/pagamentos` -> `/app/pagamentos/faturas` ou `/app/pagamentos/metodos`.
- Preferências: `/app/configuracoes` -> perfil, notificações, privacidade ou segurança.

## Terapeuta Free - aliases de transição

Operação essencial com limites claros e convites contextuais para evolução.

### Rotas

- `/basico`: redirect legado para o dashboard Free.
- `/basico/agenda`: agenda simples.
- `/basico/pacientes`: pacientes ativos.
- `/basico/sessoes`: sessões.
- `/basico/mensagens`: mensagens.
- `/basico/servicos`: serviços.
- `/basico/servicos/meus`: meus serviços.
- `/basico/pagamento`: redirect legado para financeiro operacional.
- `/basico/perfil`: perfil público.
- `/basico/upgrade`: evolução para Premium ou Premium Plus.
- `/basico/configuracoes`: configurações.
- `/basico/suporte`: redirect legado para Mensagens.

### Permissões

- Acessa agenda, pacientes, sessões, mensagens, serviços sem limite por plano, perfil e financeiro operacional.
- Não acessa avaliações, métricas intermediárias, IA ou insights avançados.
- Limites usam microcopy acolhedora, sem tom punitivo.

## Terapeuta Premium - aliases de transição

Operação profissional com financeiro, avaliações e métricas intermediárias.

### Rotas

- `/pro`: redirect legado para o dashboard Premium.
- `/pro/agenda`: agenda avançada.
- `/pro/pacientes`: pacientes.
- `/pro/sessoes`: sessões.
- `/pro/mensagens`: mensagens.
- `/pro/servicos`: serviços.
- `/pro/financeiro`: redirect legado para financeiro operacional.
- `/pro/metricas`: métricas intermediárias.
- `/pro/avaliacoes`: avaliações.
- `/pro/plano`: plano atual e evolução para Premium Plus.
- `/pro/perfil`: perfil público.
- `/pro/configuracoes`: configurações.
- `/pro/suporte`: redirect legado para Mensagens.

### Permissões

- Inclui recursos do Free.
- Acessa financeiro operacional, avaliações e métricas intermediárias.
- Pode ver convites contextuais para Premium Plus.
- Não acessa Assistente Aura, insights avançados nem histórico operacional Premium Plus.

## Terapeuta Premium Plus - aliases de transição

Plano premium com IA, insights e histórico operacional no detalhe do paciente.

### Rotas

- `/plus`: redirect legado para o dashboard Premium Plus.
- `/plus/agenda`: agenda Premium Plus.
- `/plus/pacientes`: pacientes.
- `/plus/pacientes/:slug-do-paciente`: histórico operacional do paciente.
- `/plus/sessoes`: sessões.
- `/plus/mensagens`: mensagens.
- `/plus/servicos`: serviços.
- `/plus/servicos/meus`: meus serviços.
- `/plus/financeiro`: redirect legado para financeiro operacional.
- `/plus/avaliacoes`: avaliações avançadas.
- `/plus/insights`: insights exclusivos.
- `/plus/assessor-ia`: Assistente Aura (alias legado).
- `/plus/perfil`: perfil público.
- `/plus/configuracoes`: configurações.
- `/plus/suporte`: redirect legado para Mensagens.

### Permissões

- Inclui recursos do Premium.
- Não exibe área de upgrade.
- Acessa IA, insights e histórico operacional do paciente.
- Dados usam linguagem humana: “Pessoas que viram seu perfil”, “Pessoas que quiseram conhecer melhor seu trabalho”, “Pessoas que seguiram para agendar”.

## Admin

Área interna de governança, moderação, operação e saúde da plataforma.

### Rotas

- `/admin`: visão geral.
- `/admin-login`: login separado para superadmin.
- `/admin/profissionais`: profissionais.
- `/admin/profissionais/verificacoes`: verificações.
- `/admin/pacientes`: pacientes.
- `/admin/sessoes`: sessões.
- `/admin/pagamentos`: pagamentos.
- `/admin/avaliacoes`: avaliações.
- `/admin/assinaturas`: assinaturas e planos.
- `/admin/terapias`: terapias.
- `/admin/matching`: regras de recomendação.
- `/admin/integracoes`: integrações.
- `/admin/seguranca`: segurança.
- `/admin/relatorios`: relatórios.
- `/admin/configuracoes`: configurações.
- `/admin/configuracoes/emails`: central de e-mails transacionais.
- `/admin/configuracoes/emails/eventos/:actionKey`: configuração de um evento
  de e-mail allowlisted.
- `/admin/suporte`: suporte.

### Fluxos

- Aprovação: `/admin/profissionais` -> `/admin/profissionais/verificacoes` -> aprovar, solicitar ajuste ou reprovar.
- Sessões: `/admin/sessoes` -> filtrar status -> abrir caso -> suporte ou pagamento.
- Financeiro: `/admin/pagamentos` -> transações, repasses e relatórios.
- Catálogo: `/admin/terapias` -> categorias e tags -> `/admin/matching`.
- E-mails: `/admin/configuracoes` -> E-mails -> evento transacional -> voltar
  para a central.

## Relações

- Público cria confiança e intenção.
- Reserva transforma intenção em encontro online para o paciente e sessão operacional para o terapeuta.
- Paciente mantém continuidade depois da reserva.
- Terapeuta opera agenda, sessões, mensagens e pagamentos.
- Plano do terapeuta controla profundidade de dados e recursos.
- Admin cuida de curadoria, moderação, pagamentos e operação.

## Aliases Técnicos

Usar somente quando houver variação legada ou visual:

- `/como funciona` -> `/sobre-nos`.
- `/como-funciona` -> `/sobre-nos`.
- `/para-terapeutas/planos` -> `/para-terapeutas`.
- `/admin/login` -> `/admin-login`.
- `/plus/serviços` -> `/plus/servicos`.
- `/plus/avaliações` -> `/plus/avaliacoes`.
- `/plus/ia` -> `/plus/assessor-ia`.
- `/app/sessoes` -> `/app/encontros`.
- `/app/sessoes/:bookingId` -> `/app/encontros/:bookingId`.
- `/app/sessoes/proximas` -> `/app/encontros`.
- `/app/sessoes/historico` -> `/app/encontros#patient-history-encounters-title`.

## Cobertura da Jornada

O node `12272:2` contém 6 perfis, 24 fluxos e 92 etapas:

- Público: descoberta guiada, busca e reserva, terapias e caminhos, terapeutas visitantes.
- Paciente: rotina de cuidado, relacionamento, pagamentos, conta e suporte.
- Terapeuta Free: operação essencial, comunicação e serviços, perfil público, conta e crescimento.
- Terapeuta Premium: gestão do atendimento, comunicação e oferta, financeiro, evolução profissional.
- Terapeuta Premium Plus: operação premium, pacientes e histórico, inteligência Premium Plus, gestão e suporte.
- Admin: pessoas e aprovação, operação da plataforma, financeiro e assinaturas, catálogo e matching.

## Divergências

- Páginas legais públicas e ajuda pública não aparecem no node `12272:2`. Elas permanecem por necessidade institucional e de produto.
- `/app/sessoes/historico` não aparece como etapa própria no node `12272:2`; o histórico existe dentro da área canônica `/app/encontros`.
