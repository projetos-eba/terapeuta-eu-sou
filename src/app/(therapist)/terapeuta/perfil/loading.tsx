import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageHeader,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";

export default function TherapistProfileLoading() {
  return (
    <AppPageContainer aria-busy="true">
      <AppPageHeader eyebrow="Meu perfil" title="Perfil público">
        <span className="block h-5 w-full max-w-xl animate-pulse rounded-full bg-brand-lavenderSoft" />
      </AppPageHeader>
      <AppPageGrid>
        <AppPageMain>
          <SkeletonSection />
          <SkeletonSection className="min-h-[520px]" />
        </AppPageMain>
        <AppPageAside>
          <SkeletonSection />
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
