import { Skeleton } from "@/components/ui/misc";

export function PageLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-[14px]" />
        <Skeleton className="h-56 w-full rounded-[14px]" />
      </div>
    </div>
  );
}
