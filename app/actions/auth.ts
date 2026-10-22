import {
  registerCustomerAction,
  loginAction,
  adminLoginAction,
  logoutAction,
} from "@/lib/auth/actions";

export { loginAction, adminLoginAction, logoutAction };
export const registerAction = registerCustomerAction;

export type ActionState = {
  success?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  errors?: Record<string, string[]>;
};
