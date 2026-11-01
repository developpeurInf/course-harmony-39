"use client";

import dynamic from "next/dynamic";

// Éditeur chargé à la demande (ne pèse pas sur le reste de l'application)
const WhiteboardEditor = dynamic(() => import("@/views/WhiteboardEditor"), { ssr: false });

export default function Page() {
  return <WhiteboardEditor />;
}
