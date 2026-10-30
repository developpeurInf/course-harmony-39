"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import RoomFollowUp from "@/views/RoomFollowUp";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequireFeature feature="followUp"><RequirePermission perm="student.view"><RoomFollowUp /></RequirePermission></RequireFeature>;
}
