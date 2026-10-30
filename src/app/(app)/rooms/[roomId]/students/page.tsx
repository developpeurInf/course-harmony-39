"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import RoomStudents from "@/views/RoomStudents";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequireFeature feature="students"><RequirePermission perm="student.view"><RoomStudents /></RequirePermission></RequireFeature>;
}
