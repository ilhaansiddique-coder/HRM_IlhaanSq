export default function TenantLoading() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted/70" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border bg-muted/30"
          />
        ))}
      </div>

      <div className="flex gap-2">
        <div className="h-9 flex-1 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-80 animate-pulse rounded-lg border bg-muted/30"
          />
        ))}
      </div>
    </div>
  );
}
