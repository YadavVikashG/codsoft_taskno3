"use client";

import { ArrowUpRight, CheckCircle2, Flag, Headset, Lightbulb, Mail, Megaphone, Phone, Send } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { AuthUser } from "@/lib/types";

type SupportCategory = "suggestion" | "campaign" | "report_recruiter" | "other";
type SupportRequest = { id: string; category: SupportCategory; subject: string; message: string; recruiterEmail: string; status: "open" | "reviewing" | "resolved"; adminReply: string; createdAt: string; senderName: string; senderEmail: string };

const categoryLabels: Record<SupportCategory, string> = {
  suggestion: "Product suggestion",
  campaign: "Campaign idea",
  report_recruiter: "Report a recruiter",
  other: "Something else",
};

export function HelpCenter({ user }: { user: AuthUser }) {
  const [category, setCategory] = useState<SupportCategory>("suggestion");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<SupportRequest[]>([]);

  async function refreshRequests() {
    const response = await fetch("/api/support");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load your support requests.");
    setRequests(result.requests);
  }

  useEffect(() => {
    void refreshRequests().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load your support requests."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject, message, recruiterEmail }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send your request.");
      await refreshRequests();
      setSent(true);
      setSubject("");
      setMessage("");
      setRecruiterEmail("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send your request.");
    } finally {
      setBusy(false);
    }
  }

  const topics: { id: SupportCategory; title: string; detail: string; icon: typeof Lightbulb }[] = [
    { id: "suggestion", title: "Share an idea", detail: "Help us make CareerHub better.", icon: Lightbulb },
    { id: "campaign", title: "Pitch a campaign", detail: "Suggest a community or hiring campaign.", icon: Megaphone },
    { id: "report_recruiter", title: "Report a recruiter", detail: "Tell us about a concern or unsafe interaction.", icon: Flag },
  ];

  return <><section className="recruiter-welcome help-welcome"><span className="eyebrow"><span className="eyebrow-line" />CAREERHUB HELP DESK</span><div className="recruiter-welcome-row"><div><h1>We’re listening.<br /><em>What’s on your mind?</em></h1><p>Real people are here to help make your experience better.</p></div><span className="help-hero-icon"><Headset size={25} /></span></div></section>
    <section className="help-contact-grid">
      <a className="help-contact-card" href="mailto:yadavvikashgajraj@gmail.com"><span><Mail size={19} /></span><small>EMAIL OUR TEAM</small><strong>yadavvikashgajraj@gmail.com</strong><i><ArrowUpRight size={15} /></i></a>
      <a className="help-contact-card" href="tel:+919140878781"><span><Phone size={19} /></span><small>CALL OUR TEAM</small><strong>9140878781</strong><i><ArrowUpRight size={15} /></i></a>
    </section>
    <section className="help-topic-list" aria-label="Support topics">{topics.map(({ id, title, detail, icon: Icon }) => <button key={id} className={`help-topic${category === id ? " help-topic-active" : ""}`} onClick={() => { setCategory(id); setSent(false); }}><span className="help-topic-icon"><Icon size={17} /></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight size={16} /></button>)}</section>
    <section className="help-form-panel"><div className="help-form-heading"><span className="eyebrow"><span className="eyebrow-line" />SEND A NOTE</span><h2>Let’s get this to the right person.</h2><p>Signed in as <strong>{user.name}</strong>. You can follow your requests and read admin replies here.</p></div><form className="support-form" onSubmit={submit}><label>Topic<select value={category} onChange={(event) => { setCategory(event.target.value as SupportCategory); setSent(false); }}><option value="suggestion">Product suggestion</option><option value="campaign">Campaign idea</option><option value="report_recruiter">Report a recruiter</option><option value="other">Something else</option></select></label>{category === "report_recruiter" && <label>Recruiter account email<input type="email" value={recruiterEmail} onChange={(event) => setRecruiterEmail(event.target.value)} placeholder="name@company.com" required /><small>We’ll review the account and your report privately.</small></label>}<label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={category === "campaign" ? "What should we bring to life?" : category === "report_recruiter" ? "What happened?" : "How can we help?"} minLength={3} maxLength={160} required /></label><label>Details<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Share the useful details. Please avoid including passwords or sensitive documents." rows={5} minLength={8} maxLength={5000} required /></label>{error && <p className="support-error" role="alert">{error}</p>}{sent && <p className="support-success"><CheckCircle2 size={15} />Your note is with the CareerHub team.</p>}<button className="primary-button" type="submit" disabled={busy}><Send size={15} />{busy ? "Sending…" : "Send to CareerHub"}</button></form></section>
    <section className="my-support-requests"><header><h2>Your support requests</h2><p>Only you and the CareerHub admin team can see these messages.</p></header>{requests.length ? requests.map((request) => <article className="my-support-request" key={request.id}><div><span className={`support-category support-category-${request.category}`}>{categoryLabels[request.category]}</span><span className={`my-support-status my-support-status-${request.status}`}>{request.status}</span></div><h3>{request.subject}</h3><p>{request.message}</p>{request.adminReply ? <blockquote><strong>CareerHub admin replied</strong><p>{request.adminReply}</p></blockquote> : <small>Waiting for an admin reply.</small>}</article>) : <p className="my-support-empty">You haven’t sent any support requests yet.</p>}</section>
    <p className="help-privacy"><CheckCircle2 size={14} />Your reports and admin replies are private to you and the CareerHub admin team.</p>
  </>;
}

