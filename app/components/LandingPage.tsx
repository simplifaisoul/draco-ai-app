"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Terminal, Cpu, Code2, Globe, Image as ImageIcon,
  ArrowRight, ArrowUp, Shield, MessageSquare, Bot, Check,
  Lightbulb, Server, Wrench, GraduationCap
} from "lucide-react";

interface LandingPageProps {
  onGetStarted: () => void;
}

const TYPING_LINES = [
  "Set up an Nginx web server for me",
  "Show me how file permissions work",
  "Install Docker and run a container",
  "Create a cron job that runs every hour",
  "Teach me how firewalls work",
];

function TypingText() {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const current = TYPING_LINES[index];
    let t: NodeJS.Timeout;
    if (!deleting && text.length < current.length)
      t = setTimeout(() => setText(current.slice(0, text.length + 1)), 38);
    else if (!deleting && text.length === current.length)
      t = setTimeout(() => setDeleting(true), 2400);
    else if (deleting && text.length > 0)
      t = setTimeout(() => setText(text.slice(0, -1)), 18);
    else { setDeleting(false); setIndex((i) => (i + 1) % TYPING_LINES.length); }
    return () => clearTimeout(t);
  }, [text, deleting, index]);
  return <span className="text-white/70">{text}<span className="animate-pulse text-purple-400">|</span></span>;
}

