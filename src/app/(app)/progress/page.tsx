"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import MyProgress from "@/views/MyProgress";

export default function Page() {
  return <RequireFeature feature="progress"><MyProgress /></RequireFeature>;
}
