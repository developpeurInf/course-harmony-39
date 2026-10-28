"use client";

import RoomStudents from "@/views/RoomStudents";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequirePermission perm="student.view"><RoomStudents /></RequirePermission>;
}
