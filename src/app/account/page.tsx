import { PageLoading } from "@/components/page-loading";
import { Suspense } from "react";
import { Account } from "@/components/account";

export default function AccountPage() {
  return <Suspense fallback={<PageLoading label="Loading account…" />}><Account /></Suspense>;
}
