"use client";

import MainLayout from "@/components/layout/MainLayout";
import { ChatProvider } from "@/contexts/ChatContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <MainLayout>{children}</MainLayout>
    </ChatProvider>
  );
}
