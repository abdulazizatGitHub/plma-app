# Branded email templates (owner pastes into Supabase)

The app verifies email with a **6-digit code**, not a link. Password reset works the same way. This was the owner's decision on 2026-10-09.

These templates show the code large, with Mehrmah branding. They use Supabase's Go-template variables:

- `{{ .Token }}`: the code
- `{{ .Email }}`: the recipient
- `{{ .Data.full_name }}`: the name entered at sign-up

| Supabase template | File | Subject |
|-------------------|------|---------|
| **Confirm signup** | [`confirm-signup.html`](./confirm-signup.html) | `Your Mehrmah code: {{ .Token }}` |
| **Reset password** | [`reset-password.html`](./reset-password.html) | `Your Mehrmah password reset code: {{ .Token }}` |
| **Change email address** | [`change-email.html`](./change-email.html) | `Confirm your new Mehrmah email: {{ .Token }}` |
| **Reauthentication** | [`reauthentication.html`](./reauthentication.html) | `Your Mehrmah security code: {{ .Token }}` |

The last two aren't used by the app yet. Pasting them in keeps every email Supabase might send on-brand, code-first, and free of links.

Each Supabase project (dev, preprod, production) has its own templates and settings. Repeat these steps for every project.

## Steps (Supabase dashboard, about 15 minutes)

0. **Connect an email sender first (required).**
   - On the Free plan, Supabase only lets you edit templates once custom SMTP is set up. Its default templates send a **link**, but the app asks for the **code**, so sign-up can't be finished without this step.
   - **Without a domain:** use a Gmail account with an App Password. A separate Gmail just for the app is best, because testers see it as the sender. Gmail sends up to about 500 emails a day.
     1. On that Google account, turn on **2-Step Verification**.
     2. Open <https://myaccount.google.com/apppasswords> and create an app password named `Supabase`. Copy the 16 characters.
     3. In Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**.
        - **Sender email:** the Gmail address
        - **Sender name:** `Mehrmah`
        - **Host:** `smtp.gmail.com`
        - **Port:** `465`
        - **Username:** the Gmail address
        - **Password:** the app password
        - **Save.**
     4. **Authentication → Rate Limits:** raise **emails sent per hour** to about 30. The limit is low until custom SMTP is on.
   - **With a domain later:** use Resend, Brevo or Amazon SES with an address on that domain. This gives better delivery and fewer spam-folder emails.
1. **Authentication → Emails → Templates**
   - **Confirm signup:**
     1. Set the **Subject** from the table above.
     2. Switch the body to **Source** and replace it with the full contents of `confirm-signup.html`.
     3. **Save.**
   - **Reset password**, **Change email address** and **Reauthentication:** do the same with their files.
2. **Authentication → Sign In / Providers → Email**
   - **Confirm email:** on.
   - **Email OTP Length:** **6**. The app's code box expects exactly 6 digits.
   - **Email OTP Expiration:** **900** seconds (15 minutes). The emails say 15 minutes.
   - **Password requirements:**
     - minimum length **8**
     - require **lowercase, uppercase, digits and symbols**

     This makes the server enforce the same rules as the app's checklist.
3. **Authentication → URL Configuration**
   - **Site URL:** the web app's address, for example `https://life-preprod.vercel.app`. Emails use it as the base for any link.
   - **Redirect URLs:** add the same address followed by `/**`. The app works with codes only, but Supabase checks this list.
4. **Test it:**
   1. Sign up in the app with a real address you can read.
   2. You should get the branded email with a 6-digit code.
   3. Enter it in the app, and you land on Today.

## Notes

- **Don't use fake or test addresses** like `@example.com` with the real sign-up form. Bounced emails can get a Supabase project's email sending restricted. Automated tests create accounts through the admin API, which sends no email.
- Supabase sends the code in the same request whether the template shows a link or a code. With these templates, only the code is shown.
