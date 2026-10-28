"use client";

import Exercises from "@/views/Exercises";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return <RequireFeature feature="exercises"><Exercises /></RequireFeature>;
}
