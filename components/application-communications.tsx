"use client";

import { CalendarClock, CheckCircle2, Download, ExternalLink, FileCheck2, MessageCircle, Mic, Send, Sparkles, Video, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { UserRole } from "@/lib/types";

type MessageKind = "message" | "interview" | "offer" | "rejection";
type ThreadMessage = { id: string; kind: MessageKind; subject: string; body: string; senderId: string; senderName: string; createdAt: string; scheduledAt?: string | null; meetingUrl?: string; meetingExpiresAt?: string | null; hasMeetingUrl?: boolean };
type JobProfile = { description: string; employment: string; salaryMin: number; salaryMax: number };

function getOfferDetails(message: ThreadMessage) {
  const lines = message.body.split("\n");
  const field = (label: string) => lines.find((line) => line.startsWith(`${label}: `))?.slice(label.length + 2);
  const detailsStart = lines.findIndex((line) => line.startsWith("Position: "));
  const responsibilitiesStart = lines.findIndex((line) => line === "Responsibilities:");
  const responsibilitiesEnd = lines.findIndex((line, index) => index > responsibilitiesStart && /^(Company|Compensation|Pay frequency|Bonus\/equity|Proposed start date|Work schedule|Benefits|Contingencies|At-will employment): /.test(line));
  const blankLine = lines.indexOf("");
  return {
    recipient: lines.find((line) => line.startsWith("Dear "))?.replace(/^Dear\s+|,$/g, "") || "Candidate",
    position: field("Position") || message.subject.replace(/^Offer of employment\s*[·-]\s*/i, ""),
    company: field("Company") || message.senderName,
    responsibilities: responsibilitiesStart >= 0 ? lines.slice(responsibilitiesStart + 1, responsibilitiesEnd > -1 ? responsibilitiesEnd : undefined).join("\n").trim() : "",
    compensation: field("Compensation"),
    payFrequency: field("Pay frequency"),
    bonusEquity: field("Bonus/equity"),
    startDate: field("Proposed start date"),
    workSchedule: field("Work schedule"),
    benefits: field("Benefits"),
    contingencies: field("Contingencies"),
    atWill: field("At-will employment"),
    note: lines.slice(blankLine + 1, detailsStart > -1 ? detailsStart : undefined).join("\n").trim(),
  };
}

function isJitsiRoom(url?: string) {
  if (!url) return false;
  try {
    const meeting = new URL(url);
    return meeting.protocol === "https:" && meeting.hostname === "meet.jit.si";
  } catch {
    return false;
  }
}

const modes: { id: MessageKind; label: string }[] = [
  { id: "message", label: "Message" },
  { id: "interview", label: "Schedule interview" },
  { id: "offer", label: "Offer letter" },
  { id: "rejection", label: "Decision letter" },
];

function downloadLetter(message: ThreadMessage) {
  if (message.kind === "offer") {
    const offer = getOfferDetails(message);
    const { recipient, position, company: employer, compensation, payFrequency, bonusEquity, startDate, workSchedule, responsibilities, benefits, contingencies, atWill, note } = offer;
    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 54;
    const safeText = (value: string) => value.replace(/[–—]/g, "-").replace(/·/g, "|");

    pdf.setFillColor(79, 70, 229);
    pdf.rect(0, 0, pageWidth, 132, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("CAREERHUB", margin, 43);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text("A NEW CHAPTER STARTS HERE", margin, 63);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(25);
    pdf.text("Offer of employment", margin, 105);

    pdf.setTextColor(100, 116, 139);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("PREPARED FOR", margin, 172);
    pdf.text("ISSUED", pageWidth - margin - 112, 172);
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(13);
    pdf.text(safeText(recipient), margin, 194);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    pdf.text(new Date(message.createdAt).toLocaleDateString("en-US", { dateStyle: "long" }), pageWidth - margin - 112, 194);

    pdf.setTextColor(79, 70, 229);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("POSITION", margin, 245);
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(20);
    pdf.text(pdf.splitTextToSize(safeText(position), pageWidth - margin * 2), margin, 273);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(71, 85, 105);
    pdf.text(safeText(employer), margin, 300);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, 322, pageWidth - margin, 322);

    const cardTop = 344;
    const cardGap = 10;
    const cardWidth = (pageWidth - margin * 2 - cardGap * 2) / 3;
    const formattedStart = startDate && startDate !== "Not specified" ? new Date(`${startDate}T00:00:00`).toLocaleDateString("en-US", { dateStyle: "medium" }) : "To be agreed";
    const cardData = [["COMPENSATION", `${compensation || "To be agreed"}${payFrequency ? ` / ${payFrequency.toLowerCase()}` : ""}`], ["PROPOSED START", formattedStart], ["WORK SCHEDULE", workSchedule || "To be agreed"]];
    cardData.forEach(([label, value], index) => {
      const x = margin + index * (cardWidth + cardGap);
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(x, cardTop, cardWidth, 67, 6, 6, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text(label, x + 11, cardTop + 21);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      pdf.text(pdf.splitTextToSize(safeText(value), cardWidth - 22).slice(0, 2), x + 11, cardTop + 42);
    });

    let y = 454;
    const writeSection = (heading: string, content: string) => {
      if (y > 680) { pdf.addPage(); y = 72; }
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(79, 70, 229);
      pdf.text(safeText(heading.toUpperCase()), margin, y);
      y += 16;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(51, 65, 85);
      for (const line of pdf.splitTextToSize(safeText(content), pageWidth - margin * 2)) {
        if (y > 700) { pdf.addPage(); y = 72; }
        pdf.text(line, margin, y);
        y += 15;
      }
      y += 12;
    };
    pdf.setTextColor(15, 23, 42);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`Dear ${safeText(recipient)},`, margin, y);
    y += 25;
    writeSection("Offer details", note || "We are pleased to offer you this position.");
    writeSection("Position responsibilities", responsibilities || "Responsibilities are described in the job profile.");
    writeSection("Bonus and equity", bonusEquity || "None specified.");
    writeSection("Benefits", benefits || "To be confirmed by the hiring team.");
    writeSection("Contingencies", contingencies || "None specified.");
    writeSection("At-will employment", atWill || "Employment is at will. Either the employer or employee may end the employment relationship at any time, for any legal reason.");
    if (y > 650) { pdf.addPage(); y = 72; }
    pdf.setTextColor(51, 65, 85);
    pdf.text("We look forward to hearing from you.", margin, y);
    y += 37;
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(15, 23, 42);
    pdf.text(safeText(employer), margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text("Hiring team", margin, y + 15);

    for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) {
      pdf.setPage(page);
      const height = pdf.internal.pageSize.getHeight();
      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, height - 42, pageWidth - margin, height - 42);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text("CONFIDENTIAL | CANDIDATE OFFER", margin, height - 26);
      pdf.text(`${page} / ${pdf.getNumberOfPages()}`, pageWidth - margin, height - 26, { align: "right" });
    }

    const filename = position.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "employment";
    pdf.save(`${filename}-offer-letter.pdf`);
    return;
  }
  const file = new Blob([`${message.subject}\n\n${message.body}\n\n${new Date(message.createdAt).toLocaleString()}`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${message.kind}-letter.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ApplicationCommunications({
  applicationId,
  applicationTitle,
  company,
  candidateName,
  role,
  onClose,
  onSent,
}: {
  applicationId: string;
  applicationTitle: string;
  company: string;
  candidateName: string;
  role: UserRole;
  onClose: () => void;
  onSent: (kind: MessageKind) => void;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [kind, setKind] = useState<MessageKind>("message");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [videoRoom, setVideoRoom] = useState<{ url: string; title: string; expiresAt: string } | null>(null);
  const [jobProfile, setJobProfile] = useState<JobProfile>({ description: "", employment: "Full-time", salaryMin: 0, salaryMax: 0 });
  const [offerSalary, setOfferSalary] = useState("");
  const [payFrequency, setPayFrequency] = useState("Annual");
  const [bonusEquity, setBonusEquity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [workSchedule, setWorkSchedule] = useState("Full-time, 40 hours per week");
  const [benefits, setBenefits] = useState("");
  const [contingencies, setContingencies] = useState("");
  const atWillStatement = "Employment is at will. Either the employer or employee may end the employment relationship at any time, for any legal reason.";

  async function loadMessages() {
    const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/messages`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load this conversation.");
    setMessages(data.messages ?? []);
    if (data.application) {
      setJobProfile({
        description: data.application.jobDescription ?? "",
        employment: data.application.employment ?? "Full-time",
        salaryMin: Number(data.application.salaryMin) || 0,
        salaryMax: Number(data.application.salaryMax) || 0,
      });
      setWorkSchedule(data.application.employment === "Full-time" ? "Full-time, 40 hours per week" : `${data.application.employment ?? "Role"} schedule to be agreed`);
    }
  }

  useEffect(() => {
    void loadMessages().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load this conversation."));
    const refreshId = window.setInterval(() => { void loadMessages().catch(() => undefined); }, 60_000);
    return () => window.clearInterval(refreshId);
  }, [applicationId]);

  useEffect(() => {
    if (!videoRoom) return;
    const remaining = new Date(videoRoom.expiresAt).getTime() - Date.now();
    if (remaining <= 0) { setVideoRoom(null); return; }
    const expiryId = window.setTimeout(() => setVideoRoom(null), remaining);
    return () => window.clearTimeout(expiryId);
  }, [videoRoom]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    const form = new FormData(formElement);
    const note = String(form.get("body") ?? "").trim();
    let body = note;
    let subject = "Message about your application";
    if (kind === "interview") subject = `Interview invitation · ${applicationTitle}`;
    if (kind === "offer") {
      subject = `Offer of employment · ${applicationTitle}`;
      body = `Dear ${candidateName},\n\n${note || "We are pleased to offer you this position."}\n\nPosition: ${applicationTitle}\nResponsibilities:\n${jobProfile.description || "Responsibilities to be confirmed with the hiring team."}\nCompany: ${company}\nCompensation: ${offerSalary}\nPay frequency: ${payFrequency}\nBonus/equity: ${bonusEquity || "None specified"}\nProposed start date: ${startDate}\nWork schedule: ${workSchedule}\nBenefits: ${benefits}\nContingencies: ${contingencies || "None specified"}\nAt-will employment: ${atWillStatement}\n\nWe look forward to hearing from you.\n${company}`;
    }
    if (kind === "rejection") subject = `Application update · ${applicationTitle}`;
    try {
      const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, subject, message: body, scheduledAt: kind === "interview" ? scheduledAt : null, meetingUrl: kind === "interview" ? meetingUrl : "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send this update.");
      setMessages((current) => [...current, data.message]);
      setSent(true);
      onSent(kind);
      formElement.reset();
      setScheduledAt("");
      setMeetingUrl("");
      setOfferSalary("");
      setPayFrequency("Annual");
      setBonusEquity("");
      setStartDate("");
      setBenefits("");
      setContingencies("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send this update.");
    } finally {
      setBusy(false);
    }
  }

  const canSendFormal = role === "recruiter" || role === "admin";
  const activeModes = canSendFormal ? modes : modes.slice(0, 1);

  function createVideoRoom() {
    const applicationSlug = applicationId.replace(/[^a-zA-Z0-9-]/g, "").slice(-16) || "interview";
    setMeetingUrl(`https://meet.jit.si/careerhub-${applicationSlug}-${crypto.randomUUID()}`);
  }

  return (
    <div className="modal-backdrop communication-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="communication-dialog" role="dialog" aria-modal="true" aria-labelledby="communication-title">
        <header className="communication-header">
          <div><span className="eyebrow"><span className="eyebrow-line" />APPLICATION THREAD</span><h2 id="communication-title">{candidateName}</h2><p>{applicationTitle} · {company}</p></div>
          <button className="icon-button" onClick={onClose} aria-label="Close conversation"><X size={20} /></button>
        </header>

        <div className="communication-thread" aria-live="polite">
          {messages.length === 0 ? <div className="thread-empty"><span><MessageCircle size={19} /></span><strong>Start the conversation.</strong><p>Keep interview details and hiring updates together with this application.</p></div> : messages.map((message) => {
            const offer = message.kind === "offer" ? getOfferDetails(message) : null;
            return <article className={`thread-message${message.kind === "offer" || message.kind === "rejection" ? " thread-letter" : ""}`} key={message.id}>
              <div className="thread-message-top"><strong>{message.senderName}</strong><time>{new Date(message.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></div>
              <span className={`thread-kind thread-kind-${message.kind}`}>{message.kind === "interview" ? <CalendarClock size={13} /> : message.kind === "offer" ? <FileCheck2 size={13} /> : <MessageCircle size={13} />}{message.kind === "rejection" ? "Decision letter" : message.kind === "offer" ? "Offer letter" : message.kind === "interview" ? "Interview" : "Message"}</span>
              {offer ? <div className="offer-letter-card">
                <div className="offer-letter-banner"><span><Sparkles size={15} /> CAREERHUB OFFER</span><small>CONFIDENTIAL</small></div>
                <div className="offer-letter-content"><p className="offer-letter-kicker">AN OFFER OF EMPLOYMENT</p><h3>{offer.position}</h3><p className="offer-letter-company">{offer.company}</p>
                  <div className="offer-letter-terms">{offer.compensation && <div><small>COMPENSATION · {offer.payFrequency || "PAY FREQUENCY NOT SET"}</small><strong>{offer.compensation}</strong></div>}{offer.startDate && <div><small>PROPOSED START</small><strong>{new Date(`${offer.startDate}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" })}</strong></div>}{offer.workSchedule && <div><small>WORK SCHEDULE</small><strong>{offer.workSchedule}</strong></div>}</div>
                  <p className="offer-letter-greeting">Dear {offer.recipient},</p><p className="offer-letter-body">{offer.note || "We are pleased to offer you this position."}</p>
                  <section className="offer-letter-section"><h4>Position details</h4><p><strong>Responsibilities</strong>{offer.responsibilities || "See the job profile for the role responsibilities."}</p></section>
                  <section className="offer-letter-terms-grid"><div><h4>Bonus and equity</h4><p>{offer.bonusEquity || "None specified."}</p></div><div><h4>Benefits</h4><p>{offer.benefits || "Not specified."}</p></div><div><h4>Contingencies</h4><p>{offer.contingencies || "None specified."}</p></div></section>
                  <p className="offer-letter-at-will"><strong>At-will employment</strong>{offer.atWill || "Employment is at will. Either the employer or employee may end the employment relationship at any time, for any legal reason."}</p>
                  <p className="offer-letter-closing">We look forward to hearing from you.</p><div className="offer-letter-signature"><strong>{offer.company}</strong><span>Hiring team</span></div>
                </div><button className="letter-download" onClick={() => downloadLetter(message)}><Download size={14} />Download offer as PDF</button>
              </div> : <><h3>{message.subject}</h3>{message.scheduledAt && <div className="scheduled-details"><CalendarClock size={15} /><strong>{new Date(message.scheduledAt).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}</strong>{message.meetingUrl && (isJitsiRoom(message.meetingUrl) ? <button type="button" onClick={() => setVideoRoom({ url: message.meetingUrl!, title: message.subject, expiresAt: message.meetingExpiresAt! })}><Video size={14} />Join video interview</button> : <a href={message.meetingUrl} target="_blank" rel="noreferrer">Join external interview<ExternalLink size={13} /></a>)}{message.hasMeetingUrl && !message.meetingUrl && new Date(message.scheduledAt).getTime() > Date.now() && <span className="meeting-window-note">Join opens at the scheduled start; link expires 30 minutes later.</span>}{message.hasMeetingUrl && !message.meetingUrl && message.meetingExpiresAt && new Date(message.meetingExpiresAt).getTime() <= Date.now() && <span className="meeting-window-expired">Interview link expired 30 minutes after start.</span>}</div>}<p className="thread-message-body">{message.body}</p>{message.kind === "rejection" && <button className="letter-download" onClick={() => downloadLetter(message)}><Download size={14} />Download letter</button>}</>}
            </article>;
          })}
        </div>

        <form className="communication-composer" onSubmit={send}>
          <div className="communication-modes" role="group" aria-label="Choose an update type">
            {activeModes.map((modeOption) => <button key={modeOption.id} type="button" className={kind === modeOption.id ? "communication-mode-active" : ""} onClick={() => { setKind(modeOption.id); setSent(false); setError(""); }}>{modeOption.label}</button>)}
          </div>
          {kind === "interview" && <div className="communication-fields"><label>Interview date and time<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required /></label><label>Meeting link <span>OPTIONAL</span><input type="url" value={meetingUrl} onChange={(event) => setMeetingUrl(event.target.value)} placeholder="https://" /></label><div className="video-room-create"><span>{isJitsiRoom(meetingUrl) ? "In-app video room ready" : "Create a built-in video interview room"}</span><button type="button" onClick={createVideoRoom}><Video size={15} />{isJitsiRoom(meetingUrl) ? "Create new room" : "Create video room"}</button></div></div>}
          {kind === "offer" && <>
            <div className="offer-profile-preview"><span><FileCheck2 size={15} /> JOB PROFILE</span><strong>{applicationTitle} · {jobProfile.employment}</strong><p>{jobProfile.description || "No responsibilities are listed in the job profile."}</p><small>Posted salary range: {jobProfile.salaryMin ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(jobProfile.salaryMin) : "Not listed"}{jobProfile.salaryMax ? `–${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(jobProfile.salaryMax)}` : ""}</small></div>
            <div className="communication-fields offer-fields">
              <label>Agreed compensation<input value={offerSalary} onChange={(event) => setOfferSalary(event.target.value)} placeholder="Enter agreed salary or rate" required /></label>
              <label>Pay frequency<select value={payFrequency} onChange={(event) => setPayFrequency(event.target.value)}><option>Annual</option><option>Hourly</option><option>Monthly</option><option>Weekly</option><option>Biweekly</option></select></label>
              <label>Proposed start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
              <label>Work schedule<input value={workSchedule} onChange={(event) => setWorkSchedule(event.target.value)} placeholder="Hours and expected schedule" required /></label>
              <label>Bonus or equity <span>OPTIONAL</span><input value={bonusEquity} onChange={(event) => setBonusEquity(event.target.value)} placeholder="Bonus target, equity, or none" /></label>
              <label>Contingencies <span>OPTIONAL</span><input value={contingencies} onChange={(event) => setContingencies(event.target.value)} placeholder="Background check, work authorization, or none" /></label>
              <label className="offer-benefits-field">Benefits<input value={benefits} onChange={(event) => setBenefits(event.target.value)} placeholder="Health insurance, retirement plan, PTO details" required /></label>
            </div>
            <div className="offer-at-will-note"><strong>At-will employment</strong><p>{atWillStatement}</p></div>
          </>}
          <label className="composer-label">{kind === "offer" ? "Personal note" : kind === "rejection" ? "Decision message" : kind === "interview" ? "Interview note" : "Your message"}<textarea name="body" rows={kind === "message" ? 3 : 2} placeholder={kind === "offer" ? "Add a personal note for the candidate (optional)." : kind === "rejection" ? "Thank you for taking the time to meet our team..." : kind === "interview" ? "Share what to expect and who they will meet." : "Write a thoughtful note..."} required={kind !== "offer"} minLength={2} maxLength={10000} /></label>
          {error && <p className="communication-error" role="alert">{error}</p>}
          {sent && <p className="communication-success"><CheckCircle2 size={14} />Update sent and added to this application.</p>}
          <footer className="composer-footer"><span>{kind === "offer" || kind === "rejection" ? "Saved in the application thread and available to download." : "Only the candidate and hiring team can see this."}</span><button className="primary-button" type="submit" disabled={busy}><Send size={15} />{busy ? "Sending…" : kind === "offer" ? "Send offer letter" : kind === "rejection" ? "Send decision" : kind === "interview" ? "Send interview" : "Send message"}</button></footer>
        </form>
      </section>
      {videoRoom && <div className="video-room-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setVideoRoom(null); }}><section className="video-room-dialog" role="dialog" aria-modal="true" aria-label="Video interview"><header><div><span><Video size={16} /> CAREERHUB INTERVIEW</span><strong>{videoRoom.title}</strong></div><div><a href={videoRoom.url} target="_blank" rel="noreferrer" aria-label="Open interview in a new tab"><ExternalLink size={17} /></a><button className="icon-button" onClick={() => setVideoRoom(null)} aria-label="Close video interview"><X size={20} /></button></div></header><iframe src={videoRoom.url} title="Jitsi video interview room" allow="camera; microphone; fullscreen; display-capture; autoplay" allowFullScreen /><p><Mic size={13} /> Camera and microphone permissions are managed by the meeting service.</p></section></div>}
    </div>
  );
}