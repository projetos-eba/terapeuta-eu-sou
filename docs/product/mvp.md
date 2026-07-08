# MVP Público + Reserva

Este documento define o recorte inicial de implementação funcional do Terapeuta Eu Sou antes da fase de backend completa com Supabase.

## Direção

O MVP prioriza o fluxo público que gera descoberta, confiança e intenção de reserva. Supabase será a base posterior para banco, autenticação, storage e Edge Functions, mas esta etapa apenas prepara o projeto para essa direção.

## Escopo V1

Rotas do fluxo público:

- `/`: entrada pública.
- `/como-funciona`: explicação da experiência.
- `/sua-jornada`: questionário guiado.
- `/sua-jornada/resultado`: caminhos sugeridos.
- `/terapeutas`: busca de terapeutas.
- `/terapeutas/:slug`: perfil público.
- `/reserva`: serviço, horário, conta e pagamento.
- `/reserva/sucesso`: confirmação.
- `/entrar` e `/cadastro`: preparação para autenticação.

## Fora Desta Rodada

- Banco de dados Supabase.
- Supabase Auth.
- Supabase Edge Functions.
- Pagamentos reais.
- Mensagens reais.
- Agenda real.
- Área logada do paciente.
- Áreas Básico, Pro, Plus e Admin completas.
- Storybook.

## Critérios de Pronto

- Rotas usam `src/lib/routes.ts` como fonte canônica.
- Componentes reutilizáveis públicos usam tokens TES.
- Dados mockados ficam explícitos e fáceis de substituir por Supabase.
- Nenhuma variável sensível real aparece no repositório.
- O projeto passa em typecheck, lint e build.
