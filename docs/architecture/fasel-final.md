Atue como Staff Software Engineer, Software Architect, Security Engineer, QA Engineer e especialista em integrações Stripe, Supabase e Zoom Video SDK.

Sua missão é elevar significativamente a maturidade técnica e operacional do TES, priorizando:

1. segurança e integridade arquitetural;
2. evolução completa do painel administrativo;
3. homologação e hardening das integrações Stripe;
4. homologação e hardening da integração Zoom Video SDK;
5. correção das fragilidades do Match;
6. compatibilidade entre área pública, paciente, terapeuta e admin;
7. testes reais de navegação e cliques após cada etapa importante;
8. correção contínua de bugs, vulnerabilidades, inconsistências e problemas de performance;
9. criação de uma pipeline de qualidade que impeça regressões.

Não entregue apenas diagnóstico, plano ou sugestões.

Analise, implemente, teste, corrija e documente.

Não declare como concluído algo que não tenha sido efetivamente executado e validado.

==================================================
1. PRINCÍPIOS DE EXECUÇÃO
==================================================

A implementação deve seguir boas práticas modernas, sem criar complexidade desnecessária.

Preferir:

- arquitetura modular orientada a domínio;
- separação clara entre domínio, aplicação, infraestrutura e apresentação;
- comandos e consultas separados;
- read models explícitos;
- DTOs públicos, privados e administrativos separados;
- validação em todas as fronteiras;
- transações para alterações compostas;
- idempotência;
- concorrência otimista;
- state machines explícitas para estados transacionais;
- adapters para integrações externas;
- segurança por padrão;
- menor privilégio;
- fail closed;
- observabilidade estruturada;
- migrations incrementais;
- compatibilidade retroativa;
- feature flags quando mudanças tiverem risco operacional;
- testes automatizados e navegação real.

Não aplicar padrões de arquitetura apenas por formalidade.

Toda abstração criada deve resolver um problema concreto de:

- segurança;
- manutenção;
- testabilidade;
- isolamento de integração;
- consistência;
- performance;
- observabilidade.

==================================================
2. REGRAS NÃO NEGOCIÁVEIS
==================================================

Não:

- confiar em IDs enviados pelo navegador;
- confiar em redirect de Stripe para ativar pagamento ou assinatura;
- confiar em frontend para validar regras críticas;
- usar service role no navegador;
- expor secrets, tokens ou credenciais;
- usar fallback fictício silencioso em produção;
- transformar erro de infraestrutura em sucesso aparente;
- manter links ativos para páginas inexistentes;
- usar Math.random em rankings;
- apagar histórico transacional;
- executar migration destrutiva sem transição e backfill;
- permitir que um terapeuta altere dados de outro;
- permitir que paciente acesse dados privados de terapeuta;
- permitir que admin seja autenticado somente por senha mestre em produção;
- declarar homologação sem executar os testes;
- pular testes porque o código “parece correto”;
- criar nova fonte de verdade quando já existe uma fonte canônica;
- alterar integrações financeiras sem plano de rollback;
- misturar Stripe Billing com pagamentos de sessões;
- criar sessão Zoom sem confirmação financeira válida;
- expor JWT ou segredo do Zoom Video SDK ao cliente;
- manter componentes ou artefatos de cobertura gerados no repositório.

==================================================
3. METODOLOGIA OBRIGATÓRIA
==================================================

Trabalhe em fases.

Cada fase deve seguir:

1. analisar;
2. diagnosticar;
3. registrar riscos;
4. definir plano técnico;
5. implementar;
6. criar ou ampliar testes;
7. executar testes automatizados;
8. iniciar aplicação;
9. navegar pela interface;
10. realizar cliques reais;
11. verificar banco, logs e efeitos colaterais;
12. corrigir problemas encontrados;
13. repetir a homologação;
14. documentar;
15. somente então avançar.

Após cada fase importante, produza um checkpoint contendo:

- o que foi analisado;
- o que foi alterado;
- bugs encontrados;
- vulnerabilidades encontradas;
- riscos corrigidos;
- arquivos alterados;
- migrations criadas;
- testes adicionados;
- comandos executados;
- resultados reais;
- navegação realizada;
- cliques realizados;
- logs inspecionados;
- pendências;
- riscos residuais.

Não interrompa a execução apenas para apresentar planejamento.

Peça confirmação somente quando existir decisão de negócio impossível de inferir com segurança.

==================================================
4. PREPARAÇÃO E BASELINE
==================================================

Antes de qualquer alteração:

