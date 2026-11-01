"use client";

import { useParams } from "@/lib/router";
import Whiteboards from "@/views/Whiteboards";

export default function Page() {
  const { roomId } = useParams<{ roomId: string }>();
  return <Whiteboards key={roomId} roomId={roomId} />;
}
