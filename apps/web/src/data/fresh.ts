import type { Graph, Person, Release } from "./model";
import { SEED } from "./seed";

export const MODULE_COLORS = ["#e5582b", "#3866c9", "#2f8f46", "#d48a1c", "#1f8a8a", "#b5401b", "#5a6fd6", "#8a6a3a"];

export const MODULE_SUGGESTIONS = ["Payments", "Auth", "Dashboard", "Onboarding", "Notifications", "Settings", "Search", "Admin", "Mobile app", "API"];

export type FreshInput = {
  productName: string;
  modules: string[];
  release: Pick<Release, "version" | "name" | "date">;
  owner: Person;
};

/** A brand-new product: modules, one current version, nothing else yet. Miscellaneous is always there. */
export function freshGraph(i: FreshInput): Graph {
  const modules = i.modules.map((name, k) => ({ id: `m-${k + 1}`, name, color: MODULE_COLORS[k % MODULE_COLORS.length] }));
  return {
    product: { id: "prod", name: i.productName || "My product" },
    people: [i.owner],
    modules: [...modules, { id: "m-misc", name: "Miscellaneous", color: "#7a7365", misc: true }],
    releases: [{ id: "r-1", version: i.release.version || "v1.0", name: i.release.name || "First release", date: i.release.date, state: "current" }],
    features: [],
    tickets: [],
    bugs: [],
    comments: [],
    activity: [],
  };
}

/** The sample product, with the new owner added to the team so they can play with it. */
export function sampleGraph(owner: Person, productName?: string): Graph {
  return {
    ...SEED,
    product: { ...SEED.product, name: productName || SEED.product.name },
    people: SEED.people.some((p) => p.id === owner.id) ? SEED.people : [owner, ...SEED.people],
  };
}

export const graphKey = (workspaceId: string) => `zelo-graph-${workspaceId}`;
