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
- confirmar que apps antigos e webhooks antigos nao estao implantados antes de
  remover qualquer configuracao remota.

Nao declarar producao pronta sem teste externo controlado, revisao legal das
paginas publicas e validacao dos webhooks reais.
