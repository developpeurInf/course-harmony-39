"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import Lab3DScene from "@/views/Lab3DScene";

export default function Page() {
  return <RequireFeature feature="lab3d"><Lab3DScene /></RequireFeature>;
}
