import { VantaBackground } from "@/components/ui/vanta-background";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <VantaBackground mode="night" />
      <div className="fixed inset-0 z-[1] bg-black/55 pointer-events-none" />
      <div className="relative z-10 flex flex-col h-full">
        {children}
      </div>
    </>
  );
}
