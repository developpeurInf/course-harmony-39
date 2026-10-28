"use client";

import RoomFollowUp from "@/views/RoomFollowUp";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequirePermission perm="student.view"><RoomFollowUp /></RequirePermission>;
}
