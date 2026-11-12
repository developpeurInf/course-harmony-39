"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import Library from "@/views/Library";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequireFeature feature="library"><RequirePermission perm="library.import"><Library /></RequirePermission></RequireFeature>;
}
