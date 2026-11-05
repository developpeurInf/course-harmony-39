"use client";

import RoomPermissions from "@/views/RoomPermissions";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequirePermission perm="class.edit"><RoomPermissions /></RequirePermission>;
}
