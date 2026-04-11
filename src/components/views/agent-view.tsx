"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import {
  Bot, Send, Terminal, FileText, Globe, FolderOpen, Search,
  ChevronRight, Loader2, CheckCircle2, AlertCircle, Wrench,
  Trash2, Monitor, MousePointer, Type, Camera, Code, Mic, MicOff, Volume2, VolumeX,
} from "lucide-react";
import { useAppStore, ContentStorage } from "@/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useIntegrationsStore } from "@/store/integrations-store";

interface AgentStep {
  type: "thinking" | "tool_call" | "tool_result";
  content: any;
}

interface AgentMessage {
  role: "user" | "assistant";
  content: string;
  steps?: AgentStep[];
  loading?: boolean;
}

const TOOL_ICONS: Record<string, any> = {
  read_file: FileText,
  write_file: FileText,
  list_directory: FolderOpen,
  search_files: Search,
  fetch_url: Globe,
  analyze_data: Terminal,
  browser_navigate: Monitor,
  browser_screenshot: Camera,
  browser_click: MousePointer,
  browser_type: Type,
  browser_extract: Code,
  browser_evaluate: Code,
};

const EXAMPLE_TASKS = [
  { icon: FileText, text: "Check my outlook email for any new invoices and forward them to accounting@example.com" },
  { icon: Globe, text: "List the top 5 recent customer support tickets from Zendesk and summarize the main issues" },
  { icon: Monitor, text: "Find the latest 'Q4 Planning' Notion page and text its summary to Slack #management" },
  { icon: Search, text: "Search my Google Drive for 'Q3 Financial Report.pdf' and email it to my manager" },
  { icon: MousePointer, text: "Check HubSpot for any new leads generated today and create a Salesforce record for each" },
  { icon: Camera, text: "Create a Jira ticket for the 'Payment API failing' issue and assign it to the backend team" },
  { icon: Terminal, text: "Read the latest Shopify orders from today and post the total revenue to Slack #sales" },
  { icon: FolderOpen, text: "View my Google Calendar for tomorrow, and if I have free time, schedule a meeting block" },
];

