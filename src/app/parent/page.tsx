"use client";

import { Suspense } from "react";
import ParentPortal from "@/views/ParentPortal";

export default function Page() {
  return <Suspense fallback={null}><ParentPortal /></Suspense>;
}
