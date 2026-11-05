import Studio from "@/components/studio/Studio";
export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ avatar?: string; fitting?: string }>;
}) {
  const params = await searchParams;
  return (
    <Studio
      requestedAvatar={
        typeof params.avatar === "string" ? params.avatar : undefined
      }
      requestedFitting={
        typeof params.fitting === "string" ? params.fitting : undefined
      }
    />
  );
}
