import { useMemo } from 'react';
import {
  BarChart3,
  Compass,
  Feather,
  Flame,
  Layers3,
  Scale,
  Sparkles,
  Tags,
  Upload,
  UserRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { feedbackAlignment } from '@/lib/recommendation-diagnostics';
import type {
  BookMetadataMap,
  BookRecord,
  RecommendationFeedback,
  TasteProfile,
  TasteSignal,
} from '@/lib/types';

export function TasteView({
  profile,
  books,
  metadata,
  feedback,
  loading,
  onImport,
}: {
  profile: TasteProfile;
  books: BookRecord[];
  metadata: BookMetadataMap;
  feedback: RecommendationFeedback[];
  loading: boolean;
  onImport: () => void;
}) {
  const alignment = useMemo(
    () => feedbackAlignment({ feedback, books, profile, metadata }),
    [feedback, books, profile, metadata],
  );
  if (loading)
    return (
      <div className="mx-auto h-[560px] max-w-5xl animate-pulse rounded-sm bg-card" />
    );
  if (profile.overallAverage === null) {
    return (
      <section className="mx-auto max-w-xl pt-10 text-center sm:pt-20">
        <span className="mx-auto grid size-13 place-items-center rounded-2xl bg-primary-muted text-primary">
          <Compass className="size-5" />
        </span>
        <h1 className="editorial-title mt-5">
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
    <section className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your story compass</p>
          <h1 className="editorial-title mt-2 max-w-3xl">
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

      {/* buildTasteProfile joins an empty list into an empty string when a
          library has ratings but no catalog subjects yet, which rendered this
          panel as a blank coloured band. */}
      {profile.readerSummary.trim() && (
        <article className="relative mt-8 border-t-2 border-primary/30 bg-primary-muted/30 p-6 sm:p-8">
          <div className="relative flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-muted text-primary">
              <Compass className="size-5" />
            </span>
            <div>
              <p className="eyebrow">At the heart of your taste</p>
              <p className="mt-3 max-w-3xl font-serif text-2xl leading-8 tracking-[-0.025em] text-foreground sm:text-[1.7rem] sm:leading-9">
                {profile.readerSummary}
              </p>
            </div>
          </div>
        </article>
      )}

      <article className="mt-8 border-t border-border py-6 sm:py-7">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="eyebrow">Your ideal reading experience</p>
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
              className="border-t border-border py-6"
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
        <article className="mt-8 border-t border-border py-6 sm:py-7">
          <div className="flex items-center gap-3">
            <Layers3 className="size-5 text-primary" />
            <div>
              <p className="eyebrow">The balance that works for you</p>
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
        <article className="mt-8 border-t border-border py-6 sm:py-7">
          <p className="eyebrow">Better as a supporting thread</p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            {profile.lessCompelling}
          </p>
        </article>
      )}

      {(profile.favoriteGenres.length > 0 ||
        profile.favoriteAuthors.length > 0) && (
        <section className="mt-10 border-t border-border pt-8">
          <div className="flex items-center gap-3">
            <BarChart3 className="size-5 text-primary" />
            <div>
              <p className="eyebrow">Reading statistics</p>
              <h2 className="mt-1 font-serif text-3xl tracking-[-0.04em]">
                A few familiar landmarks
              </h2>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <TasteStats
              title="Genres you rate highest"
              icon={Tags}
              signals={profile.favoriteGenres}
            />
            <TasteStats
              title="Authors that stand out"
              icon={UserRound}
              signals={profile.favoriteAuthors}
            />
          </div>
        </section>
      )}

      {alignment && (
        <article className="mt-8 border-t border-border py-6 sm:py-7">
          <div className="flex items-center gap-3">
            <Scale className="size-5 text-primary" />
            <div>
              <p className="eyebrow">Feedback check</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">
                Does the taste model track what you actually pick
              </h2>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {alignment.aligned ? (
              <>
                Books you asked for more of score higher on your taste model
                (avg {alignment.likedAverage.toFixed(2)} across{' '}
                {alignment.likedCount}) than the ones you passed on (avg{' '}
                {alignment.passedAverage.toFixed(2)} across{' '}
                {alignment.passedCount}) — the scoring is tracking your actual
                choices.
              </>
            ) : (
              <>
                Books you asked for more of (avg{' '}
                {alignment.likedAverage.toFixed(2)} across{' '}
                {alignment.likedCount}) are scoring about the same as the ones
                you passed on (avg {alignment.passedAverage.toFixed(2)} across{' '}
                {alignment.passedCount}). The taste model may need more
                ratings, or those choices were about length or mood rather
                than taste.
              </>
            )}
          </p>
        </article>
      )}
    </section>
  );
}

function TasteStats({
  title,
  icon: Icon,
  signals,
}: {
  title: string;
  icon: typeof Tags;
  signals: TasteSignal[];
}) {
  return (
    <article className="border-t border-border py-6">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="mt-5 space-y-3">
        {signals.map((signal) => (
          <div
            key={`${signal.dimension}:${signal.value}`}
            className="flex items-center justify-between gap-4 rounded-xl bg-background/40 px-4 py-3"
          >
            <p className="font-medium">{signal.value}</p>
            <p className="shrink-0 text-right text-xs text-muted-foreground">
              {signal.average.toFixed(2)} average
              <span className="block">
                {signal.sampleSize} rated{' '}
                {signal.sampleSize === 1 ? 'book' : 'books'}
              </span>
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
