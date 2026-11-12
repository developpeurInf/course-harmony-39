"use client";

import StudentCourse from "@/views/StudentCourse";
import { RequirePermission } from "@/components/access/AccessUi";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return <RequireFeature feature="courses"><RequirePermission perm="course.view"><StudentCourse /></RequirePermission></RequireFeature>;
}
