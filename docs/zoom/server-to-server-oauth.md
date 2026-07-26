# Server-to-Server OAuth

Contrato usado:

- Token: `POST https://zoom.us/oauth/token`
- Grant: `account_credentials`
- Autenticação: Basic Auth com Client ID e Client Secret do app S2S
- `account_id`: enviado na query
- API base: `https://api.zoom.us/v2`

O access token fica somente em cache de memória do isolate, com renovação antes da expiração. Não persistir token no banco.

Scopes mínimos esperados para operação:

- `meeting:read:meeting:admin`
- `meeting:write:meeting:admin`
- `meeting:update:meeting:admin`
- `meeting:delete:meeting:admin`
- `user:read:user:admin`
- `user:read:zak:admin`

O teste real valida se o access token retornado pelo fluxo
`account_credentials` inclui `user:read:zak:admin`, sem imprimir o token. Para
ZAK, o script consulta primeiro `GET /v2/users/{ZOOM_DEFAULT_HOST_USER_ID}` e
usa o campo `id` retornado pelo Zoom na chamada
`GET /v2/users/{userId}/token?type=zak`.

O host precisa estar ativo e com `type === 2` para ser tratado como licenciado.
`type > 1` não é validação suficiente.

Se o token contiver o scope e o host estiver correto/licenciado, uma falha 401
ou 403 no ZAK deve ser tratada como pendência externa de autorização do General
App, instalação do app para o host ou restrição atual do Zoom Marketplace. Não
criar fallback inseguro.
