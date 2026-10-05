"use client";

import {
  ArrowDownUp,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  Flag,
  Globe2,
  Headset,
  Lightbulb,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  MessageSquareText,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { formatSalary, Job } from "@/lib/jobs";
import { AuthScreen } from "@/components/auth-screen";
import { AuthUser } from "@/lib/types";
import { ApplicationCommunications } from "@/components/application-communications";
import { HelpCenter, SupportInbox } from "@/components/help-center";
import { CommunityCenter } from "@/components/community-center";
import { ThemeControl } from "@/components/theme-control";
import { getSavedTheme, getThemeImage, randomTheme, ThemeId, ThemeMode } from "@/lib/themes";

type View = "discover" | "applications" | "saved" | "profile" | "community" | "overview" | "openings" | "candidates" | "admin" | "users" | "help" | "support";
type Profile = { name: string; email: string; role: string; location: string; resumeName: string; resumeUrl: string; educationLevel: string; educationDetails: string; certificates: string[]; currentCompany: string; currentPosition: string };
type Application = { id: string; jobId: string; date: string; stage: string; resumeUrl: string; name?: string; email?: string; headline?: string; jobTitle?: string; company?: string; location?: string; workplace?: Job["workplace"]; interviewAt?: string | null; meetingUrl?: string; meetingExpiresAt?: string | null; hasMeetingUrl?: boolean };
type Candidate = { id: string; name: string; title: string; email: string; job: string; stage: string; avatar: string; color: string; resumeUrl?: string; company?: string };
type Conversation = { applicationId: string; name: string; title: string; company: string };

function CompanyMark({ job, large = false }: { job: Job; large?: boolean }) {
  return (
    <span className={`company-mark${large ? " company-mark-large" : ""}`} style={{ background: job.color }}>
      {job.initials}
    </span>
  );
}

function ApplicationPill({ stage }: { stage: string }) {
  const tone = stage.toLowerCase().replaceAll(" ", "-");
  return <span className={`status-pill status-${tone}`}><span />{stage}</span>;
}

function ApplicationTracker({ stage }: { stage: string }) {
  const steps = ["Applied", "Under review", "Shortlisted", "Interview", "Final decision"];
  const stageIndex = stage === "New" ? 0 : stage === "In review" ? 1 : stage === "Shortlisted" ? 2 : stage === "Interview" ? 3 : 4;
  return <div className={`application-tracker${stage === "Declined" ? " tracker-declined" : ""}`} aria-label={`Application stage: ${stage}`}>
    {steps.map((step, index) => <span className={`tracker-step${index < stageIndex ? " tracker-complete" : index === stageIndex ? " tracker-current" : ""}`} key={step}><i>{index < stageIndex ? <Check size={10} /> : null}</i><small>{step}</small></span>)}
  </div>;
}

async function fetchPublishedJobs(): Promise<Job[]> {
  const response = await fetch("/api/jobs");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load live job listings.");
  if (!Array.isArray(data.jobs)) throw new Error("Job listings are temporarily unavailable.");
  return data.jobs.map((job: Partial<Job> & { postedAt?: string }) => ({
    ...job,
    salary: job.salary ?? formatSalary(job.salaryMin ?? 0, job.salaryMax ?? 0),
    posted: job.posted ?? (job.postedAt ? new Date(job.postedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Recently"),
    color: job.color ?? "#e8eff0",
    initials: job.initials ?? (job.company?.slice(0, 1).toUpperCase() || "C"),
  } as Job));
}

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [theme, setTheme] = useState<ThemeId>("midnight-dark");
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");

  useEffect(() => {
    const savedTheme = getSavedTheme(window.localStorage.getItem("careerhub-theme"));
    if (savedTheme) {
      setTheme(savedTheme);
      setThemeMode("fixed");
    } else {
      setTheme(randomTheme());
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function selectTheme(nextTheme: ThemeId) {
    setTheme(nextTheme);
    setThemeMode("fixed");
    window.localStorage.setItem("careerhub-theme", nextTheme);
  }

  function enableAutomaticTheme() {
    setTheme(randomTheme(theme));
    setThemeMode("auto");
    window.localStorage.removeItem("careerhub-theme");
  }

  useEffect(() => {
    void fetch("/api/auth/session").then((response) => response.json()).then((data) => setUser(data.user)).catch(() => setUser(null)).finally(() => setCheckingSession(false));
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  if (checkingSession) return <main className="auth-loading"><span className="brand-symbol"><span /><span /><span /><span /></span><span>Preparing your workspace…</span></main>;
  if (!user) return <AuthScreen theme={theme} themeMode={themeMode} onSelectTheme={selectTheme} onAutoTheme={enableAutomaticTheme} onAuthenticated={(authenticatedUser) => {
    if (themeMode === "auto") setTheme(randomTheme(theme));
    setUser(authenticatedUser);
  }} />;
  return <Portal key={user.id} user={user} onSignOut={signOut} theme={theme} themeMode={themeMode} onSelectTheme={selectTheme} onAutoTheme={enableAutomaticTheme} />;
}

function Portal({ user, onSignOut, theme, themeMode, onSelectTheme, onAutoTheme }: { user: AuthUser; onSignOut: () => void; theme: ThemeId; themeMode: ThemeMode; onSelectTheme: (theme: ThemeId) => void; onAutoTheme: () => void }) {
  const isCandidate = user.role === "candidate";
  const isRecruiter = user.role === "recruiter";
  const isAdmin = user.role === "admin";
  const [view, setView] = useState<View>(isCandidate ? "discover" : isRecruiter ? "overview" : "admin");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [profile, setProfile] = useState<Profile>({ name: user.name, email: user.email, role: user.headline, location: user.location, resumeName: user.resumeName, resumeUrl: user.resumeUrl, educationLevel: "", educationDetails: "", certificates: [], currentCompany: "", currentPosition: "" });
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [workplace, setWorkplace] = useState("All types");
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);
  const [salaryFloor, setSalaryFloor] = useState(0);
  const [sortBy, setSortBy] = useState<"newest" | "salary-high" | "salary-low">("newest");
  const [applicationJob, setApplicationJob] = useState<Job | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  useEffect(() => {
    void fetch("/api/profile").then((response) => response.json()).then((data) => {
      if (data.profile) setProfile({ name: data.profile.name, email: data.profile.email, role: data.profile.headline, location: data.profile.location, resumeName: data.profile.resumeName, resumeUrl: data.profile.resumeUrl, educationLevel: data.profile.educationLevel ?? "", educationDetails: data.profile.educationDetails ?? "", certificates: data.profile.certificates ?? [], currentCompany: data.profile.currentCompany ?? "", currentPosition: data.profile.currentPosition ?? "" });
    }).catch(() => undefined);
    if (isCandidate) void fetch("/api/saved-jobs").then((response) => response.json()).then((data) => setSavedIds(data.savedIds ?? [])).catch(() => undefined);
    void fetch("/api/applications").then((response) => response.json()).then((data) => {
      const items: Application[] = data.applications ?? [];
      setApplications(items);
      if (!isCandidate) setCandidates(items.map((item) => ({ id: item.id, name: item.name ?? "Candidate", title: item.headline || "Candidate", email: item.email ?? "", job: item.jobTitle ?? "Role", stage: item.stage, avatar: userInitials(item.name ?? "C"), color: "#e5eae4", resumeUrl: item.resumeUrl, company: item.company })));
    }).catch(() => undefined);
    void fetchPublishedJobs().then((databaseJobs) => {
      setJobs(databaseJobs);
      setSelectedId(databaseJobs[0]?.id ?? "");
      setJobsError("");
    }).catch((error) => {
      setJobsError(error instanceof Error ? error.message : "Could not load live job listings.");
    }).finally(() => setJobsLoading(false));
  }, [user.id, isCandidate]);

  useEffect(() => {
    function handleCommandShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
        setCommandSearch("");
      }
      if (event.key === "Escape") setCommandOpen(false);
    }
    window.addEventListener("keydown", handleCommandShortcut);
    return () => window.removeEventListener("keydown", handleCommandShortcut);
  }, []);

  const visibleJobs = jobs.filter((job) => {
    const matchesSearch = `${job.title} ${job.company} ${job.tags.join(" ")}`.toLowerCase().includes(search.toLowerCase());
    const matchesLocation = `${job.location} ${job.workplace}`.toLowerCase().includes(locationSearch.toLowerCase());
    const matchesWorkplace = workplace === "All types" || job.workplace === workplace;
    const matchesEmployment = employmentTypes.length === 0 || employmentTypes.includes(job.employment);
    const matchesSalary = job.salaryMax >= salaryFloor;
    const matchesSaved = view !== "saved" || savedIds.includes(job.id);
    return matchesSearch && matchesLocation && matchesWorkplace && matchesEmployment && matchesSalary && matchesSaved;
  }).sort((first, second) => {
    if (sortBy === "salary-high") return second.salaryMax - first.salaryMax;
    if (sortBy === "salary-low") return first.salaryMin - second.salaryMin;
    return (Date.parse(second.postedAt ?? "") || 0) - (Date.parse(first.postedAt ?? "") || 0);
  });
  const selectedJob = visibleJobs.find((job) => job.id === selectedId) ?? visibleJobs[0] ?? null;
  const applicationIds = applications.map((application) => application.jobId);
  const myApplications = applications.map((application) => ({
    ...application,
    job: jobs.find((job) => job.id === application.jobId) ?? (application.jobTitle ? {
      id: application.jobId,
      title: application.jobTitle,
      company: application.company ?? "",
      location: application.location ?? "",
      workplace: application.workplace ?? "Remote",
      employment: "Full-time",
      salary: "",
      salaryMin: 0,
      salaryMax: 0,
      posted: "",
      description: "",
      tags: [],
      color: "#e8eee4",
      initials: application.company?.slice(0, 1).toUpperCase() ?? "C",
    } : undefined),
  })).filter((application) => application.job);

  function navigate(nextView: View) {
    setView(nextView);
    setMobileMenu(false);
    setCommandOpen(false);
    if (nextView === "discover" || nextView === "saved") setSelectedId(visibleJobs[0]?.id ?? jobs[0]?.id ?? "");
  }

  function toggleSaved(id: string) {
    const wasSaved = savedIds.includes(id);
    setSavedIds((current) => wasSaved ? current.filter((savedId) => savedId !== id) : [...current, id]);
    void fetch(wasSaved ? `/api/saved-jobs?jobId=${encodeURIComponent(id)}` : "/api/saved-jobs", {
      method: wasSaved ? "DELETE" : "POST",
      headers: wasSaved ? undefined : { "Content-Type": "application/json" },
      body: wasSaved ? undefined : JSON.stringify({ jobId: id }),
    }).then(async (response) => {
      if (!response.ok) throw new Error((await response.json()).error || "Could not update saved jobs.");
    }).catch((error) => {
      setSavedIds((current) => wasSaved ? [...current, id] : current.filter((savedId) => savedId !== id));
      setNotice(error instanceof Error ? error.message : "Could not update saved jobs.");
    });
  }

  async function uploadResume(file: File): Promise<{ url: string; name: string }> {
    const data = new FormData();
    data.append("resume", file);
    const response = await fetch("/api/resumes", { method: "POST", body: data });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Resume upload failed.");
    return result;
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!applicationJob) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("resume");
    const note = String(form.get("note") || "");
    try {
      let resumeUrl = profile.resumeUrl;
      if (file instanceof File && file.size > 0) {
        const uploaded = await uploadResume(file);
        resumeUrl = uploaded.url;
        setProfile((current) => ({ ...current, resumeName: uploaded.name, resumeUrl }));
      }
      if (!resumeUrl) throw new Error("Attach your resume before applying.");
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: applicationJob.id, resumeUrl, coverNote: note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit your application.");
      const application: Application = { ...result.application, resumeUrl, jobTitle: applicationJob.title, company: applicationJob.company, location: applicationJob.location, workplace: applicationJob.workplace };
      setApplications((current) => [application, ...current.filter((item) => item.jobId !== applicationJob.id)]);
      setApplicationJob(null);
      setNotice("Application sent. Good things take a first step.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not submit your application.");
    }
  }

  async function handleProfileResume(file: File) {
    try {
      const uploaded = await uploadResume(file);
      setProfile((current) => ({ ...current, resumeName: uploaded.name, resumeUrl: uploaded.url }));
      setNotice("Resume added to your profile.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not upload your resume.");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: profile.name, headline: profile.role, location: profile.location, educationLevel: profile.educationLevel, educationDetails: profile.educationDetails, certificates: profile.certificates, currentCompany: profile.currentCompany, currentPosition: profile.currentPosition }) });
    const result = await response.json();
    if (!response.ok) { setNotice(result.error || "Could not save your profile."); return; }
    setProfile((current) => ({ ...current, name: result.profile.name, role: result.profile.headline, location: result.profile.location, educationLevel: result.profile.educationLevel, educationDetails: result.profile.educationDetails, certificates: result.profile.certificates ?? [], currentCompany: result.profile.currentCompany, currentPosition: result.profile.currentPosition }));
    setNotice("Profile updated.");
  }

  async function updateCandidateStage(id: string, stage: string) {
    const response = await fetch("/api/applications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, stage }) });
    if (!response.ok) { const result = await response.json(); setNotice(result.error || "Could not update the candidate."); return; }
    setCandidates((current) => current.map((candidate) => candidate.id === id ? { ...candidate, stage } : candidate));
  }

  async function updateJobStatus(id: string, status: "open" | "closed") {
    const response = await fetch("/api/jobs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    const result = await response.json();
    if (!response.ok) { setNotice(result.error || "Could not update this opening."); return; }
    setJobs((current) => current.map((job) => job.id === id ? { ...job, status } : job));
    setNotice(status === "open" ? "This opening is live." : "This opening is now closed.");
  }

  async function refreshJobs() {
    setJobsLoading(true);
    setJobsError("");
    try {
      const updatedJobs = await fetchPublishedJobs();
      setJobs(updatedJobs);
      setSelectedId(updatedJobs[0]?.id ?? "");
    } catch (error) {
      setJobsError(error instanceof Error ? error.message : "Could not load live job listings.");
    } finally {
      setJobsLoading(false);
    }
  }

  const commandItems: { label: string; view: View }[] = isAdmin
    ? [{ label: "Platform overview", view: "admin" }, { label: "User accounts", view: "users" }, { label: "Job listings", view: "openings" }, { label: "Applications", view: "candidates" }, { label: "Community", view: "community" }, { label: "Support inbox", view: "support" }]
    : isRecruiter
      ? [{ label: "Recruitment overview", view: "overview" }, { label: "Job openings", view: "openings" }, { label: "Candidate pipeline", view: "candidates" }, { label: "Community", view: "community" }, { label: "Help and contact", view: "help" }]
      : [{ label: "Discover jobs", view: "discover" }, { label: "My applications", view: "applications" }, { label: "Saved jobs", view: "saved" }, { label: "My profile", view: "profile" }, { label: "Community", view: "community" }, { label: "Help and contact", view: "help" }];
  const matchingCommands = commandItems.filter((item) => item.label.toLowerCase().includes(commandSearch.toLowerCase()));

  return (
    <main className="portal-shell">
      <aside className={`sidebar${mobileMenu ? " sidebar-open" : ""}`}>
        <button className="brand" onClick={() => navigate(isCandidate ? "discover" : isRecruiter ? "overview" : "admin")} aria-label="CareerHub home">
          <span className="brand-symbol"><span /><span /><span /><span /></span>
          <span>career<span>hub</span></span>
        </button>

        <div className="workspace-label">{isAdmin ? "ADMIN WORKSPACE" : "WORKSPACE"}</div>
        <div className="role-badge"><span className={`role-badge-dot role-${user.role}`} />{isAdmin ? "Administrator" : isRecruiter ? "Recruiter workspace" : "Candidate workspace"}</div>

        <div className="nav-label">{isAdmin ? "PLATFORM" : isRecruiter ? "RECRUITMENT" : "YOUR CAREER"}</div>
        <nav className="side-nav" aria-label="Main navigation">
          {(isAdmin ? [
            { id: "admin" as View, label: "Overview", icon: LayoutDashboard },
            { id: "users" as View, label: "User accounts", icon: UsersRound },
            { id: "openings" as View, label: "Job listings", icon: BriefcaseBusiness },
            { id: "candidates" as View, label: "Applications", icon: FileText },
            { id: "community" as View, label: "Community", icon: UsersRound },
            { id: "support" as View, label: "Support inbox", icon: Headset },
          ] : isRecruiter ? [
            { id: "overview" as View, label: "Overview", icon: LayoutDashboard },
            { id: "openings" as View, label: "Job openings", icon: BriefcaseBusiness },
            { id: "candidates" as View, label: "Candidates", icon: UsersRound },
            { id: "community" as View, label: "Community", icon: UsersRound },
            { id: "help" as View, label: "Help & contact", icon: CircleHelp },
          ] : [
            { id: "discover" as View, label: "Discover jobs", icon: Search },
            { id: "applications" as View, label: "My applications", icon: FileText },
            { id: "saved" as View, label: "Saved jobs", icon: Bookmark },
            { id: "profile" as View, label: "My profile", icon: UsersRound },
            { id: "community" as View, label: "Community", icon: UsersRound },
            { id: "help" as View, label: "Help & contact", icon: CircleHelp },
          ]).map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item${view === id ? " nav-item-active" : ""}`} onClick={() => navigate(id)}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {id === "applications" && applications.length > 0 && <span className="nav-count">{applications.length}</span>}
              {id === "candidates" && <span className="nav-count">{candidates.length}</span>}
            </button>
          ))}
        </nav>

        {isRecruiter && <button className="sidebar-new-job" onClick={() => setPostOpen(true)}><Plus size={16} />Post a new job</button>}

        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <span className="note-icon"><Sparkles size={17} /></span>
          <strong>A little more you.</strong>
          <p>A complete profile helps the right work find you.</p>
          <button onClick={() => isAdmin ? navigate("users") : isRecruiter ? navigate("candidates") : navigate("profile")}>{isAdmin ? "Manage accounts" : isRecruiter ? "Meet your candidates" : "Complete profile"}<ArrowRight size={14} /></button>
        </div>
        <div className="account-row">
          <span className="avatar avatar-user">{userInitials(profile.name)}</span>
          <span className="account-info"><strong>{profile.name}</strong><small>{user.role}</small></span>
          <button className="account-signout" onClick={onSignOut} title="Sign out" aria-label="Sign out"><LogOut size={15} /></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle navigation"><Menu size={20} /></button>
          <div className="breadcrumb"><span>CareerHub</span><span className="breadcrumb-dot">/</span><strong>{navLabel(view)}</strong></div>
          <div className="topbar-actions">
            <button className="command-trigger" onClick={() => { setCommandOpen(true); setCommandSearch(""); }} aria-label="Open command palette"><Search size={15} /><kbd>⌘K</kbd></button>
            <ThemeControl theme={theme} mode={themeMode} onSelect={onSelectTheme} onAuto={onAutoTheme} />
            <span className="live-status"><i /> CareerHub workspace</span>
            <button className="top-avatar" aria-label="Open your profile" onClick={() => navigate(isCandidate ? "profile" : isRecruiter ? "overview" : "admin")}>{userInitials(profile.name)}</button>
          </div>
        </header>

        <div className="page-content">
          {view === "discover" && <>
            <section className="welcome-row">
              <div>
                <span className="eyebrow"><span className="eyebrow-line" />YOUR NEXT CHAPTER</span>
                <h1>Find work that <em>moves</em><br className="desktop-break" /> you forward.</h1>
                <p className="page-intro">Good work, good people, and a place to grow into what’s next.</p>
              </div>
              <div className="welcome-art" aria-hidden="true">
                <div className="art-photo" style={{ backgroundImage: `url("${getThemeImage(theme)}")` }} />
                <span className="art-sun" /><span className="art-leaf art-leaf-one" /><span className="art-leaf art-leaf-two" />
                <span className="art-note"><Sparkles size={14} /> Your next chapter</span>
              </div>
            </section>

            <div className="search-panel">
              <label className="search-field"><Search size={19} /><span><small>What are you looking for?</small><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Job title, company, or skill" /></span></label>
              <span className="search-divider" />
              <label className="search-field location-field"><MapPin size={19} /><span><small>Where?</small><input value={locationSearch} onChange={(event) => setLocationSearch(event.target.value)} placeholder="City, state, or remote" /></span></label>
              <button className="search-submit" onClick={() => setSelectedId(visibleJobs[0]?.id ?? "")}><Search size={16} /><span>Find a job</span></button>
            </div>

            <div className="results-toolbar">
              <div><span className="results-count">{visibleJobs.length}</span><span>roles worth a look</span></div>
              <div className="filter-actions">
                <label className="filter-select sort-select"><ArrowDownUp size={14} /><select aria-label="Sort job listings" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="newest">Newest first</option><option value="salary-high">Salary: high to low</option><option value="salary-low">Salary: low to high</option></select><ChevronDown size={13} /></label>
              </div>
            </div>

            <div className="jobs-layout">
              <aside className="job-filters" aria-label="Job filters">
                <div className="job-filter-heading"><strong>Filters</strong><button onClick={() => { setWorkplace("All types"); setEmploymentTypes([]); setSalaryFloor(0); }}>Clear all</button></div>
                <fieldset><legend>Workplace type</legend>{["Remote", "On-site", "Hybrid"].map((type) => <label key={type}><input type="radio" name="workplace" checked={workplace === type} onChange={() => setWorkplace(type)} />{type}</label>)}<label><input type="radio" name="workplace" checked={workplace === "All types"} onChange={() => setWorkplace("All types")} />Any workplace</label></fieldset>
                <fieldset><legend>Employment type</legend>{["Full-time", "Contract", "Part-time", "Internship"].map((type) => <label key={type}><input type="checkbox" checked={employmentTypes.includes(type)} onChange={() => setEmploymentTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])} />{type}</label>)}</fieldset>
                <fieldset className="salary-filter"><legend>Minimum salary</legend><strong>${(salaryFloor / 1000).toFixed(0)}k{salaryFloor === 200000 ? "+" : ""}</strong><input type="range" min="0" max="200000" step="10000" value={salaryFloor} onChange={(event) => setSalaryFloor(Number(event.target.value))} aria-label="Minimum annual salary" /><span><small>$0</small><small>$200k+</small></span></fieldset>
              </aside>
              <div className="job-list" aria-label="Job results">
                {jobsLoading ? <div className="job-skeleton-list" aria-label="Loading job listings"><div /><div /><div /></div> : jobsError ? <div className="empty-state"><span><CircleHelp size={20} /></span><strong>Live listings are unavailable</strong><p>{jobsError}</p><button onClick={() => void refreshJobs()}>Try again</button></div> : visibleJobs.length === 0 ? jobs.length === 0 ? <div className="opportunity-empty"><span className="opportunity-mark"><BriefcaseBusiness size={24} /></span><div><span className="eyebrow"><span className="eyebrow-line" />THE NEXT CHAPTER IS LOADING</span><h2>No open roles just yet.</h2><p>Only live listings from hiring teams appear here. Check back soon for new opportunities.</p><button onClick={() => void refreshJobs()}><ArrowDownUp size={15} />Refresh listings</button></div><span className="opportunity-index">CAREERHUB <i /> LIVE ROLES</span></div> : <div className="empty-state"><span><Search size={20} /></span><strong>No roles match these filters</strong><p>Adjust your keywords, workplace, employment type, or salary floor.</p><button onClick={() => { setSearch(""); setLocationSearch(""); setWorkplace("All types"); setEmploymentTypes([]); setSalaryFloor(0); }}>Clear filters</button></div> : visibleJobs.map((job) => (
                  <article key={job.id} className={`job-card${selectedJob?.id === job.id ? " job-card-selected" : ""}`} onClick={() => setSelectedId(job.id)}>
                    <div className="job-card-top"><CompanyMark job={job} /><span className="job-company">{job.company}</span><span className="job-time">{job.posted}</span><button className={`bookmark-button${savedIds.includes(job.id) ? " is-saved" : ""}`} onClick={(event) => { event.stopPropagation(); toggleSaved(job.id); }} aria-label={savedIds.includes(job.id) ? "Remove saved job" : "Save job"}><Bookmark size={17} fill={savedIds.includes(job.id) ? "currentColor" : "none"} /></button></div>
                    <h3>{job.title}</h3>
                    <div className="job-meta"><span><MapPin size={13} />{job.location}</span><i /><span><Globe2 size={13} />{job.workplace}</span></div>
                    <div className="job-card-bottom"><div className="tag-list"><span className="job-tag">{job.employment}</span><span className="job-tag job-tag-pay">{job.salary}</span></div><button className="quick-apply-button" disabled={applicationIds.includes(job.id)} onClick={(event) => { event.stopPropagation(); setApplicationJob(job); }}>{applicationIds.includes(job.id) ? "Applied" : "Quick apply"}<ArrowRight size={14} /></button></div>
                  </article>
                ))}
                <div className="list-footer"><span>Showing {visibleJobs.length} of {jobs.length} opportunities</span><span className="footer-spark"><Zap size={13} /> Latest published roles</span></div>
              </div>

              {selectedJob && <aside className="job-detail">
                <div className="detail-topline"><span className="detail-label">THE OPPORTUNITY</span><button className={`bookmark-button detail-bookmark${savedIds.includes(selectedJob.id) ? " is-saved" : ""}`} onClick={() => toggleSaved(selectedJob.id)} aria-label="Save this job"><Bookmark size={17} fill={savedIds.includes(selectedJob.id) ? "currentColor" : "none"} /></button></div>
                <CompanyMark job={selectedJob} large />
                <h2>{selectedJob.title}</h2>
                <div className="detail-company">{selectedJob.company}<span className="detail-dot">·</span>{selectedJob.location}</div>
                <div className="detail-badges"><span><Globe2 size={13} />{selectedJob.workplace}</span><span><BriefcaseBusiness size={13} />{selectedJob.employment}</span></div>
                <div className="detail-salary"><span>COMPENSATION</span><strong>{selectedJob.salary}</strong><small>Annual salary</small></div>
                <div className="detail-description"><h3>About the role</h3><p>{selectedJob.description}</p></div>
                <div className="detail-tags">{selectedJob.tags.map((tag) => <span className="detail-tag" key={tag}>{tag}</span>)}</div>
                <button className="apply-button" disabled={applicationIds.includes(selectedJob.id)} onClick={() => setApplicationJob(selectedJob)}>{applicationIds.includes(selectedJob.id) ? <><CheckCircle2 size={17} />Application sent</> : <>Apply for this role<ArrowRight size={17} /></>}</button>
                <p className="apply-footnote"><CheckCircle2 size={13} /> Your profile stays private until you apply.</p>
              </aside>}
            </div>
          </>}

          {view === "saved" && <>
            <PageHeading eyebrow="YOUR SHORTLIST" title="Saved for later." description="A few possibilities you didn’t want to forget." />
            <div className="saved-jobs-grid">{visibleJobs.map((job) => <button key={job.id} className="saved-job-row" onClick={() => { setView("discover"); setSelectedId(job.id); }}><CompanyMark job={job} /><span><strong>{job.title}</strong><small>{job.company} · {job.location}</small></span><span className="saved-salary">{job.salary}</span><ArrowUpRight size={17} /></button>)}{visibleJobs.length === 0 && <EmptyMessage title="Your shortlist is ready for a spark." detail="Save a live role and it will be waiting here." action="Explore jobs" onAction={() => navigate("discover")} />}</div>
          </>}

          {view === "applications" && <>
            <PageHeading eyebrow="THE NEXT CHAPTER" title="Your applications." description="Every first step, all in one place." />
            <div className="summary-strip"><span><strong>{applications.length.toString().padStart(2, "0")}</strong><small>Applications sent</small></span><span><strong>{applications.filter((item) => item.stage === "Interview").length.toString().padStart(2, "0")}</strong><small>In conversation</small></span><span><strong>{savedIds.length.toString().padStart(2, "0")}</strong><small>Roles saved</small></span></div>
            {myApplications.length === 0 ? <EmptyMessage title="Your story starts with one good fit." detail="When you apply to a role, you’ll find updates and next steps here." action="Find your next role" onAction={() => navigate("discover")} /> : <div className="application-list">{myApplications.map((application) => <article className="application-row" key={application.id}><CompanyMark job={application.job!} /><div className="application-role"><strong>{application.job!.title}</strong><small>{application.job!.company} · {application.job!.location}</small><ApplicationTracker stage={application.stage} />{application.interviewAt && <span className="application-interview"><CalendarClock size={13} />Interview {new Date(application.interviewAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}{application.meetingUrl && <a href={application.meetingUrl} target="_blank" rel="noreferrer">Join</a>}</span>}</div><div className="application-date"><small>APPLIED</small><span>{new Date(application.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div><ApplicationPill stage={application.stage} /><button className="row-icon" onClick={() => setConversation({ applicationId: application.id, name: profile.name, title: application.job!.title, company: application.job!.company })} aria-label={`Message the hiring team about ${application.job!.title}`}><MessageSquareText size={16} /></button></article>)}</div>}
          </>}

          {view === "profile" && <>
            <PageHeading eyebrow="YOUR CAREER, YOUR TERMS" title="A little more you." description="Give the right opportunity a reason to find you." />
            <div className="profile-layout"><section className="profile-form-section"><div className="section-heading"><span className="section-icon"><UsersRound size={17} /></span><div><h2>Your details</h2><p>Just the essentials, for now.</p></div></div><form className="profile-form" onSubmit={saveProfile}><label>Full name<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></label><label>Email address<input value={profile.email} type="email" readOnly /></label><label>What do you do?<input value={profile.role} onChange={(event) => setProfile({ ...profile, role: event.target.value })} placeholder="Product designer" /></label><label>Based in<input value={profile.location} onChange={(event) => setProfile({ ...profile, location: event.target.value })} placeholder="City, state" /></label><label>Education level<select value={profile.educationLevel} onChange={(event) => setProfile({ ...profile, educationLevel: event.target.value })}><option value="">Select level</option><option>High school</option><option>Certificate or bootcamp</option><option>Associate degree</option><option>Bachelor’s degree</option><option>Master’s degree</option><option>Doctorate</option><option>Other</option></select></label><label>School, program or field<input value={profile.educationDetails} onChange={(event) => setProfile({ ...profile, educationDetails: event.target.value })} placeholder="School and area of study" /></label><label>Current job title<input value={profile.currentPosition} onChange={(event) => setProfile({ ...profile, currentPosition: event.target.value })} placeholder="Role or position" /></label><label>Current workplace<input value={profile.currentCompany} onChange={(event) => setProfile({ ...profile, currentCompany: event.target.value })} placeholder="Company or organization" /></label><label className="profile-wide-field">Certificates <span className="optional">ONE PER LINE</span><textarea value={profile.certificates.join("\n")} onChange={(event) => setProfile({ ...profile, certificates: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) })} placeholder="Add certificates, one per line" rows={3} /></label><button className="primary-button" type="submit">Save profile<Check size={15} /></button></form></section><aside className="resume-card"><div className="resume-card-heading"><span className="resume-icon"><FileText size={19} /></span><span><strong>Your resume</strong><small>PDF or Word · Up to 5 MB</small></span></div>{profile.resumeName ? <><div className="resume-file"><CheckCircle2 size={17} /><span><strong>{profile.resumeName}</strong><small>Private · only shared with teams you apply to</small></span></div><a className="resume-download" href={profile.resumeUrl} download><ArrowDownToLine size={14} />Download your resume</a></> : <label className="resume-drop"><input type="file" accept=".pdf,.doc,.docx" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleProfileResume(file); }} /><span className="resume-upload-icon"><Plus size={18} /></span><strong>Bring your story with you</strong><small>PDF or Word, up to 5 MB</small><span className="resume-browse">Choose a file</span></label>}<p className="privacy-note"><CheckCircle2 size={14} /> Never shared unless you apply.</p></aside></div>
          </>}

          {view === "community" && <CommunityCenter currentUserId={user.id} currentUserName={profile.name} currentUserRole={user.role} />}

          {view === "overview" && <RecruiterOverview jobs={jobs} candidates={candidates} onNavigate={navigate} onPost={() => setPostOpen(true)} />}
          {view === "openings" && <RecruiterOpenings jobs={jobs} onPost={() => setPostOpen(true)} onStatus={updateJobStatus} onSelect={(id) => setSelectedId(id)} />}
          {view === "candidates" && <>
            {candidates.length > 0 && <div className="candidate-message-shortcuts">{candidates.map((candidate) => <button key={candidate.id} onClick={() => setConversation({ applicationId: candidate.id, name: candidate.name, title: candidate.job, company: candidate.company ?? user.company })}><MessageSquareText size={15} />Message {candidate.name}</button>)}</div>}
            <RecruiterCandidates candidates={candidates} onStage={updateCandidateStage} />
          </>}
          {view === "admin" && <AdminOverview />}
          {view === "users" && <AdminUsers />}
          {view === "help" && <HelpCenter user={user} />}
          {view === "support" && <SupportInbox />}
        </div>

        <footer className="page-footer"><span>Made for the work that matters.</span><span>CareerHub <span className="footer-dot">©</span> 2026</span></footer>
      </section>

      {applicationJob && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setApplicationJob(null); }}><section className="modal-card application-modal"><div className="modal-top"><span className="modal-kicker">ONE GOOD NEXT STEP</span><button className="icon-button" onClick={() => setApplicationJob(null)} aria-label="Close"><X size={19} /></button></div><h2>Make it a little more real.</h2><p className="modal-intro">You’re applying for <strong>{applicationJob.title}</strong> at {applicationJob.company}.</p><form className="modal-form" onSubmit={submitApplication}>{profile.resumeName && <small className="attached-resume"><CheckCircle2 size={13} />Applying as {profile.name} · {profile.email}</small>}<label>Resume{profile.resumeName && <small className="attached-resume"><CheckCircle2 size={13} />{profile.resumeName} · upload a different file below</small>}<input name="resume" type="file" accept=".pdf,.doc,.docx" required={!profile.resumeUrl} /></label><label>A note for the team <span className="optional">OPTIONAL</span><textarea name="note" placeholder="What drew you to this role?" rows={3} /></label><button className="apply-button" type="submit">Send application<ArrowRight size={17} /></button></form><p className="modal-privacy"><CheckCircle2 size={13} /> Your details only go to this hiring team.</p></section></div>}

      {conversation && <ApplicationCommunications applicationId={conversation.applicationId} applicationTitle={conversation.title} company={conversation.company} candidateName={conversation.name} role={user.role} onClose={() => setConversation(null)} onSent={(kind) => {
        const stage = kind === "interview" ? "Interview" : kind === "offer" ? "Offer" : kind === "rejection" ? "Declined" : undefined;
        if (!stage) return;
        setCandidates((current) => current.map((candidate) => candidate.id === conversation.applicationId ? { ...candidate, stage } : candidate));
        setApplications((current) => current.map((application) => application.id === conversation.applicationId ? { ...application, stage } : application));
      }} />}

      {postOpen && <JobPostModal company={user.company} admin={isAdmin} onClose={() => setPostOpen(false)} onPublish={async (job) => {
        const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not publish this role.");
        const savedJob = result.job;
        const newJob: Job = { ...job, ...savedJob, posted: "Just now", postedAt: new Date().toISOString(), salary: formatSalary(job.salaryMin, job.salaryMax), tags: job.tags ?? [], color: "#e8eff0", initials: job.company.slice(0, 1).toUpperCase() };
        setJobs((current) => [newJob, ...current]);
        setNotice("Your job is live on CareerHub.");
        setPostOpen(false);
      }} />}

      {commandOpen && <div className="command-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette"><label className="command-search"><Search size={18} /><input autoFocus value={commandSearch} onChange={(event) => setCommandSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && matchingCommands[0]) navigate(matchingCommands[0].view); }} placeholder="Search pages and actions…" /><kbd>ESC</kbd></label><div className="command-results">{matchingCommands.map((item) => <button key={item.view} onClick={() => navigate(item.view)}><span>{item.label}</span><ArrowRight size={15} /></button>)}{matchingCommands.length === 0 && <p>No matching pages</p>}</div></section></div>}

      {notice && <div className="toast" role="status"><CheckCircle2 size={17} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15} /></button></div>}
    </main>
  );
}

function navLabel(view: View) {
  const labels: Record<View, string> = { discover: "Discover", applications: "Applications", saved: "Saved jobs", profile: "Profile", community: "Community", overview: "Overview", openings: "Job openings", candidates: "Candidates", admin: "Overview", users: "User accounts", help: "Help & Contact", support: "Support inbox" };
  return labels[view];
}

function userInitials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="subpage-heading"><span className="eyebrow"><span className="eyebrow-line" />{eyebrow}</span><h1>{title}</h1><p>{description}</p></section>;
}

function EmptyMessage({ title, detail, action, onAction }: { title: string; detail: string; action: string; onAction: () => void }) {
  return <div className="large-empty-state"><span className="empty-illustration"><Sparkles size={21} /></span><h2>{title}</h2><p>{detail}</p><button className="primary-button" onClick={onAction}>{action}<ArrowRight size={15} /></button></div>;
}

function RecruiterOverview({ jobs, candidates, onNavigate, onPost }: { jobs: Job[]; candidates: Candidate[]; onNavigate: (view: View) => void; onPost: () => void }) {
  return <><section className="recruiter-welcome"><span className="eyebrow"><span className="eyebrow-line" />YOUR HIRING DESK</span><div className="recruiter-welcome-row"><div><h1>Great teams start<br />with <em>good people.</em></h1><p>Here’s where the right people and the right work meet.</p></div><button className="primary-button" onClick={onPost}><Plus size={16} />Post a new role</button></div></section><section className="metrics-grid"><MetricCard label="Open positions" value={jobs.filter((job) => job.status !== "closed").length} trend="Across your team" icon={<BriefcaseBusiness size={17} />} /><MetricCard label="In the pipeline" value={candidates.length} trend="Ready for a review" icon={<UsersRound size={17} />} /><MetricCard label="Interviews booked" value={candidates.filter((candidate) => candidate.stage === "Interview").length} trend="This week" icon={<Clock3 size={17} />} /></section><div className="dashboard-columns"><section className="dashboard-section"><div className="section-title-row"><div><span className="eyebrow eyebrow-small">KEEP THE MOMENTUM</span><h2>Recent candidates</h2></div><button className="text-action" onClick={() => onNavigate("candidates")}>View all<ArrowRight size={14} /></button></div><div className="compact-candidates">{candidates.length ? candidates.slice(0, 3).map((candidate) => <div className="compact-candidate" key={candidate.id}><span className="candidate-avatar" style={{ background: candidate.color }}>{candidate.avatar}</span><span className="candidate-copy"><strong>{candidate.name}</strong><small>{candidate.title}</small></span><ApplicationPill stage={candidate.stage} /></div>) : <div className="dashboard-empty"><UsersRound size={18} /><span>New applicants will appear here.</span></div>}</div></section><section className="dashboard-section openings-section"><div className="section-title-row"><div><span className="eyebrow eyebrow-small">MAKING AN IMPACT</span><h2>Open roles</h2></div><button className="text-action" onClick={() => onNavigate("openings")}>Manage<ArrowRight size={14} /></button></div><div className="compact-openings">{jobs.filter((job) => job.status !== "closed").length ? jobs.filter((job) => job.status !== "closed").slice(0, 3).map((job) => <button className="compact-opening" key={job.id} onClick={() => onNavigate("openings")}><CompanyMark job={job} /><span><strong>{job.title}</strong><small>{job.company} · {job.location}</small></span><ArrowUpRight size={15} /></button>) : <div className="dashboard-empty"><BriefcaseBusiness size={18} /><span>Your first role can start a great conversation.</span><button onClick={onPost}>Create opening<ArrowRight size={13} /></button></div>}</div></section></div><div className="recruiter-bottom-note"><span><Sparkles size={17} /></span><p><strong>Good hiring is a human thing.</strong> Make space for thoughtful conversations, and the right match will follow.</p><button onClick={() => onNavigate("candidates")}>Open your pipeline<ArrowRight size={14} /></button></div></>;
}

function MetricCard({ label, value, trend, icon }: { label: string; value: number; trend: string; icon: React.ReactNode }) {
  const displayLabel = label === "Interviews booked" ? "In interview stage" : label;
  const displayTrend = trend === "This week" || trend === "Ready for a review" ? "All applications" : trend;
  return <article className="metric-card"><span className="metric-icon">{icon}</span><span className="metric-value">{value.toString().padStart(2, "0")}</span><span className="metric-label">{displayLabel}</span><span className="metric-trend">{displayTrend}</span></article>;
}

function RecruiterOpenings({ jobs, onPost, onSelect, onStatus }: { jobs: Job[]; onPost: () => void; onSelect: (id: string) => void; onStatus: (id: string, status: "open" | "closed") => void }) {
  return <><PageHeading eyebrow="THE WORK YOU’RE BUILDING" title="Your open roles." description="Good people are out there. Let’s make it easy to find each other." /><div className="openings-toolbar"><span>{jobs.filter((job) => job.status !== "closed").length} active · {jobs.length} total opportunities</span><button className="primary-button" onClick={onPost}><Plus size={16} />Post a new role</button></div>{jobs.length ? <div className="recruiter-job-list">{jobs.map((job) => <article className="recruiter-job-row" key={job.id}><CompanyMark job={job} /><div className="recruiter-job-copy"><span className="recruiter-job-title">{job.title}</span><span>{job.company} · {job.location}</span></div><span className="recruiter-job-type">{job.workplace}</span><span className={`opening-live${job.status === "closed" ? " opening-closed" : ""}`}><i />{job.status === "closed" ? "Closed" : "Active"}</span><button className="opening-toggle" onClick={() => onStatus(job.id, job.status === "closed" ? "open" : "closed")}>{job.status === "closed" ? "Reopen" : "Close"}</button><button className="row-icon" onClick={() => onSelect(job.id)} aria-label={`View ${job.title}`}><ArrowUpRight size={16} /></button></article>)}</div> : <div className="opening-empty"><span className="opportunity-mark"><BriefcaseBusiness size={22} /></span><div><h2>Your first role sets things in motion.</h2><p>Publish a real opening and the right candidates can start finding you.</p><button className="primary-button" onClick={onPost}><Plus size={15} />Create your first opening</button></div></div>}</>;
}

function RecruiterCandidates({ candidates, onStage }: { candidates: Candidate[]; onStage: (id: string, stage: string) => void }) {
  const stages = ["New", "In review", "Shortlisted", "Interview", "Offer", "Hired", "Declined"];
  function dropCandidate(event: React.DragEvent<HTMLElement>, stage: string) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    if (id) onStage(id, stage);
  }
  return <><PageHeading eyebrow="THE PEOPLE BEHIND THE PROFILES" title="Meet your candidates." description="Move candidates through your hiring stages." /><div className="pipeline-summary"><span><strong>{candidates.length}</strong> people in your pipeline</span><span><UsersRound size={16} /> Drag a candidate to move stages, or use the menu</span></div>{candidates.length ? <div className="pipeline-board">{stages.map((stage) => {
    const stageCandidates = candidates.filter((candidate) => candidate.stage === stage);
    return <section className="pipeline-column" key={stage} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropCandidate(event, stage)}>
      <header><strong>{stage}</strong><span>{stageCandidates.length}</span></header>
      <div className="pipeline-column-body">{stageCandidates.map((candidate) => <article className="pipeline-card" key={candidate.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", candidate.id)}>
        <div className="pipeline-card-person"><span className="candidate-avatar" style={{ background: candidate.color }}>{candidate.avatar}</span><span><strong>{candidate.name}</strong><small>{candidate.title}</small></span></div>
        <p>{candidate.job}</p>
        <div className="pipeline-card-footer"><label className="candidate-stage-label"><span className="sr-only">Move {candidate.name} to stage</span><select value={candidate.stage} onChange={(event) => onStage(candidate.id, event.target.value)} aria-label={`Move ${candidate.name} to stage`}>{stages.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={13} /></label>{candidate.resumeUrl && <a className="candidate-resume" href={candidate.resumeUrl} aria-label={`Download ${candidate.name}'s resume`}><ArrowDownToLine size={15} /></a>}</div>
      </article>)}{stageCandidates.length === 0 && <div className="pipeline-column-empty">No candidates in this stage yet</div>}</div>
    </section>;
  })}</div> : <div className="opening-empty"><span className="opportunity-mark"><UsersRound size={22} /></span><div><h2>No applications in the pipeline.</h2><p>Applicants who apply to your live roles will show up here.</p></div></div>}</>;
}

