import { Link as MuiLink, type LinkProps } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

type AppLinkProps = LinkProps & {
  to?: string;
};

export function AppLink({ to, className, ...props }: AppLinkProps) {
  const resolvedClassName = ['app-link', className].filter(Boolean).join(' ');

  if (to) {
    return <MuiLink component={RouterLink} to={to} className={resolvedClassName} {...props} />;
  }

  return <MuiLink className={resolvedClassName} {...props} />;
}
