'use client';

import { useState } from 'react';
import { BarChart3, CalendarDays, Trophy } from 'lucide-react';

import { RankingView } from '@/components/ranking-view';
import { TasteView } from '@/components/taste-view';
import { YearView } from '@/components/year-view';
import type { BookMetadataMap, BookRecord, TasteProfile } from '@/lib/types';

type Insight = 'profile' | 'years' | 'ranking';

const sections: Array<{
  id: Insight;
  label: string;
  icon: typeof BarChart3;
}> = [
  { id: 'profile', label: 'Reader profile', icon: BarChart3 },
  { id: 'years', label: 'Reading years', icon: CalendarDays },
  { id: 'ranking', label: 'Book ranking', icon: Trophy },
];

export function InsightsView({
  books,
  metadata,
  profile,
  rankingOrder,
  loading,
  onImport,
  onRankingOrderChange,
}: {
  books: BookRecord[];
  metadata: BookMetadataMap;
  profile: TasteProfile;
  rankingOrder: string[];
  loading: boolean;
  onImport: () => void;
  onRankingOrderChange: (ids: string[]) => Promise<void>;
}) {
  const [section, setSection] = useState<Insight>('profile');

  return (
    <div>
      <nav
        aria-label="Insights sections"
        className="mx-auto mb-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-border bg-card/80 p-1"
      >
        {sections.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSection(item.id)}
              className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary-muted text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <Icon className="size-4" /> {item.label}
            </button>
          );
        })}
      </nav>

      {section === 'profile' && (
        <TasteView profile={profile} loading={loading} onImport={onImport} />
      )}
      {section === 'years' && (
        <YearView
          books={books}
          metadata={metadata}
          loading={loading}
          onImport={onImport}
        />
      )}
      {section === 'ranking' && (
        <RankingView
          books={books}
          metadata={metadata}
          rankingOrder={rankingOrder}
          loading={loading}
          onImport={onImport}
          onRankingOrderChange={onRankingOrderChange}
        />
      )}
    </div>
  );
}
