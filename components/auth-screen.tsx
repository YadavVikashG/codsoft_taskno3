"use client";

import { ArrowRight, BriefcaseBusiness, CheckCircle2, Eye, EyeOff, Search, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { AuthUser, UserRole } from "@/lib/types";
import { ThemeControl } from "@/components/theme-control";
import { getThemeImage, ThemeId, ThemeMode } from "@/lib/themes";

export function AuthScreen({ onAuthenticated, theme, themeMode, onSelectTheme, onAutoTheme }: { onAuthenticated: (user: AuthUser) => void; theme: ThemeId; themeMode: ThemeMode; onSelectTheme: (theme: ThemeId) => void; onAutoTheme: () => void }) {
  const [screen, setScreen] = useState<"login" | "register">("login");
  const [role, setRole] = useState<"candidate" | "recruiter">("candidate");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      company: String(form.get("company") ?? ""),
      role: role as UserRole,
    };
    try {
      const response = await fetch(`/api/auth/${screen === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not sign in.");
      onAuthenticated(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-story-photo" style={{ backgroundImage: `url("${getThemeImage(theme)}")` }} />
        <div className="auth-story-shade" />
        <a className="auth-brand" href="/" aria-label="CareerHub home"><span className="brand-symbol"><span /><span /><span /><span /></span><span>career<span>hub</span></span></a>
        <div className="auth-story-copy"><span className="auth-eyebrow"><Sparkles size={14} /> A BETTER KIND OF WORKING</span><h1>Your next chapter<br />looks good <em>on you.</em></h1><p>Find the work, the people, and the room to become what’s next.</p></div>
        <div className="auth-photo-credit"><span />Thoughtful work. Better together.</div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-top"><ThemeControl theme={theme} mode={themeMode} onSelect={onSelectTheme} onAuto={onAutoTheme} /><span>Already have an account?</span><button className="auth-switch-link" onClick={() => { setScreen(screen === "login" ? "register" : "login"); setError(""); }}>{screen === "login" ? "Create one" : "Sign in"}<ArrowRight size={14} /></button></div>
        <div className="auth-form-wrap">
          <span className="auth-mobile-brand"><span className="brand-symbol"><span /><span /><span /><span /></span>career<span>hub</span></span>
          <span className="auth-form-eyebrow">{screen === "login" ? "WELCOME BACK" : "MAKE YOURSELF AT HOME"}</span>
          <h2>{screen === "login" ? "Good to see you." : "Let’s get you started."}</h2>
          <p className="auth-subtitle">{screen === "login" ? "Your next good thing is still out there." : "A few details, then you’re on your way."}</p>

          {screen === "register" && <div className="account-type-picker" role="group" aria-label="Account type"><button className={role === "candidate" ? "account-type-active" : ""} type="button" onClick={() => setRole("candidate")}><Search size={15} /><span><strong>I'm looking</strong><small>Find your next role</small></span></button><button className={role === "recruiter" ? "account-type-active" : ""} type="button" onClick={() => setRole("recruiter")}><BriefcaseBusiness size={15} /><span><strong>I'm hiring</strong><small>Build your team</small></span></button></div>}

          <form className="auth-form" onSubmit={submit}>
            {screen === "register" && <label>Your name<input name="name" autoComplete="name" placeholder="Alex Morgan" minLength={2} maxLength={100} required /></label>}
            {screen === "register" && role === "recruiter" && <label>Company<input name="company" autoComplete="organization" placeholder="Your company" minLength={2} required /></label>}
            <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
            <label>Password<span className="password-input"><input name="password" type={showPassword ? "text" : "password"} autoComplete={screen === "login" ? "current-password" : "new-password"} placeholder={screen === "login" ? "Enter your password" : "At least 10 characters"} minLength={screen === "register" ? 10 : undefined} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? "One moment…" : screen === "login" ? "Sign in" : role === "candidate" ? "Create candidate account" : "Create recruiter account"}<ArrowRight size={16} /></button>
          </form>
          <p className="auth-security"><CheckCircle2 size={14} />Your account and profile stay yours.</p>
          <p className="admin-entry-note">Admin account? Sign in with your administrator credentials.</p>
        </div>
        <div className="auth-panel-footer"><span>© CareerHub 2026</span><span>Made for the work that matters.</span></div>
      </section>
    </main>
  );
}