"use client";

import RoomCourses from "@/views/RoomCourses";
import { RequirePermission } from "@/components/access/AccessUi";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return <RequireFeature feature="courses"><RequirePermission perm="course.view"><RoomCourses /></RequirePermission></RequireFeature>;
}
