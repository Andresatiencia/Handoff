import { Suspense } from "react";
import { Account } from "@/components/account";

export default function AccountPage() {
  return <Suspense fallback={<main className="page-width py-16">Loading account…</main>}><Account /></Suspense>;
}