1. Ler:
   - AGENTS.md;
   - README;
   - documentação central;
   - ADRs;
   - sitemap;
   - routes-map;
   - product;
   - integração Stripe;
   - integração Zoom;
   - Match;
   - admin;
   - terapias;
   - serviços;
   - pagamentos;
   - jurídico;
   - RLS;
   - cache;
   - observabilidade;
   - skills aplicáveis.

2. Inspecionar:
   - git status;
   - branch atual;
   - commits recentes;
   - migrations;
   - Edge Functions;
   - RPCs;
   - views;
   - RLS;
   - grants;
   - rotas;
   - componentes;
   - testes;
   - scripts;
   - workflows;
   - configuração da Vercel;
   - configuração local do Supabase;
   - integrações externas.

3. Executar baseline:
   - npm install, se necessário;
   - npm run lint;
   - npm run typecheck;
   - npm run build;
   - npm test;
   - npm run test:deno;
   - testes SQL/pgTAP;
   - Playwright;
   - legal:check;
   - scripts de validação Stripe;
   - scripts de validação Zoom.

4. Registrar todos os erros anteriores à implementação.

5. Corrigir bloqueios que impeçam integração, build, typecheck ou homologação.

6. Remover artefatos gerados versionados indevidamente:
   - coverage/;
   - relatórios;
   - screenshots temporários;
   - arquivos locais;
   - caminhos absolutos de máquinas.

7. Atualizar .gitignore.

==================================================
5. CLASSIFICAÇÃO DE ACHADOS
==================================================

Classifique cada achado:

P0:
- vazamento de dados;
- bypass de autenticação;
- bypass financeiro;
- perda ou corrupção de dados;
- cobrança indevida;
- acesso administrativo indevido;
- exposição de secrets;
- sessão Zoom acessível por usuário indevido.

P1:
- fluxo crítico quebrado;
- regra de domínio incorreta;
- estado financeiro inconsistente;
- Match incorreto;
- admin com ações inseguras;
- webhook não idempotente;
- links para rotas inexistentes;
- inconsistência entre shells.

P2:
- performance;
- cache;
- acessibilidade;
- ausência de observabilidade;
- dívida técnica relevante;
- UX operacional frágil.

P3:
- melhoria futura sem risco imediato.

Regras:

- corrigir todos os P0 imediatamente;
- corrigir todos os P1 antes de avançar;
- corrigir P2 relacionados às superfícies alteradas;
- documentar P3;
- criar teste de regressão para cada bug corrigido.

==================================================
6. FASE 1 — SEGURANÇA TRANSVERSAL
==================================================

Realize uma auditoria completa de segurança.

Verificar:

- autenticação;
- autorização;
- RLS;
- IDOR;
- RBAC;
- cookies;
- refresh token;
- logout;
- expiração de sessão;
- rate limit;
- CORS;
- CSRF;
- replay;
- requestId;
- idempotência;
- concorrência;
- enumeração;
- injeção;
- XSS;
- upload de arquivos;
- logs sensíveis;
- dados privados em cache;
- secrets;
- service role;
- endpoints administrativos;
- Edge Functions;
- RPCs security definer;
- search_path;
- grants;
- storage buckets;
- políticas de upload.

--------------------------------------------------
6.1 Administração
--------------------------------------------------

Eliminar o uso de MASTER_PASSWORD como mecanismo normal de acesso administrativo em produção.

Regras:

- MASTER_PASSWORD deve ser proibido em produção;
- qualquer bypass de desenvolvimento precisa de flag explícita;
- flag deve falhar fechada;
- não permitir senha global compartilhada em ambiente real;
- implementar autenticação administrativa reforçada;
- preparar ou implementar MFA;
- implementar rate limit;
- registrar tentativas;
- registrar falhas;
- alertar comportamento suspeito;
- implementar gestão de sessão administrativa;
- adicionar logout global quando necessário;
- exigir reautenticação para ações críticas.

Criar RBAC granular, por exemplo:

- admin.dashboard.read;
- professionals.read;
- professionals.verify;
- patients.read;
- sessions.read;
- sessions.manage;
- payments.read;
- payments.manage;
- subscriptions.read;
- subscriptions.manage;
- therapies.read;
- therapies.manage;
- matching.read;
- matching.manage;
- integrations.read;
- integrations.manage;
- security.read;
- security.manage;
- audit.read;
- support.read;
- support.manage.

Não depender apenas de role = admin para todas as operações.

--------------------------------------------------
6.2 Uploads
--------------------------------------------------

