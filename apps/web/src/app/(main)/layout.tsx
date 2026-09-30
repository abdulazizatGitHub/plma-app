import { BottomNav } from "@/components/layout/bottom-nav";

export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="mx-auto min-h-0 w-full max-w-lg flex-1 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+7rem)]">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
