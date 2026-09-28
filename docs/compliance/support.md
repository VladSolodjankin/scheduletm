# Support and Documentation

Effective date: 2026-09-28

For any question about your Meetli account, appointments, or connected integrations (including Zoom and Google Calendar), contact our team directly at `support@meetli.cc`. We aim to respond to support requests promptly; for account security concerns (for example, suspected unauthorized access), please mark your message as urgent.

## Adding the App

Prerequisites: a Meetli account with the `owner` or `product_admin` role (Settings access), and a Zoom account you're signed into in your browser.

- Sign in to Meetli and go to Settings, then Integrations.
- Find the Zoom card and select Connect.
- You're redirected to Zoom's consent screen. Review the requested permissions (create a meeting on your behalf, identify your connected Zoom account) and select Authorize.
- You're redirected back to Meetli, and the Zoom card now shows Connected.

Troubleshooting: if Connect does nothing, make sure pop-up or redirect blocking isn't preventing the browser from following the redirect to Zoom's consent screen. If authorization succeeds but the card still shows not connected, refresh the Integrations page; if that persists, disconnect and reconnect. If meetings aren't being created, confirm Zoom is still shown as Connected in Settings, Integrations — a revoked or expired Zoom authorization shows as disconnected and needs reconnecting. For anything else, contact `support@meetli.cc`.

## Usage

Once connected, Zoom is available as a meeting provider when creating or editing an appointment.

- When booking or editing an appointment, choose Zoom as the meeting provider. Meetli automatically creates a Zoom meeting via the Zoom REST API and attaches the join link to the appointment.
- The generated join link is shown on the appointment and included in confirmation and reminder notifications sent to the client.
- No manual Zoom account interaction is required after the initial connection; meeting creation happens automatically for each Zoom-provider appointment.

Prerequisites for this feature: an active Zoom connection (see Adding the App above) and an appointment with Zoom selected as its meeting provider.

## Removing the App

- Go to Settings, then Integrations.
- Find the Zoom card and select Disconnect.

What happens when you disconnect: Meetli immediately clears the stored Zoom OAuth credentials (access token, refresh token, and expiry metadata) from your account. Future appointments can no longer use Zoom as a meeting provider until you reconnect. Previously created Zoom meeting links already sent to clients are not retroactively revoked by Meetli; to end a specific meeting, use Zoom directly. Disconnecting does not delete your Meetli appointment history.

You can also revoke Meetli's access directly from your Zoom account's App Marketplace management page at any time; Meetli will then treat the connection as expired the next time it tries to use it.

## Related documents

See the Privacy Policy, Security Policy, and Terms of Use pages (linked in the site footer) for how Meetli handles your data and the terms of using the service.
