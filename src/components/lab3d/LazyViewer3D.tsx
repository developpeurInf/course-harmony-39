"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/**
 * Visionneuse 3D chargée à la demande : three.js (≈ 560 Ko) n'est téléchargé que
 * lorsqu'une scène est réellement affichée, pas avec la galerie du Labo 3D.
 */
export const Viewer3D = dynamic(() => import("./Viewer3D").then((m) => m.Viewer3D), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(62vh,560px)] w-full items-center justify-center rounded-xl border bg-muted/30" aria-busy="true">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});
