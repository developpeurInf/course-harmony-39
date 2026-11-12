"use client";

import ProposedResources from "@/views/ProposedResources";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return (
    <RequireFeature feature="courses">
      <ProposedResources kind="course" />
    </RequireFeature>
  );
}
