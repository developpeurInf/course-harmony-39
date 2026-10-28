"use client";

import LessonPlans from "@/views/LessonPlans";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequirePermission perm="ai.lesson_plan"><LessonPlans /></RequirePermission>;
}
