"use client";

import RoomAttendance from "@/views/RoomAttendance";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequirePermission perm="attendance.manage"><RoomAttendance /></RequirePermission>;
}
