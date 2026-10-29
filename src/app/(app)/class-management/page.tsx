"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import ClassManagement from "@/views/ClassManagement";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequireFeature feature="classManagement"><RequirePermission perm="class.view"><ClassManagement /></RequirePermission></RequireFeature>;
}
