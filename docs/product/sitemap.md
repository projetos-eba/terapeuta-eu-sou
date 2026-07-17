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
- `/pro` é a entrada canônica do terapeuta Pro.
- `/para-terapeutas/planos` concentra a decisão pública de planos.
- `/basico/sessoes` e `/basico/mensagens` existem por decisão de produto.
- Favoritos do paciente separam terapeutas e terapias.
- Plus concentra histórico operacional do paciente em `/plus/pacientes/:slug-do-paciente`.

## Público

Área aberta para descoberta, educação, busca, reserva e entrada de terapeutas.

### Rotas

- `/`: home pública.
- `/como-funciona`: etapas da experiência e sessão online.
- `/sua-jornada`: questionário guiado.
- `/sua-jornada/resultado`: caminhos sugeridos e terapeutas relacionados.
- `/terapeutas`: busca de terapeutas.
- `/terapeutas/:slug`: perfil público do terapeuta.
- `/reserva`: serviço, horário, conta e pagamento.
- `/reserva/sucesso`: confirmação da sessão.
- `/terapias`: catálogo de terapias.
- `/terapias/:slug`: detalhe da terapia.
- `/para-terapeutas`: página pública para terapeutas.
- `/para-terapeutas/planos`: planos Básico, Pro e Plus.
- `/entrar`: login.
- `/cadastro`: cadastro.
- `/cliente/login`: login separado para cliente.
- `/cliente/cadastro`: cadastro inicial de cliente.
- `/terapeuta/login`: login separado para terapeuta.
- `/terapeuta/cadastro`: cadastro inicial de terapeuta.
- `/reset-senha`: recuperação de senha.
- `/ajuda`: ajuda pública.
- `/termos`: termos de uso.
- `/privacidade`: política de privacidade.

### Fluxos

- Jornada guiada: `/` -> `/como-funciona` -> `/sua-jornada` -> `/sua-jornada/resultado` -> `/terapias/:slug` -> `/terapeutas` -> `/terapeutas/:slug` -> `/reserva` -> `/reserva/sucesso` -> `/app`. O Match é público, anônimo, determinístico, recomenda terapias e guarda escolhas apenas em `sessionStorage`.
- Busca direta: `/` -> `/terapeutas` -> `/terapeutas/:slug` -> `/reserva` -> `/reserva/sucesso`.
- Terapias: `/` -> `/terapias?q=&category=&sort=&page=` -> `/terapias/:slug` -> `/terapeutas?therapy=:slug&source=therapy` -> `/terapeutas/:slug?therapy=:slug&source=therapy`. A listagem usa `public_therapies_v`; o detalhe usa `public_therapy_details_v` e profissionais de `public_therapist_search`. Ambas mostram terapias com `status = published`, categoria ativa e mantêm filtros/origem na URL. O Match só considera terapias publicadas e ativadas em `matching_therapy_settings` e aponta para `/terapias/:slug?source=match`.
- Clientes visitantes: `/` -> `/cliente/cadastro` ou `/cliente/login` -> `/app`.
- Terapeutas visitantes: `/` -> `/para-terapeutas` -> `/para-terapeutas/planos` -> `/terapeuta/cadastro?plan=free|premium|premium_plus` -> `/terapeuta/login` -> `/basico`, `/pro` ou `/plus`.

## Paciente

Área logada para continuidade da sessão, favoritos, mensagens, pagamentos e preferências.

### Rotas

- `/app`: visão geral.
- `/app/sessoes`: área de sessões.
- `/app/sessoes/proximas`: próximas sessões.
- `/app/sessoes/historico`: histórico de sessões.
- `/app/sessoes/:slug`: detalhe da sessão.
- `/app/mensagens`: mensagens.
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
- `/app/ajuda`: ajuda logada.

### Fluxos

- Pós-reserva: `/reserva/sucesso` -> `/app` -> `/app/sessoes/:slug`.
- Favoritos: `/app/favoritos` -> `/app/favoritos/terapeutas` ou `/app/favoritos/terapias` -> perfil ou terapia -> `/reserva`.
- Pagamentos: `/app/pagamentos` -> `/app/pagamentos/faturas` ou `/app/pagamentos/metodos`.
- Preferências: `/app/configuracoes` -> perfil, notificações, privacidade ou segurança.

## Terapeuta Básico

Operação essencial com limites claros e convites contextuais para evolução.

### Rotas

- `/basico`: dashboard Básico.
- `/basico/agenda`: agenda simples.
- `/basico/pacientes`: pacientes ativos.
- `/basico/sessoes`: sessões.
- `/basico/mensagens`: mensagens.
- `/basico/servicos`: serviços.
- `/basico/servicos/meus`: meus serviços.
- `/basico/pagamento`: pagamento simplificado.
- `/basico/perfil`: perfil público.
- `/basico/upgrade`: evolução para Pro ou Plus.
- `/basico/configuracoes`: configurações.
- `/basico/suporte`: suporte.

