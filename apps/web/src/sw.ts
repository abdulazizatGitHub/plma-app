/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    // Detail pages are one precached shell each (/items/view?id=…): match them
    // whatever their app parameters. `_rsc` is deliberately not listed, so
    // Next's data requests never get the HTML shell.
    ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^(id|add|kind|category|parent|date|time|title|priority)$/],
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
