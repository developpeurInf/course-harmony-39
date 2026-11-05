"use client";

import RoomExercises from "@/views/RoomExercises";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return <RequireFeature feature="exercises"><RoomExercises /></RequireFeature>;
}
