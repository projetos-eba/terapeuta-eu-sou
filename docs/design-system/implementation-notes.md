# Notas de Implementação

Guia técnico para iniciar e manter o front-end TES com Next.js, TypeScript, Tailwind CSS e shadcn/ui.

Fonte primária de navegação: Figma `↳ Jornadas dos Usuários`, node `12272:2`, frame principal `12280:2`.

## Stack

Usa-se Next.js 15 com App Router porque o produto tem áreas com rotas claras, layouts por perfil e renderização híbrida. Usa-se TypeScript para contratos de rota, permissão e componentes. Usa-se Tailwind com CSS Variables para manter tokens centralizados. Usa-se shadcn/ui como base estrutural, sempre encapsulada por wrappers TES.

A área autenticada do terapeuta converge para `/terapeuta/*`; Free, Premium e
Premium Plus compartilham shell e rotas, com acesso resolvido por capability.
`/basico/*`, `/pro/*` e `/plus/*` são aliases temporários, enquanto
`/terapeutas/*` continua sendo o catálogo público.

## Estrutura

```txt
src/
  app/
    page.tsx
    globals.css
    (public)/
    app/
    basico/
    pro/
    plus/
    admin/
  components/
    tes/
      base/
      layout/
      product/
      charts/
      feedback/
    ui/
  design-system/
    tokens/
    themes/
  features/
    public/
    patient/
    therapist/
    admin/
    matching/
    billing/
    messaging/
  lib/
    auth/
    permissions/
    routes/
    formatters/
    copy/
  content/
    ux-writing/
    therapy-catalog/
```

## Aliases

`tsconfig.json` define:

```json
{
  "@/*": ["./src/*"],
  "@/components/*": ["./src/components/*"],
  "@/lib/*": ["./src/lib/*"],
  "@/design-system/*": ["./src/design-system/*"],
  "@/features/*": ["./src/features/*"],
  "@/content/*": ["./src/content/*"]
}
```

Uso:

```ts
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
```

## Rotas

Centralizar rotas em `src/lib/routes.ts`.

```ts
export const routes = {
  public: {
    home: "/",
    howItWorks: "/como-funciona",
    journey: "/sua-jornada",
    journeyResult: "/sua-jornada/resultado",
    therapists: "/terapeutas",
    therapistProfile: (slug: string) => `/terapeutas/${slug}`,
    therapies: "/terapias",
    therapyDetail: (slug: string) => `/terapias/${slug}`,
    reservation: "/reserva",
    reservationSuccess: "/reserva/sucesso",
    forTherapists: "/para-terapeutas",
    therapistPlans: "/para-terapeutas/planos",
    signIn: "/entrar",
    signUp: "/cadastro",
    resetPassword: "/reset-senha",
    terms: "/termos",
    privacy: "/privacidade",
  },
  patient: {
    home: "/app",
    sessions: "/app/sessoes",
    upcomingSessions: "/app/sessoes/proximas",
    sessionHistory: "/app/sessoes/historico",
    messages: "/app/mensagens",
    favorites: "/app/favoritos",
    favoriteTherapists: "/app/favoritos/terapeutas",
    favoriteTherapies: "/app/favoritos/terapias",
    payments: "/app/pagamentos",
    settings: "/app/configuracoes",
    help: "/app/ajuda",
  },
  therapist: {
    basicHome: "/basico",
    basicSessions: "/basico/sessoes",
    basicMessages: "/basico/mensagens",
    proHome: "/pro",
    plusHome: "/plus",
    plusServices: "/plus/servicos",
    plusReviews: "/plus/avaliacoes",
    plusAssessorIa: "/plus/assessor-ia",
    plusPatientJourney: (slug: string) => `/plus/pacientes/${slug}`,
  },
  admin: {
    home: "/admin",
  },
} as const;
```

Aliases ficam em objeto separado:

```ts
export const routeAliases = {
  "/como funciona": routes.public.howItWorks,
  "/plus/serviços": routes.therapist.plusServices,
  "/plus/avaliações": routes.therapist.plusReviews,
  "/plus/ia": routes.therapist.plusAssessorIa,
} as const;
```

## Permissões

Permissão é contrato por recurso, não só por rota.

```ts
type Plan = "basic" | "pro" | "plus";

export const therapistCapabilities = {
  sessions: ["basic", "pro", "plus"],
  messages: ["basic", "pro", "plus"],
  completeFinance: ["pro", "plus"],
  reviews: ["pro", "plus"],
  intermediateMetrics: ["pro", "plus"],
  advancedInsights: ["plus"],
  aiRecommendations: ["plus"],
  patientJourneyHistory: ["plus"],
  prioritySupport: ["plus"],
} satisfies Record<string, Plan[]>;
```

