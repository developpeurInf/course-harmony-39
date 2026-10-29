"use client";

import ClassCalendar from "@/views/ClassCalendar";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequirePermission perm="class.calendar"><ClassCalendar /></RequirePermission>;
}
