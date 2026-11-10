import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Camera, Shirt, SlidersHorizontal, View, LockKeyhole, Bookmark } from "lucide-react";
import { IMAGES, DARK_BLUR_DATA_URL } from "@/lib/images";

const steps = [
  { icon: Camera, number: "01", title: "Start with your wardrobe", description: "Photograph or upload an item, then add its color and style. Your wardrobe stays private to your account.", href: "/wardrobe", action: "Add your first item" },
  { icon: SlidersHorizontal, number: "02", title: "Find your style, choose your occasion", description: "Save your preferences in the quiz to discover up to three top-and-jeans looks using clothes you already own.", href: "/quiz", action: "Explore your style" },
  { icon: View, number: "03", title: "See it in Studio", description: "Once your avatar and 3D clothes are ready, choose tops and bottoms separately, explore every angle and save your look.", href: "/studio", action: "Open the fitting room" },
];
const features = [
  { icon: Shirt, title: "Tops and bottoms, chosen separately", text: "Change your top while keeping your jeans, or the other way around. Processing items never replace your latest selection." },
  { icon: Bookmark, title: "Keep the looks you love", text: "Save your avatar, top, bottom and camera angle once everything is ready. Reopen a saved look without running AI again." },
  { icon: Camera, title: "Lookbook images of your actual outfit", text: "Choose a camera angle and background in Studio, then save an image of your current 3D scene." },
];
export default function HomePage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <section aria-labelledby="hero-title" className="relative isolate flex min-h-[760px] items-center overflow-hidden bg-black lg:min-h-[860px]">
        <Image src={IMAGES.heroLanding.src} alt="Style reference: an outfit with a minimal aesthetic" fill priority sizes="100vw" placeholder="blur" blurDataURL={DARK_BLUR_DATA_URL} className="-z-20 object-cover object-[62%_center] lg:object-center" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/75 to-black/60 lg:via-black/65 lg:to-black/20" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
        <div className="mx-auto w-full max-w-7xl px-5 pb-28 pt-40 sm:px-8 lg:py-44">
          <div className="max-w-2xl">
            <p className="mb-6 text-xs uppercase tracking-[.22em] text-orange-200">Digital wardrobe · Personal style</p>
            <h1 id="hero-title" className="font-display text-5xl font-semibold leading-[1.06] text-white sm:text-6xl lg:text-7xl">Your clothes.<br /><span className="text-white/85">Your own style.</span></h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-white/85">A home for your wardrobe, outfit ideas for every occasion and your personal 3D fitting room.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/wardrobe" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg hover:bg-accent-hover">Open your wardrobe <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <Link href="/studio" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-white/50 bg-black/30 px-6 py-3 text-sm text-white hover:bg-black/50">Explore 3D Studio <View size={18} aria-hidden="true" /></Link>
            </div>
            <div className="mt-8 flex items-center gap-2 text-xs leading-5 text-white/80"><LockKeyhole size={15} className="shrink-0" aria-hidden="true" />Sign in to access your private wardrobe and saved looks.</div>
          </div>
        </div>
        <p className="absolute bottom-7 left-5 right-5 max-w-lg text-xs leading-5 text-white/75 sm:left-8 lg:left-[max(2rem,calc((100vw-76rem)/2))]">Style reference photo, not an avatar or a FitMatch-generated result.</p>
      </section>
      <section aria-labelledby="journey-title" className="border-y border-border bg-bg-elevated/40">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
            <div><p className="mb-3 text-xs uppercase tracking-[.2em] text-accent-text">Your space</p><h2 id="journey-title" className="font-display text-3xl font-semibold sm:text-4xl">Start wherever feels right.</h2></div>
            <p className="max-w-sm text-sm leading-6 text-fg-muted">You can add clothes before creating an avatar. The style quiz is optional and you can update it anytime.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, ...step }) => (
              <article key={step.number} className="flex flex-col rounded-3xl border border-border bg-bg p-6 sm:p-7">
                <div className="mb-8 flex items-center justify-between"><Icon size={25} className="text-accent-text" aria-hidden="true" /><span className="font-mono text-xs text-fg-muted">{step.number}</span></div>
                <h3 className="font-display text-2xl font-semibold">{step.title}</h3>
                <p className="mb-7 mt-4 flex-1 text-sm leading-6 text-fg-muted">{step.description}</p>
                <Link href={step.href} className="inline-flex min-h-11 items-center justify-between gap-3 text-sm text-accent-text hover:text-fg">{step.action}<ArrowUpRight size={17} aria-hidden="true" /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section aria-labelledby="studio-title" className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-24">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs text-accent-text"><span className="h-1.5 w-1.5 rounded-full bg-accent" />3D Studio · Experimental</p>
          <h2 id="studio-title" className="font-display text-3xl font-semibold leading-tight sm:text-4xl">Prepare once.<br />Style again and again.</h2>
          <p className="mt-5 text-sm leading-7 text-fg-muted">The first release focuses on personal avatars, T-shirts and jeans. Photos need processing before you can try items on; your account shows whether they are ready, waiting or need attention.</p>
          <p className="mt-3 text-sm leading-7 text-fg-muted">Personal avatar creation and face, body and hair editing are still being validated. Studio shows available results; reference images on this page do not represent your avatar quality.</p>
          <Link href="/prepare" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-accent-text">Prepare avatar and clothes <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>
        <div className="space-y-4">
          {features.map(({icon: Icon, title, text}) => (
            <div key={title} className="flex gap-4 rounded-2xl border border-border p-5"><Icon size={20} className="mt-1 shrink-0 text-accent-text" aria-hidden="true" /><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-fg-muted">{text}</p></div></div>
          ))}
        </div>
      </section>
    </main>
  );
}
