"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PrevisioniPage() {
  const router = useRouter();

  useEffect(() => {
    // Le previsioni sono ora integrate nella pagina Gara
    router.replace("/gara");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#050507] text-white bg-grid flex items-center justify-center">
      <div className="text-white/30 text-sm">Reindirizzamento alla pagina Gara...</div>
    </div>
  );
}
