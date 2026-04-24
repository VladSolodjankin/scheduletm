export enum WebUserRole {
  Owner = 'owner',
  Admin = 'admin',
  Specialist = 'specialist',
  Client = 'client',
}

export const WEB_USER_ROLES = [WebUserRole.Owner, WebUserRole.Admin, WebUserRole.Specialist, WebUserRole.Client] as const;
