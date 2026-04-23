export function LogoCloud() {
  return (
    <section className="border-y border-border/60 bg-card/30">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-10">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Trusted by growing businesses across the region
        </p>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 items-center gap-8 opacity-60">
          {[
            "Bashundhara",
            "Aarong",
            "Daraz",
            "Pickaboo",
            "Othoba",
            "Chaldal",
          ].map((name) => (
            <div
              key={name}
              className="text-center text-sm font-semibold tracking-tight text-muted-foreground"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
