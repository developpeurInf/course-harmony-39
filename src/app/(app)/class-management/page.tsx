"use client";

import ClassManagement from "@/views/ClassManagement";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequirePermission perm="class.view"><ClassManagement /></RequirePermission>;
}
