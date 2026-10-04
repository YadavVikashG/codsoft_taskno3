export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  workplace: "Remote" | "Hybrid" | "On-site";
  employment: string;
  salary: string;
  salaryMin: number;
  salaryMax: number;
  posted: string;
  description: string;
  tags: string[];
  color: string;
  initials: string;
  status?: "open" | "closed";
};

export const formatSalary = (salaryMin: number, salaryMax: number) =>
  `$${Math.round(salaryMin / 1000)}k–$${Math.round(salaryMax / 1000)}k`;