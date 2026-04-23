export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you are looking for does not exist.
        </p>
      </div>
    </main>
  );
}
