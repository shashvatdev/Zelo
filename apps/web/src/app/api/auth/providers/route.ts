import { config } from "@/server/config";
import { json, route } from "@/server/http";

export const GET = route(async () => json({ google: !!config.google, devMailbox: config.devMailbox, demo: config.demoEnabled }));