Auditar uploads administrativos e profissionais.

Garantir:

- tipos permitidos;
- extensão derivada do MIME validado;
- tamanho máximo;
- nomes aleatórios;
- bucket correto;
- RLS;
- path por entidade;
- bloqueio de SVG quando não necessário;
- proteção contra overwrite;
- remoção de arquivos órfãos;
- validação server-side;
- não confiar apenas no content-type enviado pelo navegador;
- logs sem dados sensíveis.

==================================================
7. FASE 2 — EVOLUÇÃO DO PAINEL ADMINISTRATIVO
==================================================

O admin é atualmente o shell menos desenvolvido.

Transforme-o em uma central operacional real, integrada ao restante do sistema.

Utilizar o AuthenticatedShell existente.

Não criar outro shell.

--------------------------------------------------
7.1 Dashboard administrativo
--------------------------------------------------

Evoluir /admin para apresentar dados reais:

- terapias publicadas;
- terapias em rascunho;
- temas;
- refinamentos;
- solicitações de novas terapias;
- profissionais ativos;
- profissionais pendentes de verificação;
- pacientes ativos;
- sessões futuras;
- sessões com problemas;
- pagamentos pendentes;
- refunds;
- disputes;
- repasses pendentes;
- assinaturas ativas;
- assinaturas inadimplentes;
- alertas Stripe;
- alertas Zoom;
- falhas de webhook;
- alertas de integridade;
- ações administrativas recentes.

Requisitos:

- dados agregados;
- sem exposição desnecessária de PII;
- queries paginadas;
- índices;
- estados de loading, error, empty e degraded;
- links apenas para rotas existentes;
- ocultar módulos ainda não inaugurados.

--------------------------------------------------
7.2 Profissionais
--------------------------------------------------

Implementar ou concluir:

- listagem;
- busca;
- filtros;
- status;
- plano;
- perfil público;
- verificação;
- documentos privados;
- status Stripe Connect;
- status de assinatura;
- quantidade de serviços;
- quantidade de sessões;
- histórico de ações;
- suspensão;
- reativação;
- auditoria.

Não permitir acesso público a documentos.

Ações críticas devem exigir:

- permissão;
- motivo;
- confirmação;
- requestId;
- expectedVersion;
- auditoria.

--------------------------------------------------
7.3 Verificações
--------------------------------------------------

Implementar fluxo de verificação:

- pendente;
- em análise;
- aprovado;
- rejeitado;
- informação adicional necessária;
- expirado.

Registrar:

- ator;
- data;
- motivo;
- documentos considerados;
- estado anterior;
- novo estado.

Não copiar documentos para logs ou eventos.

--------------------------------------------------
7.4 Pacientes
--------------------------------------------------

Implementar visão administrativa mínima:

- busca;
- status;
- quantidade de encontros;
- tickets;
- pagamentos;
- data de criação;
- sinais operacionais.

Evitar exposição excessiva.

Não exibir dados clínicos ou conteúdo sensível sem necessidade operacional explícita.

--------------------------------------------------
7.5 Sessões
--------------------------------------------------

Implementar módulo administrativo de sessões:

- filtros;
- terapeuta;
- paciente;
- terapia;
- serviço;
- status;
- pagamento;
- Zoom;
- data;
- cancelamento;
- reagendamento;
- disputa;
- refund;
- auditoria.

Ações administrativas devem ser limitadas e auditadas.

--------------------------------------------------
7.6 Pagamentos e repasses
--------------------------------------------------

Implementar visão administrativa:

- pagamentos de sessão;
- assinaturas;
- charges;
- payment intents;
- refunds;
- disputes;
- transfers;
- repasses;
- lotes;
- falhas;
- reconciliação;
- ambiente Stripe;
- status de webhook.

Separar claramente:

- pagamento de sessão;
- assinatura do terapeuta;
- repasse para terapeuta;
- taxa da plataforma;
- refund;
- dispute.

--------------------------------------------------
7.7 Integrações
--------------------------------------------------

Implementar /admin/integracoes:

Stripe:

- ambiente;
- conectividade;
- última sincronização;
- webhooks;
- eventos com falha;
- catálogo Billing;
- contas Connect;
- reconciliação;
- alertas.

Zoom:

- configuração;
- conectividade;
- webhook;
- sessões futuras;
- sessões com falha;
- tokens emitidos;
- sessões órfãs;
- alertas.

E-mail:

- provider;
- última tentativa;
- falhas recentes;
- fila;
- taxa de erro.

