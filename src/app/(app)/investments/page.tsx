import { EntriesPage } from "@/components/entries/entries-page";

export default function Page({ searchParams }: PageProps<"/investments">) {
  return <EntriesPage kind="INVESTMENT" searchParams={searchParams} />;
}
