import { PublicTherapistsLowerBanner } from "@/components/tes";
import type {
  PublicTherapyDetail,
  RelatedTherapist,
  RelatedTherapistSort,
} from "../../types/therapy-detail";
import { RelatedTherapistsMatchClient } from "./related-therapists-match-client";
import { TherapyBenefits } from "./therapy-benefits";
import { TherapyHero, TherapyHeroImage } from "./therapy-hero";
import { TherapyOverview } from "./therapy-overview";

type TherapyDetailPageProps = {
  relatedErrorMessage?: string;
  relatedTherapists: RelatedTherapist[];
  source: string;
  sort: RelatedTherapistSort;
  therapy: PublicTherapyDetail;
};

export function TherapyDetailPage({
  relatedErrorMessage,
  relatedTherapists,
  source,
  sort,
  therapy,
}: TherapyDetailPageProps) {
  return (
    <div className="bg-[#fbf8ff]">
      <div className="mx-auto max-w-[1440px] px-5 pb-16 pt-8 sm:px-8 lg:px-12 lg:pt-12">
        <section className="grid gap-6 lg:grid-cols-[0.42fr_0.58fr] lg:items-start">
          <div className="space-y-6">
            <TherapyHero therapy={therapy} />
            <TherapyOverview therapy={therapy} />
          </div>

          <div className="space-y-6">
            <TherapyHeroImage therapy={therapy} />
            <TherapyBenefits therapy={therapy} />
          </div>
        </section>

        <div className="mt-8">
          <RelatedTherapistsMatchClient
            errorMessage={relatedErrorMessage}
            initialTherapists={relatedTherapists}
            source={source}
            sort={sort}
            therapy={therapy}
          />
        </div>

        <section className="mt-8">
          <PublicTherapistsLowerBanner />
        </section>
      </div>
    </div>
  );
}
