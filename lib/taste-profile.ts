import {
  decadeFor,
  genreLabel,
  genresForBook,
  lengthBand,
  storyTraitsForBook,
} from '@/lib/book-features';
import type {
  BookMetadataMap,
  BookRecord,
  NarrativeInsight,
  StoryBalanceInsight,
  TasteDimension,
  TasteProfile,
  TasteSignal,
} from '@/lib/types';

type Feature = { dimension: TasteDimension; value: string };

const priors: Record<TasteDimension, number> = {
  story: 5,
  author: 3,
  genre: 5,
  decade: 6,
  length: 6,
};

const minimumSamples: Record<TasteDimension, number> = {
  story: 3,
  author: 2,
  genre: 3,
  decade: 4,
  length: 4,
};

const narrativeDescriptions: Record<string, string> = {
  'Dark & intense':
    'You respond to genuine pressure: difficult choices, uneasy atmospheres, and consequences that cannot be tidied away too easily.',
  'Speculative & futuristic':
    'Imagined societies and altered futures hold your attention when the central idea changes how people live, choose, and survive.',
  'Epic & sweeping':
    'You enjoy stories that open outward through layered worlds, long arcs, journeys, and stakes that grow beyond one person.',
  'Political & social':
    'Power, hierarchy, rebellion, and the rules holding a society together add welcome depth to the central conflict.',
  'Mystery-led':
    'Secrets and gradual revelation work for you when each answer changes the meaning or danger of what came before.',
  'Adventure-led':
    'Forward motion matters: obstacles, discovery, and survival give the story a strong sense of purpose.',
  'Mythic & folkloric':
    'You appreciate stories with an older resonance, where symbols, legends, and wonder make the world feel larger than the plot.',
  'Coming-of-age':
    'Transformation interests you when growing into a new self carries a real cost and changes the character’s place in the world.',
  Historical:
    'A vivid sense of time and place becomes compelling when history actively shapes the choices available to the characters.',
  Romantic:
    'Emotional chemistry adds energy when desire, trust, and vulnerability complicate the larger story.',
  'Family & relationships':
    'Loyalty, belonging, and difficult bonds matter most when they force characters to choose what they owe one another.',
  Humorous:
    'Wit and tonal lightness give you breathing room, especially when humor reveals character rather than dissolving the stakes.',
};

const idealElements: Record<string, string> = {
  'Dark & intense': 'costly choices',
  'Speculative & futuristic': 'an unfamiliar world with rules that matter',
  'Epic & sweeping': 'stakes that keep widening',
  'Political & social': 'power structures under strain',
  'Mystery-led': 'secrets that genuinely change the story',
  'Adventure-led': 'a clear sense of forward motion',
  'Mythic & folkloric': 'mythic resonance and wonder',
  'Coming-of-age': 'a transformation that comes at a price',
  Historical: 'a setting that shapes every choice',
  Romantic: 'emotional tension with consequences',
  'Family & relationships': 'bonds tested by difficult loyalties',
  Humorous: 'wit that reveals character',
};

export function featuresForBook(
  book: BookRecord,
  metadata: BookMetadataMap = {},
): Feature[] {
  const features: Feature[] = [{ dimension: 'author', value: book.author }];
  for (const story of storyTraitsForBook(book, metadata)) {
    features.push({ dimension: 'story', value: story });
  }
  for (const genre of genresForBook(book, metadata)) {
    features.push({ dimension: 'genre', value: genreLabel(genre) });
  }
  const decade = decadeFor(book);
  if (decade) features.push({ dimension: 'decade', value: decade });
  const length = lengthBand(
    book.pageCount ?? metadata[book.id]?.pageCount ?? null,
  );
  if (length) features.push({ dimension: 'length', value: length });
  return features;
}

