"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowUpRight, Building2, Check, Heart, ImagePlus, Mail, MessageCircle, Search, Send, Share2, UserPlus, UsersRound, X } from "lucide-react";

type ConnectionStatus = "none" | "sent" | "received" | "friends" | "self";
type Person = { id: string; name: string; role: string; company: string; headline: string; location: string; educationLevel: string; educationDetails: string; certificates: string[]; currentCompany: string; currentPosition: string; connectionStatus: ConnectionStatus; canAdminConnect: boolean };
type Company = { name: string; followers: number; following: boolean };
type Comment = { id: string; body: string; authorId: string; authorName: string; createdAt: string };
type Liker = { id: string; name: string; headline: string; isFriend: boolean };
type Post = { id: string; content: string; imageUrl: string; createdAt: string; sharedPostId: string | null; authorId: string; authorName: string; authorRole: string; authorHeadline: string; sharedContent?: string | null; sharedImageUrl?: string | null; sharedAuthorName?: string | null; likes: number; likers: Liker[]; liked: boolean; commentCount: number; comments: Comment[] };
type DirectMessage = { id: string; senderId: string; recipientId: string; senderName: string; body: string; createdAt: string };

export function CommunityCenter({ currentUserId, currentUserName, currentUserRole }: { currentUserId: string; currentUserName: string; currentUserRole: string }) {
  const [tab, setTab] = useState<"feed" | "people" | "companies">("feed");
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<Array<{ id: string; name: string; headline: string }>>([]);
  const [profile, setProfile] = useState<Person | null>(null);
  const [likesForPost, setLikesForPost] = useState<Post | null>(null);
  const [messageFriend, setMessageFriend] = useState<Person | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [directMessageText, setDirectMessageText] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [postText, setPostText] = useState("");
  const [postImage, setPostImage] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState("");
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [commentingOn, setCommentingOn] = useState("");
  const [sharingPost, setSharingPost] = useState("");
  const [shareText, setShareText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const response = await fetch("/api/community");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load the community.");
    setPeople(data.people ?? []);
    setCompanies(data.companies ?? []);
    setPosts(data.posts ?? []);
    setIncomingRequests(data.incomingRequests ?? []);
  }

  useEffect(() => { void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load the community.")); }, []);
  useEffect(() => () => { if (postImagePreview) URL.revokeObjectURL(postImagePreview); }, [postImagePreview]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/community", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "That action could not be completed.");
      await refresh();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That action could not be completed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let imageUrl = "";
    if (postImage) {
      setBusy(true);
      setError("");
      try {
        const formData = new FormData();
        formData.append("image", postImage);
        const response = await fetch("/api/community/media", { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not upload this image.");
        imageUrl = data.url;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not upload this image.");
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    if (await act({ action: "create_post", content: postText, imageUrl })) {
      setPostText("");
      setPostImage(null);
      setPostImagePreview("");
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    if (await act({ action: "comment", postId, content: commentText[postId] ?? "" })) {
      setCommentText((current) => ({ ...current, [postId]: "" }));
      setCommentingOn("");
    }
  }

  async function sharePost(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    if (await act({ action: "share_post", postId, content: shareText })) {
      setShareText("");
      setSharingPost("");
    }
  }

  async function openMessages(person: Person) {
    setMessageFriend(person);
    setMessagesLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/community?with=${encodeURIComponent(person.id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load messages.");
      setDirectMessages(data.messages ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load messages.");
    } finally {
      setMessagesLoading(false);
    }
  }

  async function sendDirectMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!messageFriend || !directMessageText.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/community", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "direct_message", targetId: messageFriend.id, content: directMessageText }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send message.");
      setDirectMessages((current) => [...current, data.message]);
      setDirectMessageText("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send message.");
    } finally {
      setBusy(false);
    }
  }

  const visiblePeople = people.filter((person) => `${person.name} ${person.headline} ${person.currentCompany} ${person.company} ${person.location}`.toLowerCase().includes(query.toLowerCase()));
  const visibleCompanies = companies.filter((company) => company.name.toLowerCase().includes(query.toLowerCase()));
  const acceptedFriends = people.filter((person) => person.connectionStatus === "friends");

  return <section className="community-page">
    <header className="community-heading"><div><span className="eyebrow"><span className="eyebrow-line" />CAREERHUB COMMUNITY</span><h1>People behind the work.</h1><p>Meet members, follow companies, and share what you’re building.</p></div><div className="community-count"><UsersRound size={17} /><strong>{people.length}</strong><span>members</span></div></header>
    <div className="community-tabs" role="tablist" aria-label="Community views">
      <button role="tab" aria-selected={tab === "feed"} className={tab === "feed" ? "community-tab-active" : ""} onClick={() => { setTab("feed"); setQuery(""); }}><MessageCircle size={15} />Community feed</button>
      <button role="tab" aria-selected={tab === "people"} className={tab === "people" ? "community-tab-active" : ""} onClick={() => { setTab("people"); setQuery(""); }}><UsersRound size={15} />People<span>{people.length}</span></button>
      <button role="tab" aria-selected={tab === "companies"} className={tab === "companies" ? "community-tab-active" : ""} onClick={() => { setTab("companies"); setQuery(""); }}><Building2 size={15} />Companies<span>{companies.length}</span></button>
    </div>

    {error && <p className="community-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={13} /></button></p>}

    {tab === "feed" && <div className="community-feed-layout">
      <div className="community-feed-main">
        <form className="community-compose" onSubmit={createPost}><span className="community-avatar">{currentUserName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><label htmlFor="community-post">Share an update with the community</label><textarea id="community-post" value={postText} onChange={(event) => setPostText(event.target.value)} maxLength={3000} placeholder="What’s happening in your professional world?" rows={3} />{postImagePreview && <div className="post-image-preview"><img src={postImagePreview} alt="Selected post attachment" /><button type="button" onClick={() => { setPostImage(null); setPostImagePreview(""); }} aria-label="Remove selected image"><X size={15} /></button></div>}<footer><label className="community-image-upload"><ImagePlus size={15} /><span>{postImage ? postImage.name : "Add photo"}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setPostImage(file); setPostImagePreview(URL.createObjectURL(file)); } }} /></label><small>{postText.length}/3000 · Images up to 5 MB</small><button className="primary-button" disabled={busy || (!postText.trim() && !postImage)}><Send size={14} />Post</button></footer></div></form>
        {posts.length ? posts.map((post) => <article className="community-post" key={post.id}>
          <header><button className="community-author" onClick={() => setProfile(people.find((person) => person.id === post.authorId) ?? null)}><span className="community-avatar">{post.authorName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{post.authorName}{post.authorId === currentUserId ? " · You" : ""}</strong><small>{post.authorHeadline || post.authorRole} · {new Date(post.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</small></span></button><button className="post-author-profile" onClick={() => setProfile(people.find((person) => person.id === post.authorId) ?? null)} aria-label={`View ${post.authorName}'s profile`}><ArrowUpRight size={15} /></button></header>
          {post.content && <p className="community-post-text">{post.content}</p>}
          {post.imageUrl && <img className="community-post-image" src={post.imageUrl} alt={`Image shared by ${post.authorName}`} loading="lazy" />}
          {post.sharedPostId && <div className="shared-post"><small>Shared from {post.sharedAuthorName || "a community member"}</small><p>{post.sharedContent || "Original post is no longer available."}</p>{post.sharedImageUrl && <img className="community-post-image" src={post.sharedImageUrl} alt="Image from shared post" loading="lazy" />}</div>}
          <div className="post-engagement"><button onClick={() => setLikesForPost(post)} aria-label={`View ${post.likes} people who liked this post`}><Heart size={13} />{post.likes} {post.likes === 1 ? "like" : "likes"}</button><span><MessageCircle size={13} />{post.commentCount}</span></div>
          <div className="post-actions"><button className={post.liked ? "post-liked" : ""} onClick={() => void act({ action: "toggle_like", postId: post.id })} disabled={busy}><Heart size={15} fill={post.liked ? "currentColor" : "none"} />Like</button><button onClick={() => { setCommentingOn(commentingOn === post.id ? "" : post.id); setSharingPost(""); }}><MessageCircle size={15} />Comment</button><button onClick={() => { setSharingPost(sharingPost === post.id ? "" : post.id); setCommentingOn(""); }}><Share2 size={15} />Share</button></div>
          {post.comments.length > 0 && <div className="post-comments">{post.comments.slice().reverse().map((comment) => <div key={comment.id}><strong>{comment.authorName}</strong><span>{comment.body}</span></div>)}</div>}
          {commentingOn === post.id && <form className="post-reply" onSubmit={(event) => void submitComment(event, post.id)}><input value={commentText[post.id] ?? ""} onChange={(event) => setCommentText((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Write a comment" maxLength={1200} required /><button aria-label="Send comment" disabled={busy}><Send size={14} /></button></form>}
          {sharingPost === post.id && <form className="post-reply" onSubmit={(event) => void sharePost(event, post.id)}><input value={shareText} onChange={(event) => setShareText(event.target.value)} placeholder="Add a note (optional)" maxLength={1000} /><button aria-label="Share post" disabled={busy}><Share2 size={14} /></button></form>}
        </article>) : <div className="community-empty"><MessageCircle size={22} /><strong>No posts yet</strong><span>Share an update to start the conversation.</span></div>}
      </div>
      <aside className="community-aside"><h2>Friend requests</h2>{incomingRequests.length ? incomingRequests.map((request) => <div className="request-row" key={request.id}><span className="community-avatar">{request.name.slice(0, 1)}</span><div><strong>{request.name}</strong><small>{request.headline || "CareerHub member"}</small></div><button onClick={() => void act({ action: "accept_request", targetId: request.id })} disabled={busy} aria-label={`Accept request from ${request.name}`}><Check size={15} /></button></div>) : <p>No incoming requests.</p>}<button className="aside-link" onClick={() => setTab("people")}>Discover members<ArrowUpRight size={14} /></button></aside>
    </div>}

    {tab !== "feed" && <>
      {tab === "people" && <div className="community-connections">
        <section className="connections-panel"><header><div><h2>Friend requests</h2><small>People who want to connect with you</small></div><span>{incomingRequests.length}</span></header>{incomingRequests.length ? incomingRequests.map((request) => <div className="request-row" key={request.id}><span className="community-avatar">{request.name.slice(0, 1)}</span><div><strong>{request.name}</strong><small>{request.headline || "CareerHub member"}</small></div><button onClick={() => void act({ action: "accept_request", targetId: request.id })} disabled={busy} aria-label={`Accept request from ${request.name}`}><Check size={15} /></button></div>) : <p className="connections-empty">No pending requests.</p>}</section>
        <section className="connections-panel"><header><div><h2>Your friends</h2><small>Message members you’ve connected with</small></div><span>{acceptedFriends.length}</span></header>{acceptedFriends.length ? <div className="friend-list">{acceptedFriends.map((friend) => <article key={friend.id}><button className="friend-identity" onClick={() => setProfile(friend)}><span className="community-avatar">{friend.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{friend.name}</strong><small>{friend.headline || friend.currentPosition || "Connected member"}</small></span></button><button className="friend-message-button" onClick={() => void openMessages(friend)} aria-label={`Message ${friend.name}`}><Mail size={15} />Message</button></article>)}</div> : <p className="connections-empty">Accept a request or connect with a member to start a conversation.</p>}</section>
      </div>}
      <label className="community-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "people" ? "Search people, roles, companies" : "Search companies"} /></label>
      {tab === "people" ? <div className="community-directory">{visiblePeople.map((person) => <article className="person-card" key={person.id}>
        <button className="person-card-main" onClick={() => setProfile(person)}><span className="community-avatar community-avatar-large">{person.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><strong>{person.name}</strong><span>{person.headline || (person.role === "recruiter" ? "Recruiter" : person.role === "admin" ? "CareerHub admin" : "CareerHub member")}</span><small>{person.currentPosition && person.currentCompany ? `${person.currentPosition} · ${person.currentCompany}` : person.company || person.location}</small></button>
        {person.connectionStatus === "none" && (currentUserRole !== "admin" || person.canAdminConnect) && <button className="connect-button" onClick={() => void act({ action: "friend_request", targetId: person.id })} disabled={busy}><UserPlus size={14} />Connect</button>}
        {person.connectionStatus === "sent" && <span className="connection-status">Request sent</span>}
        {person.connectionStatus === "friends" && <span className="connection-status"><Check size={13} />Connected</span>}
        {person.connectionStatus === "friends" && <button className="friend-message-button" onClick={() => void openMessages(person)}><Mail size={14} />Message</button>}
        {person.connectionStatus === "self" && <span className="connection-status">You</span>}
        {person.connectionStatus === "received" && <button className="connect-button" onClick={() => void act({ action: "accept_request", targetId: person.id })} disabled={busy}><Check size={14} />Accept</button>}
      </article>)}{visiblePeople.length === 0 && <div className="community-empty"><UsersRound size={22} /><strong>No members found</strong><span>Try a different name, role, or company.</span></div>}</div>
      : <div className="community-directory">{visibleCompanies.map((company) => <article className="company-card" key={company.name}><span className="company-card-mark"><Building2 size={19} /></span><div><strong>{company.name}</strong><small>{company.followers} {company.followers === 1 ? "follower" : "followers"}</small></div><button className={company.following ? "follow-button is-following" : "follow-button"} onClick={() => void act({ action: "follow_company", company: company.name, following: !company.following })} disabled={busy}>{company.following ? <><Check size={14} />Following</> : "Follow"}</button></article>)}{visibleCompanies.length === 0 && <div className="community-empty"><Building2 size={22} /><strong>No companies found</strong><span>Companies appear here when recruiters or live jobs list them.</span></div>}</div>}
    </>}

    {profile && <div className="profile-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfile(null); }}><section className="community-profile-dialog" role="dialog" aria-modal="true" aria-label={`${profile.name} profile`}><header><span className="community-avatar community-avatar-large">{profile.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><button onClick={() => setProfile(null)} aria-label="Close profile"><X size={18} /></button></header><h2>{profile.name}</h2><p>{profile.headline || (profile.role === "admin" ? "CareerHub admin" : profile.role)}</p><small>{profile.location || "Location not provided"}</small>{(profile.currentPosition || profile.currentCompany) && <section><strong>Experience</strong><p>{[profile.currentPosition, profile.currentCompany].filter(Boolean).join(" · ")}</p></section>}{(profile.educationLevel || profile.educationDetails) && <section><strong>Education</strong><p>{[profile.educationLevel, profile.educationDetails].filter(Boolean).join(" · ")}</p></section>}{profile.certificates?.length > 0 && <section><strong>Certificates</strong><ul>{profile.certificates.map((certificate) => <li key={certificate}>{certificate}</li>)}</ul></section>}{profile.id !== currentUserId && profile.connectionStatus === "friends" && <button className="friend-message-button" onClick={() => void openMessages(profile)}><Mail size={14} />Message friend</button>}{profile.id !== currentUserId && profile.connectionStatus === "none" && (currentUserRole !== "admin" || profile.canAdminConnect) && <button className="connect-button" onClick={async () => { if (await act({ action: "friend_request", targetId: profile.id })) setProfile(null); }} disabled={busy}><UserPlus size={14} />Send friend request</button>}{profile.id !== currentUserId && profile.connectionStatus === "received" && <button className="connect-button" onClick={async () => { if (await act({ action: "accept_request", targetId: profile.id })) setProfile(null); }} disabled={busy}><Check size={14} />Accept friend request</button>}</section></div>}
    {likesForPost && <div className="profile-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setLikesForPost(null); }}><section className="likers-dialog" role="dialog" aria-modal="true" aria-label="People who liked this post"><header><div><Heart size={16} /><span><strong>People who liked this post</strong><small>{likesForPost.likes} total {likesForPost.likes === 1 ? "like" : "likes"}</small></span></div><button onClick={() => setLikesForPost(null)} aria-label="Close likes"><X size={18} /></button></header><div className="likers-list">{likesForPost.likers.length ? likesForPost.likers.map((liker) => <button key={liker.id} onClick={() => { setLikesForPost(null); const person = people.find((item) => item.id === liker.id); if (person) setProfile(person); }}><span className="community-avatar">{liker.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{liker.name}{liker.id === currentUserId ? " · You" : ""}</strong><small>{liker.headline || "CareerHub member"}</small></span>{liker.isFriend && <em><Check size={12} />Friend</em>}</button>) : <p>No likes yet.</p>}</div></section></div>}
    {messageFriend && <div className="profile-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setMessageFriend(null); }}><section className="direct-message-dialog" role="dialog" aria-modal="true" aria-label={`Messages with ${messageFriend.name}`}><header><div><span className="community-avatar">{messageFriend.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{messageFriend.name}</strong><small>{messageFriend.headline || "Connected member"}</small></span></div><button onClick={() => setMessageFriend(null)} aria-label="Close messages"><X size={18} /></button></header><div className="direct-message-list">{messagesLoading ? <p>Loading messages…</p> : directMessages.length ? directMessages.map((message) => <article className={message.senderId === currentUserId ? "direct-message-self" : ""} key={message.id}><strong>{message.senderName}</strong><p>{message.body}</p><time>{new Date(message.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</time></article>) : <p className="connections-empty">You’re connected. Start a conversation.</p>}</div><form className="direct-message-compose" onSubmit={sendDirectMessage}><input value={directMessageText} onChange={(event) => setDirectMessageText(event.target.value)} placeholder="Write a message" maxLength={2000} required /><button className="primary-button" disabled={busy}><Send size={14} />Send</button></form></section></div>}
  </section>;
}
