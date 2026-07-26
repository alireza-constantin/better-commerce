import { Check, Layers3, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const foundations = [
  {
    icon: ShieldCheck,
    title: 'Secure browser boundary',
    detail: 'Session and CSRF integration arrives in the next phase.',
  },
  {
    icon: Layers3,
    title: 'Typed application structure',
    detail: 'Router, query cache, and feature ownership are ready.',
  },
] as const;

export function FoundationPage() {
  return (
    <main className="min-h-dvh bg-background px-5 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between border-b border-border pb-5">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Better Commerce
            </p>
            <h1 className="text-lg font-semibold tracking-tight">Admin</h1>
          </div>
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-emerald-500"
            />
            Foundation ready
          </span>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-medium text-muted-foreground">
              Phase 1
            </p>
            <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              The operational surface has a stable foundation.
            </h2>
            <p className="mt-6 max-w-[65ch] text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              This client-only application is connected to the workspace and
              ready for the authenticated Admin shell. Commerce behavior stays
              authoritative in the API.
            </p>
            <div className="mt-8">
              <Button disabled>
                <Check aria-hidden="true" />
                Foundation verified
              </Button>
            </div>
          </div>

          <div className="border-t border-border lg:border-l lg:border-t-0 lg:pl-10">
            <h3 className="sr-only">Foundation capabilities</h3>
            <ul className="divide-y divide-border">
              {foundations.map(({ detail, icon: Icon, title }) => (
                <li className="grid grid-cols-[2.5rem_1fr] gap-4 py-6" key={title}>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
