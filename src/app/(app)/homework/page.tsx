"use client";

import ClassDocuments from "@/views/ClassDocuments";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return (
    <RequireFeature feature="homework" classModule="homework">
      <ClassDocuments kind="homework" />
    </RequireFeature>
  );
}