Não expor secrets.

--------------------------------------------------
7.8 Segurança e auditoria
--------------------------------------------------

Implementar /admin/seguranca:

- sessões administrativas;
- tentativas de login;
- falhas;
- eventos de autorização;
- alterações críticas;
- webhooks inválidos;
- requests suspeitos;
- auditoria;
- exportação controlada;
- revogação de sessão;
- MFA;
- permissões.

==================================================
8. FASE 3 — HARDENING DO MATCH
==================================================

Corrigir as inconsistências já identificadas.

--------------------------------------------------
8.1 Labels
--------------------------------------------------

A label de correspondência deve usar o número real de temas coincidentes.

Não usar percentual para afirmar quantidade de temas.

Exemplo:

- um tema coincidente: “1 tema em comum”;
- dois temas coincidentes: “2 temas em comum”;
- três temas coincidentes: “3 temas em comum”.

Corrigir frontend, Edge Function, testes e contratos.

--------------------------------------------------
8.2 Versionamento
--------------------------------------------------

O matchingVersionId deve representar uma versão realmente válida.

Garantir:

- versão existente;
- versão publicada;
- configuração da versão;
- vínculo entre seleção e versão;
- rejeição de versão inválida;
- tratamento de versão desatualizada;
- reexecução segura;
- auditoria;
- nenhum versionId puramente decorativo.

--------------------------------------------------
8.3 Alteração dos temas de uma terapia
--------------------------------------------------

Ao remover tema de uma terapia:

1. identificar serviços afetados;
2. identificar refinamentos afetados;
3. apresentar impacto;
4. exigir motivo;
5. impedir inconsistência;
6. aplicar estratégia transacional.

Preferir:

- bloquear alteração enquanto existirem serviços incompatíveis;
- ou marcar serviços como configuration_required;
- ou remover apenas vínculos operacionais inválidos de forma auditada.

Nunca deixar:

- tema do serviço fora da terapia;
- refinamento órfão;
- serviço público aparentemente válido com configuração inválida.

--------------------------------------------------
8.4 Fallbacks
--------------------------------------------------

Remover fallback silencioso em produção.

Em produção:

- erro de Supabase não retorna mock;
- lista vazia não retorna mock;
- Match sem versão publicada retorna unavailable;
- home sem terapeutas reais mostra estado vazio honesto;
- ambiente demo exige flag explícita;
- uso de demo precisa ser claramente observável.

--------------------------------------------------
8.5 Performance
--------------------------------------------------

Auditar:

- ranking no banco;
- paginação;
- índices;
- cardinalidade;
- N+1;
- selects excessivos;
- ordenação em memória;
- payloads;
- cache.

Executar EXPLAIN ANALYZE quando possível.

==================================================
9. FASE 4 — STRIPE: ARQUITETURA E HARDENING
==================================================

Revise toda a integração Stripe como um domínio financeiro crítico.

Manter separação explícita:

- Stripe Billing para planos;
- Stripe Checkout de sessão;
- Stripe Connect para repasses;
- ledger interno;
- payouts;
- refunds;
- disputes.

--------------------------------------------------
9.1 Fonte de verdade
--------------------------------------------------

Redirect de sucesso nunca ativa:

- assinatura;
- booking;
- pagamento;
- repasse;
- plano.

Somente webhook validado pode confirmar estado financeiro.

A interface pode mostrar:

- pagamento em confirmação;
- aguardando webhook;
- pagamento confirmado;
- pagamento falhou.

--------------------------------------------------
9.2 Webhooks
--------------------------------------------------

Auditar:

- verificação da assinatura;
- raw body;
- timestamp;
- replay;
- idempotência;
- evento duplicado;
- evento fora de ordem;
- evento desconhecido;
- ambiente;
- livemode/testmode;
- correlationId;
- logs;
- retry;
- dead-letter operacional;
- reconciliação.

Criar tabela ou mecanismo equivalente de eventos Stripe:

- stripe_event_id;
- type;
- environment;
- livemode;
- status;
- received_at;
- processed_at;
- attempts;
- error_code;
- correlation_id;
- payload hash.

Não guardar payload completo com PII desnecessária.

--------------------------------------------------
9.3 Assinaturas
--------------------------------------------------

Homologar estados:

- incomplete;
- incomplete_expired;
- trialing;
- active;
- past_due;
- unpaid;
- paused;
- canceled.

Garantir:

- ativação somente por webhook;
- upgrade;
- downgrade;
- cancelamento;
- cancelamento no fim do período;
- reativação;
- falha de pagamento;
- renovação;
- invoice paid;
- invoice payment failed;
- portal de cobrança;
- uma assinatura ativa por terapeuta;
- ausência de duplicação;
- segregação por ambiente;
- catálogo sincronizado.

--------------------------------------------------
9.4 Pagamentos de sessões
--------------------------------------------------

Homologar:

- hold;
- booking;
- Checkout;
- payment intent;
- webhook;
- confirmação;
- expiração;
- cancelamento;
- refund;
- refund parcial;
- dispute;
- falha;
- idempotência;
- reserva duplicada;
- dois usuários disputando o mesmo horário.

--------------------------------------------------
9.5 Stripe Connect
--------------------------------------------------

Auditar:

- criação de conta;
- account links;
- onboarding;
- charges_enabled;
- payouts_enabled;
- requirements;
- currently_due;
- eventually_due;
- disabled_reason;
- external account;
- transfers;
- separate charges and transfers;
- reconciliação;
- falha de transferência;
- retry;
- conta desconectada;
- terapeuta suspenso;
- mudança de ambiente.

Não permitir repasse quando:

- conta não estiver apta;
- pagamento não estiver confirmado;
- sessão não estiver elegível;
- houver dispute ou refund incompatível;
- ledger estiver inconsistente.

--------------------------------------------------
9.6 Ledger
--------------------------------------------------

Garantir que o ledger interno seja imutável e conciliável.

Cada movimentação deve ter:

- origem;
- tipo;
- valor;
- moeda;
- booking;
- payment;
- therapist;
- Stripe object;
- environment;
- correlationId;
- createdAt.

Não editar lançamentos históricos.

Usar estorno compensatório.

--------------------------------------------------
9.7 Testes Stripe
--------------------------------------------------

Após cada subetapa:

Automatizados:

- unitários;
- Deno;
- banco;
- webhook;
- idempotência;
- state machine;
- concorrência;
- reconciliação.

Navegação real:

1. cadastrar terapeuta;
2. escolher Premium;
3. clicar em continuar;
4. abrir Stripe Checkout real em test mode;
5. concluir pagamento;
6. aguardar webhook;
7. confirmar plano;
8. abrir portal;
9. cancelar;
10. confirmar atualização por webhook.

Sessão:

1. cliente escolhe horário;
2. cria hold;
3. abre Checkout;
4. conclui pagamento;
5. webhook confirma;
6. booking é ativado;
7. Zoom fica elegível;
8. cancelar;
9. executar refund;
10. confirmar ledger.

Capturar:

- screenshots;
- traces;
- requestId;
- Stripe IDs;
- logs;
- estado anterior;
- estado posterior.

Não registrar números completos de cartão ou secrets.

==================================================
10. FASE 5 — ZOOM VIDEO SDK: ARQUITETURA E HARDENING
==================================================

Auditar toda a integração Zoom.

O TES utiliza Zoom Video SDK.

Manter sessão lógica local como fonte de coordenação.

--------------------------------------------------
10.1 Regra financeira
--------------------------------------------------

Só criar ou habilitar sessão Zoom após:

- booking válido;
- pagamento confirmado;
- sessão elegível;
- terapeuta ativo;
- paciente correto.

Nunca criar sessão baseada apenas no redirect do Stripe.

--------------------------------------------------
10.2 Autorização
--------------------------------------------------

Garantir:

- terapeuta entra somente em sessões próprias;
- paciente entra somente em encontros próprios;
- admin não entra automaticamente;
- role do JWT definida server-side;
- topic/sessionName não manipulável;
- bookingId validado;
- janela de acesso;
- sessão futura bloqueada quando necessário;
- sessão encerrada bloqueia novo token;
- sessão cancelada não gera token;
- refund/cancelamento atualiza elegibilidade.

--------------------------------------------------
10.3 Tokens
--------------------------------------------------

JWT do Zoom deve:

- ser criado somente no backend;
- ter vida curta;
- conter role correta;
- usar sessionName canônico;
- nunca ser persistido em logs;
- nunca ser armazenado permanentemente;
- nunca ser exposto para outro participante;
- ser emitido apenas após autorização completa.

--------------------------------------------------
10.4 Webhooks
--------------------------------------------------

Auditar:

- assinatura;
- secret token;
- replay;
- idempotência;
- evento duplicado;
- evento fora de ordem;
- sessão iniciada;
- participante entrou;
- participante saiu;
- sessão encerrada;
- falha;
- ambiente;
- correlationId.