function naturalList(values: string[]) {
  if (values.length < 2) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function buildNarrativeProfile(
  favoriteStoryTypes: TasteSignal[],
  weakest: TasteSignal[],
) {
  const positive = favoriteStoryTypes.filter((signal) => signal.delta > 0);
  const leading = (positive.length > 0 ? positive : favoriteStoryTypes).slice(
    0,
    4,
  );
  const labels = new Set(leading.map((signal) => signal.value));
  const lowerStorySignals = weakest
    .filter((signal) => signal.dimension === 'story')
    .slice(0, 3);
  const lowerLabels = new Set(lowerStorySignals.map((signal) => signal.value));
  const narrativeInsights: NarrativeInsight[] = leading.map((signal) => ({
    label: signal.value,
    strength:
      signal.delta >= 0.24
        ? 'Core pull'
        : signal.delta >= 0.1
          ? 'Strong pull'
          : 'Supporting pull',
    description:
      narrativeDescriptions[signal.value] ??
      'This kind of narrative repeatedly adds something valuable to your reading experience.',
  }));

  const summary: string[] = [];
  if (labels.has('Epic & sweeping') && labels.has('Speculative & futuristic')) {
    summary.push(
      'You like stories that open into large imagined worlds, but spectacle alone is not enough.',
    );
  } else if (labels.has('Epic & sweeping')) {
    summary.push(
      'You are happiest when a story opens outward, building momentum and widening its stakes as it goes.',
    );
  } else if (labels.has('Speculative & futuristic')) {
    summary.push(
      'You are drawn to imagined worlds whose rules reshape everyday life rather than merely decorate the plot.',
    );
  }
  if (labels.has('Dark & intense')) {
    summary.push(
      'Your attention sharpens when choices are costly, the atmosphere carries weight, and victory cannot arrive without consequence.',
    );
  }
  if (labels.has('Political & social')) {
    summary.push(
      'Private decisions become especially compelling when they expose power, hierarchy, or a society beginning to fracture.',
    );
  } else if (labels.has('Mystery-led')) {
    summary.push(
      'You want discovery to do more than solve a puzzle: each revelation should alter the emotional or moral stakes.',
    );
  } else if (labels.has('Adventure-led')) {
    summary.push(
      'You also value strong forward motion, with each obstacle changing the characters as well as the destination.',
    );
  }
  if (summary.length === 0 && leading[0]) {
    summary.push(narrativeDescriptions[leading[0].value]);
  }

  const elements = leading
    .map((signal) => idealElements[signal.value])
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);
  const idealStory = elements.length
    ? `Your sweet spot is a story built around ${naturalList(elements)}. It should make the world’s design matter, keep the characters emotionally exposed, and allow every escalation to reveal something about who they are.`
    : 'Your sweet spot is a story with meaningful choices, a distinct atmosphere, and characters who are changed by what the plot asks of them.';

  const storyBalance: StoryBalanceInsight[] = [];
  if (
    labels.has('Speculative & futuristic') &&
    labels.has('Political & social')
  ) {
    storyBalance.push({
      title: 'Ideas need consequences',
      description:
        'A clever premise becomes satisfying when it changes power, society, or survival—not when it remains background scenery.',
    });
  }
  if (labels.has('Epic & sweeping') && labels.has('Dark & intense')) {
    storyBalance.push({
      title: 'Scale needs pressure',
      description:
        'Large worlds work best for you when the conflict stays personal enough to hurt and every expansion raises the emotional cost.',
    });
  }
  if (
    (lowerLabels.has('Romantic') ||
      lowerLabels.has('Family & relationships')) &&
    leading.length > 0
  ) {
    storyBalance.push({
      title: 'Emotion inside momentum',
      description:
        'Relationships seem strongest when they intensify the central struggle, expose a vulnerability, or make a difficult choice harder.',
    });
  }
  if (labels.has('Mystery-led') && labels.has('Dark & intense')) {
    storyBalance.push({
      title: 'Revelations must change the stakes',
      description:
        'Suspense holds longer when an answer creates a moral problem or emotional rupture instead of simply closing a puzzle.',
    });
  }
  if (storyBalance.length === 0 && leading[0]) {
    storyBalance.push({
      title: 'Atmosphere with purpose',
      description:
        'The mood of a story matters most when it shapes choices, relationships, and the direction of the plot.',
    });
  }

  const lowerNames = lowerStorySignals.map((signal) =>
    signal.value === 'Romantic'
      ? 'romance'
      : signal.value === 'Coming-of-age'
        ? 'personal maturation'
        : signal.value === 'Family & relationships'
          ? 'family bonds'
          : signal.value.toLowerCase(),
  );
  const lessCompelling = lowerNames.length
    ? `${naturalList(lowerNames)} seem to work better for you as supporting currents than as the entire engine of a story. They may become more compelling when they sharpen a larger conflict or force a difficult choice.`
    : null;

  return {
    readerSummary: summary.join(' '),
    idealStory,
    narrativeInsights,
    storyBalance: storyBalance.slice(0, 3),
    lessCompelling,
  };
}

