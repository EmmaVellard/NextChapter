import {
  Compass,
  Feather,
  Flame,
  Layers3,
  Sparkles,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { TasteProfile } from '@/lib/types';

export function TasteView({
  profile,
  loading,
  onImport,
}: {
  profile: TasteProfile;
  loading: boolean;
  onImport: () => void;
}) {
  if (loading)
    return (
      <div className="mx-auto h-[560px] max-w-4xl animate-pulse rounded-[2rem] bg-card" />
    );
  if (profile.overallAverage === null) {
    return (
      <section className="mx-auto max-w-xl pt-10 text-center sm:pt-20">
        <span className="mx-auto grid size-13 place-items-center rounded-2xl bg-primary-muted text-primary">
          <Compass className="size-5" />
        </span>
        <h1 className="mt-5 font-serif text-5xl tracking-[-0.05em]">
          Your story compass starts with a few favorites
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
          A handful of strong reactions is enough to begin revealing the
          tension, scale, and emotional balance that make a story stay with you.
        </p>
        <Button className="mt-6 h-12 rounded-xl px-5" onClick={onImport}>
          <Upload /> Add recent ratings
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Your story compass
          </p>
          <h1 className="mt-2 max-w-3xl font-serif text-5xl tracking-[-0.055em] sm:text-6xl">
            What makes a story work for you
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            A closer look at the pressure, scale, ideas, and emotional balance
            that keep you turning pages.
          </p>
        </div>
        <Button
          variant="outline"
          className="h-11 rounded-xl"
          onClick={onImport}
        >
          <Upload /> Refresh profile
        </Button>
      </div>

      <article className="relative mt-8 overflow-hidden rounded-[2rem] border border-primary/25 bg-primary-muted/34 p-6 sm:p-8">
        <div className="absolute -top-20 -right-16 size-56 rounded-full bg-primary/14 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-muted text-primary">
            <Compass className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[0.13em] text-primary uppercase">
              At the heart of your taste
            </p>
            <p className="mt-3 max-w-3xl font-serif text-2xl leading-8 tracking-[-0.025em] text-foreground sm:text-[1.7rem] sm:leading-9">
              {profile.readerSummary}
            </p>
          </div>
        </div>
      </article>

      <article className="mt-4 rounded-[2rem] border border-border bg-card p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[0.13em] text-primary uppercase">
              Your ideal reading experience
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">
              The story you are looking for
            </h2>
          </div>
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
          {profile.idealStory}
        </p>
      </article>

      {profile.narrativeInsights.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {profile.narrativeInsights.map((insight, index) => (
            <article
              key={insight.label}
              className="rounded-[2rem] border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-secondary text-primary">
                  {index === 0 ? (
                    <Flame className="size-4" />
                  ) : (
                    <Feather className="size-4" />
                  )}
                </span>
                <span className="rounded-full bg-primary-muted px-2.5 py-1 text-[0.68rem] font-semibold text-primary">
                  {insight.strength}
                </span>
              </div>
              <h2 className="mt-5 font-serif text-2xl tracking-[-0.035em]">
                {insight.label}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {insight.description}
              </p>
            </article>
          ))}
        </div>
      )}

      {profile.storyBalance.length > 0 && (
        <article className="mt-4 rounded-[2rem] border border-border bg-card p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <Layers3 className="size-5 text-primary" />
            <div>
              <p className="text-xs font-semibold tracking-[0.13em] text-primary uppercase">
                The balance that works for you
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">
                How your favorite elements fit together
              </h2>
            </div>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {profile.storyBalance.map((insight) => (
              <div key={insight.title}>
                <h3 className="font-semibold">{insight.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {insight.description}
                </p>
              </div>
            ))}
          </div>
        </article>
      )}

      {profile.lessCompelling && (
        <article className="mt-4 rounded-[2rem] border border-border bg-secondary/55 p-6 sm:p-7">
          <p className="text-xs font-semibold tracking-[0.13em] text-primary uppercase">
            Better as a supporting thread
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            {profile.lessCompelling}
          </p>
        </article>
      )}
    </section>
  );
}
