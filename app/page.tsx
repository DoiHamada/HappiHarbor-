import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand-logo";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      redirect("/onboarding");
    }

    redirect("/matches");
  }

  const safetyCards = [
    {
      title: "Kindness First",
      description:
        "Our community is built on mutual respect. We foster a positive atmosphere where every interaction begins with warmth.",
      icon: "K",
      iconBg: "bg-rose-100",
      iconColor: "text-rose-600"
    },
    {
      title: "Slow Dating Focus",
      description:
        "Quality over quantity. We limit swipes to encourage thoughtful conversations and deeper emotional bonds.",
      icon: "S",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600"
    },
    {
      title: "Community Led",
      description:
        "A zero-tolerance policy for harassment. Kindness isn't just a suggestion, it's a requirement to stay in the harbor.",
      icon: "C",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600"
    }
  ];

  const steps = [
    {
      title: "Build Your Safe Profile",
      body: "Share your values, quirks, and what makes you happy. Our guided setup helps you express your true self."
    },
    {
      title: "Connect Mindfully",
      body: "Start conversations in a space where everyone is looking for the same thing: a genuine, respectful connection."
    },
    {
      title: "Find Your Community",
      body: "Join interest-based groups and local harbor events to meet people in a natural, low-pressure environment."
    }
  ];

  return (
    <div className="space-y-0">
      <section className="grid gap-10 py-12 md:grid-cols-[1fr_1.05fr] md:items-center md:py-16">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-[#ffe5c2] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#c46c00]">
            Trusted by 50K+ happy members
          </p>
          <h1 className="max-w-xl text-4xl font-black leading-tight text-[#10162f] md:text-6xl">
            A kinder way to <span className="text-[#ea9f2f]">find your person.</span>
          </h1>
          <p className="max-w-xl text-base leading-7 text-[#585e72]">
            Escape the noise of modern dating. Join a community built on respect, safety, and genuine human connection.
            Your safe harbor starts here.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth"
              className="inline-flex items-center rounded-full bg-[#ec9f29] px-6 py-3 text-sm font-semibold text-white no-underline shadow-[0_12px_24px_-14px_rgba(236,159,41,0.85)] transition hover:brightness-95"
            >
              Find Your Safe Harbor
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center rounded-full border border-[#d8d9df] bg-white px-6 py-3 text-sm font-semibold text-[#252a3b] no-underline"
            >
              See how it works
            </Link>
          </div>
        </div>
        <div className="rounded-[2.25rem] bg-gradient-to-br from-[#5f3a1a] via-[#a0713d] to-[#3f260f] p-3 shadow-[0_30px_45px_-30px_rgba(15,19,38,0.65)]">
          <div className="overflow-hidden rounded-[1.8rem] bg-[#d6b18c]">
            <img
              src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80"
              alt="Two people sharing coffee and laughing"
              className="h-[370px] w-full object-cover object-center"
            />
            <div className="m-4 -mt-14 rounded-2xl bg-white/95 px-5 py-3 backdrop-blur">
              <p className="text-sm font-semibold text-[#252a3b]">Real Connection</p>
              <p className="text-xs text-[#666d80]">Matches based on shared values, not just swipes.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 border-y border-black/5 py-10 text-center sm:grid-cols-3">
        <div>
          <p className="text-4xl font-black text-[#eb9f31]">10k+</p>
          <p className="mt-1 text-sm text-[#666d80]">Success Stories</p>
        </div>
        <div>
          <p className="text-4xl font-black text-[#eb9f31]">99%</p>
          <p className="mt-1 text-sm text-[#666d80]">Safety Rating</p>
        </div>
        <div>
          <p className="text-4xl font-black text-[#eb9f31]">24/7</p>
          <p className="mt-1 text-sm text-[#666d80]">Human Support</p>
        </div>
      </section>

      <section className="-mx-4 bg-[#f2efea] px-4 py-16 md:-mx-8 md:px-8">
        <div className="mx-auto max-w-[1180px]">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#e59a2c]">Safety First</p>
          <h2 className="text-center text-4xl font-black text-[#131a30]">Your Harbor, Your Rules</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-7 text-[#666d80]">
            We prioritize your peace of mind with human-led moderation and strict community standards that keep the
            bad vibes out.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {safetyCards.map((item) => (
              <article key={item.title} className="rounded-3xl border border-black/5 bg-white p-7 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.35)]">
                <span className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${item.iconBg} ${item.iconColor}`}>
                  {item.icon}
                </span>
                <h3 className="mt-5 text-xl font-bold text-[#161b2f]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#666d80]">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="grid gap-8 py-16 md:grid-cols-[1fr_1fr] md:items-center">
        <div className="overflow-hidden rounded-[2rem] shadow-[0_25px_40px_-26px_rgba(0,0,0,0.4)]">
          <img
            src="https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1400&q=80"
            alt="Small group talking around a table"
            className="h-[300px] w-full object-cover object-center"
          />
        </div>
        <div className="space-y-5">
          <h2 className="text-4xl font-black text-[#131a30]">Ready to sail?</h2>
          {steps.map((step, index) => (
            <div key={step.title} className="flex gap-4">
              <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f5b13e] text-xs font-semibold text-white">
                {index + 1}
              </span>
              <div>
                <h3 className="text-lg font-bold text-[#171d34]">{step.title}</h3>
                <p className="mt-1 text-sm leading-7 text-[#666d80]">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-0 py-4 md:px-12 md:py-10">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#eba126] px-6 py-14 text-center md:px-20">
          <div className="pointer-events-none absolute -right-4 -top-12 h-40 w-40 rounded-full bg-[#f4bc62]/70" />
          <h2 className="relative text-4xl font-black text-white md:text-5xl">Stop swiping. Start connecting.</h2>
          <p className="relative mx-auto mt-3 max-w-2xl text-sm text-[#fff5e7]">
            Your harbor is waiting. Join the kindest dating community on the web today.
          </p>
          <div className="relative mt-8">
            <Link
              href="/auth"
              className="inline-flex items-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-[#da7f00] no-underline"
            >
              Create Your Free Profile
            </Link>
          </div>
          <p className="relative mt-7 text-xs italic text-[#fff3dd]">
            &quot;The most wholesome experience I&apos;ve had online.&quot; - Sarah, 29
          </p>
        </div>
      </section>

      <footer className="-mx-4 mt-10 border-t border-black/5 bg-[#f6f4f1] px-4 py-12 md:-mx-8 md:px-8">
        <div className="mx-auto grid max-w-[1180px] gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <BrandLogo className="text-2xl" textClassName="text-2xl" />
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#666d80]">
              HappiHarbor is a community-focused platform dedicated to finding meaningful long-term relationships
              through safety and respect.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#131a30]">App</h3>
            <ul className="mt-4 space-y-3 text-sm text-[#4d556c]">
              <li>
                <Link href="#" className="no-underline hover:text-[#131a30]">
                  Download iOS
                </Link>
              </li>
              <li>
                <Link href="#" className="no-underline hover:text-[#131a30]">
                  Download Android
                </Link>
              </li>
              <li>
                <Link href="#" className="no-underline hover:text-[#131a30]">
                  Safety Guidelines
                </Link>
              </li>
              <li>
                <Link href="#" className="no-underline hover:text-[#131a30]">
                  Help Center
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#131a30]">Company</h3>
            <ul className="mt-4 space-y-3 text-sm text-[#4d556c]">
              <li>
                <Link href="#" className="no-underline hover:text-[#131a30]">
                  Our Story
                </Link>
              </li>
              <li>
                <Link href="#" className="no-underline hover:text-[#131a30]">
                  Success Stories
                </Link>
              </li>
              <li>
                <Link href="#" className="no-underline hover:text-[#131a30]">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="#" className="no-underline hover:text-[#131a30]">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-[1180px] flex-col gap-3 border-t border-black/5 pt-6 text-xs text-[#7c8397] md:flex-row md:items-center md:justify-between">
          <p>© 2026 HappiHarbor. All rights reserved. Built for humans.</p>
          <div className="flex items-center gap-5">
            <Link href="#" className="no-underline hover:text-[#42495d]">
              Terms
            </Link>
            <Link href="#" className="no-underline hover:text-[#42495d]">
              Cookies
            </Link>
            <Link href="#" className="no-underline hover:text-[#42495d]">
              Safety
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
