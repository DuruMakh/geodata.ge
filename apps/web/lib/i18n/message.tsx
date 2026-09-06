import { Fragment, type ReactNode } from "react";
import { message } from "./messages";
import type { Messages } from "./types";

// Full sentences can reorder translated text without losing styled numbers or links.
export function Message({ messages, id, values }: { messages: Messages; id: string; values: Readonly<Record<string, ReactNode>> }) {
  message(messages, id, Object.fromEntries(Object.keys(values).map(key => [key, ""])));
  return messages[id].split(/(\{[A-Za-z][A-Za-z0-9_]*\})/g).map((part, index) => {
    const parameter = /^\{([A-Za-z][A-Za-z0-9_]*)\}$/.exec(part);
    return <Fragment key={index}>{parameter ? values[parameter[1]] : part}</Fragment>;
  });
}
