"use client";

import StudentsActivities from "@/views/StudentsActivities";
import { RequirePermission } from "@/components/access/AccessUi";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return <RequireFeature feature="studentActivities"><RequirePermission perm="student.activity_view"><StudentsActivities /></RequirePermission></RequireFeature>;
}
