"use client";

import Whiteboards from "@/views/Whiteboards";
import { RequireClassModule } from "@/components/access/RequireFeature";

export default function Page() {
  return <RequireClassModule module="whiteboard"><Whiteboards /></RequireClassModule>;
}
