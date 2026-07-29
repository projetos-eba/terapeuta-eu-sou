import "server-only";

import { cache } from "react";

import {
  getDefaultMessage,
  TherapistReviewsError,
} from "./therapist-reviews.errors";
import { mapTherapistReviewsPageData } from "./therapist-reviews.mappers";
import { queryTherapistReviews } from "./therapist-reviews.queries";
import type { TherapistReviewsPageData } from "./therapist-reviews.types";

export type TherapistReviewsPageResult =
  | {
      data: TherapistReviewsPageData;
      status: "success";
    }
  | {
      message: string;
      requestId?: string;
      status: "error";
    };

export const getTherapistReviewsPage = cache(
  async function getTherapistReviewsPage({
    accessToken,
    profileId,
  }: {
    accessToken: string;
    profileId: string;
  }): Promise<TherapistReviewsPageResult> {
    try {
      const data = mapTherapistReviewsPageData(
        await queryTherapistReviews(accessToken),
      );

      if (data.therapist.profileId !== profileId) {
        throw new TherapistReviewsError("forbidden");
      }

      return {
        data,
        status: "success",
      };
    } catch (error) {
      if (error instanceof TherapistReviewsError) {
        return {
          message: getDefaultMessage(error.code),
          status: "error",
        };
      }

      return {
        message: getDefaultMessage("unavailable"),
        status: "error",
      };
    }
  },
);
