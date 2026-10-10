import { AppHeader } from "@/components/layout/app-header";
import { AppNav } from "@/components/layout/app-nav";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { RequireAuth } from "@/components/providers/require-auth";
import { StoreProvider } from "@/components/providers/store-provider";

export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <RequireAuth>
      <StoreProvider>
        <AddSheetProvider>
          <AppHeader />
          <div className="min-h-0 w-full flex-1 lg:pl-56">
            <main className="mx-auto w-full max-w-xl px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+6rem)] md:max-w-2xl md:px-6 lg:pb-10">
              {children}
            </main>
          </div>
          <AppNav />
        </AddSheetProvider>
      </StoreProvider>
    </RequireAuth>
  );
}