### Permissões

- Acessa agenda, pacientes, sessões, mensagens, serviços limitados, perfil, pagamento simples e suporte.
- Não acessa financeiro completo, avaliações, métricas intermediárias, IA, insights avançados ou suporte prioritário.
- Limites usam microcopy acolhedora, sem tom punitivo.

## Terapeuta Pro

Operação profissional com financeiro, avaliações e métricas intermediárias.

### Rotas

- `/pro`: dashboard Pro.
- `/pro/agenda`: agenda avançada.
- `/pro/pacientes`: pacientes.
- `/pro/sessoes`: sessões.
- `/pro/mensagens`: mensagens.
- `/pro/servicos`: serviços.
- `/pro/financeiro`: financeiro completo.
- `/pro/metricas`: métricas intermediárias.
- `/pro/avaliacoes`: avaliações.
- `/pro/plano`: plano atual e evolução para Plus.
- `/pro/perfil`: perfil público.
- `/pro/configuracoes`: configurações.
- `/pro/suporte`: suporte.

### Permissões

- Inclui recursos do Básico.
- Acessa financeiro completo, avaliações e métricas intermediárias.
- Pode ver convites contextuais para Plus.
- Não acessa Assessor IA, insights avançados nem histórico operacional Plus.

## Terapeuta Plus

Plano premium com IA, insights e histórico operacional no detalhe do paciente.

### Rotas

- `/plus`: dashboard Plus.
- `/plus/agenda`: agenda Plus.
- `/plus/pacientes`: pacientes.
- `/plus/pacientes/:slug-do-paciente`: histórico operacional do paciente.
- `/plus/sessoes`: sessões.
- `/plus/mensagens`: mensagens.
- `/plus/servicos`: serviços.
- `/plus/servicos/meus`: meus serviços.
- `/plus/financeiro`: financeiro completo.
- `/plus/avaliacoes`: avaliações avançadas.
- `/plus/insights`: insights exclusivos.
- `/plus/assessor-ia`: Assessor IA.
- `/plus/perfil`: perfil público.
- `/plus/configuracoes`: configurações.
- `/plus/suporte`: suporte prioritário.

### Permissões

- Inclui recursos do Pro.
- Não exibe área de upgrade.
- Acessa IA, insights, histórico operacional do paciente e suporte prioritário.
- Dados usam linguagem humana: “Pessoas que viram seu perfil”, “Pessoas que quiseram conhecer melhor seu trabalho”, “Pessoas que seguiram para agendar”.

## Admin

Área interna de governança, moderação, operação e saúde da plataforma.

### Rotas

- `/admin`: visão geral.
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
- `/admin/suporte`: suporte.

### Fluxos

- Aprovação: `/admin/profissionais` -> `/admin/profissionais/verificacoes` -> aprovar, solicitar ajuste ou reprovar.
- Sessões: `/admin/sessoes` -> filtrar status -> abrir caso -> suporte ou pagamento.
- Financeiro: `/admin/pagamentos` -> transações, repasses e relatórios.
- Catálogo: `/admin/terapias` -> categorias e tags -> `/admin/matching`.

## Relações

- Público cria confiança e intenção.
- Reserva transforma intenção em sessão online.
- Paciente mantém continuidade depois da reserva.
- Terapeuta opera agenda, sessões, mensagens e pagamentos.
- Plano do terapeuta controla profundidade de dados e recursos.
- Admin cuida de curadoria, moderação, pagamentos e operação.

## Aliases Técnicos

Usar somente quando houver variação legada ou visual:

- `/como funciona` -> `/como-funciona`.
- `/plus/serviços` -> `/plus/servicos`.
- `/plus/avaliações` -> `/plus/avaliacoes`.
- `/plus/ia` -> `/plus/assessor-ia`.

## Cobertura da Jornada

O node `12272:2` contém 6 perfis, 24 fluxos e 92 etapas:

- Público: descoberta guiada, busca e reserva, terapias e caminhos, terapeutas visitantes.
- Paciente: rotina de cuidado, relacionamento, pagamentos, conta e suporte.
- Terapeuta Básico: operação essencial, comunicação e serviços, perfil público, conta e crescimento.
- Terapeuta Pro: gestão do atendimento, comunicação e oferta, financeiro, evolução profissional.
- Terapeuta Plus: operação premium, pacientes e histórico, inteligência Plus, gestão e suporte.
- Admin: pessoas e aprovação, operação da plataforma, financeiro e assinaturas, catálogo e matching.

## Divergências

- Páginas legais públicas e ajuda pública não aparecem no node `12272:2`. Elas permanecem por necessidade institucional e de produto.
- `/app/sessoes/historico` não aparece como etapa própria no node `12272:2`; o histórico existe dentro da área `/app/sessoes`.
