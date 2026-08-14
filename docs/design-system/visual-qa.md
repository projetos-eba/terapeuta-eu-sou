# Visual QA TES

Status: gate formal de release visual  
Versão: 2026-08-13

## Evidência mínima

Capturar a implementação real, preferencialmente com Playwright em navegador
visível, nos seguintes viewports de referência:

- desktop amplo: `1440 × 900`;
- tablet: `1024 × 768`;
- mobile: `390 × 844`.

Adicionar `1280 × 800` ou `360 × 800` quando a composição tiver risco específico.
Validar a primeira dobra e a página completa. Não considerar somente screenshot
do Figma ou componente isolado.

## Estados mínimos

- conteúdo real disponível;
- empty real;
- filtro sem resultado;
- loading;
- erro/indisponibilidade;
- forbidden quando aplicável;
- hover, focus-visible, pressed e disabled;
- dialog/drawer aberto;
- conteúdo longo, nomes longos e valores extremos plausíveis.

Não usar dados demonstrativos para transformar falha em sucesso aparente.

## Checklist visual

- tarefa primária e hierarquia da primeira dobra;
- vertical rhythm, line length, whitespace e alinhamentos;
- padding no primeiro/último elemento de cada região delimitada;
- cardification, bordas, sombras, badges e gradientes com função;
- tipografia e mínimos de legibilidade;
- densidade declarada versus densidade observada;
- filtros próximos do conteúdo controlado;
- estados, CTAs e ações concorrentes;
- truncamento com acesso ao valor completo quando necessário;
- ausência de overflow da página e uso justificado de scroll interno;
- transformação de tabela, calendário, rail, tabs e ações no mobile/tablet;
- touch targets, foco, teclado e contraste;
- overlay, scroll lock, Escape, foco confinado e retorno de foco em dialogs;
- empty/loading/error coerentes e sem mensagem técnica.

## Processo

1. Registrar intent, tarefa primária, densidade e patterns aplicados.
2. Executar testes funcionais e abrir navegador visível.
3. Capturar viewports e estados mínimos.
4. Comparar `Intent vs Implementation vs TES Experience Language vs Design System`.
5. Preencher o Visual Quality Score com evidências.
6. Reprovar em qualquer eliminatório; corrigir e repetir a captura.
7. Anexar screenshots, rota, data, commit e limitações ao handoff.

## Automação proporcional

Automatizar agora políticas baratas e estáveis: mínimos tipográficos, hex
arbitrário, overflow básico em E2E, foco de dialogs e viewports críticos. Não
adicionar infraestrutura pesada de snapshot antes da calibração dos benchmarks,
pois mudanças legítimas produziriam ruído e congelariam padrões ainda imaturos.

Depois da calibração, avaliar screenshots de referência por componente estável,
limiar de pixel diff, axe em fluxos críticos e catálogo isolado. A automação não
substitui o Visual QA/Critic nem a pergunta anti-genérica.
