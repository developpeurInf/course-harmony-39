"use client";

import Exams from "@/views/Exams";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return <RequireFeature feature="exams"><Exams /></RequireFeature>;
}
