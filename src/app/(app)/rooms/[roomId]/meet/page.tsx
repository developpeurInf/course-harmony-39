"use client";

import { Suspense } from "react";
import { RequireFeature } from "@/components/access/RequireFeature";
import { useParams } from "@/lib/router";
import Meetings from "@/views/Meetings";

export default function Page() {
  const { roomId } = useParams<{ roomId: string }>();
  return (
    <RequireFeature feature="meet">
      <Suspense fallback={null}>
        <Meetings key={roomId} roomId={roomId} />
      </Suspense>
    </RequireFeature>
  );
}
