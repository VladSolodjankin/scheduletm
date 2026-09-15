import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useId, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import type { Locale } from '../../shared/i18n/dictionaries';
import { publicPageText } from './uiText';

export function EditorNavigationGuard({ locale, dirty, busy, save }: {
  locale: Locale;
  dirty: boolean;
  busy: boolean;
  save: () => Promise<unknown>;
}) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    (dirty || busy) && currentLocation.pathname !== nextLocation.pathname
  ));
  const titleId = useId();
  const descriptionId = useId();
  const saveRequest = useRef(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const stay = () => {
    saveRequest.current += 1;
    setSaveFailed(false);
    blocker.reset?.();
  };
  const leaveAfterSave = async () => {
    // A null result includes failed saves and edits made while a save was pending.
    // Only leave after the current document was acknowledged by the server.
    const request = ++saveRequest.current;
    setSaveFailed(false);
    const saved = await save();
    if (request !== saveRequest.current) {return;}
    if (saved) {blocker.proceed?.();} else {setSaveFailed(true);}
  };
  return (
    <Dialog open={blocker.state === 'blocked'} onClose={stay} aria-labelledby={titleId} aria-describedby={descriptionId}>
      <DialogTitle id={titleId}>{publicPageText(locale, 'unsaved')}</DialogTitle>
      <DialogContent>
        <DialogContentText id={descriptionId}>{publicPageText(locale, 'leaveWarning')}</DialogContentText>
        {saveFailed ? <Alert severity="error">{publicPageText(locale, 'saveError')}</Alert> : null}
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={stay}>{publicPageText(locale, 'stay')}</Button>
        <Button disabled={busy} onClick={() => blocker.proceed?.()}>{publicPageText(locale, 'discardAndLeave')}</Button>
        <Button variant="contained" disabled={busy} onClick={() => void leaveAfterSave()}>{publicPageText(locale, 'saveAndLeave')}</Button>
      </DialogActions>
    </Dialog>
  );
}
