export function SessionLoadingPage() {
  return (
    <main
      aria-busy="true"
      aria-label="در حال بررسی نشست مدیریتی"
      className="grid min-h-dvh place-items-center bg-background px-5 text-foreground"
    >
      <div className="text-center">
        <span
          aria-hidden="true"
          className="mx-auto block size-8 animate-spin rounded-full border-2 border-border border-t-foreground motion-reduce:animate-none"
        />
        <p className="mt-4 text-sm text-muted-foreground">
          در حال بررسی نشست مدیریتی…
        </p>
      </div>
    </main>
  );
}
