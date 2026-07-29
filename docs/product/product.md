# Produto

Visão geral do Terapeuta Eu Sou como produto, negócio e experiência. Este documento orienta decisões de escopo, posicionamento, UX, perfis de usuário e evolução do produto.

## Resumo Executivo

O Terapeuta Eu Sou é uma plataforma digital para aproximar pessoas de terapeutas, apoiar a reserva de sessões online e oferecer ferramentas de gestão para profissionais.

O produto atua em duas frentes:

- Para pacientes: descoberta guiada, busca de terapeutas, exploração de terapias, reserva, acompanhamento de sessões, favoritos, mensagens, pagamentos e suporte.
- Para terapeutas: presença pública, agenda, sessões, mensagens, serviços, pagamentos, avaliações, métricas, insights e apoio por IA, conforme o plano contratado.

O TES usa uma experiência clara, acolhedora e premium. A interface evita linguagem fria de crescimento e troca termos como "conversão" por frases humanas, como "Pessoas que seguiram para agendar".

## Visão Geral

O TES organiza a jornada de cuidado em um fluxo simples:

1. A pessoa entende como a plataforma funciona.
2. Responde uma jornada guiada ou busca diretamente.
3. Conhece terapias e terapeutas.
4. Escolhe serviço e horário.
5. Confirma a reserva.
6. Continua a experiência na área logada do paciente.

Para terapeutas, o produto organiza a operação profissional:

1. Cadastro e aprovação do perfil.
2. Publicação da presença pública.
3. Configuração de agenda e serviços.
4. Atendimento por sessões e mensagens.
5. Acompanhamento de pagamentos e relacionamento.
6. Evolução por plano, quando fizer sentido.

Para Admin, o produto centraliza governança:

1. Aprovação de profissionais.
2. Gestão de pacientes, sessões, pagamentos e avaliações.
3. Curadoria de terapias e regras de recomendação.
4. Acompanhamento de segurança, suporte, relatórios e integrações.

## Proposta de Valor

### Para Pacientes

O TES ajuda pessoas a encontrarem caminhos terapêuticos e profissionais com mais clareza, sem prometer resultado terapêutico.

Valor entregue:

- Menos incerteza na escolha de terapia ou terapeuta.
- Jornada guiada com linguagem acolhedora.
- Perfil público de terapeuta com informações claras.
- Reserva online com serviço, horário, conta e pagamento em um fluxo único.
- Área logada para sessões, mensagens, favoritos, pagamentos e suporte.
- Favoritos separados entre terapeutas e terapias.

### Para Terapeutas

O TES ajuda terapeutas a construir presença digital, organizar agenda e acompanhar sua operação em uma plataforma especializada.

Valor entregue:

- Perfil público estruturado.
- Agenda, pacientes, sessões, mensagens e serviços.
- Pagamentos e repasses conforme o plano.
- Avaliações e métricas para planos superiores.
- Insights e Assessor IA no Plus.
- Suporte proporcional ao plano.

### Para Admin

O TES ajuda a equipe interna a manter qualidade, segurança e consistência da plataforma.

Valor entregue:

- Fila de aprovação de profissionais.
- Moderação de avaliações e casos sensíveis.
- Acompanhamento de sessões, pagamentos e assinaturas.
- Gestão do catálogo de terapias.
- Regras de recomendação, integrações, segurança, relatórios e suporte.

## Posicionamento

O TES se posiciona como uma plataforma de terapia online clara, humana e premium, feita para reduzir incerteza na escolha de terapeutas e dar estrutura profissional a quem atende.

### Categoria

Marketplace e SaaS vertical para terapia online.

### Diferencial

O produto combina descoberta acolhedora para pacientes com ferramentas operacionais para terapeutas. A experiência não trata terapia como compra fria nem trata dados como painel agressivo de performance.

### Personalidade

- Humana.
- Clara.
- Acolhedora.
- Premium.
- Leve.
- Responsável.
- Profissional sem frieza.

### Frase de Posicionamento

O Terapeuta Eu Sou ajuda pessoas a encontrarem terapeutas com mais clareza e ajuda terapeutas a cuidarem da sua presença, agenda e relacionamento em um ambiente digital acolhedor.

## Princípio Central de UX

A experiência deve reduzir incerteza sem pressionar decisão.

Isso significa:

- Cada tela precisa explicar o próximo passo.
- Cada dado precisa ter leitura humana.
- Cada limite de plano precisa aparecer sem culpa.
- Cada decisão sensível precisa dar contexto.
- Cada fluxo deve ser curto o suficiente para avançar e claro o suficiente para confiar.

## Princípios de Produto

### Clareza Antes de Abundância

Mostra-se primeiro o que ajuda a pessoa a decidir. Detalhes ficam acessíveis sem competir com a ação principal.

### Acolhimento Sem Promessa

O produto acolhe dúvidas e momentos pessoais, mas não promete cura, diagnóstico ou resultado terapêutico.

### Dados Com Linguagem Humana

Métricas usam frases compreensíveis:

- "Pessoas que viram seu perfil."
- "Pessoas que quiseram conhecer melhor seu trabalho."
- "Pessoas que seguiram para agendar."
- "Horários com maior procura."

Evita-se:

- "Conversão."
- "CTR."
- "Leads."
- "Funil."
- "Baixa performance."

### Profundidade Por Necessidade

Subrotas existem quando melhoram a experiência. A arquitetura não força níveis de profundidade.

### Progressão Respeitosa

Básico mostra o essencial. Pro profissionaliza a operação. Plus aprofunda inteligência, suporte e recursos premium. Upgrade aparece como possibilidade, não como pressão.

## Perfis de Usuário

## Público

Pessoa visitante, paciente em potencial ou terapeuta ainda sem conta.

Objetivos:

- Entender o TES.
- Explorar terapias.
- Encontrar terapeutas.
- Fazer a jornada guiada.
- Reservar uma sessão.
- Conhecer planos para terapeutas.
- Entrar, cadastrar ou recuperar senha.

## Paciente

Pessoa que já reservou ou criou conta para continuar sua experiência.

Objetivos:

- Ver próximas sessões.
- Acessar detalhes e link da sessão.
- Conversar com terapeuta ou suporte.
- Retomar terapeutas e terapias favoritos.
- Gerenciar pagamentos.
- Ajustar perfil, notificações, privacidade e segurança.

Observação: `/app/sessoes/historico` é subrota opcional quando a experiência separar histórico de `/app/sessoes`.

## Terapeuta Básico

Profissional no plano inicial, com operação essencial e recursos limitados.

Objetivos:

- Completar perfil.
- Criar disponibilidade.
- Acompanhar pacientes.
- Controlar sessões.
- Responder mensagens.
- Cadastrar serviços limitados.
- Acompanhar financeiro operacional.
- Evoluir de plano quando fizer sentido.

Limites:

- Sem avaliações como área principal.
- Sem métricas intermediárias.
- Sem Assessor IA.
- Sem insights avançados.
- Sem suporte prioritário.

## Terapeuta Pro

Profissional com operação mais madura, financeiro operacional, avaliações e métricas intermediárias.

Objetivos:

- Gerir agenda avançada.
- Acompanhar pacientes e sessões.
- Responder mensagens com mais agilidade.
- Gerir serviços completos.
- Acompanhar financeiro.
- Ver métricas e avaliações.
- Gerir plano e considerar evolução para Plus.

Limites:

- Sem Assessor IA.
- Sem insights Plus.
- Sem histórico operacional Plus do paciente.

## Terapeuta Plus

Profissional no plano premium, com inteligência avançada, IA, histórico operacional e suporte prioritário.

Objetivos:

- Operar agenda, sessões, mensagens e serviços com mais contexto.
- Acompanhar pacientes e histórico operacional.
- Usar Assessor IA para revisar perfil, serviços e presença.
- Ver insights avançados.
- Acompanhar financeiro e avaliações com leitura mais profunda.
- Acessar suporte prioritário.

Regras:

- Plus não exibe área de upgrade.
- IA sugere, mas a pessoa revisa antes de aplicar.
- Dados devem apoiar clareza, não comparação agressiva.

## Admin

Equipe interna responsável por operação, qualidade, moderação e governança.

Objetivos:

- Aprovar profissionais.
- Acompanhar pacientes, sessões, pagamentos e assinaturas.
- Moderar avaliações.
- Curar terapias.
- Ajustar regras de recomendação.
- Monitorar segurança, integrações, relatórios e suporte.

## Modelo de Planos