export function SupportInbox() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [error, setError] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [replyBusy, setReplyBusy] = useState("");
  useEffect(() => { void fetch("/api/support").then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setRequests(data.requests); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load support requests.")); }, []);

  async function changeStatus(id: string, status: SupportRequest["status"]) {
    const response = await fetch("/api/support", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not update this request."); return; }
    setRequests((current) => current.map((request) => request.id === id ? { ...request, status: data.request.status } : request));
  }

  async function sendReply(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const reply = replies[id]?.trim() ?? "";
    if (!reply) return;
    setReplyBusy(id);
    setError("");
    try {
      const response = await fetch("/api/support", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, reply }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send this reply.");
      setRequests((current) => current.map((request) => request.id === id ? { ...request, adminReply: data.request.adminReply } : request));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send this reply.");
    } finally {
      setReplyBusy("");
    }
  }

  return <><div className="subpage-heading"><span className="eyebrow"><span className="eyebrow-line" />COMMUNITY CARE</span><h1>Support inbox.</h1><p>Review member reports and reply privately in CareerHub.</p></div>{error && <p className="support-error" role="alert">{error}</p>}{requests.length === 0 ? <div className="opening-empty"><span className="opportunity-mark"><Headset size={22} /></span><div><h2>Your inbox is clear.</h2><p>New member reports and suggestions will arrive here.</p></div></div> : <section className="support-inbox">{requests.map((request) => <article className="support-request" key={request.id}><div className="support-request-top"><span className={`support-category support-category-${request.category}`}>{categoryLabels[request.category]}</span><label><span className="sr-only">Request status</span><select value={request.status} onChange={(event) => void changeStatus(request.id, event.target.value as SupportRequest["status"])}><option value="open">Open</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option></select></label></div><h2>{request.subject}</h2><p>{request.message}</p>{request.recruiterEmail && <strong className="reported-account">Reported recruiter: {request.recruiterEmail}</strong>}<footer><span>From {request.senderName} · {request.senderEmail}</span><time>{new Date(request.createdAt).toLocaleDateString()}</time></footer>{request.adminReply && <blockquote className="support-admin-reply"><strong>Your current reply</strong><p>{request.adminReply}</p></blockquote>}<form className="support-reply-form" onSubmit={(event) => void sendReply(event, request.id)}><label htmlFor={`reply-${request.id}`}>{request.adminReply ? "Update reply" : "Reply privately to this member"}</label><textarea id={`reply-${request.id}`} value={replies[request.id] ?? request.adminReply} onChange={(event) => setReplies((current) => ({ ...current, [request.id]: event.target.value }))} maxLength={5000} rows={3} placeholder="Write a reply visible only to this member." required /><button className="primary-button" disabled={replyBusy === request.id}><Send size={14} />{replyBusy === request.id ? "Sending…" : request.adminReply ? "Update reply" : "Send reply"}</button></form></article>)}</section>}</>;
}