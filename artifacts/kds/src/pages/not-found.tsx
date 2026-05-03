import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { LogoMark } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0f] text-white">
      <Card className="w-full max-w-md mx-4 border-white/10 bg-white/5 text-white">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <LogoMark size={32} />
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">LineOps KDS</p>
              <h1 className="text-2xl font-bold text-white">Page not found</h1>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/60">
            This route doesn’t exist in the KDS interface.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
