import { BottomNav } from "@/components/layout/bottom-nav";

export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="mx-auto min-h-0 w-full max-w-lg flex-1 px-4 pb-24 pt-6">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
