export type UserRole = "candidate" | "recruiter" | "admin";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company: string;
  headline: string;
  location: string;
  resumeName: string;
  resumeUrl: string;
};