import Studio from "@/components/studio/Studio";
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  return (
    <Studio
      request={{
        avatar: one(params.avatar),
        fitting: one(params.fitting),
        look: one(params.look),
        top: one(params.top),
        bottom: one(params.bottom),
      }}
    />
  );
}
