"use client";

import Courses from "@/views/Courses";
import { RequirePermission } from "@/components/access/AccessUi";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return <RequireFeature feature="courses"><RequirePermission perm="course.view"><Courses /></RequirePermission></RequireFeature>;
}
