"use client";

import { RequireFeature } from "@/components/access/RequireFeature";
import QuestionBank from "@/views/QuestionBank";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequireFeature feature="questionBank"><RequirePermission perm="quiz.bank"><QuestionBank /></RequirePermission></RequireFeature>;
}
