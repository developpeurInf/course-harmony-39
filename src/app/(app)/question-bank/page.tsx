"use client";

import QuestionBank from "@/views/QuestionBank";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequirePermission perm="quiz.bank"><QuestionBank /></RequirePermission>;
}
