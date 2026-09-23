import { vi } from "vitest";

// `server-only` throws from its client entry, and Vitest resolves it that way
// because it does not set the react-server export condition. The package is a
// build-time guard against importing a server module into a client bundle;
// under Vitest it has nothing to guard, so it is a no-op here. Without this,
// every test that renders a page reaching a *.server.ts catalogue — the site
// footer's, for instance — fails on the import.
vi.mock("server-only", () => ({}));
