"use client";

import CreateRoom from "@/views/CreateRoom";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequirePermission perm="class.create"><CreateRoom /></RequirePermission>;
}
