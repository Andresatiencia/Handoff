import { PageLoading } from "@/components/page-loading";
import { Suspense } from "react";
import { Messages } from "@/components/messages";

export default function MessagesPage() {
  return <Suspense fallback={<PageLoading label="Loading conversations…" />}><Messages /></Suspense>;
}
