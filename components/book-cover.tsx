'use client';

import Image, { type ImageLoader } from 'next/image';
import { useState } from 'react';
import { BookOpen } from 'lucide-react';

import { cn } from '@/lib/utils';

const palettes = [
  ['#693c3a', '#b46b54'],
  ['#264c45', '#558777'],
  ['#38446c', '#6c75a5'],
  ['#6a542b', '#b1904c'],
  ['#51385f', '#8d6797'],
  ['#334a59', '#698a99'],
];

function paletteFor(value: string) {
  let hash = 0;
  for (const character of value)
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return palettes[Math.abs(hash) % palettes.length];
}

const passthroughLoader: ImageLoader = ({ src }) => src;

export function BookCover({
  title,
  author,
  coverUrl,
  className,
}: {
  title: string;
  author: string;
  coverUrl?: string | null;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (coverUrl && coverUrl !== failedUrl) {
    return (
      <div
        className={cn(
          'book-cover book-spine relative aspect-[2/3] w-full overflow-hidden rounded-r-xl rounded-l-[0.28rem] border border-white/12 bg-muted',
          className,
        )}
      >
        <Image
          src={coverUrl}
          alt={`Cover of ${title} by ${author}`}
          fill
          sizes="(max-width: 640px) 25vw, 13rem"
          loader={passthroughLoader}
          unoptimized
          className="absolute inset-0 size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(coverUrl)}
        />
      </div>
    );
  }

  const [start, end] = paletteFor(`${title}:${author}`);
  return (
    <div
      className={cn(
        'book-cover book-spine relative flex aspect-[2/3] w-full flex-col overflow-hidden rounded-r-xl rounded-l-[0.28rem] border border-white/12 p-4 text-[#fff9e9]',
        className,
      )}
      style={{ background: `linear-gradient(145deg, ${start}, ${end})` }}
      aria-label={`Cover placeholder for ${title}`}
    >
      <span className="absolute inset-y-0 left-0 w-[7%] bg-black/16 shadow-[inset_-1px_0_rgba(255,255,255,0.1)]" />
      <span className="absolute inset-x-4 top-5 h-px bg-white/24" />
      <BookOpen className="mt-5 size-5 opacity-80" aria-hidden="true" />
      <div className="mt-auto pl-1">
        <p className="line-clamp-4 font-serif text-[clamp(0.95rem,4.2vw,1.35rem)] leading-[1.02] font-semibold tracking-[-0.025em] text-balance">
          {title}
        </p>
        <p className="mt-3 line-clamp-2 text-[0.66rem] leading-4 font-medium tracking-[0.04em] text-white/72 uppercase">
          {author}
        </p>
      </div>
    </div>
  );
}