export function buildTasteProfile(
  books: BookRecord[],
  metadata: BookMetadataMap = {},
): TasteProfile {
  const rated = books.filter((book) => book.myRating !== null);
  if (rated.length === 0) {
    return {
      overallAverage: null,
      ratedBookCount: 0,
      signals: [],
      strongest: [],
      weakest: [],
      favoriteAuthors: [],
      favoriteGenres: [],
      favoriteStoryTypes: [],
      readerSummary:
        'A few strong reactions are enough to begin revealing what makes a story stay with you.',
      idealStory:
        'Your ideal story will take shape as you mark more finished books as favorites.',
      narrativeInsights: [],
      storyBalance: [],
      lessCompelling: null,
    };
  }

  const overallAverage =
    rated.reduce((sum, book) => sum + (book.myRating ?? 0), 0) / rated.length;
  const groups = new Map<string, { feature: Feature; ratings: number[] }>();

  for (const book of rated) {
    for (const feature of featuresForBook(book, metadata)) {
      const key = `${feature.dimension}:${feature.value.toLowerCase()}`;
      const group = groups.get(key) ?? { feature, ratings: [] };
      group.ratings.push(book.myRating as number);
      groups.set(key, group);
    }
  }

  const signals = Array.from(groups.values())
    .map<TasteSignal>(({ feature, ratings }) => {
      const average =
        ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
      const confidence =
        ratings.length / (ratings.length + priors[feature.dimension]);
      return {
        ...feature,
        sampleSize: ratings.length,
        average,
        delta: (average - overallAverage) * confidence,
        confidence,
      };
    })
    .filter((signal) => signal.sampleSize >= minimumSamples[signal.dimension]);

  const strongest = signals
    .filter((signal) => signal.delta > 0.08)
    .sort((a, b) => b.delta - a.delta || b.sampleSize - a.sampleSize)
    .slice(0, 6);
  const weakest = signals
    .filter((signal) => signal.delta < -0.08)
    .sort((a, b) => a.delta - b.delta || b.sampleSize - a.sampleSize)
    .slice(0, 4);
  const favorites = (dimension: TasteDimension) =>
    signals
      .filter((signal) => signal.dimension === dimension)
      .sort((a, b) => b.delta - a.delta || b.sampleSize - a.sampleSize)
      .slice(0, 4);
  const favoriteAuthors = favorites('author');
  const favoriteGenres = favorites('genre');
  const favoriteStoryTypes = favorites('story');
  const narrativeProfile = buildNarrativeProfile(favoriteStoryTypes, weakest);

  return {
    overallAverage,
    ratedBookCount: rated.length,
    signals,
    strongest,
    weakest,
    favoriteAuthors,
    favoriteGenres,
    favoriteStoryTypes,
    ...narrativeProfile,
  };
}
