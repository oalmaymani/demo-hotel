import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminRoot({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolved = await searchParams;
  const lang = getSingleValue(resolved?.lang) === "en" ? "en" : "ar";
  redirect(`/admin/login?lang=${lang}`);
}
