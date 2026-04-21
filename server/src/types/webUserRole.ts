export enum WebUserRole {
  Owner = 'owner',
  Admin = 'admin',
  Specialist = 'specialist',
}

export const WEB_USER_ROLES = [WebUserRole.Owner, WebUserRole.Admin, WebUserRole.Specialist] as const;
