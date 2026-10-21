/**
 * `Promise.all` over an object: each name resolves to its own promise's value. Unlike destructuring a long array of
 * results by position, a swapped pair cannot pass the typecheck unnoticed when the results share one shape.
 */
export async function awaitNamed<T extends Record<string, Promise<unknown>>>(promises: T): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const entries = Object.entries(promises);
  const values = await Promise.all(entries.map(([, promise]) => promise));
  return Object.fromEntries(entries.map(([name], index) => [name, values[index]])) as { [K in keyof T]: Awaited<T[K]> };
}
