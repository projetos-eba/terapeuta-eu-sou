import Image from "next/image";
import {
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Filter,
  Grid2X2,
  Heart,
  Leaf,
  Search,
  Star,
} from "lucide-react";

import {
  FilterButton,
  JourneyBanner,
  PublicFooter,
  PublicHeader,
  TESInput,
  TherapistCard,
  type TherapistCardData,
} from "@/components/tes";

const filters = [
  { label: "Tipo de terapia", icon: Leaf },
  { label: "Tema buscado", icon: Grid2X2 },
  { label: "Emoção ou momento", icon: Heart },
  { label: "Disponibilidade", icon: CalendarDays },
  { label: "Preço", icon: CircleDollarSign },
  { label: "Avaliação", icon: Star },
];

const therapists: TherapistCardData[] = [
  {
    name: "Ana Oliveira",
    slug: "ana-oliveira",
    specialty: "Terapeuta Integrativa",
    description:
      "Um espaço de acolhimento para quem busca mais clareza, equilíbrio e leveza emocional.",
    image: "/therapists/ana-oliveira.png",
    nextSlot: "Hoje, 18:00",
    price: "R$ 120 / sessão",
    rating: "4,9",
    reviews: "98 avaliações",
    quote: "Me senti acolhida desde a primeira sessão.",
    tags: ["Ansiedade", "Autoestima", "Autoconhecimento"],
    highlight: "Destaque TES",
    highlightTone: "featured",
  },
  {
    name: "Rafael Santos",
    slug: "rafael-santos",
    specialty: "Terapeuta Holístico",
    description:
      "Apoio para quem está vivendo mudanças importantes e deseja encontrar novos caminhos.",
    image: "/therapists/rafael-santos.png",
    nextSlot: "Amanhã, 09:30",
    price: "R$ 120 / sessão",
    rating: "4,8",
    reviews: "74 avaliações",
    quote: "Ajudou a organizar um momento muito difícil.",
    tags: ["Mudanças de vida", "Propósito", "Equilíbrio emocional"],
    highlight: "Destaque TES",
    highlightTone: "featured",
  },
  {
    name: "Célia Martins",
    slug: "celia-martins",
    specialty: "Terapeuta Integrativa",
    description:
      "Escuta cuidadosa para relações, luto e processos de transformação.",
    image: "/therapists/celia-martins.png",
    nextSlot: "Sex, 14:00",
    price: "R$ 120 / sessão",
    rating: "4,9",
    reviews: "112 avaliações",
    quote: "Ela me ajudou a me reconstruir com amor.",
    tags: ["Relacionamentos", "Luto", "Autoestima"],
    highlight: "Perfil Verificado",
    highlightTone: "verified",
  },
  {
    name: "Juliana Costa",
    slug: "juliana-costa",
    specialty: "Terapeuta Holística",
    description:
      "Apoio para famílias construírem diálogos mais leves e seguros.",
    image: "/therapists/juliana-costa.png",
    nextSlot: "Seg, 10:00",
    price: "R$ 120 / sessão",
    rating: "4,8",
    reviews: "88 avaliações",
    quote: "Nossas conversas em família mudaram completamente.",
    tags: ["Família", "Relacionamentos", "Comunicação"],
    highlight: "Perfil Verificado",
    highlightTone: "verified",
  },
  {
    name: "Lucas Pereira",
    slug: "lucas-pereira",
    specialty: "Terapeuta Integrativo",
    description:
      "Cuidado para autoconhecimento, escolhas e transições de vida.",
    image: "/therapists/lucas-pereira.png",
    nextSlot: "Ter, 16:30",
    price: "R$ 130 / sessão",
    rating: "4,9",
    reviews: "101 avaliações",
    quote: "Me ajudou a entender meu propósito.",
    tags: ["Autoconhecimento", "Propósito", "Mudanças de vida"],
    highlight: "Destaque TES",
    highlightTone: "featured",
  },
  {
    name: "Patrícia Lima",
    slug: "patricia-lima",
    specialty: "Terapeuta Integrativa",
    description:
      "Sessões para perceber o corpo, respirar melhor e cultivar presença.",
    image: "/therapists/patricia-lima.png",
    nextSlot: "Qua, 11:00",
    price: "R$ 120 / sessão",
    rating: "4,8",
    reviews: "69 avaliações",
    quote: "Voltei a dormir bem e a viver o presente.",
    tags: ["Corpo e mente", "Ansiedade", "Presença"],
    highlight: "Perfil Verificado",
    highlightTone: "verified",
  },
  {
    name: "Márcio Andrade",
    slug: "marcio-andrade",
    specialty: "Terapeuta Holístico",
    description:
      "Apoio para lidar com estresse, ansiedade e cobranças internas.",
    image: "/therapists/marcio-andrade.png",
    nextSlot: "Qui, 15:00",
    price: "R$ 120 / sessão",
    rating: "4,7",
    reviews: "63 avaliações",
    quote: "Encontrei uma forma mais gentil de olhar para mim.",
    tags: ["Ansiedade", "Estresse", "Autoestima"],
    highlight: "Perfil Verificado",
    highlightTone: "verified",
  },
  {
    name: "Fernanda Rocha",
    slug: "fernanda-rocha",
    specialty: "Terapeuta Integrativa",
    description:
      "Acolhimento para fortalecer a autoestima e construir relações mais saudáveis.",
    image: "/therapists/fernanda-rocha.png",
    nextSlot: "Sex, 15:30",
    price: "R$ 120 / sessão",
    rating: "4,8",
    reviews: "91 avaliações",
    quote: "Senti segurança para falar do que eu sentia.",
    tags: ["Autoestima", "Relacionamentos", "Autoconhecimento"],
    highlight: "Perfil Verificado",
    highlightTone: "verified",
  },
];

