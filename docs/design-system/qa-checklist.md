# Checklist de QA

Lista de validação visual, funcional, técnica e de linguagem para telas TES.

## Fontes

- [ ] Sitemap, navegação e permissões conferidos na página Figma `↳ Jornadas dos Usuários` (`12272:2`).
- [ ] Tela comparada com `Design Telas`.
- [ ] Tela comparada com `Referencias` do perfil.
- [ ] Regras de plano conferidas na documentação de produto.
- [ ] Rotas conferidas em `docs/product/routes-map.md`.
- [ ] Inferências estão marcadas quando aplicável.

## Fidelidade Visual

- [ ] Paleta usa branco, lavanda, roxo `#6C3D91`, ciano `#81BAE0` e verde suave.
- [ ] CTA principal usa `color.semantic.action.primary.default` (`#6C3D91`) ou gradiente derivado e texto branco.
- [ ] Acentos de paciente usam `color.semantic.profile.patient` (`#81BAE0`) quando aplicável.
- [ ] Bordas são sutis.
- [ ] Cards usam `radius.card` e `shadow.card`.
- [ ] Ilustrações são leves e humanizadas.
- [ ] A tela evita visual genérico de SaaS frio.
- [ ] Hierarquia visual segue referência do perfil.
- [ ] Nada fica apertado, sobreposto ou cortado.
- [ ] Tabelas densas seguem escaneáveis.
- [ ] Empty states têm ícone ou ilustração coerente.

## Design System

- [ ] Estilos vêm de tokens.
- [ ] Cores hardcoded têm justificativa.
- [ ] Componentes reutilizáveis são usados antes de variações locais.
- [ ] Variações por plano ficam no componente.
- [ ] Loading, empty, error, disabled e focus existem quando aplicável.
- [ ] P0 tem stories no Storybook.
- [ ] Componentes com permissão têm stories por plano.
- [ ] Página única `Design System` mantém a expansão dentro de `Design System / Phase 2 Expansion`.
- [ ] Componentes em `Design System / Recent Product Components` usam estilos `TES/*`, Auto Layout e não têm subframes de texto com altura colapsada.
- [ ] Não há nomes genéricos em componentes novos (`Frame 123`, `Teste`, `Botão novo`, `Card 1`).
- [ ] Componentes novos têm descrição e metadados AI-friendly.
- [ ] Ícones vêm de `Icon/*` ou seguem o mesmo estilo linear, leve e consistente.
- [ ] Assets vêm de `Asset/*` quando forem apoio visual suave.
- [ ] Gráficos usam `Data/*` e possuem resumo textual acessível.
- [ ] Patterns por perfil compõem componentes existentes antes de criar exceções locais.

## Acessibilidade

- [ ] Texto normal tem contraste mínimo recomendado de 4.5:1.
- [ ] Texto grande tem contraste mínimo recomendado de 3:1.
- [ ] Ícones sem texto têm `aria-label` ou tooltip acessível.
- [ ] Inputs têm label associado.
- [ ] Erros de formulário são anunciados.
- [ ] Foco visível aparece em todos os controles.
- [ ] Modais e drawers prendem foco e fecham com `Esc`.
- [ ] Tabelas têm cabeçalho semântico.
- [ ] Status não dependem só de cor.
- [ ] Animações respeitam redução de movimento.

## Responsividade

- [ ] Público funciona em desktop, tablet e mobile.
- [ ] Header público colapsa corretamente.
- [ ] Sidebars viram compactas, drawer ou navegação inferior.
- [ ] Tabelas viram cards em mobile.
- [ ] CTAs ficam visíveis.
- [ ] Texto quebra antes de reduzir demais.
- [ ] Cards mantêm proporções estáveis.
- [ ] Gráficos oferecem versão legível ou resumo.
- [ ] Right rail vira bloco abaixo, drawer ou seção colapsável em telas estreitas.
- [ ] FilterBar quebra para coluna/drawer sem cortar labels.
- [ ] Topbar interna não sobrepõe título, busca, avatar ou ações.

## Funcionalidade

- [ ] Rotas canônicas usam slugs sem espaço e sem acento.
- [ ] Aliases visuais redirecionam para rota canônica quando existirem.
- [ ] `/app` é a entrada do paciente.
- [ ] `/terapeuta` é a entrada autenticada de todos os planos.
- [ ] `/basico/*`, `/pro/*` e `/plus/*` redirecionam para rotas equivalentes.
- [ ] `/para-terapeutas/planos` é a página pública de planos.
- [ ] Guardas de autenticação impedem acesso indevido.
- [ ] Guardas de plano impedem recursos fora do plano.
- [ ] Básico acessa financeiro operacional e não acessa avaliações ou métricas intermediárias.
- [ ] Pro acessa financeiro, avaliações e métricas intermediárias.
- [ ] Plus não vê upgrade.
- [ ] Admin exige permissão interna.
- [ ] Reserva pede cadastro depois de horário e serviço escolhidos.
- [ ] `/reserva` e `/reserva/sucesso` respeitam a sequência da Jornada.
- [ ] Pagamento informa política e valor antes de confirmar.
- [ ] Sitemap não força subnível quando uma página pai resolve.

## Linguagem TES

- [ ] Usa “sessões”, salvo contexto legal.
- [ ] Usa “pessoas que viram seu perfil”.
- [ ] Usa “pessoas que quiseram conhecer melhor seu trabalho”.
- [ ] Usa “pessoas que seguiram para agendar”.
- [ ] Evita “CTR”, “funil”, “leads” e “baixa performance”.
- [ ] Erros são calmos e acionáveis.
- [ ] Empty states não culpam a pessoa.
- [ ] Upgrade é contextual e respeitoso.
- [ ] Nenhum texto promete cura, diagnóstico ou resultado garantido.
- [ ] Dados usam `Pessoas interessadas`, `Caminhos até o agendamento` ou `Sinais para observar`.
- [ ] Gráficos evitam `CTR`, `conversão`, `lead`, `baixa performance` e ranking competitivo.
- [ ] Upgrade fala de clareza e recursos, não de ganho financeiro.

