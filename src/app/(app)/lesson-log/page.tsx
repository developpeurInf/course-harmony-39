"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import LessonLog from "@/views/LessonLog";

export default function Page() {
  return <RequireFeature feature="lessonLog"><LessonLog /></RequireFeature>;
}
