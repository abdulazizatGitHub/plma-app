import type { RewardDay } from "./rewards.js";

/**
 * A scored day for tests: "P" perfect, "Y" complete, "N" not complete,
 * "-" free; "Q" complete with the Prayer ring only half on time (qada).
 */
export function fakeDay(date: string, f: string, over: Partial<RewardDay> = {}): RewardDay {
  const free = f === "-";
  const complete = f === "Y" || f === "P" || f === "Q";
  return {
    date,
    due: free ? 0 : 9,
    done: complete ? 9 : 3,
    complete,
    perfect: f === "P",
    points: complete ? 6 : 2,
    prayerDue: free ? 0 : 5,
    prayerFill: complete ? (f === "Q" ? 8 : 10) : 4,
    prayerClosed: complete,
    commitDue: free ? 0 : 3,
    commitDone: complete ? 3 : 1,
    commitClosed: complete,
    balanceDue: free ? 0 : 1,
    balanceDone: complete ? 1 : 0,
    balanceClosed: complete,
    prayersOnTime: complete ? (f === "Q" ? 4 : 5) : 2,
    itemsDone: complete ? 8 : 3,
    dhuhr: free ? null : complete,
    ...over,
  };
}
