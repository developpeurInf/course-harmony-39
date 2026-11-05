"use client";

import OfficeHub from "@/views/office/OfficeHub";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return <RequireFeature feature="office"><OfficeHub /></RequireFeature>;
}