## Público

- [ ] Home tem hero, etapas, terapias, terapeutas, planos e FAQ.
- [ ] Jornada limita seleção e explica que não há resposta certa.
- [ ] Resultado usa linguagem de sintonia.
- [ ] Busca tem filtros, ordenação e estado vazio.
- [ ] Reserva mostra serviço, horário, valor e conta/pagamento no momento certo.
- [ ] Sucesso reforça que a sessão é online.

## Paciente

- [ ] Visão geral mostra próxima sessão ou caminho para agendar.
- [ ] Sessões têm status claro.
- [ ] Detalhe mostra link, política e suporte.
- [ ] Mensagens diferenciam terapeuta e suporte.
- [ ] Favoritos separam terapeutas e terapias.
- [ ] Pagamentos mostram comprovantes e reembolsos.

## Terapeutas

- [ ] Básico mostra progresso de perfil e plano.
- [ ] Free acessa `/terapeuta/sessoes` e `/terapeuta/mensagens` conforme a
      política de capability.
- [ ] Básico mostra limites sem punição.
- [ ] Pro tem financeiro, avaliações e métricas intermediárias.
- [ ] Pro pode evoluir para Plus por contexto.
- [ ] Plus tem insights, Assessor IA e histórico do paciente no detalhe.
- [ ] Plus não tem upgrade.
- [ ] Detalhe do paciente Plus não cria subpágina desnecessária.

## Admin

- [ ] Tabelas têm filtros e ações rastreáveis.
- [ ] Ações críticas pedem confirmação.
- [ ] Filas de moderação priorizam atenção.
- [ ] Integrações usam status claro.

## Técnica

- [ ] `npm run build` passa.
- [ ] `npm run lint` passa.
- [ ] `npm run typecheck` passa.
- [ ] Storybook builda quando instalado.
- [ ] Não há erro de console relevante.
- [ ] Imagens têm fallback.
- [ ] Dados vazios não quebram layout.
- [ ] Permissões são testadas.
- [ ] Datas e valores usam formato brasileiro.

## Validação Visual

1. Capturar screenshot desktop.
2. Capturar screenshot tablet.
3. Capturar screenshot mobile.
4. Comparar contra Figma e referência local.
5. Registrar diferenças intencionais.
6. Ajustar tokens antes de exceções locais.

## QA da Página Design System

- [ ] `Design System / Foundations` renderiza.
- [ ] `Design System / Component Library` renderiza.
- [ ] `Design System / Product Patterns & Templates` renderiza.
- [ ] `Design System / Phase 2 Expansion` renderiza.
- [x] `Design System / Public Reusable Consolidation` renderiza e documenta logo/footer/FAQ/jornada.
- [x] `Design System / Componentes` está separado em 12 frames menores por domínio de uso.
- [x] `Design System / Componentes` possui 88 componentes únicos, 0 duplicidades por nome, 0 overflow e 0 textos colapsados.
- [x] `05 Ícones de navegação e status` mostra ícones em `16`, `20` e `24`.
- [x] `07 Dados e visualizações` inclui empty/loading states.
- [x] `08` a `11 Patterns` cabem nos respectivos frames sem overflow.
- [x] `12 Metadados e checklist AI-friendly` contém o modelo obrigatório de documentação.
- [x] `Design System / Public Reusable Consolidation` (`12548:136`) tem 0 placeholders, 0 overflow, 0 textos sem estilo TES e 0 containers residuais de `1px`.
- [x] Componentes públicos refinados foram validados por screenshots individuais.

## QA das Páginas Públicas Recriadas

- [x] 10 QA pairs públicos revisados em `↳ Design Telas`.
- [x] Todas as páginas editáveis mantêm largura `1055px`.
- [x] `Page / Público / Resultado` (`12521:631`) mantém largura `1055px`.
- [x] 0 nomes genéricos no frame consolidado e nos componentes públicos refinados.
- [x] 0 placeholders nas páginas públicas recriadas.
- [x] 0 overflow horizontal por bounding box absoluto.
- [x] 0 overflow vertical em `Page / Público / Resultado` e `Page / Público / Como Funciona` após ajuste de footer.
- [x] Header público usa `Brand/OfficialLogo`.
- [x] `Organisms/Public Header` (`12335:465`) usa estilos `TES/*` nos textos do mestre.
- [x] `/como-funciona` usa instâncias de `Product/JourneyStepCard` e `Product/JourneyDetailCard`.
- [x] `/sua-jornada/resultado` usa instâncias de `Product/JourneyResultCard/Wide`.
- [x] Footers de `/como-funciona` e `/sua-jornada/resultado` usam `Organisms/Public Footer`.
- [x] `Page / Público / Resultado` (`12521:631`) ajustada para `1786px` de altura para não cortar footer.
- [x] `Page / Público / Como Funciona` (`12532:670`) ajustada para `2460px` de altura para não cortar footer.

Observação: camadas internas herdadas da página `ícones` podem manter nomes técnicos como `Vector` em instâncias antigas. O frame público refinado usa nomes semânticos e slots compatíveis com Lucide até a correção dedicada da biblioteca de ícones.

## Aceite

- Visual alinhado à referência.
- Estados principais implementados.
- Linguagem no tom TES.
- Permissões por plano corretas.
- Responsividade verificada.
- Acessibilidade básica verificada.
- Componente reutilizável no Storybook.
