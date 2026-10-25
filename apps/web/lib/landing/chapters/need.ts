/** A chapter's `need(value, what)`: the value, or an error naming the chapter and the missing data. */
export function chapterNeed(chapter: string) {
  return function need<T>(value: T | undefined, what: string): T {
    if (value === undefined) throw new Error(`${chapter}: no data for ${what}`);
    return value;
  };
}
