"use client";

import { useParams } from "@/lib/router";
import Whiteboards from "@/views/Whiteboards";
import { RequireClassModule } from "@/components/access/RequireFeature";

export default function Page() {
  const { roomId } = useParams<{ roomId: string }>();
  return <RequireClassModule module="whiteboard"><Whiteboards key={roomId} roomId={roomId} /></RequireClassModule>;
}
