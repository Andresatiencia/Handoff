"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Arrow } from "./icons";
const essentials = [
  { id: "chair", category: "Furniture", title: "A place to think", description: "A desk chair for the next late-night study session.", alt: "Illustrative green student desk chair" },
  { id: "lamp", category: "Electronics", title: "Late-night company", description: "A little light for big ideas and long evenings.", alt: "Illustrative terracotta desk lamp" },
  { id: "kitchen", category: "Kitchen", title: "A taste of home", description: "Everyday kitchen things for your first meal in a new place.", alt: "Illustrative bowls and cooking pan" },
];
export function HandoffHero() {
  const [arriving, setArriving] = useState(false);
  const [selected, setSelected] = useState(0);
  const [visible, setVisible] = useState(true);
  const stage = useRef<HTMLElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  const item = essentials[selected];
  return <section ref={stage} className="page-width handoff-hero" data-arriving={arriving} data-visible={visible}>
    <div className="hero-heading"><h1>Good things.<br /><em>New beginnings.</em></h1><div className="hero-intro"><p>Your semester changes.<br /> Good essentials keep going.</p><p>Buy and sell with students moving on the same timeline as you.</p><div className="hero-actions"><Link href="/arriving" className="button-primary">I&apos;m arriving <Arrow /></Link><Link href="/leaving" className="text-link">I&apos;m leaving <Arrow /></Link></div></div></div>
    <div className="essentials-stage"><div className="handoff-rail" aria-hidden="true"><span>Their last chapter</span><i /><Arrow /><span>Your next chapter</span></div>
      {essentials.map((essential, index) => <button key={essential.id} type="button" className={`photo-object ${essential.id}`} aria-pressed={selected === index} onClick={() => setSelected(index)}><Image src={`/brand/${essential.id}.webp`} alt={essential.alt} width={700} height={700} sizes="(max-width: 700px) 33vw, 260px" priority={index === 0} /><span>{essential.title}<small>{essential.category}</small></span></button>)}
      <div className="object-detail" aria-live="polite"><h2>{item.title}.</h2><p>{item.description}</p><Link className="text-link" href={`/marketplace?categories=${item.category}`}>Browse {item.category.toLowerCase()} <Arrow /></Link></div>
      <div className="hero-switch"><div className="intent-toggle" role="group" aria-label="See the handoff from each student's perspective"><button type="button" aria-pressed={!arriving} onClick={() => setArriving(false)}>I&apos;m leaving</button><button type="button" aria-pressed={arriving} onClick={() => setArriving(true)}>I&apos;m arriving</button></div><p aria-live="polite">{arriving ? "A new start. With things that already feel like home." : "Ready to leave. Ready for someone new."}</p></div>
    </div>
    <div className="hero-bottom"><Link href="/marketplace"><span>Find the essentials for <em>your</em> next chapter.</span> <Arrow /></Link><small>Illustrative objects · Browse the marketplace for real listings</small></div>
  </section>;
}