function HeroIllustration() {
  return (
    <div className="pointer-events-none absolute right-0 top-0 hidden h-[350px] w-[56%] overflow-hidden lg:block">
      <Image
        src="/therapists/hero-therapists.png"
        alt=""
        fill
        sizes="900px"
        className="object-cover object-center"
        priority
      />
      <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-white to-white/0" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-white/0" />
    </div>
  );
}

function Pagination() {
  return (
    <nav
      className="mt-10 flex items-center justify-center gap-4"
      aria-label="Paginação"
    >
      {[1, 2, 3, 4].map((page) => (
        <button
          key={page}
          type="button"
          aria-current={page === 1 ? "page" : undefined}
          className={`grid size-9 place-items-center rounded-full text-sm font-extrabold ${
            page === 1
              ? "bg-brand-primary text-white shadow-card"
              : "border border-border bg-white text-tesText-secondary"
          }`}
        >
          {page}
        </button>
      ))}
      <span className="text-tesText-muted">...</span>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full border border-border bg-white text-sm font-extrabold text-tesText-secondary"
      >
        6
      </button>
      <button
        type="button"
        className="grid size-10 place-items-center rounded-full border border-border bg-white text-brand-primary"
        aria-label="Próxima página"
      >
        <ChevronDown className="size-5 -rotate-90" />
      </button>
    </nav>
  );
}

export default function TherapistsPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_78%_2%,#FFF0E8_0%,rgba(255,240,232,0)_25%),radial-gradient(circle_at_8%_22%,#F7F1FF_0%,rgba(247,241,255,0)_30%),#FFFFFF] text-tesText-primary">
      <PublicHeader />

      <section className="relative mx-auto max-w-[1680px] px-5 pb-8 pt-6 sm:px-8 lg:px-12">
        <HeroIllustration />
        <div className="relative max-w-2xl py-8 lg:min-h-[300px]">
          <h1 className="font-display text-5xl font-semibold leading-[1.04] text-brand-deep md:text-7xl">
            Encontre alguém para{" "}
            <em className="font-display font-light text-brand-primary">
              caminhar com você.
            </em>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-tesText-secondary">
            Cada jornada é única. Conheça terapeutas preparados para acolher o
            momento que você está vivendo e encontre um caminho que faça sentido
            para você.
          </p>
        </div>

        <TESInput
          aria-label="Buscar terapeutas"
          placeholder="O que você está buscando hoje?"
          leftIcon={<Search className="size-7 shrink-0 text-brand-primary" />}
          wrapperClassName="mt-2"
        />
      </section>

      <section className="mx-auto max-w-[1680px] px-5 py-8 sm:px-8 lg:px-12">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[repeat(6,minmax(0,1fr))_190px]">
          {filters.map((filter) => (
            <FilterButton key={filter.label} {...filter} />
          ))}
          <button className="flex h-12 items-center justify-center gap-3 rounded-xl bg-brand-primary px-4 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus:outline-none focus:ring-4 focus:ring-ring/20">
            Limpar filtros
            <Filter className="size-5" />
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-[1680px] px-5 pb-12 sm:px-8 lg:px-12">
        <div className="mb-7 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 className="flex items-center gap-3 text-3xl font-extrabold tracking-normal text-brand-deep">
              <Heart className="size-7 fill-brand-lavender text-brand-lavender" />
              Caminhos que podem fazer sentido para você
            </h2>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-tesText-secondary">
              Com calma, compare abordagens, histórias e formas de acolhimento.
              Escolha quando sentir que encontrou alguém com quem deseja
              caminhar.
            </p>
          </div>
          <div className="space-y-4 lg:text-right">
            <p className="text-xl font-bold text-tesText-secondary">
              Encontramos <span className="text-brand-deep">32 terapeutas</span>
            </p>
            <button className="inline-flex h-12 items-center gap-3 rounded-full border border-border bg-white px-6 text-sm font-extrabold text-tesText-secondary shadow-card">
              Ordenar por: Relevância
              <ChevronDown className="size-4 text-brand-primary" />
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          {therapists.map((therapist) => (
            <TherapistCard key={therapist.name} therapist={therapist} />
          ))}
        </div>

        <Pagination />
      </section>

      <section className="mx-auto max-w-[1680px] px-5 pb-8 sm:px-8 lg:px-12">
        <JourneyBanner />
      </section>

      <PublicFooter />
    </main>
  );
}
