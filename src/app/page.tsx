import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Camera, Shirt, SlidersHorizontal, View, LockKeyhole, Bookmark } from "lucide-react";
import { IMAGES, DARK_BLUR_DATA_URL } from "@/lib/images";

const steps = [
  { icon: Camera, number: "01", title: "Bắt đầu từ tủ đồ", description: "Chụp hoặc tải ảnh món đồ, thêm màu và phong cách. Tủ đồ của bạn được giữ riêng theo tài khoản.", href: "/wardrobe", action: "Thêm món đồ đầu tiên" },
  { icon: SlidersHorizontal, number: "02", title: "Chọn gu, chọn dịp", description: "Lưu sở thích trong quiz để tìm tối đa ba bộ áo và jeans từ những món bạn đang có.", href: "/quiz", action: "Khám phá gu của bạn" },
  { icon: View, number: "03", title: "Xem trong Studio", description: "Khi avatar và trang phục 3D sẵn sàng, chọn áo và quần riêng, xoay góc nhìn rồi lưu cả bộ.", href: "/studio", action: "Mở phòng thử đồ" },
];
const features = [
  { icon: Shirt, title: "Áo và quần, hai lựa chọn riêng", text: "Đổi áo giữ nguyên quần, đổi quần giữ nguyên áo. Món đang xử lý không tự thay lựa chọn mới của bạn." },
  { icon: Bookmark, title: "Giữ lại bộ phối bạn thích", text: "Lưu avatar, áo, quần và góc nhìn khi kết quả đã sẵn sàng. Mở lại bộ đã lưu mà không dựng AI lại." },
  { icon: Camera, title: "Ảnh lookbook từ đúng bộ đang mặc", text: "Chọn góc máy và nền trong Studio rồi lưu ảnh từ scene 3D hiện tại." },
];
export default function HomePage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-32 sm:px-8 lg:min-h-[760px] lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:gap-16 lg:pb-24 lg:pt-36">
        <div>
          <p className="mb-6 text-xs uppercase tracking-[.22em] text-accent-text">Tủ đồ số · Phong cách cá nhân</p>
          <h1 className="font-display text-5xl font-semibold leading-[1.06] sm:text-6xl lg:text-7xl">Đồ bạn có.<br /><span className="text-fg-muted">Gu của riêng bạn.</span></h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-fg-muted">Một nơi để giữ tủ đồ, chọn bộ phối theo dịp và chuẩn bị avatar cho phòng thử đồ 3D của bạn.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/wardrobe" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg hover:bg-accent-hover">Mở tủ đồ của bạn <ArrowUpRight size={18} aria-hidden="true" /></Link>
            <Link href="/studio" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-border-strong px-6 py-3 text-sm hover:bg-bg-raised">Khám phá Studio 3D <View size={18} aria-hidden="true" /></Link>
          </div>
          <div className="mt-8 flex items-center gap-2 text-xs leading-5 text-fg-muted"><LockKeyhole size={15} className="shrink-0" aria-hidden="true" />Đăng nhập để truy cập tủ đồ và bộ phối của riêng bạn.</div>
        </div>
        <figure className="relative">
          <div className="relative aspect-[4/5] max-h-[650px] overflow-hidden rounded-[2rem] border border-border bg-bg-elevated">
            <Image src={IMAGES.heroLanding.src} alt="Ảnh tham khảo phong cách: trang phục được phối theo tinh thần tối giản" fill priority sizes="(max-width: 1023px) 100vw, 45vw" placeholder="blur" blurDataURL={DARK_BLUR_DATA_URL} className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-7 text-white sm:p-9">
              <p className="text-[11px] uppercase tracking-[.2em] text-white/70">Ít thao tác hơn. Nhiều cách phối hơn.</p>
              <p className="mt-3 font-display text-3xl leading-tight">Bắt đầu bằng một<br />món đồ bạn yêu thích.</p>
            </div>
          </div>
          <figcaption className="mt-3 text-xs leading-5 text-fg-muted">Ảnh phong cách tham khảo, không phải avatar hay kết quả do FitMatch tạo.</figcaption>
        </figure>
      </section>
      <section aria-labelledby="journey-title" className="border-y border-border bg-bg-elevated/40">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
            <div><p className="mb-3 text-xs uppercase tracking-[.2em] text-accent-text">Không gian của bạn</p><h2 id="journey-title" className="font-display text-3xl font-semibold sm:text-4xl">Bắt đầu ở nơi thuận tiện nhất.</h2></div>
            <p className="max-w-sm text-sm leading-6 text-fg-muted">Bạn có thể thêm đồ trước khi tạo avatar. Quiz là tùy chọn và có thể chỉnh lại bất cứ lúc nào.</p>
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
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs text-accent-text"><span className="h-1.5 w-1.5 rounded-full bg-accent" />Studio 3D · Bản thử nghiệm</p>
          <h2 id="studio-title" className="font-display text-3xl font-semibold leading-tight sm:text-4xl">Chuẩn bị một lần.<br />Phối lại nhiều lần.</h2>
          <p className="mt-5 text-sm leading-7 text-fg-muted">Bản đầu tập trung vào avatar cá nhân, áo thun và jeans. Ảnh cần được xử lý trước khi mặc thử; trạng thái sẵn sàng, chờ hoặc lỗi sẽ hiển thị trong tài khoản.</p>
          <p className="mt-3 text-sm leading-7 text-fg-muted">Tạo avatar và chỉnh mặt, dáng, tóc vẫn đang được kiểm chứng. Studio chỉ hiển thị kết quả đã có; ảnh tham khảo trên trang này không đại diện cho chất lượng avatar của bạn.</p>
          <Link href="/prepare" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-accent-text">Chuẩn bị avatar và trang phục <ArrowUpRight size={17} aria-hidden="true" /></Link>
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
