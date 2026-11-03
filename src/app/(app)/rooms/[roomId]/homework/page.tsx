"use client";

import { useParams } from "@/lib/router";
import ClassDocuments from "@/views/ClassDocuments";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  const { roomId } = useParams<{ roomId: string }>();
  return (
    <RequireFeature feature="homework" classModule="homework">
      <ClassDocuments key={roomId} kind="homework" roomId={roomId} />
    </RequireFeature>
  );
}
