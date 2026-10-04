import { Suspense } from "react";
import { Messages } from "@/components/messages";

export default function MessagesPage() {
  return <Suspense fallback={<main className="page-width py-16">Loading conversations…</main>}><Messages /></Suspense>;
}