| Plano  | Papel                 | Valor principal                | Recursos centrais                                                                                   | Não inclui                                                   |
| ------ | --------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Básico | Entrada profissional  | Presença e operação essencial. | Perfil, agenda, pacientes, sessões, mensagens, serviços limitados, financeiro operacional, suporte. | Avaliações, métricas intermediárias, IA, insights avançados. |
| Pro    | Operação profissional | Gestão mais completa.          | Recursos do Básico, agenda avançada, serviços completos, financeiro, avaliações, métricas, plano.   | Assessor IA, insights Plus, histórico operacional Plus.      |
| Plus   | Premium               | Inteligência e apoio avançado. | Recursos do Pro, insights, Assessor IA, histórico operacional do paciente, suporte prioritário.     | Upgrade.                                                     |

## Jornadas Principais

Mapa operacional de integrações, fontes de dados e skills: `docs/product/integration-map.md`.

### Descoberta e Reserva

`/` -> `/como-funciona` -> `/sua-jornada` -> `/sua-jornada/resultado` -> `/terapias/:slug` -> `/terapeutas` -> `/terapeutas/:slug` -> `/reserva` -> `/reserva/sucesso` -> `/app`

### Busca Direta

`/` -> `/terapeutas` -> `/terapeutas/:slug` -> `/reserva` -> `/reserva/sucesso`

### Terapias

`/` -> `/terapias` -> `/terapias/:slug` -> `/terapeutas`

### Terapeutas Visitantes

`/` -> `/para-terapeutas` -> `/para-terapeutas/planos` -> `/terapeuta/cadastro?plan=free|premium|premium_plus` -> `/terapeuta/login` -> `/terapeuta`

`/basico/*`, `/pro/*` e `/plus/*` permanecem redirects temporários. O plano e
as capabilities definem a experiência dentro do namespace único;
`/terapeutas/*` continua reservado ao catálogo público.

### Pós-reserva do Paciente

`/reserva/sucesso` -> `/app` -> `/app/sessoes/:slug`

### Operação do Terapeuta

Dashboard do plano -> agenda -> serviços -> sessões -> mensagens -> pagamentos ou financeiro -> perfil -> suporte

### Governança Admin

`/admin` -> filas prioritárias -> detalhe operacional -> decisão -> registro ou acompanhamento

## Escopo Funcional

### Inclui

- Site público.
- Jornada guiada.
- Busca de terapeutas.
- Catálogo de terapias.
- Perfil público do terapeuta.
- Reserva e confirmação.
- Área logada do paciente.
- Áreas de terapeuta Básico, Pro e Plus.
- Área Admin.
- Pagamentos, assinaturas e suporte.
- Design System TES.
- Storybook como camada de validação futura.

## Regras de Experiência

- Toda tela tem uma ação principal clara.
- Toda ausência mostra contexto e próximo passo.
- Toda rota de perfil respeita permissões.
- Todo dado sensível usa linguagem cuidadosa.
- Toda sugestão de IA exige revisão humana antes de aplicação.
- Toda decisão de plano deve ser clara sem parecer punição.
- Todo status usa texto, não apenas cor.

## Linguagem TES

Usar frases humanas:

- "Seu perfil pode ficar mais claro."
- "Que tal revisar sua descrição?"
- "Pessoas que viram seu perfil."
- "Pessoas que quiseram conhecer melhor seu trabalho."
- "Pessoas que seguiram para agendar."
- "Horários com maior procura."

Evitar termos frios:

- "Conversão."
- "CTR."
- "Leads."
- "Funil."
- "Baixa performance."

## Métricas de Qualidade do Produto

- Pessoas conseguem entender o próximo passo sem ajuda.
- Pacientes conseguem encontrar terapeuta ou terapia sem pressão.
- Terapeutas entendem limites e valor do próprio plano.
- Plus comunica inteligência sem parecer competitivo.
- Admin consegue priorizar o que exige atenção.
- A linguagem permanece acolhedora em estados de erro, vazio e bloqueio.
- As telas seguem tokens, componentes e regras do Design System.

## Documentos Relacionados

- `docs/product/sitemap.md`
- `docs/product/routes-map.md`
- `docs/product/page-inventory.md`
- `docs/design-system/design-system.md`
- `docs/design-system/tokens.md`
- `docs/design-system/component-inventory.md`
- `docs/design-system/storybook-plan.md`
- `docs/design-system/qa-checklist.md`
- `docs/design-system/implementation-notes.md`
