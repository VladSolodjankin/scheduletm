export enum WebUserRole {
  ProductAdmin = 'product_admin',
  Owner = 'owner',
  Specialist = 'specialist',
  Client = 'client',
}

export const WEB_USER_ROLES = [
  WebUserRole.ProductAdmin,
  WebUserRole.Owner,
  WebUserRole.Specialist,
  WebUserRole.Client,
] as const;
