import { NextResponse } from "next/server";

export async function POST(_request: Request) {
  return NextResponse.json(
    {
      error: {
        message:
          "Este canal não está mais disponível. Use os detalhes da sessão ou o Suporte TES.",
      },
      ok: false,
    },
    { headers: { "Cache-Control": "no-store" }, status: 410 },
  );
}
