import type { User } from "./User";

export const authDestination = (role: User["role"]): string => {
  switch (role) {
    case "restaurant":
      return "/partner";
    case "rider":
      return "/rider";
    case "admin":
      return "/admin";
    default:
      return "/";
  }
};