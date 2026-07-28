import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageHeader,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";

export default function TherapistProfileEditLoading() {
  return (
    <AppPageContainer aria-busy="true">
      <AppPageHeader title="Editar perfil">
        <span className="block h-5 w-full max-w-xl animate-pulse rounded-full bg-brand-lavenderSoft" />
      </AppPageHeader>
      <SkeletonSection className="min-h-[96px]" />
      <AppPageGrid>
        <AppPageMain>
          <SkeletonSection className="min-h-[720px]" />
        </AppPageMain>
        <AppPageAside>
          <SkeletonSection className="min-h-[240px]" />
          <SkeletonSection />
          <SkeletonSection />
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
  );
}

function SkeletonSection({ className = "" }: { className?: string }) {
  return (
    <AppPageSection className={className}>
      <div className="grid gap-4">
        <div className="h-5 w-1/2 animate-pulse rounded-full bg-brand-lavenderSoft" />
        <div className="h-4 w-4/5 animate-pulse rounded-full bg-brand-lavenderSoft" />
        <div className="h-4 w-3/5 animate-pulse rounded-full bg-brand-lavenderSoft" />
      </div>
    </AppPageSection>
  );
}