function AdminOverview() {
  const [stats, setStats] = useState<{ accounts: { total: number; candidates: number; recruiters: number; admins: number; disabled: number }; jobs: { total: number; open: number }; applications: { total: number } } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void fetch("/api/admin/overview").then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setStats(data); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load dashboard.")); }, []);
  return <><section className="recruiter-welcome admin-welcome"><span className="eyebrow"><span className="eyebrow-line" />CAREERHUB CONTROL ROOM</span><div className="recruiter-welcome-row"><div><h1>A clear view of<br /><em>the whole picture.</em></h1><p>Keep the community healthy, useful, and moving forward.</p></div><span className="admin-shield"><ShieldCheck size={25} /></span></div></section>{error && <p className="form-error">{error}</p>}<section className="metrics-grid"><MetricCard label="All accounts" value={stats?.accounts.total ?? 0} trend="Across CareerHub" icon={<UsersRound size={17} />} /><MetricCard label="Active openings" value={stats?.jobs.open ?? 0} trend={`${stats?.jobs.total ?? 0} total listings`} icon={<BriefcaseBusiness size={17} />} /><MetricCard label="Applications" value={stats?.applications.total ?? 0} trend={`${stats?.accounts.disabled ?? 0} suspended accounts`} icon={<FileText size={17} />} /></section><section className="admin-role-breakdown"><div className="section-title-row"><div><span className="eyebrow eyebrow-small">A HEALTHY COMMUNITY</span><h2>Account mix</h2></div></div><div className="role-breakdown-grid"><div><span className="role-badge-dot role-candidate" /><span><strong>{stats?.accounts.candidates ?? 0}</strong><small>Candidates</small></span></div><div><span className="role-badge-dot role-recruiter" /><span><strong>{stats?.accounts.recruiters ?? 0}</strong><small>Recruiters</small></span></div><div><span className="role-badge-dot role-admin" /><span><strong>{stats?.accounts.admins ?? 0}</strong><small>Administrators</small></span></div></div></section></>;
}

