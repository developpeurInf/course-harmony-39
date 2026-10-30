"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import Support from "@/views/Support";

export default function Page() {
  return <RequireFeature feature="support"><Support /></RequireFeature>;
}