Criar read model operacional de sessões Zoom:

- booking;
- sessionName;
- status;
- startedAt;
- endedAt;
- hostJoinedAt;
- participantJoinedAt;
- lastEventAt;
- errorCode;
- retryStatus.

--------------------------------------------------
10.5 Resiliência
--------------------------------------------------

Tratar:

- Zoom indisponível;
- falha ao gerar token;
- sessão já encerrada;
- sessão duplicada;
- usuário reconectando;
- duas abas;
- terapeuta atrasado;
- paciente atrasado;
- sessão cancelada durante acesso;
- falha de rede;
- webhook não recebido.

A interface precisa comunicar:

- ainda não disponível;
- encontro disponível;
- aguardando terapeuta;
- reconectando;
- encerrado;
- cancelado;
- indisponível.

--------------------------------------------------
10.6 Privacidade
--------------------------------------------------

Não habilitar:

- gravação;
- transcrição;
- armazenamento de conteúdo;
- analytics sensíveis;

sem decisão jurídica, consentimento e política explícita.

--------------------------------------------------
10.7 Testes Zoom
--------------------------------------------------

Automatizados:

- emissão de token;
- autorização;
- role;
- expiração;
- booking inválido;
- pagamento não confirmado;
- sessão cancelada;
- outro usuário;
- replay de webhook;
- idempotência;
- sessão encerrada.

Navegação real:

1. criar booking pago;
2. acessar como terapeuta;
3. clicar em entrar na sessão;
4. abrir Video SDK;
5. acessar como paciente em outro contexto;
6. clicar em entrar no encontro;
7. conectar ambos;
8. verificar áudio/vídeo;
9. sair;
10. reconectar;
11. encerrar como host;
12. verificar estado final;
13. tentar entrar novamente;
14. confirmar bloqueio.

Executar teste headed em dois contextos de navegador.

Registrar:

- traces;
- screenshots;
- IDs locais;
- requestIds;
- eventos Zoom;
- estados no banco;
- erros.

==================================================
11. FASE 6 — ÁREA DO TERAPEUTA
==================================================

Corrigir o dashboard inicial.

Free, Premium e Premium Plus devem ter dashboard funcional.

O plano deve controlar capacidades, não substituir a página por “em construção”.

Dashboard base para todos:

- próximas sessões;
- agenda;
- serviços;
- status do perfil;
- pendências;
- mensagens;
- atalhos.

Premium:

- recursos adicionais aprovados.

Premium Plus:

- insights;
- Aura;
- recursos avançados.

Revisar também:

- plano;
- assinatura;
- configurações;
- segurança;
- suporte;
- Stripe Connect;
- serviços;
- perfil;
- agenda;
- sessões;
- financeiro.

==================================================
12. FASE 7 — ÁREA DO PACIENTE
==================================================

Completar progressivamente:

- dashboard;
- encontros;
- detalhe;
- mensagens;
- favoritos;
- pagamentos;
- faturas;
- métodos de pagamento;
- perfil;
- notificações;
- privacidade;
- segurança;
- suporte.

Não criar páginas vazias apenas para preencher rotas.

Uma rota só deve aparecer na navegação quando tiver:

- conteúdo funcional;
- estado vazio;
- estado de erro;
- autorização;
- testes.

==================================================
13. FASE 8 — CACHE, OBSERVABILIDADE E OPERAÇÃO
==================================================

--------------------------------------------------
13.1 Cache
--------------------------------------------------

Auditar cache público e privado.

Garantir:

- dados privados nunca em cache público;
- tags específicas;
- invalidação seletiva;
- suspensão refletida rapidamente;
- serviço pausado removido;
- terapia despublicada removida;
- Match atualizado;
- alterações admin refletidas;
- falhas de revalidação observáveis.

--------------------------------------------------
13.2 Observabilidade
--------------------------------------------------

Padronizar logs:

- timestamp;
- level;
- operation;
- requestId;
- correlationId;
- userRole;
- entityType;
- entityId;
- environment;
- durationMs;
- result;
- errorCode.

Não registrar:

- token;
- password;
- JWT;
- card;
- documentos;
- conteúdo privado;
- payload completo de webhook.

Criar métricas:

- erro por Edge Function;
- webhook falho;
- tempo de processamento;
- falha de checkout;
- falha Zoom;
- divergência de reconciliação;
- sessão sem pagamento;
- pagamento sem booking;
- booking sem Zoom elegível;
- transfer sem ledger.

