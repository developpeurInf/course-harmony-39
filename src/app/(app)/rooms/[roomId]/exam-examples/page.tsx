"use client";

import { useParams } from "@/lib/router";
import ClassDocuments from "@/views/ClassDocuments";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  const { roomId } = useParams<{ roomId: string }>();
  return (
    <RequireFeature feature="homework" classModule="examples">
      <ClassDocuments key={roomId} kind="example" roomId={roomId} />
    </RequireFeature>
  );
}
