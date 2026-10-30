"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import ClassCalendar from "@/views/ClassCalendar";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequireFeature feature="calendar"><RequirePermission perm="class.calendar"><ClassCalendar /></RequirePermission></RequireFeature>;
}
