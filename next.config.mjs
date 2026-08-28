/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    qualities: [75, 95],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/therapist-public-media/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "54321",
        pathname: "/storage/v1/object/public/therapist-public-media/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/therapist-public-media/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/patient-public-media/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "54321",
        pathname: "/storage/v1/object/public/patient-public-media/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/patient-public-media/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/admin-public-media/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "54321",
        pathname: "/storage/v1/object/public/admin-public-media/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/admin-public-media/**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    const headers = [
      {
        key: "Content-Security-Policy",
        value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
      },
      {
        key: "Permissions-Policy",
        value:
          "camera=(self), geolocation=(), microphone=(self), payment=(self)",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
    ];

    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/:path*",
        headers,
      },
    ];
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
