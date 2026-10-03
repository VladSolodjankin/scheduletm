import { Box, Link, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { AppPage } from '../shared/ui/AppPage';
import { AppSurface } from '../shared/ui/AppSurface';
import { AppButton } from '../shared/ui/AppButton';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';

const SCOPES = [
  {
    scope: 'meeting:write:meeting',
    purpose: "Create a Zoom meeting on the connected user's behalf when they book an appointment with Zoom selected as the meeting provider."
  },
  {
    scope: 'user:read:user',
    purpose: 'Read basic profile info (name, email) of the connected Zoom account, shown in Settings → Integrations to confirm which Zoom account is connected.'
  }
];

export function ZoomTestPlanPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(isAuthenticated ? '/appointments' : '/login');
  };

  return (
    <AppPage title="Meetli — Zoom App Test Plan" subtitle="Effective date: 2026-09-28" maxWidth={960}>
      <AppSurface className="app-legal-document">
        <Stack className="app-legal-document__content">
          <Box>
            <AppButton variant="outlined" type="button" onClick={handleBack}>
              {t('common.back')}
            </AppButton>
          </Box>

          <Stack className="app-legal-document__intro">
            <Typography variant="body1" color="text.secondary">
              This document is the step-by-step test plan referenced from the Zoom Marketplace
              submission's release notes, for use by the Zoom App Review team.
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Verified end-to-end on production (<code>meetli.cc</code>) on 2026-09-28 using a real
              test account: connected Zoom via OAuth, created an appointment with Zoom as the
              meeting provider from the internal dashboard, and confirmed a real Zoom join link
              (<code>us05web.zoom.us/j/...</code>) was attached to it. The steps below match what
              was actually exercised, not just a theoretical flow.
            </Typography>
          </Stack>

          <Stack className="app-legal-document__section">
            <Typography variant="h6">1. What the app does</Typography>
            <Typography variant="body1">
              Meetli is a scheduling/appointments SaaS. Once a user connects their Zoom account,
              Meetli can create a Zoom meeting automatically for any appointment and attach the
              join link to booking confirmations and reminders sent to the client.
            </Typography>
          </Stack>

          <Stack className="app-legal-document__section">
            <Typography variant="h6">2. Scopes requested and why</Typography>
            <Box component="table" className="app-legal-document__table">
              <Box component="thead">
                <Box component="tr">
                  <Box component="th">Scope</Box>
                  <Box component="th">Purpose</Box>
                </Box>
              </Box>
              <Box component="tbody">
                {SCOPES.map((row) => (
                  <Box component="tr" key={row.scope}>
                    <Box component="td"><code>{row.scope}</code></Box>
                    <Box component="td">{row.purpose}</Box>
                  </Box>
                ))}
              </Box>
            </Box>
            <Typography variant="body1">No other scopes are requested.</Typography>
          </Stack>

          <Stack className="app-legal-document__section">
            <Typography variant="h6">3. Test account</Typography>
            <Typography variant="body1">
              Login URL: <Link href="https://meetli.cc/login">https://meetli.cc/login</Link>
            </Typography>
            <Typography variant="body1">
              Credentials: provided separately in the Zoom Marketplace "Test account and
              credentials" field. The account has one specialist (<code>zoomtestowner</code>) and
              one bookable service ("Test service", 30 min) already set up, so the reviewer does
              not need to create anything before testing.
            </Typography>
          </Stack>

          <Stack className="app-legal-document__section">
            <Typography variant="h6">4. Step-by-step test flow</Typography>

            <Typography variant="subtitle1">4.1 Connect Zoom (OAuth authorization)</Typography>
            <Box component="ol" className="app-legal-document__list">
              <Box component="li" className="app-legal-document__list-item">
                <Typography variant="body1">Sign in to Meetli with the provided test account.</Typography>
              </Box>
              <Box component="li" className="app-legal-document__list-item">
                <Typography variant="body1">Go to Settings → Integrations.</Typography>
              </Box>
              <Box component="li" className="app-legal-document__list-item">
                <Typography variant="body1">Locate the Zoom card and select Connect.</Typography>
              </Box>
              <Box component="li" className="app-legal-document__list-item">
                <Typography variant="body1">
                  You are redirected to Zoom's OAuth consent screen (<code>zoom.us/oauth/authorize</code>).
                  Review the requested scopes and select Authorize.
                </Typography>
              </Box>
              <Box component="li" className="app-legal-document__list-item">
                <Typography variant="body1">
                  You are redirected back to <code>https://meetli.cc/settings?zoom_oauth=success</code>,
                  and the Zoom card now shows Connected, along with the connected Zoom account's
                  name/email (from <code>user:read:user</code>).
                </Typography>
              </Box>
            </Box>
            <Typography variant="body1" color="text.secondary">
              Expected result: no errors; the Zoom card persists as Connected after a page refresh.
            </Typography>

            <Typography variant="subtitle1">4.2 Create an appointment with a Zoom meeting</Typography>
            <Box component="ol" className="app-legal-document__list">
              <Box component="li" className="app-legal-document__list-item">
                <Typography variant="body1">From the Meetli dashboard, create a new appointment (or edit an existing one).</Typography>
              </Box>
              <Box component="li" className="app-legal-document__list-item">
                <Typography variant="body1">In the meeting provider field, select Zoom.</Typography>
              </Box>
              <Box component="li" className="app-legal-document__list-item">
                <Typography variant="body1">Save the appointment.</Typography>
              </Box>
            </Box>
            <Typography variant="body1" color="text.secondary">
              Expected result: the appointment now shows a Join Zoom Meeting link. This calls the
              Zoom REST API (<code>POST /v2/users/me/meetings</code>) server-side using the access
              token obtained in step 4.1, via <code>meeting:write:meeting</code>.
            </Typography>

            <Typography variant="subtitle1">4.3 Verify the meeting link</Typography>
            <Box component="ol" className="app-legal-document__list">
              <Box component="li" className="app-legal-document__list-item">
                <Typography variant="body1">
                  Open the appointment detail view and confirm the Join link is present and points
                  to a valid <code>zoom.us/j/...</code> URL.
                </Typography>
              </Box>
              <Box component="li" className="app-legal-document__list-item">
                <Typography variant="body1">Optionally, open the link to confirm it loads a real Zoom meeting.</Typography>
              </Box>
            </Box>

            <Typography variant="subtitle1">4.4 Disconnect Zoom</Typography>
            <Box component="ol" className="app-legal-document__list">
              <Box component="li" className="app-legal-document__list-item">
                <Typography variant="body1">Go to Settings → Integrations.</Typography>
              </Box>
              <Box component="li" className="app-legal-document__list-item">
                <Typography variant="body1">Select Disconnect on the Zoom card.</Typography>
              </Box>
            </Box>
            <Typography variant="body1" color="text.secondary">
              Expected result: the card returns to a disconnected state; Meetli clears the stored
              Zoom OAuth token for that user immediately. Creating a new appointment with Zoom as
              the provider now fails gracefully (the UI indicates Zoom needs to be reconnected)
              until the user connects again.
            </Typography>
          </Stack>

          <Stack className="app-legal-document__section">
            <Typography variant="h6">5. Related documents</Typography>
            <Box component="ul" className="app-legal-document__list">
              <Box component="li" className="app-legal-document__list-item">
                <Typography variant="body1">
                  <Link href="https://meetli.cc/support">Support and Documentation</Link> —
                  end-user-facing instructions for adding, using, and removing the app.
                </Typography>
              </Box>
            </Box>
          </Stack>
        </Stack>
      </AppSurface>
    </AppPage>
  );
}