function CountUp({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        let c = 0; const s = target / 30;
        const timer = setInterval(() => {
          c += s;
          if (c >= target) { setCount(target); clearInterval(timer); }
          else setCount(Math.floor(c));
        }, 40);
      }
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <div ref={ref}>{count.toLocaleString()}{suffix}</div>;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  // Track scroll position for back-to-top button
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-[#07060e] text-white overflow-x-hidden selection:bg-purple-500/30 scroll-smooth">
      {/* Brand-colored ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[35vh] left-1/2 -translate-x-1/2 w-[100vw] h-[70vh] bg-gradient-radial from-purple-900/20 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-[-10vh] left-[-10vw] w-[50vw] h-[40vh] bg-gradient-radial from-violet-950/15 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute top-[50%] right-[-5vw] w-[30vw] h-[30vh] bg-gradient-radial from-fuchsia-950/8 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.012]" style={{
          backgroundImage: `linear-gradient(rgba(168,85,247,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.08) 1px, transparent 1px)`,
          backgroundSize: '64px 64px'
        }} />
      </div>

      {/* ─── NAV ─── */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl bg-[#07060e]/70 border-b border-purple-500/[0.06]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <button onClick={scrollToTop} className="flex items-center gap-2.5 group cursor-pointer">
            <img src="/dragon_final.png" alt="Draco AI" className="w-8 h-8 object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.5)]" />
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-purple-300 to-fuchsia-300 bg-clip-text text-transparent">Draco AI</span>
          </button>
          <div className="hidden md:flex items-center gap-1">
            {["Features", "How it works", "Use cases", "Pricing"].map((item) => (
              <button key={item}
                onClick={() => scrollTo(item.toLowerCase().replace(/ /g, "-"))}
                className="px-4 py-2 text-sm text-white/30 hover:text-white/60 rounded-lg hover:bg-purple-500/[0.04] transition-all">
                {item}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onGetStarted} className="hidden sm:block px-4 py-2 text-sm text-purple-300/50 hover:text-purple-200 transition-colors">Sign in</button>
            <button onClick={onGetStarted}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white text-sm font-semibold transition-all active:scale-95 shadow-lg shadow-purple-500/15">
              Get started
            </button>
          </div>
        </div>
      </nav>

      {/* ═════════════════ HERO ═════════════════ */}
      <section ref={heroRef} className="relative z-10 pt-16 pb-6 md:pt-24 md:pb-10 px-6">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="max-w-5xl mx-auto text-center">

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-purple-500/[0.08] border border-purple-500/[0.12] mb-10">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-xs text-purple-300/60 font-medium">AI-powered. Real execution. No simulation.</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.06 }}
            className="text-[3rem] md:text-[4.5rem] lg:text-[5.5rem] font-black leading-[0.93] tracking-[-0.04em] mb-7">
            <span className="text-white">Your AI has its</span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-violet-300 bg-clip-text text-transparent">
              own computer.
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.14 }}
            className="text-base md:text-lg text-white/30 max-w-lg mx-auto mb-10 leading-relaxed">
            Draco doesn&apos;t just answer questions. It has a real machine it controls — installing software, managing files, running commands — while you watch, live.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }}
            className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
            <button onClick={onGetStarted}
              className="group px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-semibold text-base shadow-2xl shadow-purple-500/20 hover:shadow-purple-500/30 transition-all active:scale-[0.97] flex items-center gap-2 justify-center">
              Try Draco free
              <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button onClick={() => scrollTo('how-it-works')}
              className="px-8 py-4 rounded-full border border-purple-500/[0.1] text-purple-300/40 font-medium text-base hover:text-purple-200/60 hover:bg-purple-500/[0.04] transition-all flex items-center gap-2 justify-center">
              See how it works
            </button>
          </motion.div>

          {/* Live Terminal Demo */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.28 }}>
            <div className="rounded-2xl border border-purple-500/[0.08] bg-[#0c0a18]/90 backdrop-blur-2xl shadow-[0_20px_80px_rgba(88,28,135,0.08)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-purple-500/[0.05]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="ml-3 flex items-center gap-1.5 text-xs text-purple-300/20 font-mono">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    draco-agent • connected
                  </div>
                </div>
                <div className="text-[10px] text-purple-300/10 font-mono tracking-widest uppercase">live demo</div>
              </div>

              <div className="flex flex-col md:flex-row min-h-[320px]">
                {/* Chat side */}
                <div className="flex-1 p-5 md:border-r border-b md:border-b-0 border-purple-500/[0.05] flex flex-col">
                  <div className="space-y-4 flex-1">
                    <div className="flex justify-end">
                      <div className="bg-purple-600/15 border border-purple-500/10 rounded-2xl rounded-br-sm px-4 py-3 max-w-[85%]">
                        <div className="text-sm font-mono h-5 overflow-hidden"><TypingText /></div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500/25 to-fuchsia-500/15 border border-purple-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot size={13} className="text-purple-300/70" />
                      </div>
                      <div className="bg-white/[0.02] border border-purple-500/[0.05] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/35 max-w-sm">
                        On it. Let me install Nginx, configure the server block, and get it running. Watch the terminal →
                      </div>
                    </div>
                  </div>
                  <div className="pt-4">
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-purple-500/[0.06] bg-purple-500/[0.02]">
                      <span className="text-xs text-purple-300/12 flex-1">Ask Draco anything...</span>
                    </div>
                  </div>
                </div>

                {/* Terminal side */}
                <div className="w-full md:w-[48%] bg-[#0a0914] p-5 font-mono text-xs">
                  <div className="flex items-center gap-2 mb-4">
                    <Terminal size={11} className="text-purple-400/40" />
                    <span className="text-[10px] text-purple-400/30 font-bold tracking-widest uppercase">Terminal</span>
                    <div className="ml-auto text-[10px] text-purple-300/10">ubuntu@ct-200</div>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { cmd: "apt-get update && apt-get install -y nginx", out: "Reading package lists... Done ✓", d: 0.5 },
                      { cmd: "systemctl start nginx", out: "● nginx.service - active (running)", d: 1.1 },
                      { cmd: "cat > /etc/nginx/sites-available/mysite", out: "server block written ✓", d: 1.6 },
                      { cmd: "nginx -t", out: "syntax ok — test successful ✓", d: 2.1 },
                      { cmd: "curl -s localhost | head -3", out: "Welcome to nginx!", d: 2.6 },
                    ].map((s, i) => (
                      <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: s.d + 0.5 }}>
                        <div className="text-purple-200/20"><span className="text-purple-400/40">$</span> {s.cmd}</div>
                        <div className={`pl-3 mt-0.5 ${i === 4 ? 'text-green-400/40' : 'text-purple-300/12'}`}>{s.out}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── LOGOS / TRUST ─── */}
      <section className="relative z-10 py-10 border-y border-purple-500/[0.04]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-6">
            <span className="text-[10px] font-mono text-purple-400/25 tracking-widest uppercase">What you get with every container</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: 1, suffix: " core", label: "Dedicated CPU" },
              { value: 512, suffix: "MB", label: "RAM" },
              { value: 4, suffix: "GB", label: "SSD storage" },
              { value: 10, suffix: "s", label: "Boot time" },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-2xl md:text-3xl font-black text-purple-200/60 tabular-nums">
                  <CountUp target={s.value} suffix={s.suffix} />
                </div>
                <div className="text-[11px] text-purple-300/15 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-5">
            {["Full root access", "SSH capable", "apt-get / pip / npm", "Isolated networking", "Destroy on demand"].map((t, i) => (
              <span key={i} className="px-2.5 py-0.5 rounded-full text-[10px] text-purple-300/20 bg-purple-500/[0.04] border border-purple-500/[0.06]">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════ WHAT IS DRACO ═════════════════ */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }}
            className="text-center mb-14">
            <span className="text-xs font-mono text-purple-400/40 tracking-widest uppercase mb-3 block">What is Draco?</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-5">
              Think of it like this.
            </h2>
            <p className="text-white/25 max-w-xl mx-auto leading-relaxed text-base">
              Most AI tools give you text — answers, suggestions, code you have to copy-paste and figure out yourself. Draco is different.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="p-6 rounded-2xl border border-purple-500/[0.06] bg-purple-500/[0.02]">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center text-white mb-4 shadow-lg shadow-purple-500/15">
                <Bot size={20} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Regular AI</h3>
              <p className="text-sm text-white/25 leading-relaxed mb-4">You ask a question. It gives you a wall of text. Maybe some code. You still have to do everything yourself — open a terminal, install things, debug errors.</p>
              <div className="text-xs text-white/12 italic">&quot;Here&apos;s how you could set up a server...&quot;</div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.08 }}
              className="p-6 rounded-2xl border border-purple-400/[0.12] bg-gradient-to-br from-purple-500/[0.06] to-fuchsia-500/[0.03] relative overflow-hidden">
              <div className="absolute top-4 right-4 px-2 py-0.5 rounded text-[9px] font-bold bg-purple-500/15 text-purple-300/60 border border-purple-500/15 tracking-wider">DRACO</div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white mb-4 shadow-lg shadow-purple-500/25">
                <Terminal size={20} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Draco AI</h3>
              <p className="text-sm text-white/30 leading-relaxed mb-4">You ask a question. Draco opens its own computer, runs the commands, installs the tools, fixes errors — and you watch everything happen live in a real terminal.</p>
              <div className="text-xs text-purple-300/30 font-mono">$ nginx -t → syntax ok ✓</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═════════════════ FEATURES ═════════════════ */}
      <section id="features" className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} className="mb-14">
            <span className="text-xs font-mono text-purple-400/40 tracking-widest uppercase mb-3 block">Features</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
              Everything in one place.<br />
              <span className="text-white/20">Chat. Create. Execute.</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: <Terminal size={18} />, title: "Draco Agent", desc: "An AI with its own Ubuntu Linux machine. It installs tools, configures servers, runs scripts — all live in a real terminal you can watch.", gradient: "from-purple-500 to-violet-500", bg: "bg-purple-500/[0.05]", tag: "CORE" },
              { icon: <MessageSquare size={18} />, title: "Smart Chat", desc: "Powered by Gemini. Fast, sharp conversations that handle reasoning, writing, math, analysis — whatever you throw at it.", gradient: "from-fuchsia-500 to-pink-500", bg: "bg-fuchsia-500/[0.05]" },
              { icon: <ImageIcon size={18} />, title: "Image Generation", desc: "Describe what you see in your head. Get back photorealistic images, illustrations, logos, UI mockups — production quality.", gradient: "from-pink-500 to-rose-500", bg: "bg-pink-500/[0.05]" },
              { icon: <Globe size={18} />, title: "Live Web Access", desc: "Real-time web search and URL fetching. Research, pull data, check documentation — without ever leaving the chat.", gradient: "from-blue-500 to-indigo-500", bg: "bg-blue-500/[0.05]" },
              { icon: <Code2 size={18} />, title: "Code Generation", desc: "Python, JavaScript, Go, SQL — every major language. Syntax highlighted, one-click copy, with real explanations.", gradient: "from-amber-500 to-orange-500", bg: "bg-amber-500/[0.05]" },
              { icon: <Shield size={18} />, title: "Sandboxed Environments", desc: "Every Draco Agent session runs in its own isolated container. Nothing leaks. Destroy it when you're done. Completely clean.", gradient: "from-violet-500 to-purple-500", bg: "bg-violet-500/[0.05]" },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ delay: i * 0.05 }}
                className={`group p-5 rounded-2xl ${f.bg} border border-purple-500/[0.04] hover:border-purple-500/[0.1] transition-all`}>
                {f.tag && <span className="float-right px-2 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-300/50 border border-purple-500/10 tracking-wider">{f.tag}</span>}
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${f.gradient} flex items-center justify-center text-white mb-3.5 shadow-md`}>{f.icon}</div>
                <h3 className="text-sm font-bold text-white mb-1 tracking-tight">{f.title}</h3>
                <p className="text-[13px] text-white/22 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════ HOW IT WORKS ═════════════════ */}
      <section id="how-it-works" className="relative z-10 py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }}
            className="mb-16 text-center">
            <span className="text-xs font-mono text-purple-400/40 tracking-widest uppercase mb-3 block">How it works</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Three steps. Real results.</h2>
          </motion.div>

          <div className="space-y-5">
            {[
              { num: "01", title: "Tell Draco what you need", desc: "Use plain English. \"Set up a web server.\" \"Show me how Docker works.\" \"Back up my files every night.\" No technical knowledge required." },
              { num: "02", title: "Watch it work in real-time", desc: "Draco connects to its own Linux machine, runs every command, installs what's needed, handles errors — and you see it all happen live in a real terminal." },
              { num: "03", title: "Get the real result", desc: "Not a wall of instructions. The actual running server. The configured firewall. The working script. Done and ready." },
            ].map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ delay: i * 0.08 }}
                className="flex gap-5 items-start">
                <div className="hidden md:block text-4xl font-black text-purple-500/[0.08] font-mono pt-1 select-none w-16 shrink-0 text-right">{step.num}</div>
                <div className="flex-1 p-5 rounded-xl border border-purple-500/[0.04] bg-purple-500/[0.01] hover:bg-purple-500/[0.02] transition-all">
                  <h3 className="text-base font-bold text-white mb-1.5 tracking-tight">{step.title}</h3>
                  <p className="text-sm text-white/22 leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════ USE CASES ═════════════════ */}
      <section id="use-cases" className="relative z-10 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }}
            className="mb-14 text-center">
            <span className="text-xs font-mono text-purple-400/40 tracking-widest uppercase mb-3 block">Use cases</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
              Who is Draco for?
            </h2>
            <p className="text-white/20 text-base max-w-lg mx-auto">Anyone who wants an AI that actually does things — not just talks about them.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                icon: <GraduationCap size={20} />,
                title: "Students & learners",
                desc: "Want to learn Linux but don't know where to start? Ask Draco to walk you through it. It runs the commands and explains what's happening.",
                example: "\"Teach me how Linux file permissions work\"",
              },
              {
                icon: <Server size={20} />,
                title: "IT professionals",
                desc: "Automate repetitive server tasks. Set up environments in seconds. Let Draco handle the grunt work while you focus on architecture.",
                example: "\"Configure Nginx as a reverse proxy for port 3000\"",
              },
              {
                icon: <Lightbulb size={20} />,
                title: "Curious minds",
                desc: "Wondered how servers work? How websites get deployed? How databases store data? Ask Draco and watch it build one from scratch.",
                example: "\"Show me how a web server actually works\"",
              },
              {
                icon: <Wrench size={20} />,
                title: "Builders & makers",
                desc: "Got an idea? Tell Draco to set up the backend, install the tools, configure the database. Focus on your idea, not the setup.",
                example: "\"Set up a Node.js API with a PostgreSQL database\"",
              },
              {
                icon: <Server size={20} />,
                title: "Run more for less",
                desc: "Host up to 3 OpenClaw instances on a single VM starting at just $33/month, optimized for performance without breaking your budget.",
                example: "\"Install OpenClaw\"",
              },
              {
                icon: <Cpu size={20} />,
                title: "Designed for agent workloads",
                desc: "Our infrastructure is tailored for autonomous systems, giving you the flexibility and reliability needed to deploy and scale with confidence.",
                example: "\"Deploy an autonomous AI agent\"",
              },
            ].map((uc, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ delay: i * 0.06 }}
                className="p-6 rounded-2xl border border-purple-500/[0.05] bg-purple-500/[0.02] hover:bg-purple-500/[0.03] transition-all">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-violet-600 flex items-center justify-center text-white mb-4 shadow-md shadow-purple-500/10">{uc.icon}</div>
                <h3 className="text-base font-bold text-white mb-2">{uc.title}</h3>
                <p className="text-sm text-white/22 leading-relaxed mb-3">{uc.desc}</p>
                <div className="text-xs text-purple-300/25 font-mono">{uc.example}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════ LINUX HIGHLIGHT ═════════════════ */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }}
            className="p-8 md:p-12 rounded-2xl border border-purple-400/[0.1] bg-gradient-to-br from-purple-500/[0.05] to-violet-500/[0.02] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-radial from-purple-500/5 to-transparent rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Terminal size={16} className="text-purple-400/60" />
                <span className="text-xs font-mono text-purple-400/40 tracking-widest uppercase">Powered by real Linux</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-4">
                A real Ubuntu machine.<br />
                <span className="text-purple-300/40">Not a chatbot trick.</span>
              </h2>
              <p className="text-sm text-white/25 leading-relaxed max-w-xl mb-6">
                Every Draco Agent session spins up a dedicated Ubuntu container on our infrastructure. It has its own filesystem, networking, and full root access. Draco runs real <code className="text-purple-300/40 bg-purple-500/[0.08] px-1.5 py-0.5 rounded">apt-get</code>, real <code className="text-purple-300/40 bg-purple-500/[0.08] px-1.5 py-0.5 rounded">systemctl</code>, real everything. When you&apos;re done, the container is destroyed — no trace left.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Ubuntu 22.04", "Full root access", "Isolated networking", "Auto-cleanup"].map((tag, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-xs text-purple-300/30 bg-purple-500/[0.06] border border-purple-500/[0.08]">{tag}</span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═════════════════ PRICING ═════════════════ */}
      <section id="pricing" className="relative z-10 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }}
            className="text-center mb-14">
            <span className="text-xs font-mono text-purple-400/40 tracking-widest uppercase mb-3 block">Pricing</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Simple, honest pricing.</h2>
            <p className="text-white/18 text-sm">No hidden fees. Cancel anytime.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl mx-auto">
            {/* Free */}
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="p-6 rounded-2xl border border-purple-500/[0.05] bg-purple-500/[0.01]">
              <div className="text-xs text-purple-300/25 font-medium mb-3">Free</div>
              <div className="text-3xl font-black text-white mb-1">$0</div>
              <div className="text-[11px] text-white/12 mb-6">forever</div>
              <ul className="space-y-2 mb-7">
                {["50 messages / day", "5 images / day", "Web search", "All AI models", "Chat history"].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-[13px] text-white/22"><Check size={12} className="text-purple-400/20 shrink-0" />{f}</li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="w-full py-2.5 rounded-lg border border-purple-500/[0.08] text-purple-300/30 text-sm font-semibold hover:border-purple-500/[0.15] hover:text-purple-200/50 transition-all">Get started</button>
            </motion.div>

            {/* Pro */}
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.06 }}
              className="relative p-6 rounded-2xl border border-purple-500/[0.15] bg-gradient-to-b from-purple-500/[0.06] to-transparent md:scale-[1.02]">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white text-[9px] font-bold tracking-wider uppercase">Popular</div>
              <div className="text-xs text-purple-400/50 font-medium mb-3">Pro</div>
              <div className="flex items-end gap-0.5 mb-1">
                <span className="text-3xl font-black text-white">$12</span>
                <span className="text-xs text-white/15 mb-1">/mo</span>
              </div>
              <div className="text-[11px] text-white/12 mb-6">1 Linux container included</div>
              <ul className="space-y-2 mb-7">
                {[
                  "1 Linux VM (1 core, 512MB, 4GB)",
                  "Full root access & SSH",
                  "Unlimited AI messages",
                  "50 images / day",
                  "Draco Agent (AI runs commands)",
                  "Install anything with apt-get",
                  "Everything in Free",
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-[13px] text-white/35"><Check size={12} className="text-purple-400/40 shrink-0" />{f}</li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white text-sm font-semibold transition-all active:scale-[0.98] shadow-lg shadow-purple-500/15">Start Pro</button>
            </motion.div>

            {/* Dragon */}
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.12 }}
              className="p-6 rounded-2xl border border-purple-500/[0.08] bg-purple-500/[0.015]">
              <div className="text-xs text-purple-300/35 font-medium mb-3">Dragon</div>
              <div className="flex items-end gap-0.5 mb-1">
                <span className="text-3xl font-black text-white">$33</span>
                <span className="text-xs text-white/15 mb-1">/mo</span>
              </div>
              <div className="text-[11px] text-white/12 mb-6">3 Linux containers included</div>
              <ul className="space-y-2 mb-7">
                {[
                  "3 Linux VMs (run simultaneously)",
                  "SSH into any container",
                  "Use containers as jump boxes",
                  "Unlimited AI messages",
                  "100 images / day",
                  "Priority AI speed",
                  "Everything in Pro",
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-[13px] text-white/25"><Check size={12} className="text-purple-400/25 shrink-0" />{f}</li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="w-full py-2.5 rounded-lg border border-purple-500/[0.1] text-purple-300/40 text-sm font-semibold hover:border-purple-500/[0.2] hover:text-purple-200/60 hover:bg-purple-500/[0.04] transition-all">Start Dragon</button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="relative z-10 py-24 px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl font-black tracking-tight mb-4">
            Stop reading instructions.<br />
            <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">Start watching your AI work.</span>
          </h2>
          <p className="text-white/18 mb-8 text-sm">Ask. Watch. Done.</p>
          <button onClick={onGetStarted}
            className="group px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-semibold text-base shadow-2xl shadow-purple-500/20 hover:shadow-purple-500/30 transition-all active:scale-[0.97] mx-auto flex items-center gap-2">
            Try Draco free
            <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-purple-500/[0.04] py-7 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/dragon_final.png" alt="Draco" className="w-4 h-4 opacity-25" />
            <span className="text-xs text-purple-300/15">Draco AI by SimplifAI</span>
          </div>
          <div className="text-xs text-purple-300/8">© 2026</div>
        </div>
      </footer>

      {/* Back to top */}
      {showBackToTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-purple-600/80 hover:bg-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/20 backdrop-blur-sm transition-colors"
          aria-label="Back to top"
        >
          <ArrowUp size={18} />
        </motion.button>
      )}
    </div>
  );
}
