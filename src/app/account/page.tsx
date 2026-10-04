import { PageLoading } from "@/components/page-loading";
import { Suspense } from "react";
import { Account } from "@/components/account";
import { googleConfigured } from "@/lib/server/google-config";

export const dynamic = "force-dynamic";

export default function AccountPage() {
  return <Suspense fallback={<PageLoading label="Loading account…" />}><Account googleEnabled={googleConfigured()} /></Suspense>;
}
