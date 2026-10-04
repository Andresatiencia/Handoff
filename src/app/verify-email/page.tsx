import { Suspense } from "react";
import { VerifyEmail } from "@/components/verify-email";
import { PageLoading } from "@/components/page-loading";

export default function VerifyEmailPage() {
  return <Suspense fallback={<PageLoading label="Loading verification…" />}><VerifyEmail /></Suspense>;
}
