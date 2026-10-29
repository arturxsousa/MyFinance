import { EntriesPage } from "@/components/entries/entries-page";

export default function Page({ searchParams }: PageProps<"/expenses">) {
  return <EntriesPage kind="EXPENSE" searchParams={searchParams} />;
}
