import "server-only";

export function hubEnabled() {
  return process.env.FITMATCH_AUTH_PROVIDER === "app-system";
}

export function authConfig() {
  const read = (key: string) => {
    const value = process.env[key]?.trim();
    if (!value) throw new Error(`Missing auth configuration: ${key}`);
    return value;
  };
  const hubUrl = new URL(read("NEXT_PUBLIC_INFRA_URL"));
  const appUrl = new URL(read("APP_URL"));
  for (const url of [hubUrl, appUrl]) {
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
      throw new Error("Auth URLs must use HTTPS (except local development)");
    }
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Auth URLs must be origins");
  }
  const secretKey = read("INFRA_SECRET_KEY");
  const publishableKey = read("NEXT_PUBLIC_INFRA_PUBLISHABLE_KEY");
  if (!secretKey.startsWith("sk_") || !publishableKey.startsWith("pk_")) throw new Error("Invalid auth key types");
  return { hubUrl: hubUrl.origin, appUrl: appUrl.origin, secretKey, publishableKey, appId: read("INFRA_APP_ID") };
}
