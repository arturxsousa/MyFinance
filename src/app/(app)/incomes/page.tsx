import { EntriesPage } from "@/components/entries/entries-page";

export default function Page({ searchParams }: PageProps<"/incomes">) {
  return <EntriesPage kind="INCOME" searchParams={searchParams} />;
}
