import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Privacy — Life" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="10 October 2026">
      <h2>What we collect</h2>
      <ul>
        <li>Your name and email address, to create and secure your account.</li>
        <li>What you add to the app: categories, tasks, habits, progress and settings.</li>
        <li>If you allow it later, an approximate location (about 1 km) to calculate prayer times.</li>
      </ul>
      <h2>How it is stored</h2>
      <ul>
        <li>Your data is kept in our database (Supabase) and copied to your device so the app works offline.</li>
        <li>Only you can read your data. Other users never see it unless you choose to share something.</li>
        <li>Signing out removes your data from that device; it stays safe in your account.</li>
      </ul>
      <h2>What we never do</h2>
      <ul>
        <li>We don&apos;t sell your data or show you ads based on it.</li>
      </ul>
      <h2>Your choices</h2>
      <ul>
        <li>You can ask us to export or delete your account and all of its data.</li>
      </ul>
    </LegalPage>
  );
}
