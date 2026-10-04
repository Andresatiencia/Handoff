import Image from "next/image";
import type { ReactNode } from "react";
export function FlowIntro({ title, description, image = "lamp", children }: { title: string; description: string; image?: "chair" | "lamp" | "kitchen"; children?: ReactNode }) {
  return <div className="flow-intro"><h1>{title}</h1><p>{description}</p>{children}<figure><Image src={`/brand/${image}.webp`} alt="" width={420} height={420} sizes="(max-width: 760px) 140px, 300px" /><figcaption>Good things, ready for another chapter.<br />Illustrative essential.</figcaption></figure></div>;
}
