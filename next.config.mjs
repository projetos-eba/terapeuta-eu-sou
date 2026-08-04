/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async redirects() {
    return [
      {
        source: "/como-funciona",
        destination: "/sobre-nos",
        permanent: false,
      },
      {
        source: "/admin/login",
        destination: "/admin-login",
        permanent: false,
      },
      {
        source: "/para-terapeutas/planos",
        destination: "/para-terapeutas",
        permanent: false,
      },
      {
        source: "/app/sessoes/proximas",
        destination: "/app/encontros",
        permanent: false,
      },
      {
        source: "/app/sessoes/historico",
        destination: "/app/encontros#patient-history-encounters-title",
        permanent: false,
      },
      {
        source: "/app/sessoes/:bookingId",
        destination: "/app/encontros/:bookingId",
        permanent: false,
      },
      {
        source: "/app/sessoes",
        destination: "/app/encontros",
        permanent: false,
      },
      {
        source: "/plus/servi%C3%A7os",
        destination: "/terapeuta/servicos",
        permanent: false,
      },
      {
        source: "/plus/avalia%C3%A7%C3%B5es",
        destination: "/terapeuta/avaliacoes",
        permanent: false,
      },
      {
        source: "/plus/ia",
        destination: "/terapeuta/assessor-ia",
        permanent: false,
      },
      {
        source: "/basico/pagamento",
        destination: "/terapeuta/financeiro",
        permanent: false,
      },
      {
        source: "/basico/upgrade",
        destination: "/terapeuta/plano",
        permanent: false,
      },
      {
        source: "/pro/metricas",
        destination: "/terapeuta/insights",
        permanent: false,
      },
      {
        source: "/pro/plano",
        destination: "/terapeuta/plano",
        permanent: false,
      },
      {
        source: "/basico/:path*",
        destination: "/terapeuta/:path*",
        permanent: false,
      },
      {
        source: "/pro/:path*",
        destination: "/terapeuta/:path*",
        permanent: false,
      },
      {
        source: "/plus/:path*",
        destination: "/terapeuta/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