==================================================
14. FASE 9 — CI E QUALITY GATES
==================================================

Criar workflow obrigatório de CI.

Pipeline mínima:

1. instalação limpa;
2. format check;
3. lint;
4. typecheck;
5. unit tests;
6. Deno tests;
7. migrations em banco limpo;
8. seeds;
9. pgTAP/RLS;
10. build;
11. Playwright smoke;
12. legal check;
13. verificação de migrations;
14. secret scanning;
15. dependency audit;
16. artefatos de teste.

Configurar proteção de branch quando possível:

- impedir merge com CI falha;
- exigir branch atualizada;
- exigir revisão;
- impedir push direto em main;
- impedir migrations sem teste;
- impedir build quebrado.

Não versionar coverage.

Publicar coverage como artefato da pipeline.

==================================================
15. TESTES COM NAVEGAÇÃO E CLIQUES REAIS
==================================================

Após cada etapa importante:

1. iniciar Supabase;
2. aplicar migrations;
3. executar seed;
4. iniciar Edge Functions necessárias;
5. iniciar Next.js;
6. abrir navegador real;
7. navegar a partir da home;
8. evitar acessar todas as rotas diretamente;
9. clicar nos menus;
10. abrir modais;
11. preencher campos;
12. enviar formulários;
13. testar estados de erro;
14. testar retorno;
15. testar refresh;
16. testar segunda aba;
17. testar mobile;
18. testar teclado;
19. testar sessão expirada;
20. testar usuário sem permissão.

Para cada fluxo crítico, usar Playwright headed e traces.

Testar pelo menos:

Admin:

- login;
- dashboard;
- Match;
- temas;
- refinamentos;
- terapias;
- profissionais;
- sessões;
- pagamentos;
- integrações;
- segurança.

Terapeuta:

- cadastro;
- plano;
- Stripe;
- dashboard;
- perfil;
- serviços;
- Match;
- agenda;
- sessão;
- Zoom;
- financeiro;
- suporte.

Paciente:

- cadastro;
- Match;
- terapia;
- terapeuta;
- reserva;
- Stripe;
- encontro;
- Zoom;
- cancelamento;
- mensagens;
- pagamento.

Público:

- home;
- Match;
- catálogo;
- terapia;
- perfil;
- login;
- cadastro;
- páginas jurídicas.

==================================================
16. TESTES DE CONCORRÊNCIA
==================================================

Criar testes para:

- dois pacientes reservando o mesmo horário;
- duas abas alterando o mesmo serviço;
- dois admins alterando a mesma terapia;
- webhook duplicado;
- checkout duplicado;
- subscription checkout duplicado;
- refund repetido;
- transfer repetida;
- token Zoom solicitado simultaneamente;
- sessão encerrada enquanto usuário tenta entrar;
- remoção de tema durante edição de serviço.

Usar:

- locks;
- expectedVersion;
- unique constraints;
- idempotency keys;
- transações;
- retries controlados.

==================================================
17. TESTES DE SEGURANÇA
==================================================

Testar explicitamente:

- paciente lendo dados de outro paciente;
- terapeuta alterando serviço de outro terapeuta;
- terapeuta lendo financeiro de outro;
- visitante lendo admin;
- admin sem permissão alterando Match;
- manipulação de serviceId;
- manipulação de bookingId;
- manipulação de therapyId;
- manipulação de expectedVersion;
- token expirado;
- cookie adulterado;
- CORS indevido;
- replay de webhook;
- upload inválido;
- XSS em campos editoriais;
- SQL injection em filtros;
- força bruta no admin;
- master password em produção;
- token Zoom de outra sessão;
- acesso ao encontro cancelado.

==================================================
18. CRITÉRIOS DE ACEITE POR FASE
==================================================

Uma fase somente termina quando:

- lint passa;
- typecheck passa;
- testes unitários passam;
- testes Deno passam quando aplicável;
- banco aplica migrations;
- pgTAP/RLS passa;
- build passa;
- Playwright crítico passa;
- navegação real foi executada;
- cliques reais foram executados;
- logs foram inspecionados;
- bugs encontrados foram corrigidos;
- P0 e P1 foram resolvidos;
- documentação foi atualizada;
- riscos residuais foram registrados.

Não avançar para a próxima fase com P0 ou P1 relacionado à fase atual.

==================================================
19. HOMOLOGAÇÃO FINAL VERTICAL
==================================================

Executar uma jornada completa.

--------------------------------------------------
19.1 Jornada administrativa
--------------------------------------------------

