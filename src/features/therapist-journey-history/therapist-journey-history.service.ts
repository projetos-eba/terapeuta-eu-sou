import "server-only";

import { cache } from "react";

import { SupabaseServerRestError } from "@/lib/supabase/server-rest";

import {
  mapJourneyHistoryDetail,
  mapJourneyHistoryPage,
} from "./therapist-journey-history.mappers";
import { queryTherapistJourneyHistory } from "./therapist-journey-history.queries";
import type {
  JourneyHistoryDetailData,
  JourneyHistoryPageData,
} from "./therapist-journey-history.types";

export type JourneyHistoryResult<T> =
  | { data: T; status: "success" }
  | { data: null; message: string; status: "empty" | "error" };

export const getTherapistJourneyHistoryPage = cache(
  async function getTherapistJourneyHistoryPage(input: {
    accessToken: string;
    therapistProfileId: string;
  }): Promise<JourneyHistoryResult<JourneyHistoryPageData>> {
    try {
      const rows = await queryTherapistJourneyHistory(input);
      const data = mapJourneyHistoryPage({
        ...rows,
        source: "supabase",
        therapistProfileId: input.therapistProfileId,
      });

      if (data.clients.length === 0) {
        return {
          data: null,
          message: "Nenhum cliente foi identificado na sua carteira ainda.",
          status: "empty",
        };
      }

      return { data, status: "success" };
    } catch (error) {
      return {
        data: null,
        message: getSafeJourneyHistoryMessage(error),
        status: "error",
      };
    }
  },
);

export const getTherapistJourneyDetail = cache(
  async function getTherapistJourneyDetail(input: {
    accessToken: string;
    patientId: string;
    therapistProfileId: string;
  }): Promise<JourneyHistoryResult<JourneyHistoryDetailData>> {
    try {
      const rows = await queryTherapistJourneyHistory(input);
      const data = mapJourneyHistoryDetail({
        ...rows,
        patientId: input.patientId,
        source: "supabase",
        therapistProfileId: input.therapistProfileId,
      });

      if (!data) {
        return {
          data: null,
          message: "Jornada não encontrada para esta conta.",
          status: "empty",
        };
      }

      return { data, status: "success" };
    } catch (error) {
      return {
        data: null,
        message: getSafeJourneyHistoryMessage(error),
        status: "error",
      };
    }
  },
);

function getSafeJourneyHistoryMessage(error: unknown) {
  if (error instanceof SupabaseServerRestError) {
    if (error.status === 401) {
      return "Sua sessão expirou. Entre novamente para continuar.";
    }
    if (error.status === 403 || error.status === 404) {
      return "Esta área não está disponível para a sua conta.";
    }
  }

  return "Não foi possível carregar o histórico da jornada agora.";
}
