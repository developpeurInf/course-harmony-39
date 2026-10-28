"use client";

import Reports from "@/views/Reports";
import { RequirePermission } from "@/components/access/AccessUi";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return <RequireFeature feature="reports"><RequirePermission perm="reports.view"><Reports /></RequirePermission></RequireFeature>;
}
