"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import Students from "@/views/Students";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequireFeature feature="students"><RequirePermission perm="student.view"><Students /></RequirePermission></RequireFeature>;
}
