"use client";

import { Suspense } from "react";
import { RequireFeature } from "@/components/access/RequireFeature";
import Meetings from "@/views/Meetings";

export default function Page() {
  return (
    <RequireFeature feature="meet">
      <Suspense fallback={null}>
        <Meetings />
      </Suspense>
    </RequireFeature>
  );
}
