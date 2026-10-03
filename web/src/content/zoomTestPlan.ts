export const zoomTestPlanContent = {
  pageTitle: 'Meetli — Zoom App Test Plan',
  effectiveDate: 'Effective date: 2026-09-28',
  intro1: "This document is the step-by-step test plan referenced from the Zoom Marketplace submission's release notes, for use by the Zoom App Review team.",
  intro2: 'Verified end-to-end on production (meetli.cc) on 2026-09-28 using a real test account: connected Zoom via OAuth, created an appointment with Zoom as the meeting provider from the internal dashboard, and confirmed a real Zoom join link (us05web.zoom.us/j/...) was attached to it. The steps below match what was actually exercised, not just a theoretical flow.',
  section1Title: '1. What the app does',
  section1Body: 'Meetli is a scheduling/appointments SaaS. Once a user connects their Zoom account, Meetli can create a Zoom meeting automatically for any appointment and attach the join link to booking confirmations and reminders sent to the client.',
  section2Title: '2. Scopes requested and why',
  scopeTableScopeHeader: 'Scope',
  scopeTablePurposeHeader: 'Purpose',
  scopes: [
    {
      scope: 'meeting:write:meeting',
      purpose: "Create a Zoom meeting on the connected user's behalf when they book an appointment with Zoom selected as the meeting provider."
    },
    {
      scope: 'user:read:user',
      purpose: 'Read basic profile info (name, email) of the connected Zoom account, shown in Settings → Integrations to confirm which Zoom account is connected.'
    }
  ],
  section2Footer: 'No other scopes are requested.',
  section3Title: '3. Test account',
  section3LoginLabel: 'Login URL:',
  section3LoginUrl: 'https://meetli.cc/login',
  section3Credentials: 'Credentials: provided separately in the Zoom Marketplace "Test account and credentials" field. The account has one specialist (zoomtestowner) and one bookable service ("Test service", 30 min) already set up, so the reviewer does not need to create anything before testing.',
  section4Title: '4. Step-by-step test flow',
  step41Title: '4.1 Connect Zoom (OAuth authorization)',
  step41Items: [
    'Sign in to Meetli with the provided test account.',
    'Go to Settings → Integrations.',
    'Locate the Zoom card and select Connect.',
    "You are redirected to Zoom's OAuth consent screen (zoom.us/oauth/authorize). Review the requested scopes and select Authorize.",
    "You are redirected back to https://meetli.cc/settings?zoom_oauth=success, and the Zoom card now shows Connected, along with the connected Zoom account's name/email (from user:read:user)."
  ],
  step41Result: 'Expected result: no errors; the Zoom card persists as Connected after a page refresh.',
  step42Title: '4.2 Create an appointment with a Zoom meeting',
  step42Items: [
    'From the Meetli dashboard, create a new appointment (or edit an existing one).',
    'In the meeting provider field, select Zoom.',
    'Save the appointment.'
  ],
  step42Result: 'Expected result: the appointment now shows a Join Zoom Meeting link. This calls the Zoom REST API (POST /v2/users/me/meetings) server-side using the access token obtained in step 4.1, via meeting:write:meeting.',
  step43Title: '4.3 Verify the meeting link',
  step43Items: [
    'Open the appointment detail view and confirm the Join link is present and points to a valid zoom.us/j/... URL.',
    'Optionally, open the link to confirm it loads a real Zoom meeting.'
  ],
  step44Title: '4.4 Disconnect Zoom',
  step44Items: [
    'Go to Settings → Integrations.',
    'Select Disconnect on the Zoom card.'
  ],
  step44Result: 'Expected result: the card returns to a disconnected state; Meetli clears the stored Zoom OAuth token for that user immediately. Creating a new appointment with Zoom as the provider now fails gracefully (the UI indicates Zoom needs to be reconnected) until the user connects again.',
  section5Title: '5. Related documents',
  section5SupportLinkLabel: 'Support and Documentation',
  section5SupportLinkUrl: 'https://meetli.cc/support',
  section5SupportDescription: ' — end-user-facing instructions for adding, using, and removing the app.'
};
