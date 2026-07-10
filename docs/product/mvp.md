# MVP Transacional

Este documento define o recorte inicial de implementação funcional do Terapeuta Eu Sou antes da fase de backend completa com Supabase.

## Direção

O MVP prioriza uma plataforma transacional: descoberta de terapias, match determinístico por regras e pesos, listagem de terapeutas, páginas públicas, escolha de horário, cadastro/login, pré-checkout, pagamento futuro, sessão online e continuidade na área logada.

Supabase será a base posterior para banco, autenticação, storage e Edge Functions. Stripe está previsto para pagamento real e Zoom ou ferramenta similar está prevista para sessão online, mas nenhuma dessas integrações entra nesta rodada.

Não haverá IA real no MVP. Aura IA será tratada como motor determinístico de recomendações baseado em regras, pesos, condições e lógica previsível, sem OpenAI ou modelo generativo.

## Escopo V1

Fluxo transacional inicial:

- `/`: entrada pública.
- `/como-funciona`: explicação da experiência.
- `/sua-jornada`: questionário guiado.
- `/sua-jornada/resultado`: caminhos sugeridos por match determinístico.
- `/terapias` e `/terapias/:slug`: catálogo e página de terapia.
- `/terapeutas`: busca de terapeutas.
- `/terapeutas/:slug`: perfil público.
- `/reserva`: serviço, horário, conta, pré-checkout e preparação de pagamento.
- `/reserva/sucesso`: confirmação.
- `/entrar` e `/cadastro`: preparação para autenticação Supabase.
- `/app`: área logada do paciente após reserva.
- áreas do terapeuta para planos Free, Premium e Premium Plus, em recorte progressivo.

## Fora Desta Rodada

- Supabase Auth.
- Supabase Edge Functions.
- Integração funcional com Supabase no código.
- Pagamentos reais com Stripe.
- Integração real com Zoom ou ferramenta similar.
- IA real ou Aura IA generativa.
- Mensagens reais.
- Agenda real.
- Área logada do paciente completa.
- Áreas Free, Premium, Premium Plus e Admin completas.
- Storybook.

## Critérios de Pronto

- Rotas usam `src/lib/routes.ts` como fonte canônica.
- Componentes reutilizáveis públicos usam tokens TES.
- Dados mockados ficam explícitos e fáceis de substituir por Supabase.
- Nenhuma variável sensível real aparece no repositório.
- O projeto passa em typecheck, lint e build.
