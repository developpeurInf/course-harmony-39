"use client";

import RoomGradebook from "@/views/RoomGradebook";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequirePermission perm="gradebook.manage"><RoomGradebook /></RequirePermission>;
}
