"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import Lab3DMeasure from "@/views/Lab3DMeasure";

export default function Page() {
  return <RequireFeature feature="lab3d"><Lab3DMeasure /></RequireFeature>;
}
