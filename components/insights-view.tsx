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
        className="mb-8 flex max-w-full gap-6 overflow-x-auto border-b border-border"
      >
        {sections.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSection(item.id)}
              className={`relative flex min-h-11 shrink-0 items-center text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/55 focus-visible:outline-none ${
                active
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-primary'
              }`}
            >
              {item.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="bg-primary absolute inset-x-0 -bottom-px h-px rounded-full"
                />
              )}
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
