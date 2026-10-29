"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import RoomAttendance from "@/views/RoomAttendance";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequireFeature feature="attendance"><RequirePermission perm="attendance.manage"><RoomAttendance /></RequirePermission></RequireFeature>;
}
