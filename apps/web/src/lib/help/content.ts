/*
 * The app guide (owner, 2026-10-17). One source for the in-app Help page and
 * docs/guides/USER_GUIDE.md (`npm run docs:guide -w web`). Plain sentences;
 * **bold** marks a button or label as it appears in the app.
 */

export type HelpArticle = { id: string; q: string; a: string[] };
export type HelpSection = { id: string; title: string; icon: "start" | "today" | "add" | "prayer" | "plan" | "bell" | "progress" | "friends" | "groups" | "privacy" | "offline" | "install"; articles: HelpArticle[] };

export const HELP: HelpSection[] = [
  {
    id: "start",
    title: "Getting started",
    icon: "start",
    articles: [
      {
        id: "what",
        q: "What is Life?",
        a: [
          "Life keeps your prayers, habits, tasks and plans in one calm place. Each day is summed up by three rings — Prayer, Commitments and Balance — and friends and groups help you keep going.",
          "Everything works offline. Changes are saved on your device first and sync when you're back online.",
        ],
      },
      {
        id: "account",
        q: "Signing up and signing in",
        a: [
          "Sign up with your name, email and a password. We email you a **6-digit code** — enter it to confirm your account. The code is valid for 15 minutes; tap **Resend code** if it expires.",
          "Forgot your password? On the sign-in screen tap **Forgot password**, enter the code we email you, then choose a new password.",
        ],
      },
      {
        id: "setup",
        q: "The first-time setup",
        a: [
          "After signing up, a short guide walks you through: a quick intro, your name and **@username**, your prayer location and when your day ends, your interests (each becomes a category) and suggested items — nothing is added unless you tick it.",
          "Last, you can turn on reminders and install the app, then a short tour shows you around Today. You can replay the tour any time from **Profile → Help → Replay the tour**.",
        ],
      },
    ],
  },
  {
    id: "today",
    title: "Today and your rings",
    icon: "today",
    articles: [
      {
        id: "rings",
        q: "What do the three rings mean?",
        a: [
          "**Prayer** fills with the five daily prayers. A qada prayer fills half a segment and still closes the ring.",
          "**Commitments** fills with everything required today (not prayers). **Balance** closes when every area (category) with something due gets at least one thing done.",
          "Close every ring that applies and the day is **complete** — that grows your streak. A ring with nothing due is free and doesn't count.",
        ],
      },
      {
        id: "marking",
        q: "Marking things done",
        a: [
          "Tap the circle to finish an item. For counts and minutes, use **−** and **+** (or tap the number to type it). A checklist expands so you can tick each step.",
          "**⋯** on any row lets you skip it, move it to another day, set a reminder, snap it to friends once done, or edit it.",
        ],
      },
      {
        id: "days",
        q: "Yesterday, other days and fixing mistakes",
        a: [
          "Use the week strip to open any day. You can fix a day for **two days after it ends** — changes then are marked late. After that the day is closed and final, except recovering a missed prayer as qada.",
          "Your day ends at midnight unless you choose later in **Profile → My day ends at** (up to 4 AM, for night owls).",
        ],
      },
    ],
  },
  {
    id: "add",
    title: "Adding and organising",
    icon: "add",
    articles: [
      {
        id: "add",
        q: "Adding a task or habit",
        a: [
          "Tap **+**. Type a title, pick the day, and you're done. **More options** lets you make a repeating habit, a count (like 10,000 steps), minutes, a checklist or a routine with sub-items.",
          "Undated tasks go to **Pending** until you give them a day.",
        ],
      },
      {
        id: "categories",
        q: "Categories",
        a: ["Categories group your items (Physical, Mental, Spiritual…). Open **Categories** to rename, recolour, reorder or archive them, or **Add from starter packs** for new ones with suggestions."],
      },
      {
        id: "priority",
        q: "Importance and optional items",
        a: ["Each item has an importance — low, medium, high or critical. It sets how many points the item earns and how persistently reminders nudge you. **Optional** items never count against you, but still earn points when done."],
      },
    ],
  },
  {
    id: "prayer",
    title: "Prayers",
    icon: "prayer",
    articles: [
      {
        id: "times",
        q: "Prayer times and location",
        a: [
          "Times are calculated for where you are (Karachi method and Hanafi Asr by default — change them in **Profile → Prayer settings**). Until you set a location, times are for Karachi.",
          "You can nudge each prayer by a few minutes or set a fixed time to match your mosque.",
        ],
      },
      {
        id: "qada",
        q: "Marking prayers, qada and missed",
        a: [
          "Tap a prayer once you've prayed it, in any order. Hold it (or use **⋯**) for **prayed late (qada)** or **missed**. On yesterday's page, tapping a prayer asks whether it was on time or qada — nothing is assumed.",
          "Isha stays on time until Fajr: after midnight, yesterday's Isha appears on Today so you can still mark it.",
        ],
      },
      {
        id: "hijri",
        q: "Hijri date",
        a: ["Seasonal awards like Ramadan use the Hijri calendar. If your month starts a day earlier or later than Makkah's, adjust it in **Profile → Prayer settings → Hijri date**."],
      },
    ],
  },
  {
    id: "plans",
    title: "Plans",
    icon: "plan",
    articles: [
      {
        id: "plans",
        q: "Plans and steps",
        a: [
          "A plan is a project made of dated steps — a course, a content series, a trip. Each step appears on Today on its date, with the plan shown as context.",
          "A step can **wait for** another; it stays locked until that one is done. Cadence rules warn you when steps are planned too close together.",
        ],
      },
    ],
  },
  {
    id: "reminders",
    title: "Reminders",
    icon: "bell",
    articles: [
      {
        id: "on",
        q: "Turning reminders on",
        a: [
          "Go to **Profile → Reminders** and tap **Turn on**. Your browser asks for permission once. On iPhone, install Life to your Home Screen first — iPhones only send reminders to installed apps.",
          "Each item reminds you according to its importance; you can set a custom time, repeat and snooze per item. Quiet hours and the global switch are in the same place.",
        ],
      },
      {
        id: "notification",
        q: "Done and Snooze on a notification",
        a: ["Notifications have **Done** and **Snooze** buttons — Done marks the item finished without opening the app."],
      },
    ],
  },
  {
    id: "progress",
    title: "Progress, streaks and awards",
    icon: "progress",
    articles: [
      {
        id: "points",
        q: "Points and levels",
        a: [
          "Done items earn points by importance: low 1, medium 2, high 3, critical 5. Qada earns half. A perfect day (every ring closed, nothing fixed late) adds +10. Fixes made after the day earn nothing, but still count in your history.",
          "Points build your level. Points are worked out on the server from what you logged, so they can't be gamed by syncing twice.",
        ],
      },
      {
        id: "streak",
        q: "Streaks and freezes",
        a: ["Your streak counts complete days in a row; days with nothing due don't break it. Every 7 days earns a **freeze** (hold up to 2) that covers a day you couldn't finish. A new streak never erases your best."],
      },
      {
        id: "awards",
        q: "Awards and the monthly challenge",
        a: [
          "Awards are for streaks, perfect weeks and months, milestones, seasonal days (like Ramadan), group goals and leaderboard medals. See them all in **Progress → All awards** — tap one you've earned to share it.",
          "Each month you get a personal challenge for the ring with most room to grow.",
        ],
      },
    ],
  },
  {
    id: "friends",
    title: "Friends and snaps",
    icon: "friends",
    articles: [
      {
        id: "add",
        q: "Adding friends",
        a: ["Open **Friends** (from Profile or the account menu). Share your invite link — anyone who opens it can sign up and becomes your friend — or add someone by their **@username**."],
      },
      {
        id: "snaps",
        q: "Snaps and friend streaks",
        a: [
          "Tap the send icon at the top or **Snap** on Today's card to send today's rings to friends. You can also snap an item you've finished, a streak or an award.",
          "Snaps open once, full-screen, with **Kudos** and **Snap back**. Snap each other every day to keep a streak together (the flame and its number) — an hourglass means it ends within a few hours.",
        ],
      },
      {
        id: "leaderboard",
        q: "Leaderboards",
        a: ["**Progress → Leaderboard** ranks you with friends, everyone (if you've chosen to appear) or your groups, by points for the week or month. The top three earn medals."],
      },
    ],
  },
  {
    id: "groups",
    title: "Groups",
    icon: "groups",
    articles: [
      {
        id: "groups",
        q: "Groups and group goals",
        a: [
          "Create a group for family, a class or a circle, and invite friends or share the group link. Admins set goals — **each member** (everyone reaches the target) or **together** (the group adds up to it) — by days, counts or minutes, for a week, a month or chosen dates.",
          "Each goal appears on every member's Today, tagged with the group's name; log it as usual. Meeting a goal earns an award; a met together goal also gives each contributor +10 points.",
          "Tap **Snap the group** to check in — the group streak grows on days everyone checks in.",
        ],
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    icon: "privacy",
    articles: [
      {
        id: "who",
        q: "Who sees what",
        a: [
          "Others never see your items. Depending on **Who can see my progress** (Everyone, Friends, Selected friends or Only me) they see only your name, points, streak and awards. Group members also see your progress on that group's goals.",
          "Anything you snap goes only to the friends you pick. Blocking someone hides you from each other and isn't announced.",
        ],
      },
    ],
  },
  {
    id: "offline",
    title: "Offline and sync",
    icon: "offline",
    articles: [
      {
        id: "offline",
        q: "Using Life offline",
        a: [
          "Everything you do is saved on this device first, so Today works without a connection. The cloud icon at the top shows sync; tap it to sync now. Friends, snaps and leaderboards need a connection and show their last copy offline.",
          "Signing out removes your data from this device; it stays safe in your account.",
        ],
      },
    ],
  },
  {
    id: "install",
    title: "Installing the app",
    icon: "install",
    articles: [
      {
        id: "iphone",
        q: "iPhone and iPad",
        a: ["Open Life in **Safari**, tap **Share** (on newer iPhones it's under **⋯**), choose **Add to Home Screen**, then **Add**. Open Life from your Home Screen — reminders and offline use now work. In other browsers on iPhone, open the page in Safari first."],
      },
      {
        id: "android",
        q: "Android",
        a: ["In Chrome, tap **Install** on the banner at the top, or the menu **⋮ → Install app** (or **Add to Home screen**), then **Install**."],
      },
      {
        id: "computer",
        q: "Computer",
        a: ["In Chrome or Edge, click the install icon at the right of the address bar, then **Install**. On a Mac with Safari: **File → Add to Dock**."],
      },
    ],
  },
];

/** Lowercase text of an article, for search. */
export const searchText = (s: HelpSection, a: HelpArticle) => `${s.title} ${a.q} ${a.a.join(" ")}`.toLowerCase().replace(/\*\*/g, "");