Regras:

- As antigas superfícies públicas `/ajuda` e `/ajuda/zoom` foram removidas em
  2026-07-31; manter suporte logado, documentação técnica de Zoom e páginas
  legais válidas.
- Básico mantém sessões e mensagens com recursos limitados.
- Básico renderiza financeiro operacional e não renderiza navegação principal de avaliações ou métricas intermediárias.
- Pro pode ver convites para Plus.
- Plus nunca vê upgrade.
- Admin usa guarda próprio.

## Tokens

Implementar nesta ordem:

1. CSS Variables em `src/app/globals.css`.
2. Tailwind em `tailwind.config.ts`.
3. Wrappers TES.
4. Storybook foundations.
5. Telas.

Exemplo CSS:

```css
:root {
  --tes-color-brand-primary: #6c3d91;
  --tes-color-brand-primary-hover: #5b337a;
  --tes-color-brand-primary-pressed: #482861;
  --tes-color-surface-page: #ffffff;
  --tes-radius-card: 18px;
  --tes-shadow-card: 0 8px 24px rgba(38, 20, 51, 0.06);
}
```

Exemplo Tailwind:

```tsx
<section className="bg-surface-page">
  <div className="rounded-card bg-surface-default shadow-card" />
</section>
```

## shadcn/ui

Usar shadcn/ui como base acessível. Não usar componentes crus nas telas finais.

Wrappers recomendados:

- `TESButton`
- `TESCard`
- `TESInput`
- `TESSelect`
- `TESDialog`
- `TESTable`
- `TESBadge`
- `TESTabs`

Exemplo:

```tsx
<TESButton variant="primary" loading={isSaving}>
  Salvar alterações
</TESButton>
```

## Configurações

Arquivos de setup:

- `package.json`: scripts, dependências e devDependencies.
- `next.config.mjs`: Next.js 15, React Strict Mode e typed routes.
- `tsconfig.json`: strict mode e aliases.
- `tailwind.config.ts`: tokens TES e shadcn/ui.
- `postcss.config.mjs`: Tailwind e Autoprefixer.
- `.eslintrc.json`: Next Core Web Vitals.
- `.prettierrc`: Prettier com plugin Tailwind.
- `.env.example`: variáveis de ambiente.
- `components.json`: aliases shadcn/ui.
- `.vscode/extensions.json` e `.vscode/settings.json`: lint, formatação e Tailwind no VS Code.

## Variáveis de Ambiente

Categorias:

- App: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SUPPORT_EMAIL`.
- Supabase publico: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Supabase secrets: `SUPABASE_SECRET_KEYS`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` e `SERVICE_ROLE_KEY` nao pertencem ao `.env` do app Next; devem ficar em Supabase Edge Functions ou secrets remotos equivalentes.
- Banco: `DATABASE_URL`.
- Auth: `AUTH_SECRET`, `AUTH_TRUST_HOST`.
- Email: `EMAIL_FROM`, `RESEND_API_KEY`.
- Pagamento: `STRIPE_SECRET_KEY` e webhook secrets pertencem somente às Edge Functions. Quando houver integração browser com Stripe.js, a chave publicável `pk_*` deve usar variável `NEXT_PUBLIC_*`, nunca `STRIPE_SECRET_KEY`.
- Vídeo: `VIDEO_PROVIDER`, `VIDEO_PROVIDER_API_KEY`.
- IA: `AI_PROVIDER`, `OPENAI_API_KEY`.
- Storage: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- Admin: `ADMIN_EMAILS`.
- Observabilidade: `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`.

## Storybook

Ordem:

1. Foundations.
2. Base components.
3. Layout shell.
4. Público.
5. Paciente.
6. Básico.
7. Pro.
8. Plus.
9. Admin.

Componentes obrigatórios:

- `FavoriteTherapistList`.
- `FavoriteTherapyList`.
- `PlusPatientJourney`.
- `AIAssessorPanel`.
- `AdminModerationQueue`.

## QA Técnico

- `npm run lint`.
- `npm run typecheck`.
- `npm run build`.
- Storybook build quando instalado.
- Guardas de rota e plano testados.
- Estados vazios e erro testados.
- Datas e valores em formato brasileiro.

## Evolução

- Novo subnível exige fonte e motivo.
- Tokens inferidos devem ser recalibrados quando houver componentes editáveis no Figma.
- Um repositório de backend deve validar integrações antes de produção.
