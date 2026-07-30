export enum WebUserRole {
  ProductOwner = 'product_owner',
  Owner = 'owner',
  Admin = 'admin',
  Specialist = 'specialist',
  Client = 'client',
}

export const WEB_USER_ROLES = [
  WebUserRole.ProductOwner,
  WebUserRole.Owner,
  WebUserRole.Admin,
  WebUserRole.Specialist,
  WebUserRole.Client,
] as const;
