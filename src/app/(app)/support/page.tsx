"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import { RequirePermission } from "@/components/access/AccessUi";
import Support from "@/views/Support";

export default function Page() {
  return <RequireFeature feature="support"><RequirePermission perm="support.tickets"><Support /></RequirePermission></RequireFeature>;
}
