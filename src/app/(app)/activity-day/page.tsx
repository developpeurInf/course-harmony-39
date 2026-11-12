"use client";

import { Suspense } from "react";
import ActivityDay from "@/views/ActivityDay";
import { RequirePermission } from "@/components/access/AccessUi";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return (
    <RequireFeature feature="studentActivities">
      <RequirePermission perm="student.activity_view">
        <Suspense fallback={null}>
          <ActivityDay />
        </Suspense>
      </RequirePermission>
    </RequireFeature>
  );
}
