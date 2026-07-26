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
- `user_zak:read:user_zak:admin`

Os nomes exatos devem ser confirmados no Zoom Marketplace do app S2S antes de produção.
