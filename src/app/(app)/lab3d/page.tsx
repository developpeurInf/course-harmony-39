"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import Lab3D from "@/views/Lab3D";

export default function Page() {
  return <RequireFeature feature="lab3d"><Lab3D /></RequireFeature>;
}
