import type {
  PublicTherapyDetail,
  RelatedTherapist,
  RelatedTherapistSort,
} from "../../types/therapy-detail";
import { RelatedTherapists } from "./related-therapists";
import { TherapyBenefits } from "./therapy-benefits";
import { TherapyClosingCta } from "./therapy-closing-cta";
import { TherapyHero } from "./therapy-hero";
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
    <>
      <TherapyHero
        relatedCount={relatedTherapists.length}
        source={source}
        therapy={therapy}
      />
      <TherapyOverview therapy={therapy} />
      <TherapyBenefits therapy={therapy} />
      <RelatedTherapists
        errorMessage={relatedErrorMessage}
        source={source}
        sort={sort}
        therapists={relatedTherapists}
        therapy={therapy}
      />
      <TherapyClosingCta therapy={therapy} />
    </>
  );
}
