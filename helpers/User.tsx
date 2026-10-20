// If this type changes, update the auth endpoints, server session loader,
// and ProtectedRoute together.
export interface User {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: "admin" | "user" | "restaurant" | "rider";
  vegMode: boolean;
  allowRestaurantCalls: boolean;
}