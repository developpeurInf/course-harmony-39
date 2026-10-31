"use client";

import { Suspense } from "react";
import { RequireFeature } from "@/components/access/RequireFeature";
import Messages from "@/views/Messages";

export default function Page() {
  return (
    <RequireFeature feature="chat">
      <Suspense fallback={null}>
        <Messages />
      </Suspense>
    </RequireFeature>
  );
}
