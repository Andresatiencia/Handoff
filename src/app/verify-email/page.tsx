import { Suspense } from "react";
import { VerifyEmail } from "@/components/verify-email";

export default function VerifyEmailPage() {
  return <Suspense fallback={<main className="page-width py-16">Loading verification…</main>}><VerifyEmail /></Suspense>;
}
