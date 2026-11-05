import Link from "next/link";
export function Footer() {
  return (
    <footer className="border-t border-border bg-bg text-fg-muted">
      <div className="mx-auto max-w-7xl px-5 py-12 grid sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] gap-10">
        <div>
          <Link href="/" className="font-display text-2xl font-bold text-fg">
            FITMATCH<span className="text-accent-text">.AI</span>
          </Link>
          <p className="text-xs leading-6 mt-4 max-w-sm">
            Tủ đồ thật, gu của riêng bạn. Khám phá phong cách và xem từng chiếc
            áo trong không gian 3D cá nhân.
          </p>
          <p className="text-xs mt-5">
            © {new Date().getFullYear()} Fitmatch AI
          </p>
        </div>
        <nav aria-label="Khám phá">
          <p className="text-xs uppercase tracking-widest mb-4">
            Không gian của bạn
          </p>
          <ul className="space-y-3 text-sm">
            {[
              ["/wardrobe", "Tủ đồ"],
              ["/quiz", "Gu của bạn"],
              ["/looks", "Gợi ý mặc thử"],
              ["/studio", "3D Studio"],
              ["/outfits", "Ý tưởng phối đồ 2D"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="hover:text-fg">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-xs uppercase tracking-widest mb-4">
            Từ ảnh đến 3D
          </p>
          <p className="text-xs leading-6">
            Tạo avatar, thêm ảnh áo và theo dõi xử lý trong không gian của tài
            khoản.
          </p>
          <Link
            href="/prepare"
            className="text-accent-text text-sm inline-block mt-3"
          >
            Chuẩn bị bộ ảnh →
          </Link>
          <p className="text-[11px] leading-5 mt-6">
            Ảnh phong cách tham khảo: Unsplash · Maxime, Tamara Bellis, Laura
            Chouette, Hunters Race, Ksenia Chernaya và Aiony Haust.
          </p>
        </div>
      </div>
    </footer>
  );
}