function ToolCallStep({ step }: { step: AgentStep }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[step.content?.tool] ?? Wrench;

  if (step.type === "thinking") {
    return (
      <div className="pl-4 border-l-2 border-white/5 py-1">
        <p className="text-[11px] text-white/40 leading-relaxed">{step.content}</p>
      </div>
    );
  }

  if (step.type === "tool_call") {
    return (
      <div className="flex items-start gap-2 py-1">
        <div className="w-5 h-5 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={11} className="text-blue-400/70" />
        </div>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] font-mono text-blue-400/70 hover:text-blue-400 transition-colors"
          >
            <ChevronRight size={10} className={cn("transition-transform", expanded && "rotate-90")} />
            {step.content.tool}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.pre
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="text-[9px] text-white/30 font-mono mt-1 bg-white/[0.02] rounded-lg p-2 overflow-x-auto"
              >
                {JSON.stringify(step.content.input, null, 2)}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  if (step.type === "tool_result") {
    const isError = step.content?.result?.startsWith?.("Error");
    return (
      <div className="flex items-start gap-2 py-1">
        <div className={cn(
          "w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5",
          isError ? "bg-red-500/10" : "bg-emerald-500/10"
        )}>
          {isError
            ? <AlertCircle size={11} className="text-red-400/70" />
            : <CheckCircle2 size={11} className="text-emerald-400/70" />
          }
        </div>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] font-mono text-white/40 hover:text-white/60 transition-colors"
          >
            <ChevronRight size={10} className={cn("transition-transform", expanded && "rotate-90")} />
            {step.content.tool} result
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.pre
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="text-[9px] text-white/30 font-mono mt-1 bg-white/[0.02] rounded-lg p-2 overflow-x-auto max-h-40 overflow-y-auto no-scrollbar"
              >
                {step.content.result}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return null;
}

export function AgentView() {
  const [task, setTask] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const sources = useAppStore(s => s.sources);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Voice input (Speech-to-Text) ─────────────────────────────────────────
  const toggleVoiceInput = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = task;

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interim = transcript;
        }
      }
      setTask(finalTranscript + interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "aborted") {
        toast.error(`Voice error: ${event.error}`);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, task]);

  // ── Voice output (Text-to-Speech) ────────────────────────────────────────
  const speakText = useCallback((text: string) => {
    if (!ttsEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    // Clean markdown for speech
    const clean = text
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`{1,3}[^`]*`{1,3}/g, "code snippet")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[-*]\s/g, "")
      .slice(0, 3000);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled]);

  const executeAgent = useCallback(async (taskText: string) => {
    if (!taskText.trim() || loading) return;

    const userMsg: AgentMessage = { role: "user", content: taskText };
    setMessages(prev => [...prev, userMsg]);
    setTask("");
    setLoading(true);

    // Add loading message
    setMessages(prev => [...prev, { role: "assistant", content: "", loading: true }]);

    try {
      // Build source context for the agent
      const sourcesContext = sources.length > 0
        ? sources.map(s => `- ${s.name} (${s.type}, ${s.charCount} chars)`).join("\n")
        : undefined;

      // Extract credentials for all services from local storage
      const serviceTokens: Record<string, string> = {};
      const { mcpConnections } = useIntegrationsStore.getState();
      
      mcpConnections.forEach(c => {
        if (c.status === "connected") {
            // Find the provider config inside connectors registry if needed, 
            // but since we proxy it to api/services, we just pass the accessToken from config
            const token = c.config.accessToken || c.config.githubToken || c.config.gitlabToken || c.config.slackBotToken || c.config.slackAppToken || c.config.apiKey || c.config.sentryToken || c.config.databricksToken;
            if (token) serviceTokens[c.serverId] = token;
        }
      });

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: taskText,
          sourcesContext,
          serviceTokens,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Agent execution failed");
      }

      const data = await res.json();

      // Replace loading message with result
      setMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = {
          role: "assistant",
          content: data.result,
          steps: data.steps,
          loading: false,
        };
        return msgs;
      });

      // Read aloud if TTS is enabled
      speakText(data.result);
    } catch (e: any) {
      toast.error(e.message);
      setMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = {
          role: "assistant",
          content: `Error: ${e.message}`,
          loading: false,
        };
        return msgs;
      });
    } finally {
      setLoading(false);
    }
  }, [loading, sources, speakText]);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="px-8 lg:px-12 pt-8 pb-4 shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] text-[11px] text-white/40 mb-4 tracking-[0.12em] uppercase">
            <Bot size={11} className="text-emerald-400" />
            <span>Autonomous Agent</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.04em] leading-[1.05]">
            AI that acts on<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400/50 to-white/10">
              your data and computer.
            </span>
          </h2>
          <p className="text-sm text-white/30 mt-3 max-w-lg">
            Give the agent a task and it will read files, browse the web, search your filesystem,
            and analyze your connected datasets autonomously.
          </p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-8 lg:px-12 pb-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 mt-2"
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/20 font-semibold">
                Example tasks
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {EXAMPLE_TASKS.map((ex, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => executeAgent(ex.text)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 rounded-xl text-left group transition-all duration-150",
                      "bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]",
                      "hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.11)]",
                    )}
                  >
                    <ex.icon size={14} className="text-white/20 group-hover:text-emerald-400/60 shrink-0 mt-0.5 transition-colors" />
                    <span className="text-[12px] text-white/45 group-hover:text-white/80 transition-colors leading-snug">
                      {ex.text}
                    </span>
                  </button>
                ))}
              </div>

              {sources.length > 0 && (
                <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                  <CheckCircle2 size={14} className="text-emerald-400/60 shrink-0" />
                  <p className="text-[11px] text-white/40">
                    The agent can access your <strong className="text-white/60">{sources.length} connected source{sources.length !== 1 ? "s" : ""}</strong> for analysis.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Messages */}
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                {msg.role === "user" ? (
                  <div className={cn(
                    "max-w-[75%] px-4 py-3 text-[13px] text-white/90 leading-relaxed rounded-2xl rounded-tr-sm",
                    "bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)]",
                    "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                  )}>
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[90%] space-y-3 w-full">
                    <GlassCard className={cn(
                      "bg-[rgba(16,185,129,0.04)] border-[rgba(16,185,129,0.15)]",
                      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                    )}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-emerald-400/80">
                          <Bot size={12} />
                          <span className="text-[11px] font-semibold tracking-[0.1em] uppercase">Agent</span>
                          {msg.loading && (
                            <Loader2 size={12} className="animate-spin ml-1" />
                          )}
                        </div>
                      </div>

                      {/* Tool execution steps */}
                      {msg.steps && msg.steps.length > 0 && (
                        <div className="space-y-1 mb-4 pb-3 border-b border-white/5">
                          <p className="text-[9px] uppercase tracking-widest text-white/20 font-bold mb-2">
                            Execution Log ({msg.steps.filter(s => s.type === "tool_call").length} tools used)
                          </p>
                          {msg.steps.map((step, j) => (
                            <ToolCallStep key={j} step={step} />
                          ))}
                        </div>
                      )}

                      {msg.loading ? (
                        <div className="flex items-center gap-3">
                          <Loader2 size={14} className="animate-spin text-emerald-400/50" />
                          <span className="text-xs text-white/40 font-mono">
                            Agent is working...
                          </span>
                        </div>
                      ) : (
                        <div className="prose-chat text-[13px] text-white/80 leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </GlassCard>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && messages[messages.length - 1]?.role !== "assistant" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 pl-1">
              <Loader2 size={16} className="animate-spin text-emerald-400/50" />
              <span className="text-xs text-white/40 font-mono">Agent is thinking...</span>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-8 lg:px-12 py-4 border-t border-white/5 bg-black/20">
        <div className="max-w-4xl mx-auto">
          <GlassCard className="p-2 bg-gradient-to-br from-white/[0.02] to-transparent ring-1 ring-white/10">
            <div className="flex items-start gap-3 w-full bg-black/40 rounded-xl border border-white/10 p-2 shadow-inner">
              <Bot className="ml-4 mt-3 text-emerald-400/30 shrink-0" size={18} />
              <textarea
                ref={inputRef}
                placeholder="Describe a task... e.g. 'Read all .csv files in my Downloads folder and summarize them'"
                value={task}
                onChange={e => setTask(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    executeAgent(task);
                  }
                }}
                rows={2}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/25 text-sm py-2 placeholder:font-light resize-none"
              />
              <div className="flex items-center gap-1 shrink-0 mt-1">
                {/* Voice input */}
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    listening
                      ? "text-red-400 bg-red-400/10 animate-pulse"
                      : "text-white/20 hover:text-white/50 hover:bg-white/5"
                  )}
                  title={listening ? "Stop listening" : "Voice input"}
                >
                  {listening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                {/* TTS toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setTtsEnabled(v => !v);
                    if (ttsEnabled) window.speechSynthesis?.cancel();
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    ttsEnabled
                      ? "text-emerald-400 bg-emerald-400/10"
                      : "text-white/20 hover:text-white/50 hover:bg-white/5"
                  )}
                  title={ttsEnabled ? "Disable voice output" : "Enable voice output"}
                >
                  {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                </button>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setMessages([]); window.speechSynthesis?.cancel(); }}
                    className="p-2 text-white/20 hover:text-white/50 transition-colors"
                    title="Clear"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <Button
                  size="lg"
                  className="rounded-lg gap-2 text-sm bg-emerald-600 hover:bg-emerald-500"
                  onClick={() => executeAgent(task)}
                  disabled={loading}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Execute
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </motion.div>
  );
}
