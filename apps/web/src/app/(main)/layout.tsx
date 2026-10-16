import { AppHeader } from "@/components/layout/app-header";
import { AppNav } from "@/components/layout/app-nav";
import { LocationProvider } from "@/components/location/location-provider";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { RequireAuth } from "@/components/providers/require-auth";
import { StoreProvider } from "@/components/providers/store-provider";
import { Celebrations } from "@/components/rewards/celebrations";
import { RewardsProvider } from "@/lib/v2/use-rewards";
import { SocialProvider } from "@/lib/v2/use-social";
import { TodayProvider } from "@/lib/v2/use-today";

export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <RequireAuth>
      <StoreProvider>
        <RewardsProvider>
        <TodayProvider>
        <AddSheetProvider>
          <SocialProvider>
          <Celebrations />
          <LocationProvider>
          <OnboardingGate />
          <AppHeader />
          <div className="min-h-0 w-full flex-1 lg:pl-56">
            <main className="mx-auto w-full max-w-xl px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+6rem)] md:max-w-2xl md:px-6 lg:pb-10">
              {children}
            </main>
          </div>
          <AppNav />
          </LocationProvider>
          </SocialProvider>
        </AddSheetProvider>
        </TodayProvider>
        </RewardsProvider>
      </StoreProvider>
    </RequireAuth>
  );
}
