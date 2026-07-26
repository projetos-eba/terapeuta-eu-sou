# Meeting SDK

O SDK Web é carregado apenas no client por `dynamic import("@zoom/meetingsdk")`.

O backend gera JWT HS256 com:

- `appKey`/`sdkKey`: Meeting SDK Client ID
- `mn`: número da reunião recuperado pela booking autorizada
- `role`: `0` para paciente, `1` para terapeuta responsável
- `iat`, `exp` e `tokenExp`: validade curta

O browser nunca decide `role`, meeting number ou ZAK. O endpoint autenticado retorna apenas o payload mínimo necessário para o SDK.

ZAK:

- solicitado perto do horário;
- apenas para o terapeuta responsável;
- não persistido;
- obtido via `GET /v2/users/{userId}/token?type=zak`, usando o `id` retornado por `GET /v2/users/{ZOOM_DEFAULT_HOST_USER_ID}`;
- exige access token S2S com `user:read:zak:admin` e host licenciado `type === 2`;
- se indisponível por autorização do General App ou scopes, o fluxo de host fica bloqueado por configuração externa.
