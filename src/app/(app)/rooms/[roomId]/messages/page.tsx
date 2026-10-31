"use client";

import { Suspense } from "react";
import { RequireFeature } from "@/components/access/RequireFeature";
import { useParams } from "@/lib/router";
import Messages from "@/views/Messages";

export default function Page() {
  const { roomId } = useParams<{ roomId: string }>();
  return (
    <RequireFeature feature="chat">
      <Suspense fallback={null}>
        <Messages key={roomId} roomId={roomId} />
      </Suspense>
    </RequireFeature>
  );
}
