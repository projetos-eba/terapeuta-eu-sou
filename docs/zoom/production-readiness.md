# Prontidao de Producao Zoom Video SDK

Antes de producao:

- confirmar conta Zoom Build Platform ou Universal Credit;
- confirmar SDK Key/Secret e API Key/Secret no app correto;
- configurar Event Subscriptions para `session.started`, `session.ended`,
  `session.user_joined` e `session.user_left`;
- validar a URL publica da Edge Function;
- confirmar Secret Token do webhook;
- manter gravacao em nuvem, transcricao, controle remoto, envio de arquivos,
  streaming, RTMS e recursos nao usados desativados;
- revisar regioes/data centers apropriados;
- avaliar conexao peer-to-peer em chamadas de duas pessoas conforme politica de
  privacidade e documentacao oficial;
- homologar fluxo real em ambiente de teste com limite de consumo;
- configurar `ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES` como inteiro positivo e
  revisar o valor operacional aprovado pelo produto;
- executar `docs/zoom/real-homologation-runbook.md` e voltar
  `ALLOW_REAL_ZOOM=false` depois do teste;
- executar `npm run homologation:zoom:local` em ambiente local/controlado e
  aceitar sessao real somente depois de evidenciar pagamento Stripe test por
  Checkout + webhook;
- manter o rate limit distribuido de emissao de JWT ativo e validado por pgTAP;
- homologar encontro de 75 a 90 minutos para paciente e terapeuta, comprovando
  a rotação do login TES, refresh da página e reconexão após queda de rede sem
  expor token em logs ou interface;
- manter host-first ativo: paciente so recebe JWT apos `session.user_joined`
  confiavel do terapeuta;
- ativar o cron de `zoom-video-session-maintenance` via Vault/pg_net sem segredo
  versionado;
- confirmar que o comando real exige confirmacao manual momentanea do endpoint
  Zoom validado/ativo, dos quatro eventos e Playwright visivel antes de abrir
  sessao;
- confirmar que apps antigos e webhooks antigos nao estao implantados antes de
  remover qualquer configuracao remota.

Nao declarar producao pronta sem teste externo controlado, revisao legal das
paginas publicas e validacao dos webhooks reais.
