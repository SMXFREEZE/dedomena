import { BackgroundLines } from "@/components/ui/background-lines";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackgroundLines />
      <div className="relative z-10 flex flex-col h-full">
        {children}
      </div>
    </>
  );
}
