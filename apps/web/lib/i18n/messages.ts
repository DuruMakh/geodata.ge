import type { Messages, TemplateValues } from "./types";

export function message(messages: Messages, key: string, values: TemplateValues = {}): string {
  const template = Object.hasOwn(messages, key) ? messages[key] : undefined;
  if (!template?.trim()) throw new Error(`Missing translation: ${key}`);
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_, name: string) => {
    if (!Object.hasOwn(values, name)) throw new Error(`Missing parameter ${name} for translation ${key}`);
    return String(values[name]);
  });
}
