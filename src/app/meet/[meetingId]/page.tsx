"use client";

import dynamic from "next/dynamic";
import { RequireFeature } from "@/components/access/RequireFeature";

// Visio chargée à la demande (LiveKit ne pèse pas sur le reste de l'application)
const MeetingRoom = dynamic(() => import("@/views/MeetingRoom"), { ssr: false });

export default function Page() {
  return (
    <RequireFeature feature="meet">
      <MeetingRoom />
    </RequireFeature>
  );
}
