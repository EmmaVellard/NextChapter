import { afterEach, describe, expect, it, vi } from 'vitest';

import { findByIsbn, findByTitleAuthor } from '@/lib/google-books';

afterEach(() => vi.unstubAllGlobals());

describe('Google Books fallback', () => {
  it('looks a book up by ISBN and maps the fields the app uses', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'abc123',
              volumeInfo: {
                title: 'A Known Book',
                subtitle: 'A subtitle',
                description: 'A traveler discovers a hidden city.',
                categories: ['Fiction / Fantasy'],
                publisher: 'Example Press',
                publishedDate: '2020-03-01',
                pageCount: 321,
                imageLinks: {
                  thumbnail: 'http://books.google.com/books/content?id=abc123&zoom=1',
                },
                infoLink: 'https://books.google.com/books?id=abc123',
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const match = await findByIsbn('9781234567890');

    const requested = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(requested).toContain('isbn:9781234567890');
    expect(match).toMatchObject({
      providerKey: 'abc123',
      sourceUrl: 'https://books.google.com/books?id=abc123',
      coverUrl: 'https://books.google.com/books/content?id=abc123&zoom=2',
      subtitle: 'A subtitle',
      synopsis: 'A traveler discovers a hidden city.',
      subjects: ['Fiction / Fantasy'],
      publishers: ['Example Press'],
      firstPublishYear: 2020,
      pageCount: 321,
    });
  });

  it('searches by title and author when there is no ISBN', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [{ volumeInfo: { title: 'Match' } }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await findByTitleAuthor('A Known Book', 'Known Author');

    const requested = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(requested).toContain('intitle:"A Known Book"');
    expect(requested).toContain('inauthor:"Known Author"');
  });

  it('returns null when nothing matches', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await findByIsbn('0000000000')).toBeNull();
  });
});
