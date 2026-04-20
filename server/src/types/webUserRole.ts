export enum WebUserRole {
  Owner = 'owner',
  Specialist = 'specialist',
}

export const WEB_USER_ROLES = [WebUserRole.Owner, WebUserRole.Specialist] as const;
