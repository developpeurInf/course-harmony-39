"use client";

import DiagnosticEvaluation from "@/views/DiagnosticEvaluation";
import { RequirePermission } from "@/components/access/AccessUi";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return <RequireFeature feature="diagnostic"><RequirePermission perm="diagnostic.use"><DiagnosticEvaluation /></RequirePermission></RequireFeature>;
}