1. login com autenticação reforçada;
2. abrir dashboard;
3. criar tema;
4. criar refinamento;
5. editar terapia;
6. vincular temas;
7. publicar;
8. verificar impacto;
9. abrir profissional;
10. revisar verificação;
11. visualizar sessão;
12. visualizar pagamento;
13. visualizar Stripe Connect;
14. visualizar Zoom;
15. consultar auditoria;
16. revogar sessão administrativa.

--------------------------------------------------
19.2 Jornada do terapeuta
--------------------------------------------------

1. cadastro;
2. confirmar e-mail;
3. escolher plano;
4. abrir Stripe Checkout;
5. concluir assinatura;
6. aguardar webhook;
7. confirmar plano;
8. concluir perfil;
9. configurar Stripe Connect;
10. criar serviço;
11. selecionar temas;
12. selecionar refinamentos;
13. configurar agenda;
14. receber booking;
15. acessar sessão Zoom;
16. encerrar;
17. visualizar financeiro;
18. visualizar repasse.

--------------------------------------------------
19.3 Jornada do paciente
--------------------------------------------------

1. abrir home;
2. fazer Match;
3. selecionar temas;
4. selecionar refinamentos;
5. receber terapias;
6. abrir terapia;
7. receber terapeutas ordenados;
8. abrir perfil;
9. selecionar serviço;
10. selecionar horário;
11. cadastrar ou autenticar;
12. aceitar documentos;
13. abrir Stripe Checkout;
14. concluir pagamento;
15. aguardar confirmação;
16. abrir encontro;
17. entrar no Zoom;
18. encerrar;
19. avaliar;
20. visualizar pagamento.

==================================================
20. PERFORMANCE E ESCALA
==================================================

Validar comportamento com volume equivalente a:

- 10 temas;
- 100 refinamentos;
- 200 terapias;
- 10.000 terapeutas;
- 30.000 serviços;
- 100.000 bookings;
- grande volume de eventos Stripe;
- grande volume de eventos Zoom.

Auditar:

- índices;
- paginação;
- cursor;
- scans;
- joins;
- aggregate;
- JSON aggregation;
- consultas administrativas;
- ranking;
- dashboard;
- webhooks;
- ledger.

Documentar queries críticas e planos de execução.

==================================================
21. DOCUMENTAÇÃO
==================================================

Atualizar conforme impacto:

- AGENTS.md;
- README;
- ADRs;
- sitemap;
- routes-map;
- page inventory;
- integration map;
- Stripe;
- Stripe Connect;
- Billing;
- Zoom;
- Match;
- admin;
- serviços;
- RLS;
- segurança;
- cache;
- observabilidade;
- homologação;
- runbooks;
- incidentes;
- rollback.

Criar runbooks para:

- webhook Stripe falhando;
- webhook Zoom falhando;
- pagamento confirmado sem booking;
- booking sem pagamento;
- assinatura sem atualização;
- repasse falho;
- sessão Zoom indisponível;
- conta Connect restrita;
- migration falha;
- rollback;
- revogação de credenciais.

==================================================
22. RELATÓRIO FINAL
==================================================

Ao final, apresentar:

1. diagnóstico inicial;
2. arquitetura encontrada;
3. arquitetura final;
4. riscos identificados;
5. P0 corrigidos;
6. P1 corrigidos;
7. P2 corrigidos;
8. evolução do admin;
9. evolução do Stripe;
10. evolução do Zoom;
11. evolução do Match;
12. evolução do terapeuta;
13. evolução do paciente;
14. mudanças de banco;
15. migrations;
16. RLS;
17. permissões;
18. APIs;
19. RPCs;
20. Edge Functions;
21. cache;
22. observabilidade;
23. performance;
24. arquivos alterados;
25. testes criados;
26. comandos executados;
27. resultados reais;
28. navegações executadas;
29. cliques realizados;
30. traces e evidências;
31. testes externos executados;
32. testes não executados;
33. motivo dos testes não executados;
34. riscos residuais;
35. plano de rollback;
36. próximas prioridades.

Não declarar “pronto”, “homologado” ou “seguro” quando:

- build falhar;
- migrations não forem aplicadas;
- testes críticos não passarem;
- webhook real não tiver sido validado;
- Stripe não tiver sido testado em test mode;
- Zoom não tiver sido testado com dois participantes;
- P0 ou P1 permanecer aberto;
- rotas administrativas críticas continuarem quebradas;
- fallback fictício continuar ativo em produção.