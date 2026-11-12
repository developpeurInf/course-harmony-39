"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import LessonPlans from "@/views/LessonPlans";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequireFeature feature="lessonPlans"><RequirePermission perm="ai.lesson_plan"><LessonPlans /></RequirePermission></RequireFeature>;
}
