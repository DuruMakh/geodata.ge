// apps/web/lib/factQuery/topics/registry.ts
//
// Every topic adapter, one per family; each adapter task adds its entry. Build-time only: the snapshot build and tests
// import it, runtime code never does (tests/factQuery/purity.test.ts), so no loader or source file reaches /mcp.
import { educationTopicAdapter } from "./education";
import type { TopicAdapter } from "./types";

export const TOPIC_ADAPTERS: readonly TopicAdapter[] = [educationTopicAdapter];
