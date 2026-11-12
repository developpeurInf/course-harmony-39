"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import RoomGradebook from "@/views/RoomGradebook";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequireFeature feature="gradebook"><RequirePermission perm="gradebook.manage"><RoomGradebook /></RequirePermission></RequireFeature>;
}
