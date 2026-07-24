import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

const preparationItems = [
  "Escolha um lugar tranquilo e reservado",
  "Tenha fones de ouvido",
  "Tenha água por perto",
  "Traga suas reflexões e perguntas",
  "Esteja com a mente aberta e receptiva",
];

export function PreparationCard() {
  return (
    <section className="relative overflow-hidden rounded-card border border-brand-lavender bg-white p-6 shadow-card">
      <h2 className="font-display text-2xl font-light italic text-brand-deep">
        Antes do encontro
      </h2>
      <ul className="mt-6 space-y-3">
        {preparationItems.map((item) => (
          <li
            className="flex gap-2 text-sm font-semibold text-tesText-secondary"
            key={item}
          >
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-brand-primary"
              size={16}
            />
            {item}
          </li>
        ))}
      </ul>
      <Image
        alt=""
        className="absolute bottom-0 right-0 hidden h-32 w-36 object-cover opacity-80 md:block"
        height={128}
        src="/home/step-calendar.png"
        width={144}
      />
    </section>
  );
}
