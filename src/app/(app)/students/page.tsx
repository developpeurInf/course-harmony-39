"use client";

import Students from "@/views/Students";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequirePermission perm="student.view"><Students /></RequirePermission>;
}
