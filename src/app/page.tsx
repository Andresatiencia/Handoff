import Link from "next/link";
import { RecentListings } from "@/components/recent-listings";

const steps = [
  { n: "01", title: "Share your timeline", text: "Leaving or arriving? Start with your campus and the date you move." },
  { n: "02", title: "Find the everyday essentials", text: "A warm coat, a first kitchen, a desk lamp. See what other students are passing on." },
  { n: "03", title: "Keep good things going", text: "Less waste at the end of term, less to buy at the start of one." },
];

export default function Home() {
  return <main>
    <section className="page-width pb-16 pt-16 sm:pb-20 sm:pt-24">
      <p className="label rise">For students. From students.</p>
      <h1 className="display-xl rise mt-6 max-w-[15ch] text-forest" style={{ animationDelay: "60ms" }}>
        Students leaving have what arriving students need.
      </h1>
      <p className="lede rise mt-8" style={{ animationDelay: "120ms" }}>
        A new home for your old favorites. Handoff connects students leaving campus with students
        arriving, so useful things can start a new chapter too.
      </p>
      <div className="rise mt-10 flex flex-wrap items-center gap-3" style={{ animationDelay: "180ms" }}>
        <Link className="button-primary" href="/leaving">I&apos;m leaving</Link>
        <Link className="button-secondary" href="/arriving">I&apos;m arriving</Link>
      </div>
      <p className="rise mt-8 text-sm text-muted" style={{ animationDelay: "240ms" }}>
        Less to pack. Less to buy. More to pass on.
      </p>
    </section>

    <section className="page-width pb-20">
      <div className="rule flex flex-wrap items-baseline justify-between gap-4 pt-10">
        <h2 className="display-lg">Ready for their next home</h2>
        <Link href="/marketplace" className="text-sm font-medium text-forest underline underline-offset-4 decoration-forest/30 hover:decoration-forest">
          Browse everything
        </Link>
      </div>
      <div className="mt-8"><RecentListings /></div>
    </section>

    <section className="bg-sand py-16">
      <div className="page-width grid gap-10 sm:grid-cols-3 sm:gap-8">
        {steps.map(step => <div key={step.n}>
          <p className="display font-display text-2xl text-forest/35">{step.n}</p>
          <h3 className="mt-3 text-[0.9375rem] font-semibold">{step.title}</h3>
          <p className="mt-2 text-sm leading-7 text-muted">{step.text}</p>
        </div>)}
      </div>
    </section>

    <section className="page-width py-20">
      <div className="max-w-2xl">
        <h2 className="display-lg">New campus. Familiar comforts.</h2>
        <p className="lede mt-5">
          Whether you are moving across the country or across the world, a little help from
          another student goes a long way.
        </p>
        <Link className="button-primary mt-8" href="/arriving">Find your essentials</Link>
      </div>
    </section>
  </main>;
}
