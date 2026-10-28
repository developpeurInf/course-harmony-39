"use client";

import RoomExams from "@/views/RoomExams";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return <RequireFeature feature="exams"><RoomExams /></RequireFeature>;
}
