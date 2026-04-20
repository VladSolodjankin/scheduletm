import { Tab, Tabs, type TabProps, type TabsProps } from '@mui/material';

type AppTabsProps = TabsProps;

type AppTabProps = TabProps;

export function AppTabs(props: AppTabsProps) {
  return <Tabs variant="scrollable" scrollButtons="auto" {...props} />;
}

export function AppTab(props: AppTabProps) {
  return <Tab disableRipple {...props} />;
}
