import Link from "next/link";
import LegacyLogin from "@/components/LegacyLogin";
import { createClient } from "@/lib/supabase/server";
import { hubEnabled } from "@/lib/auth/config";
import { safeNext } from "@/lib/auth/session";

const messages: Record<string, string> = {
  state: "Liên kết đăng nhập đã hết hạn hoặc được mở ở trình duyệt khác. Hãy bắt đầu lại.",
  denied: "Bạn đã hủy đăng nhập. Có thể thử lại bất cứ lúc nào.",
  link_expired: "Hãy đăng nhập lại tài khoản FitMatch cũ trước khi kết nối App System.",
  IDENTITY_ALREADY_LINKED: "Tài khoản App System này đã kết nối với một tủ đồ khác. Các tài khoản vẫn được giữ riêng.",
  unavailable: "Chưa đăng nhập được. Tủ đồ của bạn vẫn được giữ lại. Hãy thử lại.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; legacy?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (!hubEnabled()) return <LegacyLogin returnTo={next} />;
  if (params.legacy === "1") return <LegacyLogin hosted returnTo={`/login?next=${encodeURIComponent(next)}`} />;
  const legacy = await (await createClient()).auth.getUser();
  const connect = !!legacy.data.user;

  return (
    <main className="min-h-[75vh] px-6 pt-32 pb-16 flex items-start justify-center bg-bg">
      <section className="w-full max-w-md rounded-lg border border-border bg-bg-elevated p-7 space-y-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-accent-text">FitMatch AI</p>
          <h1 className="font-display text-3xl font-bold">{connect ? "Kết nối tủ đồ hiện có." : "Chào mừng đến với tủ đồ của bạn."}</h1>
          <p className="text-sm leading-relaxed text-fg-muted">
            {connect ? "Bạn đã đăng nhập FitMatch. Kết nối App System để dùng tài khoản chung mà vẫn giữ nguyên tủ đồ này." : "Đăng nhập bằng tài khoản App System. Bạn sẽ quay lại đúng trang đang mở sau khi hoàn tất."}
          </p>
        </div>
        {params.error && <p role="alert" className="rounded border border-danger/40 p-3 text-sm text-fg">{messages[params.error] ?? messages.unavailable}</p>}
        {connect ? (
          <form action={`/auth/link?next=${encodeURIComponent(next)}`} method="post">
            <button type="submit" className="w-full rounded-lg bg-accent p-3 font-semibold text-black">Kết nối App System với tủ đồ này</button>
          </form>
        ) : (
          <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="block rounded-lg bg-accent p-3 text-center font-semibold text-black">Tiếp tục với App System</Link>
        )}
        <p className="text-sm leading-relaxed text-fg-muted">Tủ đồ và bộ phối được giữ riêng theo tài khoản.</p>
        {!connect && <p className="text-sm text-fg-muted">Đã có tủ đồ FitMatch từ trước? <Link className="text-accent-text underline" href={`/login?legacy=1&next=${encodeURIComponent(next)}`}>Đăng nhập tài khoản cũ trước</Link> để kết nối và giữ lại dữ liệu.</p>}
      </section>
    </main>
  );
}
