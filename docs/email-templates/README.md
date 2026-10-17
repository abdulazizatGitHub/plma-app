# Branded email templates (owner pastes into Supabase)

The app verifies email with a **6-digit code**, not a link. Password reset works the same way. This was the owner's decision on 2026-10-09.

These templates show the code large, with Life branding. They use Supabase's Go-template variables:

- `{{ .Token }}`: the code
- `{{ .Email }}`: the recipient
- `{{ .Data.full_name }}`: the name entered at sign-up

| Supabase template | File | Subject |
|-------------------|------|---------|
| **Confirm signup** | [`confirm-signup.html`](./confirm-signup.html) | `Your Life code: {{ .Token }}` |
| **Reset password** | [`reset-password.html`](./reset-password.html) | `Your Life password reset code: {{ .Token }}` |
| **Change email address** | [`change-email.html`](./change-email.html) | `Confirm your new Life email: {{ .Token }}` |
| **Reauthentication** | [`reauthentication.html`](./reauthentication.html) | `Your Life security code: {{ .Token }}` |

The last two aren't used by the app yet. Pasting them in keeps every email Supabase might send on-brand, code-first, and free of links.

Each Supabase project (dev, preprod, production) has its own templates and settings. Repeat these steps for every project.

## Steps (Supabase dashboard, about 5 minutes)

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
4. **(Recommended before real users) Authentication → Emails → SMTP Settings.**
   - Connect a sending service (Brevo, Resend, or Amazon SES all have free tiers). Set the sender name to **Life** and use an address on your own domain.
   - Supabase's built-in sender is limited to a few emails per hour and may land in spam.
5. **Test it:**
   1. Sign up in the app with a real address you can read.
   2. You should get the branded email with a 6-digit code.
   3. Enter it in the app, and you land on Today.

## Notes

- **Don't use fake or test addresses** like `@example.com` with the real sign-up form. Bounced emails can get a Supabase project's email sending restricted. Automated tests create accounts through the admin API, which sends no email.
- Supabase sends the code in the same request whether the template shows a link or a code. With these templates, only the code is shown.