type AdminAccount = { id: string; name: string; email: string; role: string; company: string; disabled: boolean; createdAt: string };

function AdminUsers() {
  const [users, setUsers] = useState<AdminAccount[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  useEffect(() => { void fetch("/api/admin/users").then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setUsers(data.users); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load accounts.")); }, []);
  async function updateUser(id: string, change: { role?: string; disabled?: boolean }) {
    const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...change }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not update account."); return; }
    setUsers((current) => current.map((user) => user.id === id ? data.user : user));
  }
  const visibleUsers = users.filter((user) => {
    const matchesQuery = `${user.name} ${user.email} ${user.company}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (roleFilter === "All roles" || user.role === roleFilter) && (statusFilter === "All statuses" || (statusFilter === "Suspended" ? user.disabled : !user.disabled));
  });
  async function toggleSelectedAccess() {
    if (!selectedIds.length) return;
    const allSuspended = visibleUsers.filter((user) => selectedIds.includes(user.id)).every((user) => user.disabled);
    setBulkBusy(true);
    for (const id of selectedIds) await updateUser(id, { disabled: !allSuspended });
    setSelectedIds([]);
    setBulkBusy(false);
  }
  const allVisibleSelected = visibleUsers.length > 0 && visibleUsers.every((user) => selectedIds.includes(user.id));
  return <><PageHeading eyebrow="COMMUNITY STEWARDSHIP" title="People make the platform." description="Manage account roles and access from one place." /><div className="admin-table-heading"><span>{visibleUsers.length} of {users.length} accounts</span><span>New admin accounts are provisioned from the terminal.</span></div>{error && <p className="form-error">{error}</p>}<div className="admin-controls"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, company" /></label><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role"><option>All roles</option><option value="candidate">Candidate</option><option value="recruiter">Recruiter</option><option value="admin">Admin</option></select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option>All statuses</option><option>Active</option><option>Suspended</option></select><button className="primary-button" disabled={selectedIds.length === 0 || bulkBusy} onClick={() => void toggleSelectedAccess()}>{bulkBusy ? "Updating…" : selectedIds.length ? `${visibleUsers.filter((user) => selectedIds.includes(user.id)).every((user) => user.disabled) ? "Restore" : "Suspend"} ${selectedIds.length} selected` : "Select accounts"}</button></div><div className="admin-users-list"><div className="admin-users-header"><span><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelectedIds(allVisibleSelected ? selectedIds.filter((id) => !visibleUsers.some((user) => user.id === id)) : [...new Set([...selectedIds, ...visibleUsers.map((user) => user.id)])])} aria-label="Select all visible accounts" /> ACCOUNT</span><span>ROLE</span><span>STATUS</span><span>JOINED</span><span>ACCESS</span></div>{visibleUsers.map((user) => <article className="admin-user-row" key={user.id}><span className="admin-user-identity"><input type="checkbox" checked={selectedIds.includes(user.id)} onChange={() => setSelectedIds((current) => current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id])} aria-label={`Select ${user.name}`} /><span className="candidate-avatar" style={{ background: "#e8eee4" }}>{userInitials(user.name)}</span><span><strong>{user.name}</strong><small>{user.email}{user.company ? ` · ${user.company}` : ""}</small></span></span><select value={user.role} onChange={(event) => void updateUser(user.id, { role: event.target.value })} aria-label={`Role for ${user.name}`}><option value="candidate">Candidate</option><option value="recruiter">Recruiter</option><option value="admin">Admin</option></select><span className={`account-status ${user.disabled ? "account-disabled" : ""}`}><i />{user.disabled ? "Suspended" : "Active"}</span><span className="admin-joined">{new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span><button className="admin-access-button" onClick={() => void updateUser(user.id, { disabled: !user.disabled })}>{user.disabled ? "Restore" : "Suspend"}</button></article>)}{visibleUsers.length === 0 && !error && <div className="admin-empty">No accounts match these filters.</div>}</div></>;
}

function JobPostModal({ company, admin, onClose, onPublish }: { company: string; admin: boolean; onClose: () => void; onPublish: (job: Omit<Job, "id" | "posted" | "color" | "initials" | "salary"> & { salaryMin: number; salaryMax: number }) => Promise<void> }) {
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const steps = ["Basic info", "Role description", "Requirements & pay", "Publish"];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) {
      const invalidField = formRef.current?.querySelector(`[data-step="${step}"] :invalid`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (invalidField) { invalidField.reportValidity(); return; }
      setStep((current) => current + 1);
      return;
    }
    setPublishing(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const salaryMin = Number(form.get("salaryMin")) || 0;
    const salaryMax = Number(form.get("salaryMax")) || 0;
    try {
      await onPublish({ title: String(form.get("title")), company: String(form.get("company") || company), location: String(form.get("location")), workplace: String(form.get("workplace")) as Job["workplace"], employment: String(form.get("employment")), salaryMin, salaryMax, description: String(form.get("description")), tags: String(form.get("tags")).split(",").map((tag) => tag.trim()).filter(Boolean) });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not publish this role.");
      setPublishing(false);
    }
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card post-modal">
        <div className="modal-top">
          <span className="modal-kicker">MAKE ROOM FOR GREAT WORK</span>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </div>
        <h2>Post a new role</h2>
        <p className="modal-intro">Add the essentials, review, and publish when you’re ready.</p>
        <nav className="post-stepper" aria-label="Job posting progress">{steps.map((label, index) => <button type="button" key={label} className={index === step ? "post-step-active" : index < step ? "post-step-complete" : ""} disabled={index > step} onClick={() => index < step && setStep(index)}><i>{index < step ? <Check size={11} /> : index + 1}</i><span>{label}</span></button>)}</nav>
        <form className="modal-form post-job-form" onSubmit={submit} noValidate ref={formRef}>
          <div className="post-step-content" data-step="0" hidden={step !== 0}>
            <label>Role title<input name="title" placeholder="e.g. Senior Product Designer" required /></label>
            <div className="form-two-col">
              <label>Company<input name="company" defaultValue={company} placeholder="Your company" readOnly={!admin} required /></label>
              <label>Location<input name="location" placeholder="City or remote" required /></label>
            </div>
            <div className="form-two-col">
              <label>Workplace<select name="workplace"><option>Remote</option><option>Hybrid</option><option>On-site</option></select></label>
              <label>Employment<select name="employment"><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select></label>
            </div>
          </div>
          <div className="post-step-content" data-step="1" hidden={step !== 1}>
            <label>About the role<textarea name="description" rows={7} placeholder="What will this person do, and what makes the opportunity meaningful?" required /></label>
          </div>
          <div className="post-step-content" data-step="2" hidden={step !== 2}>
            <div className="form-two-col">
              <label>Salary minimum<input name="salaryMin" type="number" min="0" placeholder="120000" /></label>
              <label>Salary maximum<input name="salaryMax" type="number" min="0" placeholder="160000" /></label>
            </div>
            <label>Skills <span className="optional">COMMA-SEPARATED</span><input name="tags" placeholder="Research, strategy, client services" /></label>
          </div>
          <div className="post-step-content post-review" data-step="3" hidden={step !== 3}>
            <span className="section-icon"><CheckCircle2 size={19} /></span><strong>Ready to publish</strong><p>Your role will be added to live listings and candidates can apply with their profile and resume.</p>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="post-step-actions">{step > 0 && <button type="button" className="post-back-button" onClick={() => setStep((current) => current - 1)} disabled={publishing}>Back</button>}<button className="apply-button" type="submit" disabled={publishing}>{publishing ? "Publishing…" : step === steps.length - 1 ? "Publish this role" : "Continue"}<ArrowRight size={17} /></button></div>
        </form>
      </section>
    </div>
  );
}