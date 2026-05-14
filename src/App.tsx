/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource react */
/// <reference types="vite/client" />
import React, { useState, useEffect, useCallback, useRef } from 'react';
// import ReactQuill from 'react-quill'; // DEPRECATED: Uses findDOMNode which is missing in React 19
// import 'react-quill/dist/quill.snow.css';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Settings, 
  FileEdit, 
  Search, 
  Share2, 
  Plus, 
  Save, 
  Globe, 
  X,
  Menu,
  Monitor,
  Layout,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Target,
  Mail,
  Zap,
  Clock,
  Layers,
  Brain,
  Cpu,
  Database,
  LogIn,
  LogOut,
  User,
  MessageSquare,
  RefreshCw,
  Bot,
  Trash2,
  FileText,
  Edit3,
  HelpCircle,
  List,
  Upload,
  CheckSquare,
  ShieldCheck
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from 'openai';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth, db, signInWithGoogle } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  orderBy,
  serverTimestamp,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';

/** Utility for Tailwind class merging */
// --- Utility for Tailwind class merging ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Firebase Error Types ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function formatAIError(error: any) {
  let message = "Intelligence Protocol Fault";
  let detail = "The neural engine encountered an unexpected interruption.";
  let solution = "Please check your network connection and try again.";

  const errorMessage = error?.message || String(error) || '';
  
  if (errorMessage.includes("403") || errorMessage.toLowerCase().includes("permission denied")) {
    message = "Authorization Rejected";
    detail = "The caller does not have sufficient permissions to execute this model.";
    solution = "Verify your API key is correct and has access to the requested model. Ensure billing is active if using a paid tier.";
  } else if (errorMessage.includes("404") || errorMessage.toLowerCase().includes("not found")) {
    message = "Model Not Found";
    detail = "The requested AI model is unavailable or misconfigured in this region.";
    solution = "Try switching to 'Gemini 1.5 Flash' in the settings. Ensure your API key is valid for the selected model.";
  } else if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota") || errorMessage.toLowerCase().includes("too many requests")) {
    message = "Resource Exhausted";
    detail = "The API rate limit or daily quota has been exceeded.";
    solution = "Wait a few minutes or reduce the frequency of requests. Check your provider's usage dashboard.";
  } else if (errorMessage.includes("401") || errorMessage.toLowerCase().includes("unauthorized") || errorMessage.toLowerCase().includes("invalid_api_key")) {
    message = "Credential Invalid";
    detail = "The system failed to authenticate your request.";
    solution = "Go to Settings and verify your API keys are entered correctly.";
  } else if (errorMessage.includes("503") || errorMessage.toLowerCase().includes("unavailable") || errorMessage.toLowerCase().includes("overloaded")) {
    message = "Service Unavailable";
    detail = "The AI provider is reporting temporary downtime or high load.";
    solution = "The provider may be overloaded. Please retry in 60 seconds.";
  } else if (errorMessage.includes("JSON") || errorMessage.toLowerCase().includes("parse")) {
    message = "Structural Integrity Failure";
    detail = "The AI returned a malformed response that could not be parsed.";
    solution = "Try re-generating the content. If it persists, try a more powerful model like Pro/GPT-4.";
  } else if (errorMessage.toLowerCase().includes("empty response") || errorMessage.toLowerCase().includes("no parts in the response")) {
    message = "Silent Response Fault";
    detail = "The engine completed the operation but returned no data.";
    solution = "Ensure the prompt is clear and doesn't violate safety guidelines.";
  } else if (errorMessage.includes("400") || errorMessage.toLowerCase().includes("invalid argument")) {
    message = "Request Protocol Violation";
    detail = "The AI parameters or prompt format are invalid.";
    solution = "Check if the selected model supports the current features (like JSON Schema). Avoid unusually large inputs.";
  } else if (errorMessage.toLowerCase().includes("safety") || errorMessage.toLowerCase().includes("blocked")) {
    message = "Content Filter Triggered";
    detail = "The model blocked the response due to safety filters.";
    solution = "Adjust your prompt to avoid sensitive topics or extreme language.";
  }

  return { message, detail, solution };
}

// --- Rich Text Workaround for React 19 ---
const SimpleHtmlEditor = ({ value, onChange, theme, placeholder }: { value: string; onChange: (v: string) => void; theme: string; placeholder?: string }) => {
  return (
    <div className="relative group">
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full min-h-[180px] p-4 font-mono text-[11px] border-2 rounded-lg focus:outline-none transition-all resize-y leading-relaxed",
          theme === 'dark' 
            ? "bg-slate-950 border-slate-900 text-slate-300 placeholder:text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600/20" 
            : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10"
        )}
        placeholder={placeholder || "Engineer HTML content here..."}
      />
      <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <span className="text-[7px] font-black uppercase tracking-widest text-slate-500 bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-800">HTML Draft</span>
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
      </div>
    </div>
  );
};
// Headings shape
interface HeadingItem { level: string; text: string }

interface CompetitorData {
  id?: string;
  url: string;
  wordCount: number;
  imageCount: number;
  title: string;
  description: string;
  fullContent?: string;
  lsiKeywords?: string[];
  images?: string[];
  analysis?: {
    strengths: string[];
    weaknesses: string[];
    keyEntities: string[];
    lsiTerms: string[];
    intentType: string;
    intentReasoning?: string;
    topicalDepthScore?: number;
    readabilityLevel?: string;
  };
  headings?: HeadingItem[];
  sections?: { level: string; heading: string; paragraphs: string[] }[];
}

// --- Types ---
interface FAQItem {
  question: string;
  answer: string;
}

interface MetricValue {
  label: string;
  competitorScore: number;
  yourScore: number;
  reasoning: string;
}

interface BlogPost {
  id?: string;
  title: string;
  introduction: string;
  content: string;
  faq: FAQItem[];
  conclusion: string;
  meta_title?: string;
  meta_description?: string;
  targetLsiKeywords?: string[];
  status: 'draft' | 'published' | 'scheduled';
  scheduledAt?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  wpId?: number;
  link?: string;
  createdAt?: any;
  comparisonMetrics?: MetricValue[];
  featuredImage?: {
    url: string;
    alt: string;
    title: string;
    filename: string;
    prompt: string;
  };
  contentImages?: {
    url: string;
    alt: string;
    filename: string;
    prompt: string;
  }[];
}

/** Helper to ensure blog draft conforms to current schema */
const normalizeBlogPost = (post: any, id?: string): BlogPost => {
  let faq: FAQItem[] = [];
  if (Array.isArray(post.faq)) {
    faq = post.faq;
  } else if (typeof post.faq === 'string' && post.faq.trim()) {
    faq = [{ question: "Frequently Asked Questions", answer: post.faq }];
  }

  return {
    ...post,
    id: id || post.id,
    content: post.content || post.mainContent || '',
    faq: faq,
    status: post.status || 'draft'
  };
};

const getGeminiModelName = (model: string) => {
  const m = (model || '').toLowerCase();
  if (m.includes('3.1-flash-lite')) return 'models/gemini-3.1-flash-lite';
  // Default/fallback to the requested standard model
  return 'models/gemini-2.5-flash';
};

interface AppSettings {
  wpUrl: string;
  wpUsername: string;
  wpAppPassword: string;
  gscProperty: string;
  sopKeywords: string[];
  includeFaqs: boolean;
  includeConclusion: boolean;
  punMode: boolean;
  imagePlacement: 'random' | 'after-h2' | 'after-h3';
  lsiKeywords: boolean;
  targetWordCount: number;
  aiModel: string;
  theme: 'light' | 'dark';
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  openaiKey?: string;
  anthropicKey?: string;
  geminiKey?: string;
  sopModels?: {
    title: string;
    introduction: string;
    content: string;
    faq: string;
    metaDescription: string;
    conclusion: string;
    lsi: string;
  };
  prompts: {
    title: string;
    introduction: string;
    content: string;
    faq: string;
    metaDescription: string;
    conclusion: string;
    lsi: string;
  }
}

interface WritingBlueprint {
  id?: string;
  name: string;
  description?: string;
  sopModels: AppSettings['sopModels'];
  prompts: AppSettings['prompts'];
  targetWordCount: number;
  includeConclusion: boolean;
  imagePlacement: 'random' | 'after-h2' | 'after-h3';
  createdAt?: any;
}

const injectImages = (html: string, images: BlogPost['contentImages'] = [], placement: 'random' | 'after-h2' | 'after-h3' = 'after-h2') => {
  if (!html) return '';
  
  // Strip existing injected images first to ensure clean re-injection
  const cleanHtml = html.replace(/\n?<figure class="wp-block-image[^>]*>.*?<\/figure>\n?/gs, '').trim();
  
  if (!images || images.length === 0) return cleanHtml;
  
  const tag = placement === 'after-h3' ? '</h3>' : '</h2>';
  const parts = cleanHtml.split(tag);
  
  if (parts.length > 1 && placement !== 'random') {
    let newHtml = '';
    parts.forEach((part, idx) => {
      newHtml += part;
      if (idx < parts.length - 1) {
        newHtml += tag;
        if (images[idx] && images[idx].url) {
          newHtml += `\n<figure class="wp-block-image size-large my-12"><img src="${images[idx].url}" alt="${images[idx].alt || ''}" class="rounded-xl border-4 border-slate-800 shadow-xl" /><figcaption class="text-center mt-2 italic text-sm text-slate-500 uppercase font-black tracking-widest">${images[idx].alt || ''}</figcaption></figure>\n`;
        }
      }
    });
    return newHtml;
  }
  
  // Fallback or random: insert at paragraph breaks
  const pParts = cleanHtml.split('</p>');
  if (pParts.length > 3) {
    let newHtml = '';
    pParts.forEach((part, idx) => {
      newHtml += part + '</p>';
      const imgIdx = Math.floor(idx / 3);
      if (idx > 0 && idx % 3 === 0 && images[imgIdx] && images[imgIdx].url) {
        newHtml += `\n<figure class="wp-block-image size-large my-12"><img src="${images[imgIdx].url}" alt="${images[imgIdx].alt || ''}" class="rounded-xl border-4 border-slate-800 shadow-xl" /><figcaption class="text-center mt-2 italic text-sm text-slate-500 uppercase font-black tracking-widest">${images[imgIdx].alt || ''}</figcaption></figure>\n`;
      }
    });
    return newHtml;
  }
  
  return cleanHtml;
};

// --- Main Component ---
export default function App() {
  const [activeTab, setActiveTab] = useState<'competitors' | 'optimizer' | 'proofreader' | 'sops' | 'setup' | 'settings' | 'history'>('competitors');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isFirestoreOffline, setIsFirestoreOffline] = useState(false);

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const originalMessage = error instanceof Error ? error.message : String(error);
    
    // Add localized context for common environment issues
    let contextualHint = "";
    const lowerMsg = originalMessage.toLowerCase();
    
  if (lowerMsg.includes("offline") || lowerMsg.includes("could not reach") || lowerMsg.includes("backend didn't respond")) {
      setIsFirestoreOffline(true);
      contextualHint = ` (Connection Timeout: Ensure the container has outbound networking. If this persists, the database ID '${firebaseConfig.firestoreDatabaseId}' might be provisioned in a different region or currently offline.)`;
    } else if (lowerMsg.includes("permission-denied") || lowerMsg.includes("missing or insufficient permissions")) {
      contextualHint = ` (Security Breach: Check Firestore Rules for '${path}'. Also verify '${window.location.hostname}' is in Auth > Settings > Authorized Domains.)`;
    } else if (lowerMsg.includes("unauthorized") || lowerMsg.includes("origin")) {
      contextualHint = ` (Origin Rejected: Add '${window.location.hostname}' to Firebase Auth Settings.)`;
    }

    const errInfo: FirestoreErrorInfo = {
      error: originalMessage + contextualHint,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType,
      path
    }
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(['']);
  const [focusKeyword_state, setFocusKeyword] = useState('');
  const [blueprints, setBlueprints] = useState<WritingBlueprint[]>([]);
  const [activeBlueprint, setActiveBlueprint] = useState<string | null>(null);
  const [blueprintName, setBlueprintName] = useState('');
  const [isBlueprintLoading, setIsBlueprintLoading] = useState(false);
  const [isSavingBlueprint, setIsSavingBlueprint] = useState(false);
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [currentResearch, setCurrentResearch] = useState<CompetitorData[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapingProgress, setScrapingProgress] = useState<{ processed: number, total: number, currentUrl?: string }>({ processed: 0, total: 0 });
  const [researchLogs, setResearchLogs] = useState<{id: string, timestamp: string, message: string, type: 'info' | 'success' | 'error' | 'warning'}[]>([]);
  const [lastSerpResults, setLastSerpResults] = useState<{url: string, title?: string}[]>([]);
  const [showResearchReport, setShowResearchReport] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualEntry, setManualEntry] = useState<Partial<CompetitorData>>({
    url: '',
    title: '',
    wordCount: 0,
    imageCount: 0,
    description: '',
    fullContent: ''
  });

  const [editableHeadings, setEditableHeadings] = useState<HeadingItem[] | null>(null);
  const [editableTitle, setEditableTitle] = useState<string>('');

  const addResearchLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setResearchLogs(prev => [{
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }, ...prev].slice(0, 50));
  };
  const [searches, setSearches] = useState<{id: string, query: string, timestamp: any}[]>([]);
  const [publicationHistory, setPublicationHistory] = useState<BlogPost[]>([]);

  const [selectedSearches, setSelectedSearches] = useState<Set<string>>(new Set());
  const [selectedResearch, setSelectedResearch] = useState<Set<string>>(new Set());
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());

  const [groundingKeyword, setGroundingKeyword] = useState('');
  const [groundingResults, setGroundingResults] = useState<{
    paa: string[];
    lsi: string[];
  } | null>(null);
  const [isGrounding, setIsGrounding] = useState(false);

  // Duplicate-aware setters
  const addUniqueSearches = (newSearches: {id: string, query: string, timestamp: any}[]) => {
    setSearches(prev => {
      const combined = [...newSearches, ...prev];
      const seen = new Set();
      return combined.filter(item => {
        const normalized = item.query.toLowerCase().trim();
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
    });
  };

  const addUniqueCompetitors = (newCompetitors: CompetitorData[]) => {
    setCompetitors(prev => {
      const combined = [...newCompetitors, ...prev];
      const seen = new Set();
      return combined.filter(item => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      });
    });
  };

  const addUniquePosts = (posts: BlogPost[]) => {
    setPublicationHistory(prev => {
      const combined = [...posts, ...prev];
      const seen = new Set();
      return combined.filter(item => {
        const id = item.id || item.wpId || item.title;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    });
  };

  const handleDeletePost = async (postId: string | undefined, postTitle: string) => {
    if (!postId) return;
    if (!window.confirm(`Are you sure you want to delete "${postTitle}"?`)) return;

    try {
      await deleteDoc(doc(db, 'posts', postId));
      setPublicationHistory(prev => prev.filter(p => p.id !== postId));
      showNotification("Post deleted successfully", 'success');
      
      // If the deleted post was the current draft, reset it
      if (blogDraft.id === postId) {
        setBlogDraft({
          title: '',
          introduction: '',
          sections: [],
          conclusion: '',
          metaDescription: '',
          focusKeyword: '',
          tags: [],
          categories: [],
          status: 'draft',
          faq: []
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const [blogDraft, setBlogDraft] = useState<BlogPost | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImageGenerating, setIsImageGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ step: 0, total: 7, label: '' });
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishStatus, setPublishStatus] = useState<'draft' | 'publish'>('draft');
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    wpUrl: '',
    wpUsername: '',
    wpAppPassword: '',
    gscProperty: '',
    sopKeywords: ['focus keyword', 'internal link', 'external link'],
    includeFaqs: true,
    includeConclusion: true,
    punMode: false,
    imagePlacement: 'after-h2',
    lsiKeywords: true,
    targetWordCount: 1200,
  aiModel: "models/gemini-2.5-flash",
    theme: 'dark',
    aspectRatio: '16:9',
    openaiKey: '',
    anthropicKey: '',
    geminiKey: '',
    sopModels: {
  title: 'models/gemini-2.5-flash',
  introduction: 'models/gemini-2.5-flash',
  content: 'models/gemini-2.5-flash',
  faq: 'models/gemini-2.5-flash',
  metaDescription: 'models/gemini-2.5-flash',
  conclusion: 'models/gemini-2.5-flash',
  lsi: 'models/gemini-2.5-flash'
    },
    prompts: {
      title: 'Act as a master copywriter. Generate a high-CTR, high-impact title that leads with the transformation or benefit the reader will achieve. Integrate the focus keyword "${focus_keyword}" naturally and ensure the final output is strictly under 60 characters.',
      introduction: 'Create a high-engagement "Hook-Context-Action" introduction. Start with a disruptive "Pattern-Interrupt" opening line that grabs attention. Acknowledge hidden pain points, explain why traditional advice fails, and promise a unique, data-driven solution. Integrate "${focus_keyword}" early and naturally.',
      content: 'Identify critical content gaps (missing subtopics, weak explanations) found in competitor pages. Generate a comprehensive guide with H1, H2 and H3 headings that fills these gaps using the "Inverted Pyramid" style. Expand on concepts to meet the word count requirement while maintaining high topical density. Naturally weave these semantic LSI keywords to improve topical depth: {keywords}.',
      faq: 'Analyze search intent for "People Also Ask" triggers. Generate 5 high-intent FAQs that answer questions competitors ignore or answer superficially. Each answer must be concise and benefit-oriented.',
      metaDescription: 'Act as an expert SEO analyst. Generate a compelling meta description between 150-160 characters. Lead with a primary benefit, integrate "${focus_keyword}" naturally, and conclude with a high-conversion call-to-action.',
      conclusion: 'Generate an <h2>Conclusion</h2> heading followed by 3-4 paragraphs. Summarize the unique value delivered and provide a "Mastery Checklist" of key takeaways. End with a compelling, high-urgency call-to-action.',
      lsi: 'Naturally weave these semantic LSI keywords to improve topical depth without keyword stuffing: {keywords}.'
    }
  });

  // Apply Theme
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  const [categories, setCategories] = useState<{id: number, name: string}[]>([]);
  const [tags, setTags] = useState<{id: number, name: string}[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [isFetchingCategories, setIsFetchingCategories] = useState(false);
  const [isFetchingTags, setIsFetchingTags] = useState(false);

  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'warning', detail?: string} | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [activeProviderTab, setActiveProviderTab] = useState<'google' | 'openai' | 'anthropic'>('google');

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' = 'success', detail?: string) => {
    setNotification({ message, type, detail });
    // Keep errors longer
    const timeout = type === 'error' ? 8000 : 4000;
    setTimeout(() => setNotification(null), timeout);
  };

  // --- Autosave logic ---
  useEffect(() => {
    if (!blogDraft || !user || blogDraft.status === 'published') return;
    
    const timer = setTimeout(async () => {
      setIsAutosaving(true);
      try {
        // 1. Extract images to avoid 1MB limit
        const { featuredImage, contentImages, ...metadata } = blogDraft;
        
        // 2. Save metadata and text content
        await setDoc(doc(db, 'drafts', user.uid), {
          ...metadata,
          updatedAt: serverTimestamp()
        });

        // 3. Save images separately if they exist
        if (featuredImage) {
          await setDoc(doc(db, 'draft_images', `${user.uid}_featured`), {
            url: featuredImage.url || '',
            prompt: featuredImage.prompt || '',
            alt: featuredImage.alt || '',
            updatedAt: serverTimestamp()
          });
        }

        if (contentImages && contentImages.length > 0) {
          // Save each content image as a separate document
          await Promise.all(contentImages.map((img, idx) => {
            if (img) {
              return setDoc(doc(db, 'draft_images', `${user.uid}_content_${idx}`), {
                url: img.url || '',
                prompt: img.prompt || '',
                alt: img.alt || '',
                updatedAt: serverTimestamp()
              });
            }
            return Promise.resolve();
          }));
        }

        console.log("Autosaved fragmented draft");
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `drafts/${user.uid}`);
      } finally {
        setIsAutosaving(false);
      }
    }, 5000); // 5 second debounce

    return () => clearTimeout(timer);
  }, [blogDraft, user]);

  // --- Blueprint Logic ---
  const fetchBlueprints = useCallback(async () => {
    if (!user) return;
    setIsBlueprintLoading(true);
    try {
      const q = query(collection(db, 'blueprints'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetched = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          includeConclusion: data.includeConclusion ?? true,
          imagePlacement: data.imagePlacement ?? 'after-h2'
        } as WritingBlueprint;
      });
      setBlueprints(fetched);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'blueprints');
    } finally {
      setIsBlueprintLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchBlueprints();
    }
  }, [user, fetchBlueprints]);

  const saveBlueprint = async () => {
    if (!user || !blueprintName.trim()) {
      showNotification("Please enter a blueprint name", "warning");
      return;
    }
    
    setIsSavingBlueprint(true);
    try {
      const newBlueprint = {
        userId: user.uid,
        name: blueprintName,
        sopModels: settings.sopModels,
        prompts: settings.prompts,
        targetWordCount: settings.targetWordCount,
        includeConclusion: settings.includeConclusion,
        imagePlacement: settings.imagePlacement,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'blueprints'), newBlueprint);
      setBlueprints([{ id: docRef.id, ...newBlueprint, createdAt: new Date() } as WritingBlueprint, ...blueprints]);
      setBlueprintName('');
      setActiveBlueprint(docRef.id);
      showNotification("SOP Blueprint saved successfully", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'blueprints');
    } finally {
      setIsSavingBlueprint(false);
    }
  };

  const loadBlueprint = (blueprint: WritingBlueprint) => {
    setSettings({
      ...settings,
      sopModels: blueprint.sopModels,
      prompts: blueprint.prompts,
      targetWordCount: blueprint.targetWordCount,
      includeConclusion: blueprint.includeConclusion ?? true,
      imagePlacement: blueprint.imagePlacement ?? 'after-h2'
    });
    setActiveBlueprint(blueprint.id || null);
    showNotification(`SOP Blueprint "${blueprint.name}" applied`, "success");
  };

  const deleteBlueprint = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'blueprints', id));
      setBlueprints(blueprints.filter(b => b.id !== id));
      if (activeBlueprint === id) setActiveBlueprint(null);
      showNotification("Blueprint removed", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `blueprints/${id}`);
    }
  };
  useEffect(() => {
    if (!user) return;
    const loadDraft = async () => {
      try {
        const draftDoc = await getDoc(doc(db, 'drafts', user.uid));
        if (draftDoc.exists()) {
          const data = draftDoc.data();
          const post = normalizeBlogPost(data);
          
          // 4. Fetch images separately and merge
          try {
            const featImgPath = `draft_images/${user.uid}_featured`;
            const featImgDoc = await getDoc(doc(db, 'draft_images', `${user.uid}_featured`)).catch(err => {
              handleFirestoreError(err, OperationType.GET, featImgPath);
              return null;
            });
            if (featImgDoc?.exists()) {
              post.featuredImage = featImgDoc.data() as any;
            }

            const loadedImages: any[] = [];
            const imgResults = await Promise.all(
              Array.from({ length: 15 }).map((_, i) => {
                const path = `draft_images/${user.uid}_content_${i}`;
                return getDoc(doc(db, 'draft_images', `${user.uid}_content_${i}`)).catch(err => {
                  handleFirestoreError(err, OperationType.GET, path);
                  return null;
                });
              })
            );
            
            imgResults.forEach((imgDoc, i) => {
              if (imgDoc?.exists()) {
                loadedImages[i] = imgDoc.data();
              }
            });

            if (loadedImages.length > 0) {
              post.contentImages = loadedImages;
            }
          } catch (imgErr) {
            console.error("Failed to load fragmented images:", imgErr);
          }

          setBlogDraft(post);
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, `drafts/${user.uid}`);
      }
    };
    loadDraft();
  }, [user]);

  // --- Auth & Data Loading ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthLoading(false);
      if (u) {
        loadUserData(u.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // Auto-populate editable headings/title when new research arrives
  useEffect(() => {
    if (currentResearch.length === 0) {
      setEditableHeadings(null);
      setEditableTitle('');
      return;
    }
    const primary = currentResearch.find(c => c.headings && c.headings.length > 0) || currentResearch[0];
    const junkPattern = /^(share|like what|follow|subscribe|in this blog|newsletter|cookie|privacy|menu|nav|sidebar|related|tags|categories|comments|leave a reply|about the author|recent posts|popular posts|advertisement|sign up|log in|get in touch|contact|back to top|table of contents)/i;
    const filtered = (primary?.headings || []).filter(h =>
      h.level !== 'h1' &&
      h.text?.trim() &&
      h.text.trim().length >= 10 &&
      !junkPattern.test(h.text.trim())
    );
    setEditableHeadings(filtered);
    setEditableTitle(primary?.title?.replace(/[-|].*$/, '').trim() || '');
  }, [currentResearch]);

  const loadImagesForPost = async (postId: string): Promise<{featuredImage?: any, contentImages?: any[]}> => {
    if (!postId || postId === 'undefined') return {};
    try {
      const featImgPath = `post_images/${postId}_featured`;
      const featImgDoc = await getDoc(doc(db, 'post_images', `${postId}_featured`)).catch(err => {
        handleFirestoreError(err, OperationType.GET, featImgPath);
        return null;
      });
      const featuredImage = featImgDoc?.exists() ? featImgDoc.data() : undefined;

      const loadedImages: any[] = [];
      const imgResults = await Promise.all(
        Array.from({ length: 15 }).map((_, i) => {
          const path = `post_images/${postId}_content_${i}`;
          return getDoc(doc(db, 'post_images', `${postId}_content_${i}`)).catch(err => {
            handleFirestoreError(err, OperationType.GET, path);
            return null;
          });
        })
      );
      
      imgResults.forEach((imgDoc, i) => {
        if (imgDoc?.exists()) {
          loadedImages[i] = imgDoc.data();
        }
      });

      return { 
        featuredImage, 
        contentImages: loadedImages.length > 0 ? loadedImages : undefined 
      };
    } catch (err) {
      console.error("Lazy load images failed:", err);
      return {};
    }
  };

  const loadUserData = async (uid: string) => {
    try {
      setIsFirestoreOffline(false); // Reset offline state on load attempt
      
      // Load Settings
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', uid)).catch(err => {
          handleFirestoreError(err, OperationType.GET, `settings/${uid}`);
          return null;
        });
        if (settingsDoc.exists()) {
          const data = settingsDoc.data() as AppSettings;
          // Migration for legacy or invalid model names
          const validModels = [
            'models/gemini-2.5-flash', 'models/gemini-2.0-flash-lite',
            'gpt-4o-mini', 'gpt-3.5-turbo',
            'claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'
          ];
          if (!data.aiModel || !validModels.includes(data.aiModel)) {
            data.aiModel = 'models/gemini-2.5-flash';
          }
          if (!data.sopModels) {
            data.sopModels = {
              title: 'models/gemini-2.5-flash',
              introduction: 'models/gemini-2.5-flash',
              content: 'models/gemini-2.5-flash',
              faq: 'models/gemini-2.5-flash',
              metaDescription: 'models/gemini-2.5-flash',
              conclusion: 'models/gemini-2.5-flash',
              lsi: 'models/gemini-2.5-flash'
            };
          } else {
            // Migrate any stale/invalid model IDs
            Object.keys(data.sopModels).forEach(k => {
              const key = k as keyof AppSettings['sopModels'];
              if (data.sopModels![key] && !validModels.includes(data.sopModels![key])) {
                data.sopModels![key] = 'models/gemini-2.5-flash';
              }
            });
          }
          if (data.sopModels && !data.sopModels.metaDescription) {
            data.sopModels.metaDescription = 'models/gemini-2.5-flash';
          }
          if (data.prompts && !data.prompts.metaDescription) {
            data.prompts.metaDescription = 'Act as an expert SEO analyst. Generate a compelling meta description between 150-160 characters. Lead with a primary benefit, integrate the focus keyword naturally, and conclude with a high-conversion call-to-action that creates urgency or curiosity.';
          }
          if (data.includeConclusion === undefined) {
            data.includeConclusion = true;
          }
          if (data.imagePlacement === undefined) {
            data.imagePlacement = 'after-h2';
          }
          // wpAppPassword is now in Firestore; API keys are localStorage-only
          const localKeys = JSON.parse(localStorage.getItem('ws_sensitive_keys') || '{}');
          setSettings({ ...data, ...localKeys });
        } else {
          // No Firestore doc — restore any locally saved keys
          const localKeys = JSON.parse(localStorage.getItem('ws_sensitive_keys') || '{}');
          if (Object.keys(localKeys).length > 0) setSettings(prev => ({ ...prev, ...localKeys }));
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, `settings/${uid}`);
      }

      // Load Competitors
      try {
        const qCompetitors = query(
          collection(db, 'competitors'), 
          where('authorId', '==', uid)
        );
        const competitorsSnap = await getDocs(qCompetitors);
        addUniqueCompetitors(competitorsSnap.docs.map(d => ({ id: d.id, ...(d.data() as CompetitorData) })));
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, 'competitors');
      }

      // Load Recent Draft
      try {
        const qPosts = query(
          collection(db, 'posts'),
          where('authorId', '==', uid),
          orderBy('createdAt', 'desc'),
        );
        const postsSnap = await getDocs(qPosts);
        const posts = postsSnap.docs.map(d => normalizeBlogPost(d.data(), d.id));
        addUniquePosts(posts);
        if (posts.length > 0) {
          const firstPost = posts[0];
          const images = await loadImagesForPost(firstPost.id!);
          setBlogDraft({ ...firstPost, ...images });
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, 'posts');
      }

      // Load Searches
      try {
        const qSearches = query(
          collection(db, 'searches'),
          where('authorId', '==', uid),
          orderBy('createdAt', 'desc')
        );
        const searchesSnap = await getDocs(qSearches);
        addUniqueSearches(searchesSnap.docs.map(d => ({ id: d.id, ...(d.data() as {query: string, timestamp: any}) })));
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, 'searches');
      }
    } catch (error) {
      console.error("Failed to load user data:", error);
      if (String(error).includes("offline")) {
        setIsFirestoreOffline(true);
      }
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    try {
      // Cache locally for offline access, and also persist everything (including keys) to Firestore
      localStorage.setItem('ws_sensitive_keys', JSON.stringify({ geminiKey: settings.geminiKey, openaiKey: settings.openaiKey, anthropicKey: settings.anthropicKey, wpAppPassword: settings.wpAppPassword }));
      await setDoc(doc(db, 'settings', user.uid), {
        ...settings,
        updatedAt: serverTimestamp()
      });
      showNotification("Settings saved.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `settings/${user.uid}`);
    }
  };

  const saveCompetitorToFirestore = async (data: CompetitorData) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'competitors'), {
        ...data,
        authorId: user.uid,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'competitors');
    }
  };

  const savePostToFirestore = async (post: BlogPost) => {
    if (!user) return;
    try {
      // 1. Fragment images
  const { featuredImage, contentImages, ...metadata } = post || {};
      
      let postId = post.id;
      
      if (postId) {
        // Update existing
        const docRef = doc(db, 'posts', postId);
        await updateDoc(docRef, {
          ...metadata,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new
        const docRef = await addDoc(collection(db, 'posts'), {
          ...metadata,
          authorId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        postId = docRef.id;
      }

      // 2. Save fragmented images
      if (featuredImage) {
        await setDoc(doc(db, 'post_images', `${postId}_featured`), {
          url: featuredImage.url || '',
          prompt: featuredImage.prompt || '',
          alt: featuredImage.alt || '',
          updatedAt: serverTimestamp()
        });
      }

      if (contentImages && contentImages.length > 0) {
        await Promise.all(contentImages.map((img, idx) => {
          if (img) {
            return setDoc(doc(db, 'post_images', `${postId}_content_${idx}`), {
              url: img.url || '',
              prompt: img.prompt || '',
              alt: img.alt || '',
              updatedAt: serverTimestamp()
            });
          }
          return Promise.resolve();
        }));
      }

      const savedPost = { ...post, id: postId };
      addUniquePosts([savedPost]);
      return postId;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'posts');
    }
  };

  const handleDeleteSelectedSearches = async () => {
    if (selectedSearches.size === 0) return;
    if (!window.confirm(`Delete ${selectedSearches.size} search records?`)) return;

    const idsToDelete = Array.from(selectedSearches);
    try {
      await Promise.all(idsToDelete.map((id: string) => deleteDoc(doc(db, 'searches', id))));
      setSearches(prev => prev.filter(s => !selectedSearches.has(s.id)));
      setSelectedSearches(new Set());
      showNotification(`Deleted ${idsToDelete.length} searches`, 'success');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'searches/bulk');
    }
  };

  const handleDeleteSelectedResearch = async () => {
    if (selectedResearch.size === 0) return;
    if (!window.confirm(`Delete ${selectedResearch.size} research records?`)) return;

    const idsToDelete = Array.from(selectedResearch);
    try {
      await Promise.all(idsToDelete.map((id: string) => deleteDoc(doc(db, 'competitors', id))));
      setCompetitors(prev => prev.filter(c => !selectedResearch.has(c.id!)));
      setSelectedResearch(new Set());
      showNotification(`Deleted ${idsToDelete.length} research entries`, 'success');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'competitors/bulk');
    }
  };

  const handleDeleteSelectedPosts = async () => {
    if (selectedPosts.size === 0) return;
    if (!window.confirm(`Delete ${selectedPosts.size} publication records?`)) return;

    const idsToDelete = Array.from(selectedPosts);
    try {
      await Promise.all(idsToDelete.map((id: string) => deleteDoc(doc(db, 'posts', id))));
      setPublicationHistory(prev => prev.filter(p => !selectedPosts.has(p.id!)));
      setSelectedPosts(new Set());
      showNotification(`Deleted ${idsToDelete.length} posts`, 'success');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'posts/bulk');
    }
  };

  const saveSearchToFirestore = async (queryText: string) => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'searches'), {
        query: queryText,
        authorId: user.uid,
        createdAt: serverTimestamp()
      });
      addUniqueSearches([{ id: docRef.id, query: queryText, timestamp: new Date() }]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'searches');
    }
  };

  const handleGrounding = async () => {
    if (!groundingKeyword) {
      showNotification("Please enter a keyword for grounding", "error");
      return;
    }
    setIsGrounding(true);
    setGroundingResults(null);

    const prompt = `Perform extensive SEO research for the keyword: "${groundingKeyword}".
    Fetch:
    1. A list of exactly 8 "People Also Ask" (PAA) questions related to this keyword that appear in search results.
    2. A list of 15 high-impact LSI (Latent Semantic Indexing) and semantic keywords found in competing content.
    
    Return the data in the following JSON format:
    {
      "paa": ["question 1", "question 2", ...],
      "lsi": ["keyword 1", "keyword 2", ...]
    }`;

    try {
      const apiKey = settings.geminiKey || (process.env.GEMINI_API_KEY as string);
      if (!apiKey) throw new Error("Gemini Key Missing: Grounding requires an API key in Settings.");
      const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });

const modelsToTry = [
  'models/gemini-2.0-flash-lite',
  'models/gemini-2.0-flash',
  'models/gemini-1.5-flash-latest'
];
      let response = null;
      let lastError = null;

      for (const modelId of modelsToTry) {
        try {
          console.log('[AI LOG] Grounding INPUT', { model: modelId, prompt });
          const result = await ai.models.generateContent({
            model: modelId,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              tools: [{ googleSearch: {} }],
              responseMimeType: "application/json",
              temperature: 0.1
            }
          });
          console.log('[AI LOG] Grounding OUTPUT', result.text);
          if (result.text) {
            response = result;
            break;
          }
        } catch (err: any) {
          lastError = err;
          const errStr = String(err);
          if (errStr.includes('404') || errStr.includes('model')) {
            console.warn(`Grounding: Model ${modelId} failed, trying next...`);
            continue;
          }
          throw err;
        }
      }

      if (!response) throw lastError || new Error("All grounding models failed.");

      const data = JSON.parse(response.text || '{}');
      setGroundingResults({
        paa: data.paa || [],
        lsi: data.lsi || []
      });
      showNotification("Intelligence Grounding Complete", "success");
    } catch (err: any) {
      console.error("Grounding Failure:", err);
      const { message, detail, solution } = formatAIError(err);
      showNotification(message, 'error', `Grounding fault: ${detail} ${solution}`);
    } finally {
      setIsGrounding(false);
    }
  };

  const [isRefining, setIsRefining] = useState(false);
  const [proofreadGrade, setProofreadGrade] = useState<'grade5-6' | 'grade7-8' | 'grade9-10' | 'expert'>('grade7-8');
  const [proofreadTone, setProofreadTone] = useState<'neutral' | 'professional' | 'conversational' | 'authoritative' | 'friendly'>('neutral');
  const [selectedProofreadSop, setSelectedProofreadSop] = useState<keyof typeof settings.prompts | 'none'>('none');
  const [proofreadContext, setProofreadContext] = useState('');
  const [isProofreading, setIsProofreading] = useState(false);

  const handleProofread = async () => {
    if (!blogDraft || !blogDraft.content) {
      showNotification("No content found to proofread", "error");
      return;
    }
    
    setIsProofreading(true);
    showNotification("Executing Proofreader Engine...", "success");

    // Phase 1: Clean Input
    const cleanedContent = blogDraft.content.trim();

    const systemPrompt = `You are a professional content proofreader, editor, and SEO writer.
Your job is to refine and improve content so it reads like it was written by a skilled human, while maintaining clarity, accuracy, and search intent.

Follow this workflow strictly:
1. Structure Optimization: Ensure logical flow, improve heading hierarchy, break long paragraphs, remove repetition.
2. Clarity Improvement: Simplify complex/awkward sentences, replace vague wording.
3. Humanization: Remove robotic or AI-like phrasing (Avoid: "In today's world", "Furthermore", "Moreover"). Use natural transitions.
4. SEO Optimization: Keep keywords natural, improve headings, add semantic variations.
5. Grammar: Fix punctuation, word choice, and maintain consistent tense.
6. Readability Control: Enforce chosen grade level logic.
7. Content Integrity: Do not change meaning or add fluff.

Grade Enforcement Logic:
- Grade 5-6: Very simple, short sentences.
- Grade 7-8: Clear, natural, conversational. 10-18 words avg sentence length.
- Grade 9-10: Professional and structured.
- Expert: Technical and precise.

OUTPUT RULE:
- Return ONLY the final improved content.
- Do NOT include explanations, notes, or comments.`;

    const gradeInstruction = {
      'grade5-6': "TARGET: Grade 5-6 (Simple/Short)",
      'grade7-8': "TARGET: Grade 7-8 (Conversational/SEO standard)",
      'grade9-10': "TARGET: Grade 9-10 (Professional/Structured)",
      'expert': "TARGET: Expert (Technical/Precise)"
    }[proofreadGrade];

    const toneInstruction = {
      'neutral': "TONE: Balanced and clear.",
      'professional': "TONE: Formal, objective, and professional.",
      'conversational': "TONE: Engaging, relatable, and human-centric.",
      'authoritative': "TONE: Decisive, industry-leading expert voice.",
      'friendly': "TONE: Warm, approachable, and encouraging."
    }[proofreadTone];

    const sopInstruction = selectedProofreadSop !== 'none' 
      ? `STRICT SEO SOP ADHERENCE REQUIRED: ${settings.prompts[selectedProofreadSop]}` 
      : "";

    const contextInstruction = proofreadContext ? `ADDITIONAL REFINEMENT CONTEXT: ${proofreadContext}` : "";

    try {
      const apiKey = settings.geminiKey || (process.env.GEMINI_API_KEY as string);
      if (!apiKey) throw new Error("Gemini Key Missing: Proofreader requires an API key in Settings.");
      
      const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
      const proofreadInput = `${systemPrompt}\n\n${gradeInstruction}\n${toneInstruction}\n${sopInstruction}\n${contextInstruction}\n\nCONTENT:\n${cleanedContent}`;
      console.log('[AI LOG] Proofreader INPUT', { model: 'models/gemini-2.5-flash', prompt: proofreadInput });
      const response = await ai.models.generateContent({
  model: 'models/gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: proofreadInput }] }],
        config: {
          temperature: 0.1,
          topP: 0.9
        }
      });
      console.log('[AI LOG] Proofreader OUTPUT', response.text);
      const refinedContent = response.text || '';

      if (refinedContent) {
        setBlogDraft({
          ...blogDraft,
          // Preserve raw HTML returned by the model and present a readable plain-text version in the editor
          rawContent: refinedContent,
          content: htmlToPlainText(refinedContent)
        });
        showNotification(`Humanized refinement complete (${proofreadGrade})`, "success");
      }
    } catch (err: any) {
      console.error("Proofreader Failure:", err);
      showNotification("Proofread Failed: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsProofreading(false);
    }
  };

  const handleRefineStructure = async () => {
    if (!blogDraft) return;
    setIsRefining(true);
    showNotification("Analyzing content architecture...", "success");

    const prompt = `Act as a Senior SEO Editor. Analyze the following blog post structure and content. 
    Target Word Count: ${settings.targetWordCount}
    Current Content: ${blogDraft.content}
    
    TASK: Provide specific, actionable suggestions to improve the structure, flow, and SEO of this content. 
    Focus on:
    1. Heading Hierarchy (H2/H3 distribution).
    2. Logical Flow between sections.
    3. Paragraph Length (SEO readability).
    4. Gaps relative to the target word count.
    
    Return your response as a concise list of structural improvements. If specific text changes are needed, suggest the structural shift rather than rewriting the whole post.`;

    try {
      const apiKey = settings.geminiKey || (process.env.GEMINI_API_KEY as string);
      if (!apiKey) throw new Error("Gemini Key Missing: Refinement requires an API key in Settings.");
      
      const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
      console.log('[AI LOG] Structure Refinement INPUT', { model: 'models/gemini-2.5-flash', prompt });
      const response = await ai.models.generateContent({
  model: 'models/gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      console.log('[AI LOG] Structure Refinement OUTPUT', response.text);
      const text = response.text || '';

      // Inject as a system note or show in a specialized UI
      setBlogDraft({
        ...blogDraft,
        content: `<!-- AI STRUCTURAL RECOMMENDATIONS -->\n<!-- ${text.replace(/-->/g, '')} -->\n\n${blogDraft.content}`
      });
      showNotification("Structure refined: See top of editor for notes", "success");
    } catch (err: any) {
      console.error("Refinement Failure:", err);
      showNotification("Refinement Failed: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsRefining(false);
    }
  };

  const fetchCategories = async () => {
    if (!settings.wpUrl || !settings.wpUsername || !settings.wpAppPassword) {
      showNotification("Please configure WP settings first", 'error');
      return;
    }
    setIsFetchingCategories(true);
    try {
      const res = await fetch('/api/wordpress/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCategories(data);
      showNotification("Categories synced");
    } catch (err: any) {
      showNotification("Failed to fetch categories", 'error');
    } finally {
      setIsFetchingCategories(false);
    }
  };

  const fetchTags = async () => {
    if (!settings.wpUrl || !settings.wpUsername || !settings.wpAppPassword) {
      showNotification("Please configure WP settings first", 'error');
      return;
    }
    setIsFetchingTags(true);
    try {
      const res = await fetch('/api/wordpress/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTags(data);
      showNotification("Tags synced");
    } catch (err: any) {
      showNotification("Failed to fetch tags", 'error');
    } finally {
      setIsFetchingTags(false);
    }
  };

  const generateFeaturedImage = async () => {
    if (!blogDraft || !blogDraft.featuredImage) return;
    await generateIndividualImage(blogDraft.featuredImage.prompt, 'featured', undefined, settings.aspectRatio);
  };

  const compressImage = (base64: string, maxWidth = 1024, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Fill white background for JPEG conversion
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(base64); // Fallback to original if failed
    });
  };

    // Convert HTML to readable plain text for editor display while preserving raw HTML
    const htmlToPlainText = (html?: string | null) => {
      if (!html) return '';
      try {
        // Use DOMParser in the browser to preserve text structure
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const text = doc.body.textContent || '';
        return text.replace(/\s+/g, ' ').trim();
      } catch (e) {
        // Fallback: strip tags crudely
        return (html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      }
    };

  const generateIndividualImage = async (prompt: string, type: 'featured' | 'content', index?: number, aspectRatio: string = '16:9') => {
    const apiKey = settings.geminiKey || (process.env.GEMINI_API_KEY as string);
    if (!apiKey) {
      showNotification("Critical System Fault: Gemini Core Key missing", 'error');
      return;
    }
    if (type === 'featured') setIsImageGenerating(true);
    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    try {
      showNotification(`Generating visual asset (${aspectRatio})...`, 'success');
      
      let imageUrl = '';

      // Determine image models to try. Prefer an explicit setting if present.
      const configuredModels: string[] | undefined = (settings as any).imageModels;
      const recommendedModels: string[] = Array.isArray(configuredModels) && configuredModels.length > 0
        ? configuredModels
        : ['imagen-4.0-fast-generate-001', 'imagen-3.0-generate-001'];

      if (recommendedModels.length === 0) {
        // No image-generation models configured: fall back to a placeholder to avoid noisy API errors.
        const fallbackUrl = `https://picsum.photos/seed/${encodeURIComponent(prompt)}/1200/630`;
        if (type === 'featured') {
          setBlogDraft(prev => prev ? ({
            ...prev,
            featuredImage: {
              ...(prev.featuredImage || { alt: prev.title || 'Featured Image', title: prev.title || '', prompt: prompt, filename: '' }),
              url: fallbackUrl,
              prompt: prompt
            }
          }) : null);
        } else if (index !== undefined) {
          setBlogDraft(prev => {
            if (!prev) return null;
            const newContentImages = [...(prev.contentImages || [])];
            newContentImages[index] = {
              ...(newContentImages[index] || { alt: `Section ${index + 1}`, prompt: prompt, filename: '' }),
              url: fallbackUrl,
              prompt: prompt
            };
            const updatedContent = injectImages(prev.content, newContentImages, settings.imagePlacement);
            return { ...prev, contentImages: newContentImages, content: updatedContent };
          });
        }
        showNotification('Image generation skipped — no image model configured or available. Using a placeholder.', 'warning');
        return;
      }

      const errors: any[] = [];
      // Try configured/recommended models but use the image-specific API method (generateImages)
      for (const modelId of recommendedModels) {
        try {
          console.log('[AI LOG] Image Generation INPUT', { model: modelId, prompt, aspectRatio });
          const imgResp = await ai.models.generateImages({
            model: modelId,
            prompt,
            config: {
              numberOfImages: 1,
              aspectRatio: (aspectRatio === '16:9' ? '16:9' : aspectRatio === '9:16' ? '9:16' : aspectRatio === '4:3' ? '4:3' : aspectRatio === '3:4' ? '3:4' : '1:1') as any
            }
          });
          const b64 = imgResp.generatedImages?.[0]?.image?.imageBytes;
          console.log('[AI LOG] Image Generation OUTPUT', b64 ? `[base64 image, length=${b64.length}]` : 'no image data');
          if (b64) {
            imageUrl = `data:image/png;base64,${b64}`;
            break;
          }
        } catch (mErr: any) {
          errors.push({ model: modelId, err: mErr });
          // If the error is a clear model-not-found (404), keep trying other configured models but don't spam console.
        }
      }

      if (!imageUrl) {
        // Aggregate first error message for user feedback
        const first = errors[0];
        const errMsg = first ? (first.err?.message || JSON.stringify(first.err)) : 'No error details available';
        throw new Error(`No image data returned from any configured model. ${errMsg}`);
      }

      // Compress image to avoid Firestore 1MB limit
      const compressedUrl = await compressImage(imageUrl, 1024, 0.6);
      imageUrl = compressedUrl;

      if (type === 'featured') {
        setBlogDraft(prev => prev ? ({ 
          ...prev, 
          featuredImage: { 
            ...(prev.featuredImage || { alt: prev.title || 'Featured Image', title: prev.title || '', prompt: prompt, filename: '' }), 
            url: imageUrl,
            prompt: prompt 
          } 
        }) : null);
      } else if (index !== undefined) {
        setBlogDraft(prev => {
          if (!prev) return null;
          const newContentImages = [...(prev.contentImages || [])];
          newContentImages[index] = { 
            ...(newContentImages[index] || { alt: `Section ${index + 1}`, prompt: prompt, filename: '' }), 
            url: imageUrl,
            prompt: prompt
          };
          
          // Re-inject images into content to maintain visual consistency
          const updatedContent = injectImages(prev.content, newContentImages, settings.imagePlacement);
          
          return { 
            ...prev, 
            contentImages: newContentImages,
            content: updatedContent
          };
        });
      }
      showNotification("Visual asset engineered");
      if (type === 'featured') setIsImageGenerating(false);
      return;
    } catch (err: any) {
      if (type === 'featured') setIsImageGenerating(false);
      console.error("Visual generation error:", err);
      const { message, detail, solution } = formatAIError(err);
      
      const isQuota = err.message?.includes('429') || err.message?.includes('quota');
      const isPermission = err.message?.includes('403') || err.message?.includes('permission');
      
      let finalDetail = `${detail} ${solution}`;

      if (isQuota || isPermission || err.message?.includes('404')) {
        const fallbackUrl = `https://picsum.photos/seed/${encodeURIComponent(prompt)}/1200/630`;
        finalDetail += " Initiating emergency visual placeholder.";
        if (type === 'featured') {
          setBlogDraft(prev => prev ? ({
            ...prev,
            featuredImage: {
              ...prev.featuredImage,
              url: fallbackUrl,
              alt: prev.title || 'Featured Image',
              prompt: prompt
            }
          }) : null);
        }
        showNotification(message, 'warning', finalDetail);
      } else {
        showNotification(message, 'error', finalDetail);
      }
    }
  };

  // Normalize a heading text which may sometimes be raw HTML or a JSON payload string
  const sanitizeHeadingText = (raw?: string | null) => {
    if (!raw) return '';
    const trimmed = raw.trim();
    
    // If we have markdown JSON block, strip the markdown
    let jsonStr = trimmed;
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // If it looks like JSON, try to parse and extract a sensible field
    if (jsonStr.startsWith('{') || jsonStr.startsWith('[')) {
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === 'object') {
          // In case the object is the specific complex AI payload you described, extract its explicit heading
          if (parsed.heading) return String(parsed.heading).trim();
          
          // Otherwise try the other known properties
          return String(parsed.title || parsed.meta_title || parsed.meta_description || parsed.featured_image_prompt || Object.values(parsed)[0] || '').trim();
        }
      } catch (e) {
        // fall through to HTML stripping
      }
    }

    // If it's HTML, strip tags and return text
    const plain = htmlToPlainText(trimmed);
    if (plain && plain.length > 0) return plain;

    // Fallback: return the original trimmed string
    return trimmed;
  };

  // Prettify and truncate heading text for compact UI display
  const prettifyHeadingText = (raw?: string | null, maxLen = 80) => {
    const cleaned = sanitizeHeadingText(raw);
    if (!cleaned) return '';
    // Remove excessive prompt-like fragments and newlines
    let s = cleaned.replace(/\s+/g, ' ').trim();
    // Remove surrounding quotes or braces left-over
    s = s.replace(/^['"`\s]+|['"`\s]+$/g, '');
    if (s.length <= maxLen) return s;
    // Truncate at word boundary
    const truncated = s.slice(0, maxLen); const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > Math.floor(maxLen * 0.6) ? truncated.slice(0, lastSpace) : truncated).trim() + '…';
  };

  const [uploadConfig, setUploadConfig] = useState<{ type: 'featured' | 'content', index?: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerUpload = (type: 'featured' | 'content', index?: number) => {
    setUploadConfig({ type, index });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!uploadConfig) return;
    const { type, index } = uploadConfig;
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { 
      showNotification("Image too large (max 5MB)", 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawUrl = event.target?.result as string;
      showNotification("Optimizing asset...", 'success');
      const url = await compressImage(rawUrl);
      
      if (type === 'featured') {
        setBlogDraft(prev => prev ? ({
          ...prev,
          featuredImage: {
            ...(prev.featuredImage || { alt: prev.title || 'Uploaded Asset', prompt: '', title: prev.title || '', filename: '' }),
            url,
          }
        }) : null);
      } else if (index !== undefined) {
        setBlogDraft(prev => {
          if (!prev) return null;
          const newContentImages = [...(prev.contentImages || [])];
          newContentImages[index] = { 
            ...(newContentImages[index] || { alt: `Section ${index + 1}`, prompt: 'Manual Upload', filename: '' }), 
            url,
          };
          return { ...prev, contentImages: newContentImages };
        });
      }
      showNotification(`Optimized visual asset uploaded (${Math.round(url.length / 1024)}KB)`);
      setUploadConfig(null);
    };
    reader.readAsDataURL(file);
  };

  const handleIndexRequest = async () => {
    if (!blogDraft?.wpId) return;
    try {
      const res = await fetch('/api/gsc/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          siteUrl: settings.gscProperty,
          pageUrl: blogDraft.link || `${settings.wpUrl}/?p=${blogDraft.wpId}` // Fallback to p=ID if link missing
        })
      });
      const data = await res.json();
      showNotification(data.message);
    } catch (err) {
      showNotification("Indexing request failed", 'error');
    }
  };

  const performCompetitorAnalysis = async (data: CompetitorData) => {
    // Protocol Delay: Neural synchronization
    addResearchLog("Protocol Delay: Initiating 5-second neural synchronization...", 'info');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Sanitize content more robustly: remove control chars but keep valid Unicode
    const sanitize = (text: string) => (text || "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
    
    const sanitizedTitle = sanitize(data.title).substring(0, 500);
    const sanitizedContent = sanitize(data.fullContent).substring(0, 25000); // Increased content window
    const sanitizedUrl = sanitize(data.url).substring(0, 500);

    const prompt = `
      Deep Content Intelligence & Semantic Audit Protocol. 
      Analyze the source content provided below with 100% precision. 
      Your mission is to extract the "DNA" of this page to inform a superior SEO strategy.

      SOURCE URL: ${sanitizedUrl}
      PAGE TITLE: ${sanitizedTitle}
      EXTRACTED TEXT: ${sanitizedContent}

      EXECUTE THE FOLLOWING EXTRACTIONS:
      1. CORE ENTITIES: List specific brands, people, locations, and proprietary terms mentioned as authorities.
      2. SEMANTIC CLUSTERS: Identify the primary LSI (Latent Semantic Indexing) terms and related keywords that drive the topical authority of this page.
      3. CONTENT GAP OPPORTUNITIES: Based on the text, what specific sub-topics are mentioned but NOT deeply explained? (Identify weaknesses).
      4. STRATEGIC STRENGTHS: What does this competitor do exceptionally well? (e.g., specific data points, case studies, unique formatting).
      5. SEARCH INTENT DEPTH: Classify the intent (Informational, Transactional, Commercial Investigation, etc.) and explain WHY based on the call-to-actions and language used.
      6. READABILITY LEVEL: Analyze the syntax and vocabulary (e.g. Expert, Conversational, Technical).
      7. TOPICAL DEPTH: On a scale of 0-100, how comprehensively does this page cover its primary topic compared to absolute mastery?

      THE OUTPUT MUST BE A HIGH-VALIDITY JSON OBJECT:
      {
        "strengths": ["string"],
        "weaknesses": ["string"],
        "keyEntities": ["string"],
        "lsiTerms": ["string"],
        "intentType": "string",
        "intentReasoning": "string",
        "topicalDepthScore": 0-100,
        "readabilityLevel": "string"
      }
    `;

    try {
      const responseText = await callAIModel(
        settings.aiModel, 
        prompt, 
        "Return ONLY valid JSON.",
        undefined,
        {
          type: "object",
          properties: {
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyEntities: { type: Type.ARRAY, items: { type: Type.STRING } },
            lsiTerms: { type: Type.ARRAY, items: { type: Type.STRING } },
            intentType: { type: Type.STRING },
            intentReasoning: { type: Type.STRING },
            topicalDepthScore: { type: Type.NUMBER },
            readabilityLevel: { type: Type.STRING }
          },
          required: ["strengths", "weaknesses", "keyEntities", "lsiTerms", "intentType", "intentReasoning", "topicalDepthScore", "readabilityLevel"]
        }
      );
      
      const resultJson = JSON.parse(responseText || '{}');
      return { 
        ...resultJson, 
        lsiKeywords: resultJson.lsiTerms || [] 
      };
    } catch (err: any) {
      console.error("Analysis Protocol Failure:", err);
      const { detail, solution } = formatAIError(err);
      console.warn(`Fallback active. ${detail} ${solution}`);
      return {
        strengths: ["Content established in niche"],
        weaknesses: ["Potential for deeper technical analysis"],
        keyEntities: [data.title || "Unknown"],
        lsiTerms: [],
        intentType: "Informational",
        lsiKeywords: []
      };
    }
  };

  const analyzeCompetitorContent = async (data: CompetitorData) => {
    try {
      showNotification(`Analyzing intelligence from ${new URL(data.url).hostname}...`, 'success');
      const analysis = await performCompetitorAnalysis(data);
      
      const updatedCompetitors = currentResearch.map(c => 
        c.url === data.url ? { ...c, analysis } : c
      );
      setCurrentResearch(updatedCompetitors);
      saveCompetitorToFirestore({ ...data, analysis });
      showNotification("Intelligence analysis complete");
    } catch (err: any) {
      console.error("Intelligence Analysis Failure:", {
        url: data.url,
        error: err,
        timestamp: new Date().toISOString()
      });
      
      const { message, detail, solution } = formatAIError(err);
      showNotification(message, 'error', `${detail} ${solution}`);
    }
  };

  const engineerPromptForSection = async (sectionText: string, context: string = '') => {
    const apiKey = settings.geminiKey || (process.env.GEMINI_API_KEY as string);
    if (!apiKey) {
      showNotification("Critical System Fault: Gemini Core Key missing", 'error');
      return '';
    }
    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    try {
      showNotification("Engineering visual prompt for section...", 'success');
      const sectionPromptInput = `Create a professional, cinematic visual prompt for an AI image generator (like Midjourney or DALL-E) based on this content section.
      CONTEXT: ${context}
      SECTION CONTENT: ${sectionText.substring(0, 2000)}

      Return ONLY the optimized prompt text. Focus on descriptive elements, lighting, and style. No labels.`;
      console.log('[AI LOG] Section Prompt Engineer INPUT', { model: 'models/gemini-2.5-flash', prompt: sectionPromptInput });
      const response = await ai.models.generateContent({
        model: 'models/gemini-2.5-flash',
        contents: sectionPromptInput
      });
      console.log('[AI LOG] Section Prompt Engineer OUTPUT', response.text);
      return response.text || '';
    } catch (err: any) {
      console.error("Prompt Engineering Failure:", err);
      const { message, detail, solution } = formatAIError(err);
      showNotification(message, 'error', `Prompt engineering fault: ${detail} ${solution}`);
      return '';
    }
  };

  const generateImagePrompt = async () => {
    if (!blogDraft) return;
    const apiKey = settings.geminiKey || (process.env.GEMINI_API_KEY as string);
    if (!apiKey) {
      showNotification("Critical System Fault: Gemini Core Key missing", 'error');
      return;
    }
    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    try {
      showNotification("Engineering visual prompt from content...", 'success');
      const featuredPromptInput = `Analyze the mood, industry, and core message of this blog content. Then, create a professional, high-converting cinematic visual prompt for an AI image generator (like Midjourney or DALL-E) to create a featured image.
      TITLE: ${blogDraft.title}
      INTRODUCTION: ${blogDraft.introduction.substring(0, 1000)}

      Return ONLY the optimized prompt text. The prompt should be descriptive, focus on lighting, texture, and style appropriate for the industry, and avoid any generic text labels.`;
      console.log('[AI LOG] Featured Image Prompt Engineer INPUT', { model: 'models/gemini-2.0-flash-lite', prompt: featuredPromptInput });
      const response = await ai.models.generateContent({
        model: 'models/gemini-2.0-flash-lite',
        contents: featuredPromptInput
      });
      console.log('[AI LOG] Featured Image Prompt Engineer OUTPUT', response.text);
      const promptText = response.text || '';
      setBlogDraft({
        ...blogDraft,
        featuredImage: {
          ...(blogDraft.featuredImage || { url: '', alt: blogDraft.title }),
          prompt: promptText
        }
      });
      showNotification("Visual prompt synchronized");
    } catch (err: any) {
      console.error("Prompt Engineering Failure:", err);
      const { message, detail, solution } = formatAIError(err);
      showNotification(message, 'error', `Prompt engineering failed: ${detail} ${solution}`);
    }
  };

  const handleManualImageGeneration = async () => {
    if (!blogDraft?.featuredImage?.prompt) {
      showNotification("Please provide a prompt first", 'error');
      return;
    }
    await generateIndividualImage(blogDraft.featuredImage.prompt, 'featured', undefined, settings.aspectRatio);
  };

  const handleSerpAnalysis = async (targetUrls: string[]) => {
    setIsScraping(true);
    setShowResearchReport(false);
    setCurrentResearch([]); 
    const apiKey = settings.geminiKey || (process.env.GEMINI_API_KEY as string);
    if (!apiKey) {
      showNotification("Authentication Failure: Gemini Engine Offline", 'error');
      setIsScraping(false);
      return;
    }

    const validUrls = (targetUrls || [])
      .map(u => u.trim())
      .filter(u => u.startsWith('http'))
      .map(u => {
        try {
          const urlObj = new URL(u);
          urlObj.hash = ''; // Remove fragments
          return urlObj.toString().replace(/\/$/, ""); // Normalize: remove trailing slash
        } catch (e) {
          return u;
        }
      });
      
    if (validUrls.length === 0) {
      showNotification("Please provide at least one valid competitor URL.", 'error');
      setIsScraping(false);
      return;
    }

    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    try {
      addResearchLog(`Protocol Initiated: Intelligence Gathering for ${validUrls.length} sources`, 'info');
      
      setScrapingProgress({ processed: 0, total: validUrls.length, currentUrl: "Initializing..." }); 

        // Task 1: Scrape all manual competitor nodes
        if (validUrls.length > 0) {
          showNotification(`Synchronizing ${validUrls.length} primary targets...`);
          
          for (const url of validUrls) {
            addResearchLog(`Synthesizing connection to ${url} (Waiting for dynamic ingestion)...`, 'info');
            setScrapingProgress(p => ({ ...p, currentUrl: url }));
            
            // Wait for 3s before fetching (reduced protocol delay)
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            try {
              const res = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
              });
              
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.details || `HTTP ${res.status}`);
              }
              
              const data = await res.json();
              if (data.error) {
                addResearchLog(`Node ${url} skipped: ${data.error}`, 'warning');
              } else {
                // If server returned only headings, show them immediately and skip heavier processing
                if (Array.isArray(data.headings) && data.headings.length > 0 && !data.fullContent) {
                  const minimal = {
                    url: data.url || url,
                    title: data.title || (data.headings[0]?.text || url),
                    wordCount: data.wordCount || 0,
                    imageCount: data.imageCount || 0,
                    description: data.description || '',
                    fullContent: data.fullContent || '',
                    images: data.images || [],
                    headings: data.headings || [],
                    sections: data.sections || []
                  };
                  addResearchLog(`Node ingested: ${minimal.title} (headings: ${minimal.headings.length})`, 'success');
                  // Update UI immediately without analysis or Firestore saves
                  setCurrentResearch(prev => [...prev, minimal]);
                  addUniqueCompetitors([minimal]);
                  continue;
                }
                // Normalize response: server may return only { url, headings }
                const normalized: any = {
                  url: data.url || url,
                  title: data.title || (data.headings && data.headings.length ? data.headings[0].text : url),
                  wordCount: data.wordCount || 0,
                  imageCount: data.imageCount || 0,
                  description: data.description || '',
                  fullContent: data.fullContent || '',
                  images: data.images || [],
                  headings: data.headings || [],
                  sections: data.sections || [],
                  lsiKeywords: data.lsiKeywords || []
                };

                addResearchLog(`Node ingested: ${normalized.title} (${normalized.wordCount} words, ${normalized.imageCount} imgs)`, 'success');
                const analysisData = await performCompetitorAnalysis(normalized);
                const enriched = { ...normalized, analysis: analysisData };
                try { saveCompetitorToFirestore(enriched); } catch (e) { /* non-fatal */ }

                // Incremental update so user sees results immediately
                setCurrentResearch(prev => [...prev, enriched]);
                addUniqueCompetitors([enriched]);
              }
            } catch (e: any) {
              console.error("Transmission failure for URL:", url, e);
              addResearchLog(`Node failure: ${url}`, 'error');
            } finally {
              setScrapingProgress(p => ({ ...p, processed: p.processed + 1 }));
            }
          }
        } else {
          addResearchLog("No target URLs provided for protocol execution.", "warning");
        }

        addResearchLog("Research Protocol Finalized.", "success");
        showNotification("Intelligence collection complete. Report generated in Intelligence Hub.");
        setShowResearchReport(true);
        
      } catch (err: any) {
      console.error("Intelligence Research Error:", {
        error: err,
        timestamp: new Date().toISOString()
      });
      
      const { message, detail, solution } = formatAIError(err);
      addResearchLog(`Critical Intelligence Protocol Failure: ${message}`, 'error');
      showNotification(message, 'error', `Intelligence Core Protocol Fault: ${detail} ${solution}`);
    } finally {
      setIsScraping(false);
    }
  };

  const handleManualCompetitorAdd = async () => {
    if (!manualEntry.url || !manualEntry.title) {
      showNotification("URL and Title are required for manual entry", 'error');
      return;
    }

    try {
      showNotification("Synchronizing manual data with intelligence core...", 'success');
      
      const enriched: CompetitorData = {
        url: manualEntry.url.trim(),
        title: manualEntry.title.trim(),
        wordCount: Number(manualEntry.wordCount) || 0,
        imageCount: Number(manualEntry.imageCount) || 0,
        description: manualEntry.description || '',
        fullContent: manualEntry.fullContent || '',
        analysis: undefined
      };

      // Perform AI analysis on the manual content if provided
      if (enriched.fullContent && enriched.fullContent.length > 50) {
        addResearchLog(`Executing AI Analysis on manual entry: ${enriched.title}`, 'info');
        try {
          const analysisData = await performCompetitorAnalysis(enriched);
          enriched.analysis = analysisData;
          addResearchLog(`Node ingested & analyzed: ${enriched.title}`, 'success');
        } catch (e: any) {
          addResearchLog(`AI Analysis failed for manual node: ${e.message}`, 'warning');
        }
      } else {
        addResearchLog(`Node ingested (partial): ${enriched.title}`, 'success');
      }

      await saveCompetitorToFirestore(enriched);
      setCurrentResearch(prev => [...prev, enriched]);
      addUniqueCompetitors([enriched]);
      
      showNotification("Manual competitor added successfully", 'success');
      setManualEntry({
        url: '',
        title: '',
        wordCount: 0,
        imageCount: 0,
        description: '',
        fullContent: ''
      });
      setShowManualForm(false);
    } catch (e: any) {
      showNotification("Critical transmission failure", 'error', e.message);
    }
  };

  const callAIModel = async (modelId: string, prompt: string, systemPrompt?: string, signal?: AbortSignal, responseSchema?: any) => {
    // If this is a Gemini-style model, try a prioritized list of Gemini candidates
    if (modelId.toLowerCase().includes('gemini')) {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || settings.geminiKey || (process.env.GEMINI_API_KEY as string);
      if (!apiKey) throw new Error("Gemini Key Missing: Please provide an API key in Settings or VITE_GEMINI_API_KEY.");
      const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });

      try {
        const modelToUse = modelId.startsWith('models/') ? modelId : `models/${modelId}`;
        console.info(`Using Gemini model: ${modelToUse}`);
        console.log('[AI LOG] callAIModel Gemini INPUT', { model: modelToUse, systemPrompt, prompt });
        const response = await ai.models.generateContent({
          model: modelToUse,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            systemInstruction: systemPrompt || undefined,
            temperature: 0.7,
            responseMimeType: responseSchema ? "application/json" : undefined,
            responseSchema: responseSchema || undefined
          }
        });
        console.log('[AI LOG] callAIModel Gemini OUTPUT', response?.text);
        return response?.text || '';
      } catch (err: any) {
        const { message, detail, solution } = formatAIError(err);
        throw new Error(`${message}: ${detail} ${solution}`);
      }
    }

    // Non-Gemini models use the server proxy
    const proxyPrompt = systemPrompt ? `SYSTEM: ${systemPrompt}\n\nUSER: ${prompt}` : prompt;
    console.log('[AI LOG] callAIModel Proxy INPUT', { model: modelId, systemPrompt, prompt });
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        prompt: proxyPrompt,
        openaiKey: settings.openaiKey,
        anthropicKey: settings.anthropicKey
      }),
      signal
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    // Always stringify the full object — data.content would incorrectly extract only one field
    const proxyOutput = typeof data === 'string' ? data : JSON.stringify(data);
    console.log('[AI LOG] callAIModel Proxy OUTPUT', proxyOutput);
    return proxyOutput;
  };

  const handleGenerate = async (researchData?: CompetitorData[]) => {
    // Ensure we have an array, even if event object or undefined is passed
    const dataToUse = Array.isArray(researchData) ? researchData : currentResearch;
    
    if (dataToUse.length === 0) {
      showNotification("Research competitors first", 'error');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort('Aborted');
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsGenerating(true);
    setGenerationProgress({ step: 1, total: 6, label: 'Step 1: Competitor Neural Analysis' });
    
    try {
      showNotification("Executing SEO Analysis Protocol...", "success");
      
      const lsiTerms = settings.lsiKeywords ? Array.from(new Set(dataToUse.flatMap(c => c.lsiKeywords || []))).slice(0, 30).join(', ') : 'Relevant industry terms';
      // Resolve focus keyword: UI state → settings (if not placeholder) → scraped title → fallback
      const settingsKeyword = settings.sopKeywords[0] || '';
      const isPlaceholder = !settingsKeyword || settingsKeyword.toLowerCase() === 'focus keyword';
      // Use user-edited title if available, otherwise fall back to scraped
      const rawTitle = (editableTitle || dataToUse[0]?.title || '').replace(/[-|].*$/, '').trim();
      const titleDerived = rawTitle.split(/\s+/).slice(0, 5).join(' ');
      const focusKeyword = focusKeyword_state || (!isPlaceholder ? settingsKeyword : '') || dataToUse[0]?.query || titleDerived || 'Target Topic';
      console.log('[GENERATE] Focus keyword resolved:', focusKeyword, '| from state:', focusKeyword_state, '| from settings:', settingsKeyword, '| from title:', titleDerived);

      // Extract exact headings — use user-edited list if available, otherwise scrape from research
      const primaryCompetitor = dataToUse.find(c => c.headings && c.headings.length > 0) || dataToUse[0];
      const junkHeadingPattern = /^(share|like what|follow|subscribe|in this blog|newsletter|cookie|privacy|menu|nav|sidebar|related|tags|categories|comments|leave a reply|about the author|recent posts|popular posts|advertisement|sign up|log in|get in touch|contact|back to top|table of contents)/i;
      const scrapedHeadings = editableHeadings !== null
        ? editableHeadings.map(h => `${h.level.toUpperCase()}: ${h.text.trim()}`)
        : (primaryCompetitor?.headings || [])
            .filter(h =>
              h.level !== 'h1' &&
              h.text?.trim() &&
              h.text.trim().length >= 10 &&
              !junkHeadingPattern.test(h.text.trim())
            )
            .map(h => `${h.level.toUpperCase()}: ${h.text.trim()}`);
      const scrapedHeadingList = scrapedHeadings.length > 0
        ? scrapedHeadings.join('\n        ')
        : null;

      // Build structured section content rules from scraped sections
      const rawSections = (primaryCompetitor?.sections || []).filter(s =>
        s.level !== 'h1' &&
        s.heading?.trim().length >= 10 &&
        !junkHeadingPattern.test(s.heading.trim()) &&
        s.paragraphs.length > 0
      );
      const scrapedSectionRules = rawSections.length > 0
        ? rawSections.map(s =>
            `${s.level.toUpperCase()}: ${s.heading.trim()}\n` +
            s.paragraphs.slice(0, 3).map((p, i) => `  KEY POINT ${i + 1}: ${p.substring(0, 200)}`).join('\n')
          ).join('\n\n')
        : null;

      console.log('[GENERATE] Scraped headings count:', scrapedHeadings.length);
      console.log('[GENERATE] Scraped sections with content:', rawSections.length);

      const competitorDataChunks = dataToUse.map(c => `
--- START COMPETITOR URL: ${c.url} ---
TITLE: ${c.title}
WORD COUNT: ${c.wordCount}
${c.analysis ? `
AI INTELLIGENCE REPORT:
- Intent: ${c.analysis.intentType}
- Strengths: ${c.analysis.strengths.join(', ')}
- Gaps identified: ${c.analysis.weaknesses.join(', ')}
- Key Keywords: ${c.analysis.keyEntities.join(', ')}
- LSI Keywords (Semantic Terms): ${c.lsiKeywords?.join(', ') || 'None identified'}
` : ''}
FULL PAGE CONTENT:
${c.fullContent?.substring(0, 10000) || 'No content fetched'}
--- END COMPETITOR URL ---
      `).join('\n\n');

      const sharedContext = `
        You are an Expert SEO Content Architect.
        PRIMARY TOPIC: "${focusKeyword}".
        LSI VOCABULARY: ${lsiTerms}.
        TARGET: ${settings.targetWordCount} words of factual, high-authority content.
        
        Writing Strategy:
        - REFERENCE: Use the provided Competitor Data as the primary source of truth for factual information and topical depth.
        - STRUCTURE: Identify and REPLICATE the most successful heading structures (H2s and H3s) found across the top-ranking competitors.
        - AUTHORITY: Adopt a professional, authoritative tone that fills critical gaps identified in the competitor analysis.
        - STRICT EXECUTION: You must follow the writing directives in your system instructions EXACTLY for each section. Do NOT mention or repeat these directives in your output.
        
        COMPETITOR ANALYSIS (REFERENCE DATA):
        ${competitorDataChunks}
      `;

      const sopModels = {
        title: settings.sopModels?.title || settings.aiModel,
        introduction: settings.sopModels?.introduction || settings.aiModel,
        content: settings.sopModels?.content || settings.aiModel,
        faq: settings.sopModels?.faq || settings.aiModel,
        conclusion: settings.sopModels?.conclusion || settings.aiModel,
        lsi: settings.sopModels?.lsi || settings.aiModel
      };

      const result: Partial<BlogPost> & { 
        featured_image_prompt?: string, 
        meta_title?: string, 
        meta_description?: string, 
        comparison_metrics?: any[],
        contentImages: { prompt: string, alt: string, url: string, filename: string }[]
      } = {
        title: '',
        introduction: '',
        content: '',
        faq: [],
        conclusion: '',
        meta_title: '',
        meta_description: '',
        comparison_metrics: [],
        featured_image_prompt: '',
        contentImages: []
      };

      const callStep = async (stepName: string, prompt: string, model: string, systemPrompt?: string) => {
        if (signal.aborted) return null;
        try {
          const res = await callAIModel(model, prompt, systemPrompt, signal);
          let finalRes = res;
          
          try {
            // Try to extract JSON if the model returns it or just clean text
            let textToParse = res.trim();
            if (textToParse.startsWith('```json')) {
              textToParse = textToParse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (textToParse.startsWith('```')) {
              textToParse = textToParse.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            if (textToParse.startsWith('{') || textToParse.startsWith('[')) {
              let parsed;
              try {
                parsed = JSON.parse(textToParse);
              } catch (parseErr) {
                // Attempt regex fallback for common fields
                const extracted: any = {};
                const contentMatch = textToParse.match(new RegExp('"content"\\s*:\\s*"([\\s\\S]*?)"\\s*(,|\\})', ''));
                if (contentMatch) extracted.content = contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                
                const conclusionMatch = textToParse.match(new RegExp('"conclusion"\\s*:\\s*"([\\s\\S]*?)"\\s*(,|\\})', ''));
                if (conclusionMatch) extracted.conclusion = conclusionMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');

                const introMatch = textToParse.match(new RegExp('"introduction"\\s*:\\s*"([\\s\\S]*?)"\\s*(,|\\})', ''));
                if (introMatch) extracted.introduction = introMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');

                if (Object.keys(extracted).length > 0) {
                  console.log(`[AI Parser] Gracefully recovered JSON for ${stepName} using fallback extraction.`);
                  parsed = extracted;
                } else {
                  console.warn(`Failed to parse and recover JSON for ${stepName}. Returning raw text.`);
                  return textToParse; // Return stripped string at least
                }
              }

              // Scrub any literal "focus keyword" or "{focus_keyword}" from the parsed response
              const scrub = (obj: any): any => {
                if (typeof obj === 'string') {
                  return obj
                    .replace(/{focus_keyword}/gi, focusKeyword)
                    .replace(/{keyword}/gi, focusKeyword)
                    .replace(/focus keyword/gi, focusKeyword);
                } else if (Array.isArray(obj)) {
                  return obj.map(scrub);
                } else if (obj !== null && typeof obj === 'object') {
                  const newObj: any = {};
                  for (const key in obj) {
                    newObj[key] = scrub(obj[key]);
                  }
                  return newObj;
                }
                return obj;
              };
              return scrub(parsed);
            }
            return finalRes;
          } catch (e) {
            return finalRes;
          }
        } catch (e: any) {
          console.error(`Step ${stepName} failed:`, e);
          throw e;
        }
      };

      // Step 1.5: Neural Research Synthesis & Blueprint
      setGenerationProgress({ step: 1.5, total: 6.5, label: 'Step 1.5: Neural Research Synthesis' });
      
      // Pre-process SOPs to replace placeholders locally
      const processSOP = (sop: string) => {
        if (!sop) return '';
        let processed = sop
          .replace(/{focus_keyword}/gi, focusKeyword)
          .replace(/{keyword}/gi, focusKeyword)
          .replace(/{keywords}/gi, lsiTerms)
          .replace(/focus keyword/gi, focusKeyword)
          .replace(/"focus keyword"/gi, focusKeyword);
        
        // Final safety check to remove any remaining curly brace placeholders
        return processed.replace(/{[^}]+}/g, '');
      };

      const strategyPrompt = `
        ${sharedContext}
        TASK: Create a "Master Content Blueprint" to rewrite the source article under its exact headings.
        FOCUS KEYWORD: ${focusKeyword}
        LSI KEYWORDS: ${lsiTerms}
        ${scrapedHeadingList ? `\n        EXACT HEADINGS FROM SOURCE ARTICLE (these are locked — the content will be rewritten under each of these headings exactly):\n        ${scrapedHeadingList}` : ''}

        OBJECTIVE: Define the strategic angle and LSI plan for rewriting deeply authoritative content under the source article's exact headings above.

        Identify:
        1. A strategic angle that fills gaps in the source article while keeping the same heading structure.
        2. A plan to cross-reference source facts while expanding depth under each heading.
        3. Which LSI keywords to weave into each section.

        RETURN JSON: { "strategic_angle": "...", "outline": ${scrapedHeadingList ? JSON.stringify(scrapedHeadings) : '["H2: ...", "H3: ..."]'}, "lsi_plan": "..." }
      `;
      
      const strategyData = await callStep('Strategy', strategyPrompt, settings.aiModel, "Return ONLY valid JSON. Master Blueprinting Phase.");
      const strategyBlueprint = strategyData ? JSON.stringify(strategyData) : "Standard SEO Protocol";
      const enhancedContext = `${sharedContext}\n\nSTRATEGIC BLUEPRINT:\n${strategyBlueprint}\n\nLSI TERMS:\n${lsiTerms}`;

      // Step 2: Title & Meta Generation
      setGenerationProgress({ step: 2, total: 6.5, label: 'Step 2: Engineering Title & Meta Identity' });
      const titleSystemPrompt = settings.prompts.title
        ? `You are a master SEO copywriter. You MUST follow the writing directive below EXACTLY — it overrides any default behavior.

MANDATORY WRITING DIRECTIVE:
${processSOP(settings.prompts.title)}

OUTPUT: Return ONLY valid JSON. Zero conversational filler.`
        : `You are a master of conversion. Return ONLY valid JSON. Zero conversational filler.`;

      // If the user pre-set a title in the Structure Editor, lock it in immediately
      if (editableTitle) {
        result.title = editableTitle;
      }

      const titleData = await callStep('Title', `
        ${enhancedContext}
        ${editableTitle ? `\nLOCKED ARTICLE TITLE (do NOT change or rephrase this): "${editableTitle}"\n` : ''}

        GOAL: ${editableTitle
          ? `Generate a Meta Title and Meta Description for the LOCKED title above. Do NOT invent a new title — use the locked title exactly as "title" in your response.`
          : 'Generate a high-CTR SEO Title, Meta Title, and Meta Description following your system instruction writing directive exactly.'
        }

        HARD CHARACTER LIMITS (count every space and punctuation mark):
        - "title" (H1): ${editableTitle ? `MUST be exactly: "${editableTitle}"` : 'under 60 characters. Example length: "Unlock Retention: Predict Customer Churn with AI" = 49 chars ✓'}
        - "meta_title": under 60 characters. Example: "Predict Customer Churn with AI & Boost Profits" = 46 chars ✓
        - "meta_description": 150–160 characters EXACTLY. Example of 155 chars: "Master AI-powered churn prediction. Our guide covers data, models, and strategies to retain customers and boost profits. Start now." — count yours before outputting.
        - "meta_description" MUST end with an imperative CTA (e.g., "Start today.", "Get started now.", "Learn more.").

        REQUIRED JSON SCHEMA:
        {
          "title": "H1 tag content here",
          "meta_title": "SEO title tag content",
          "meta_description": "Meta summary here",
          "featured_image_prompt": "Detailed AI art mirror prompt"
        }
      `, sopModels.title, titleSystemPrompt);

      if (titleData) {
        // Always prefer the user-edited title over whatever the AI returned
        result.title = editableTitle || titleData.title || titleData;
        result.meta_title = (titleData.meta_title || '').substring(0, 60).replace(/\s\S*$/, '');
        const rawMeta = titleData.meta_description || '';
        if (rawMeta.length <= 160) {
          result.meta_description = rawMeta;
        } else {
          // Cut at last word boundary before 160 chars and close with a period
          const cut = rawMeta.substring(0, 160).replace(/\s\S*$/, '').trimEnd();
          result.meta_description = /[.!?]$/.test(cut) ? cut : cut + '.';
        }
        result.featured_image_prompt = titleData.featured_image_prompt || '';
      }

      // Step 3: Introduction Engineering
      setGenerationProgress({ step: 3, total: 6.5, label: 'Step 3: Drafting Conversion Introduction' });
      const introSystemPrompt = settings.prompts.introduction
        ? `You are an elite SEO copywriter. You MUST follow the writing directive below EXACTLY — it overrides any default behavior.

MANDATORY WRITING DIRECTIVE:
${processSOP(settings.prompts.introduction)}

OUTPUT: Return ONLY JSON. No preamble.`
        : `Act as an elite copywriter. Return ONLY JSON. No preamble.`;

      const introData = await callStep('Introduction', `
        ${enhancedContext}
        ARTICLE TITLE: ${result.title}

        GOAL: Generate a persuasive 2-3 paragraph introduction following your system instruction writing directive exactly.

        MANDATORY INJECTION RULE: The exact phrase "${focusKeyword}" MUST appear in sentence 1 or sentence 2 — not later. This is non-negotiable and overrides all other style guidance.

        FORMATTING — CRITICAL:
        - Every paragraph MUST be wrapped in <p>...</p> tags. No bare text outside tags.
        - Use <strong>...</strong> for emphasis — never markdown **bold**.
        - Do NOT include any headings in the introduction.
        - Return ONLY the HTML paragraphs. No preamble.
        RETURN JSON: { "introduction": "<p>...</p><p>...</p>" }
      `, sopModels.introduction, introSystemPrompt);
      
      if (introData) {
        result.introduction = introData.introduction || (typeof introData === 'string' ? introData : '');
      }

      // Step 4: Core Content & LSI Optimization
      setGenerationProgress({ step: 4, total: 6.5, label: 'Step 4: Executing Multi-Section Content Architecture' });
      const contentSystemPrompt = `You are an Expert SEO Content Generator. You MUST follow both directives below EXACTLY — they override any default behavior.

MANDATORY CONTENT WRITING DIRECTIVE (governs HOW you write every paragraph):
${processSOP(settings.prompts.content) || 'Write comprehensive, authoritative, factual paragraphs that fill content gaps found in competitor pages.'}

MANDATORY SEMANTIC / LSI DIRECTIVE (governs keyword integration):
${settings.lsiKeywords ? (processSOP(settings.prompts.lsi) || `Naturally integrate these semantic terms throughout: ${lsiTerms}.`) : `Naturally integrate these semantic terms throughout: ${lsiTerms}.`}

OUTPUT RULES: Generate article body HTML only — NO <!DOCTYPE>, <html>, <head>, or <body> tags. Use only H2, H3, P, UL, OL, LI tags. Apply the directives above to every paragraph under every heading. Silent execution. JSON output only.`;

      const contentPrompt = `
        ${enhancedContext}
        ARTICLE TITLE: ${result.title}
        INTRO PREVIEW (context only — do NOT copy or include this text): ${result.introduction.substring(0, 300)}...

        GOAL: Generate the full body content in HTML format. Start DIRECTLY with the first H2 heading — do NOT include an introduction paragraph before it.

        YOUR ROLE: Your system instructions define HOW to write (style, structure, keyword usage). The heading list below defines WHAT structure to follow. These two are complementary — apply your writing directive to every paragraph under every heading listed.

        MANDATORY HEADING STRUCTURE — these are the EXACT headings scraped from the source article. You MUST use every heading below word-for-word, in this exact order, at the exact level shown. No rewording, no reordering, no additions, no omissions:
        ${scrapedHeadingList || strategyData?.outline?.join('\n        ') || 'Follow competitor heading patterns'}

        ${scrapedSectionRules ? `MANDATORY CONTENT COVERAGE — for each section below, you MUST cover the key points listed. These are the exact talking points from the source article and are non-negotiable. Write them originally in your own words but ensure every point is addressed:
        ${scrapedSectionRules}` : ''}

        MANDATORY CONSTRAINTS:
        - Apply the system instruction writing directives to every section — this is non-negotiable.
        - Begin output with the first H2 tag. No preamble, no repeated introduction.
        ${settings.punMode
          ? `- PUN MODE ACTIVE: Output ONLY the heading tags in order. Do NOT write any paragraphs, lists, or body text under any heading. Do NOT include any <p>, <ul>, <ol>, or <li> tags. Do NOT include any <a> links. Headings only — puns will be injected programmatically.`
          : `- Every section MUST have at least 2-3 substantial <p> paragraphs of original content — never leave a heading with only a list and no paragraphs.
        - Every list item (<li>) that mentions a concept MUST be preceded or followed by a <p> explaining that concept in depth.`
        }
        - Do NOT add any headings beyond those in the MANDATORY HEADING STRUCTURE list. Every heading tag in your output must match exactly one entry from that list. No H4, H5, H6, or any invented sub-headings.
        - NEVER mention the words "Directive", "Rule", "SOP", or "Competitor" in the article text.
        - NEVER use placeholders like "{focus_keyword}". Use "${focusKeyword}" instead.
        ${!settings.punMode ? `- TARGET: Aim for ${settings.targetWordCount} words of depth.
        - OPTIMIZATION: Natural ${focusKeyword} density 1-2%.` : ''}

        FORMATTING — CRITICAL:
        ${settings.punMode
          ? `- Return ONLY the H2/H3 heading tags, nothing else. No <p>, <ul>, <ol>, <li>, or <a> tags whatsoever.`
          : `- Return article body HTML only (H2, H3, P, UL, OL, LI tags ONLY).
        - Every paragraph of prose MUST be wrapped in <p>...</p> tags — NO bare text outside of tags.
        - Lists must use <ul><li>item</li></ul> or <ol><li>item</li></ol> — never bare hyphens or asterisks.`
        }
        - Do NOT wrap output in <!DOCTYPE>, <html>, <head>, or <body> tags.
        - Return within: { "content": "..." }
      `;
      const contentData = await callStep('Content', contentPrompt, sopModels.content, contentSystemPrompt);
      
      if (contentData) {
        let rawContent = contentData.content || (typeof contentData === 'string' ? contentData : '');
        // Strip model-invented placeholder spans
        rawContent = rawContent.replace(/<span[^>]*class=["'][^"']*(?:focus-keyword|lsi)[^"']*["'][^>]*>(.*?)<\/span>/gi, '$1');
        // Strip any accidental <!DOCTYPE>, <html>, <head>, <body> wrappers the model may have added
        rawContent = rawContent.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<\/?html[^>]*>/gi, '').replace(/<\/?head[^>]*>[\s\S]*?<\/head>/gi, '').replace(/<\/?body[^>]*>/gi, '');
        // Ensure bare text runs outside tags get wrapped in <p>
        rawContent = rawContent.replace(/^([^<\n][^\n]{30,})\n/gm, '<p>$1</p>\n');
        result.content = rawContent.trim();
        result.contentImages = [];
      }

      // Step 4.5: Pun Mode — extract total from title, distribute exactly across headings
      if (settings.punMode && result.content) {
        setGenerationProgress({ step: 4.5, total: 6.5, label: 'Step 4.5: Pun Mode — Generating Puns Per Section' });

        // Extract all H2/H3 headings from content
        const headingMatches = [...result.content.matchAll(/<(h[23])[^>]*>(.*?)<\/h[23]>/gi)];

        if (headingMatches.length > 0) {
          const headingTexts = headingMatches.map(m => ({ tag: m[1], text: m[2].replace(/<[^>]+>/g, '').trim() }));

          // Extract the total pun count from the article title (e.g. "50 Food Puns" → 50)
          const titleNumberMatch = (result.title || focusKeyword || '').match(/\b(\d+)\b/);
          const totalPuns = titleNumberMatch ? parseInt(titleNumberMatch[1], 10) : headingTexts.length * 10;
          const sectionCount = headingTexts.length;

          // Distribute totalPuns exactly: base per section + sprinkle remainder onto first sections
          const basePerSection = Math.floor(totalPuns / sectionCount);
          const remainder = totalPuns % sectionCount;
          const punsPerSection = headingTexts.map((_, i) => basePerSection + (i < remainder ? 1 : 0));

          console.log(`[PUN MODE] Title: "${result.title}" → total puns: ${totalPuns}, sections: ${sectionCount}, dist:`, punsPerSection);

          const punPrompt = `You are a professional comedy writer specialising in wordplay and puns.

TOPIC: "${focusKeyword}"
ARTICLE TITLE: "${result.title}"

ABSOLUTE REQUIREMENT — TOTAL PUN COUNT: You MUST produce EXACTLY ${totalPuns} puns in total across all sections. Not one more, not one fewer. Each section has a mandatory exact count listed below.

STRICT RULES:
- Each pun must be 50-60 characters maximum (count carefully).
- No pun may exceed 60 characters.
- Each pun must be a complete, standalone phrase — clever wordplay, double meanings, or sound-alike substitutions.
- Do NOT repeat puns across sections.
- Do NOT use markdown. Return ONLY valid JSON.
- Do NOT include any URLs, hyperlinks, <a> tags, or HTML markup inside any pun string — plain text only.
- The "puns" array for each section MUST contain EXACTLY the count specified — no more, no less.

SECTIONS WITH MANDATORY PUN COUNTS:
${headingTexts.map((h, i) => `${i + 1}. [${h.tag.toUpperCase()}] ${h.text} → EXACTLY ${punsPerSection[i]} puns`).join('\n')}

VERIFICATION: Before returning, count every pun array. Total must equal ${totalPuns}.

Return JSON in this exact structure:
{
  "total": ${totalPuns},
  "sections": [
    { "heading": "exact heading text here", "count": <number>, "puns": ["pun 1", "pun 2", ...] },
    ...
  ]
}`;

          const punData = await callAIModel('models/gemini-2.5-flash', punPrompt, `Return ONLY valid JSON. No preamble. Total puns across all sections MUST equal exactly ${totalPuns}.`);

          try {
            const jsonMatch = punData.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed.sections)) {
                let updatedContent = result.content;
                let totalInjected = 0;
                for (let si = 0; si < parsed.sections.length; si++) {
                  const section = parsed.sections[si];
                  if (!section.heading || !Array.isArray(section.puns) || section.puns.length === 0) continue;
                  // Enforce exact count per section: trim or pad with repeats if AI drifted
                  const target = punsPerSection[si] ?? basePerSection;
                  let puns: string[] = section.puns
                    .map((p: string) => String(p).trim())
                    .filter((p: string) => p.length > 0)
                    .map((p: string) => p.length > 60 ? p.substring(0, 57) + '...' : p);
                  // Trim to target
                  puns = puns.slice(0, target);
                  // Pad if AI returned fewer (repeat last pun with suffix to reach exact count)
                  while (puns.length < target) {
                    puns.push(`${puns[puns.length - 1] ?? 'Pun'} (${puns.length + 1})`);
                  }
                  totalInjected += puns.length;
                  const punsHtml = `<ul class="pun-list">\n${puns.map(p => `<li>${p}</li>`).join('\n')}\n</ul>`;
                  const escapedHeading = section.heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  const headingRegex = new RegExp(`(<h[23][^>]*>[^<]*${escapedHeading}[^<]*<\/h[23]>)`, 'i');
                  updatedContent = updatedContent.replace(headingRegex, `$1\n${punsHtml}`);
                }
                result.content = updatedContent;
                console.log(`[PUN MODE] Injected ${totalInjected} puns (target: ${totalPuns}) across ${parsed.sections.length} sections`);
              }
            }
          } catch (e) {
            console.warn('[PUN MODE] Failed to parse pun response, skipping', e);
          }

          // STRICT PUN-MODE CLEANUP — remove everything that isn't a heading or pun list
          result.content = result.content
            // Remove ALL <p>...</p> blocks — no paragraphs allowed
            .replace(/<p[^>]*>[\s\S]*?<\/p>/gi, '')
            // Remove all <ul> blocks that are NOT the pun list (pun lists have class="pun-list")
            .replace(/<ul(?![^>]*pun-list)[^>]*>[\s\S]*?<\/ul>/gi, '')
            // Remove all <ol> blocks
            .replace(/<ol[^>]*>[\s\S]*?<\/ol>/gi, '')
            // Strip <a href="..."> links — unwrap inner text only
            .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')
            // Remove any bare text nodes outside tags (short stray lines)
            .replace(/^(?!<)[^\n<]{1,}\n/gm, '')
            // Collapse excessive blank lines
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          console.log('[PUN MODE] Cleanup done — paragraphs and links stripped');
        }
      }

      // Step 5: FAQ & Conclusion
      if (settings.includeFaqs || settings.includeConclusion) {
        setGenerationProgress({ step: 5, total: 6.5, label: `Step 5: ${[settings.includeFaqs && 'FAQ', settings.includeConclusion && 'Conclusion'].filter(Boolean).join(' & ')} Generation` });
        
        const tasks = [];
        if (settings.includeConclusion) tasks.push("a comprehensive conclusion");
        if (settings.includeFaqs) tasks.push("exactly 5 FAQs");
        
        const closingSystemPrompt = [
          `You are an expert SEO content strategist. You MUST follow the writing directives below EXACTLY — they override any default behavior.\n`,
          settings.includeConclusion && settings.prompts.conclusion
            ? `MANDATORY CONCLUSION DIRECTIVE:\n${processSOP(settings.prompts.conclusion)}\n`
            : '',
          settings.includeFaqs && settings.prompts.faq
            ? `MANDATORY FAQ DIRECTIVE:\n${processSOP(settings.prompts.faq)}\n`
            : '',
          `OUTPUT: Closing logic execution. Silent mode. JSON only.`
        ].filter(Boolean).join('\n');

        const closingPrompt = `
          ${enhancedContext}
          ARTICLE TITLE: ${result.title}

          GOAL: Generate ${tasks.join(' and ')} following your system instruction directives exactly.

          CONSTRAINTS:
          ${settings.includeConclusion ? `- Start conclusion with <h2>Conclusion</h2> exactly.` : ''}
          - Wrap every paragraph of text in <p>...</p> tags — no bare text outside of tags.
          - Use <strong>...</strong> for bold text — NEVER use markdown **bold** syntax inside HTML.
          - Apply your system instruction directives to every section you generate.
          - No mention of "Directive" or "SOP" in final text.

          RETURN JSON:
          {
            "conclusion": "HTML...",
            "faq": [ { "question": "...", "answer": "..." } ],
            "comparison_metrics": [ { "label": "Semantic Score", "competitor_score": 70, "your_score": 98, "reasoning": "Deeper LSI integration." } ]
          }
        `;
        const closingData = await callStep('Closing', closingPrompt, sopModels.conclusion, closingSystemPrompt);
        
        if (closingData) {
          if (settings.includeConclusion) result.conclusion = closingData.conclusion || '';
          if (settings.includeFaqs) result.faq = Array.isArray(closingData.faq) ? closingData.faq : [];
          result.comparison_metrics = Array.isArray(closingData.comparison_metrics) ? closingData.comparison_metrics : [];
        }
      }

      // Final Assembly
      const metrics: MetricValue[] = Array.isArray(result.comparison_metrics) 
        ? result.comparison_metrics.map((m: any) => ({
            label: m.label || '',
            competitorScore: m.competitor_score || 0,
            yourScore: m.user_score || m.your_score || 0,
            reasoning: m.reasoning || ''
          }))
        : [];

      const lsiPool = settings.lsiKeywords ? Array.from(new Set(dataToUse.flatMap(c => (c as any).lsiKeywords || []))).slice(0, 30) as string[] : [];

      const finalContent = injectImages(result.content, result.contentImages, settings.imagePlacement);

      const assembledBlogPost = {
        title: result.title || 'Untitled Draft',
        // preserve raw HTML and create plain-text editor-friendly fields
        rawIntroduction: result.introduction || '',
        introduction: htmlToPlainText(result.introduction || ''),
        rawContent: finalContent || '',
        content: htmlToPlainText(finalContent || ''),
        faq: (result.faq || []).map((f: any) => ({ question: f.question || '', answer: f.answer || '' })),
        rawConclusion: result.conclusion || '',
        conclusion: htmlToPlainText(result.conclusion || ''),
        meta_title: result.meta_title || '',
        meta_description: result.meta_description || '',
        targetLsiKeywords: lsiPool || [],
        comparisonMetrics: metrics || [],
        featuredImage: result.featured_image_prompt ? {
          url: '',
          alt: result.title || 'Featured Image',
          prompt: result.featured_image_prompt,
          filename: '',
          title: ''
        } : null,
        status: 'draft' as const,
        createdAt: serverTimestamp(),
        contentImages: result.contentImages || []
      };
      
      console.log("\n\n=== FINAL ASSEMBLED BLOG POST ===\n", assembledBlogPost, "\n=================================\n\n");
      
      const draftId = await savePostToFirestore(assembledBlogPost);
      const draftWithId = { ...assembledBlogPost, id: draftId };
      setBlogDraft(draftWithId);
      
      if (draftWithId.contentImages && draftWithId.contentImages.length > 0) {
        draftWithId.contentImages.forEach((img, idx) => {
          if (img.prompt) {
            generateIndividualImage(img.prompt, 'content', idx, settings.aspectRatio);
          }
        });
      }
      
      setActiveTab('optimizer');
      showNotification("Modular Content Engineered Successfully", "success");
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'Aborted') {
        showNotification("Generation cancelled", 'error');
      } else {
        console.error("AI Generation Engine Failure:", err);
        const { message, detail, solution } = formatAIError(err);
        showNotification(message, 'error', `Generation engine failure: ${detail} ${solution}`);
      }
    } finally {
      setGenerationProgress({ step: 0, total: 6.5, label: '' });
      if (!signal.aborted) {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    }
  };


  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('Aborted');
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const testWordPressConnection = async () => {
    if (!settings.wpUrl || !settings.wpUsername || !settings.wpAppPassword) {
      showNotification("WordPress credentials required for testing", 'error');
      return;
    }
    showNotification("Testing Neural Node Connection...", 'success');
    try {
      const authHeader = btoa(`${settings.wpUsername}:${settings.wpAppPassword}`);
      const res = await fetch(`${settings.wpUrl}/wp-json/wp/v2/posts?per_page=1`, {
        headers: { 'Authorization': `Basic ${authHeader}` }
      });
      if (res.ok) {
        showNotification("Connection established: WordPress node online", 'success');
      } else {
        const data = await res.json().catch(() => ({}));
        showNotification("Node Rejected Connection", 'error', data.message || `Status: ${res.status}`);
      }
    } catch (err: any) {
      showNotification("Network Protocol Error", 'error', err.message);
    }
  };

  const handlePublish = async () => {
    if (!blogDraft) return;
    showNotification("Initiating WordPress Node Sync...");
    setIsPublishing(true);
    setPublishProgress(10);

    console.log("\n========== [CLIENT] WP PUBLISH START ==========");
    console.log("[CLIENT] WP URL:", settings.wpUrl);
    console.log("[CLIENT] WP Username:", settings.wpUsername);
    console.log("[CLIENT] App Password set:", !!settings.wpAppPassword);
    console.log("[CLIENT] Post title:", blogDraft.title);
    console.log("[CLIENT] Publish status:", blogDraft.scheduledAt ? 'future' : publishStatus);
    console.log("[CLIENT] Scheduled at:", blogDraft.scheduledAt || "none");
    console.log("[CLIENT] Category:", selectedCategory || "none");
    console.log("[CLIENT] Tags:", selectedTags);
    console.log("[CLIENT] Featured image URL present:", !!(blogDraft.featuredImage?.url));
    console.log("[CLIENT] Introduction length:", blogDraft.introduction?.length ?? 0);
    console.log("[CLIENT] Content length:", blogDraft.content?.length ?? 0);
    console.log("[CLIENT] FAQ items:", blogDraft.faq?.length ?? 0);
    console.log("[CLIENT] Conclusion length:", blogDraft.conclusion?.length ?? 0);

    try {
      setPublishProgress(25);
      console.log("[CLIENT] Sending POST to /api/wordpress/publish...");

      // Use raw HTML fields — the non-raw fields are stripped plain text for internal use only
      const faqHtml = blogDraft.faq && blogDraft.faq.length > 0
        ? `<h2>Frequently Asked Questions</h2>${blogDraft.faq.map((f: any) => `<h3>${f.question}</h3>${f.answer}`).join('')}`
        : '';

      const postContent = `${blogDraft.rawIntroduction || blogDraft.introduction || ''}
${blogDraft.rawContent || blogDraft.content || ''}
${faqHtml}
${blogDraft.rawConclusion || blogDraft.conclusion || ''}`;

      console.log("[CLIENT] ───── INTRODUCTION HTML ─────");
      console.log(blogDraft.rawIntroduction || blogDraft.introduction || '(empty)');
      console.log("[CLIENT] ───── CONTENT HTML ─────");
      console.log(blogDraft.rawContent || blogDraft.content || '(empty)');
      console.log("[CLIENT] ───── FAQ HTML ─────");
      console.log(faqHtml || '(empty)');
      console.log("[CLIENT] ───── CONCLUSION HTML ─────");
      console.log(blogDraft.rawConclusion || blogDraft.conclusion || '(empty)');
      console.log("[CLIENT] ───── FULL PAYLOAD HTML ─────");
      console.log(postContent);
      console.log("[CLIENT] Total content payload length:", postContent.length, "chars");

      const res = await fetch('/api/wordpress/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpUrl: settings.wpUrl,
          wpUsername: settings.wpUsername,
          wpAppPassword: settings.wpAppPassword,
          featuredImageUrl: blogDraft.featuredImage?.url || null,
          postData: {
            title: blogDraft.title,
            categories: selectedCategory ? [selectedCategory] : [],
            tags: selectedTags,
            content: postContent,
            status: blogDraft.scheduledAt ? 'future' : publishStatus,
            date: blogDraft.scheduledAt ? new Date(blogDraft.scheduledAt).toISOString() : undefined
          }
        })
      });

      setPublishProgress(60);
      console.log("[CLIENT] Server responded — HTTP status:", res.status);

      const data = await res.json();
      setPublishProgress(80);
      console.log("[CLIENT] Response body:", data);

      if (data.error) {
        console.error("[CLIENT] Server returned error:", data.error, "|", data.details);
        showNotification(`${data.error}: ${data.details || ''}`, 'error');
        setIsPublishing(false);
        setPublishProgress(0);
        console.log("========== [CLIENT] WP PUBLISH FAILED ==========\n");
        return;
      }

      setPublishProgress(95);
      console.log("[CLIENT] WP post created — ID:", data.id, "| Link:", data.link, "| Status:", data.status);

      const updatedDraft: BlogPost = {
        ...blogDraft,
        status: blogDraft.scheduledAt ? 'scheduled' : 'published',
        wpId: data.id,
        link: data.link,
        recurrence: blogDraft.recurrence || 'none'
      };
      setBlogDraft(updatedDraft);
      savePostToFirestore(updatedDraft);
      setPublishProgress(100);
      showNotification("Post Live on WordPress Terminal");
      console.log("[CLIENT] Draft updated in Firestore — wpId:", data.id);
      console.log("========== [CLIENT] WP PUBLISH DONE ==========\n");

      setTimeout(() => {
        setIsPublishing(false);
        setPublishProgress(0);
      }, 800);
    } catch (err: any) {
      console.error("[CLIENT] Unexpected publish error:", {
        endpoint: settings.wpUrl,
        username: settings.wpUsername,
        error: err,
        response: err.response?.data
      });
      console.log("========== [CLIENT] WP PUBLISH FAILED (EXCEPTION) ==========\n");

      let message = "Sync Protocol Failure";
      let detail = err.response?.data?.message || err.message || "The connection to your WordPress node was interrupted.";
      
      if (detail.toLowerCase().includes("unauthorized") || detail.toLowerCase().includes("forbidden") || detail.toLowerCase().includes("invalid username") || (err.status === 401)) {
        message = "Authentication Rejected";
        detail = "WP Application Password or Username is incorrect. Sync procedures require valid credentials.";
      } else if (detail.toLowerCase().includes("endpoint") || detail.toLowerCase().includes("not found") || (err.status === 404)) {
        message = "Node Interface Not Found";
        detail = "The WordPress REST API endpoint could not be reached. Verify the Protocol (HTTP/HTTPS) and Base URL.";
      } else if (err.status === 500) {
        message = "Target Server Failure";
        detail = "The WordPress server encountered a critical error processing the content payload.";
      }

      showNotification(message, 'error', detail);
      setIsPublishing(false);
      setPublishProgress(0);
    }
  };

  // --- Quill configurations removed for React 19 compatibility ---

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Zap className="w-8 h-8 text-indigo-500 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-slate-950 border-4 border-slate-800 rounded-lg p-12 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-8 border-2 border-indigo-700">
            <Zap className="text-white w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter mb-4 text-white uppercase">WriteSpace</h1>
          <p className="text-slate-500 text-[10px] mb-10 leading-relaxed uppercase tracking-[0.3em] font-black opacity-80">
            Intelligent Orchestration
          </p>
          <button 
            onClick={signInWithGoogle}
            className="w-full py-4 bg-indigo-600 text-white rounded-lg font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all border-2 border-indigo-700 active:scale-95"
          >
            <LogIn className="w-5 h-5" />
            Establish Identity
          </button>
          <p className="mt-8 text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black border-t-2 border-slate-900 pt-8">
            Enterprise Sync Terminal
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-300",
      settings.theme === 'dark' ? "bg-slate-950 text-slate-200" : "bg-slate-50 text-slate-800"
    )}>
      {/* Universal Progress Bar */}
      <AnimatePresence>
        {isPublishing && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-0 right-0 z-[100] h-1.5 bg-indigo-600/10 backdrop-blur-sm"
          >
            <motion.div 
              className="h-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.5)]"
              initial={{ width: 0 }}
              animate={{ width: `${publishProgress}%` }}
              transition={{ ease: "easeInOut" }}
            />
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-indigo-600 rounded-full border-2 border-indigo-700 shadow-2xl">
              <Zap className="w-3 h-3 text-white animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap">
                {publishProgress < 100 ? `Synchronizing Node: ${publishProgress}%` : 'Transmission Complete'}
              </span>
            </div>
          </motion.div>
        )}
        {isFirestoreOffline && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-0 right-0 z-[99] bg-amber-600 px-6 py-2 flex items-center justify-between border-b border-amber-700 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-white" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">
                Neural Cloud Disconnected — Operating in Local Buffer Mode
              </span>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-[9px] font-black uppercase tracking-widest text-white transition-all"
            >
              Attempt Reconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Header */}
      <header className={cn(
        "lg:hidden h-16 px-4 border-b-2 flex items-center justify-between sticky top-0 z-40 transition-all",
        settings.theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Zap className="text-white w-5 h-5" />
          </div>
          <span className={cn("text-lg font-black tracking-tight", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>WriteSpace AI</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={cn("p-2 rounded-lg border-2", settings.theme === 'dark' ? "border-slate-800" : "border-slate-200")}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <nav className={cn(
        "fixed left-0 top-0 h-full w-64 border-r-2 flex flex-col items-start py-8 z-50 overflow-y-auto transition-all transform lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        settings.theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
      )}>
        <div className="mb-12 px-6 flex items-center gap-3 w-full justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="text-white w-6 h-6" />
            </div>
            <span className={cn("text-lg font-black tracking-tight", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>WriteSpace AI</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1 text-slate-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 w-full px-4 flex flex-col gap-2">
          {[
            { id: 'competitors', icon: <Search className="w-5 h-5" />, label: 'Research' },
            { id: 'sops', icon: <Layers className="w-5 h-5" />, label: 'SEO SOPs' },
            { id: 'optimizer', icon: <FileEdit className="w-5 h-5" />, label: 'Drafts' },
            // { id: 'proofreader', icon: <ShieldCheck className="w-5 h-5" />, label: 'Proofreader' },
            { id: 'history', icon: <Database className="w-5 h-5" />, label: 'History' },
            { id: 'setup', icon: <Globe className="w-5 h-5" />, label: 'Setup' },
            { id: 'settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
          ].map((item) => (
            <NavItem 
              key={item.id}
              icon={item.icon} 
              active={activeTab === item.id} 
              onClick={() => {
                setActiveTab(item.id as any);
                setIsMobileMenuOpen(false);
              }}
              label={item.label}
              theme={settings.theme}
            />
          ))}
        </div>

        <div className="mt-auto px-4 w-full">
          <div className={cn(
            "p-4 rounded-lg border-2 transition-all",
            settings.theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600"
          )}>
            <p className="text-[10px] uppercase font-bold mb-1 tracking-tighter opacity-60">Status</p>
            <p className="text-xs text-green-500 flex items-center gap-2 font-bold">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> 
              Cloud Connected
            </p>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className={cn(
        "min-h-screen transition-all",
        "lg:pl-64"
      )}>
        {/* Overlay for mobile menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Header (Desktop Only) */}
        <header className={cn(
          "hidden lg:flex h-24 border-b-2 px-8 items-center justify-between sticky top-0 z-40 transition-all",
          settings.theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div>
            <h1 className={cn("text-2xl font-black tracking-tight", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>
              {activeTab === 'competitors' && "Competitor Intelligence"}
              {activeTab === 'optimizer' && "Article Draft"}
              {activeTab === 'proofreader' && "Proofreader Intelligence"}
              {activeTab === 'sops' && "Strategic Writing Protocols"}
              {activeTab === 'setup' && "WordPress Terminal"}
              {activeTab === 'settings' && "System Configuration"}
              {activeTab === 'history' && "Publication Archive"}
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 opacity-60">
              Content Intelligence Protocol v2.5
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20">
              Pipeline Active
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="flex items-center gap-4 group"
            >
              <div className="text-right">
                <p className={cn("text-sm font-bold group-hover:text-indigo-500 transition-colors", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>{user?.displayName || 'User'}</p>
                <p className="text-[10px] text-slate-500 font-medium">Chief Content Officer</p>
              </div>
              <div className={cn(
                "w-10 h-10 rounded-xl border-2 overflow-hidden group-hover:border-indigo-500 transition-all shadow-md",
                settings.theme === 'dark' ? "bg-slate-800 border-slate-800" : "bg-slate-200 border-slate-200"
              )}>
                <img src={user?.photoURL || ''} alt="Avatar" className="w-full h-full object-cover" />
              </div>
            </button>
          </div>
        </header>

        <section className="p-4 sm:p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'competitors' && (
              <motion.div 
                key="competitors"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <div className={cn(
                  "rounded-lg border-2 p-8 transition-all",
                  settings.theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
                )}>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-6">Content Intelligence Protocol</h3>
                  <div className="space-y-6">
                    {/* Focus Keyword Input */}
                    <div className="relative">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">Focus Keyword</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                        <input
                          type="text"
                          placeholder="e.g. food puns for restaurants"
                          className={cn(
                            "w-full border-2 rounded-lg py-3 pl-12 pr-4 text-[11px] focus:outline-none focus:border-indigo-500 transition-all font-mono",
                            settings.theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
                          )}
                          value={focusKeyword_state}
                          onChange={(e) => setFocusKeyword(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative space-y-4 col-span-full">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-indigo-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target Intel Nodes (URLs)</span>
                          </div>
                          <button 
                            onClick={() => setCompetitorUrls([...competitorUrls, ''])}
                            className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-400 flex items-center gap-1.5"
                          >
                            <Plus className="w-3 h-3" /> Add Node
                          </button>
                        </div>
                        
                        <div className="space-y-3">
                          {competitorUrls.map((url, idx) => (
                            <div key={idx} className="flex gap-2 group">
                              <div className="relative flex-1">
                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input 
                                  type="text" 
                                  placeholder={`Competitor Node #${idx + 1} URL...`} 
                                  className={cn(
                                    "w-full border-2 rounded-lg py-3 pl-12 pr-4 text-[11px] focus:outline-none focus:border-indigo-500 transition-all font-mono",
                                    settings.theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
                                  )}
                                  value={url || ''}
                                  onChange={(e) => {
                                    const newUrls = [...competitorUrls];
                                    newUrls[idx] = e.target.value;
                                    setCompetitorUrls(newUrls);
                                  }}
                                />
                              </div>
                              {competitorUrls.length > 1 && (
                                <button 
                                  onClick={() => setCompetitorUrls(competitorUrls.filter((_, i) => i !== idx))}
                                  className="p-3 text-slate-500 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button 
                          onClick={() => handleSerpAnalysis(competitorUrls)}
                          disabled={isScraping}
                          className={cn(
                            "flex-1 px-6 py-4 bg-indigo-600 text-white border-2 border-indigo-600 rounded-lg text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-indigo-500/20",
                          )}
                        >
                          {isScraping ? (
                            <Zap className="w-5 h-5 animate-pulse" />
                          ) : (
                            <Search className="w-5 h-5" />
                          )}
                          Execute Unified Research
                        </button>

                        <button 
                          onClick={() => setShowManualForm(!showManualForm)}
                          className={cn(
                            "px-6 py-4 border-2 rounded-lg text-sm font-black uppercase tracking-widest transition-all gap-2 flex items-center justify-center",
                            settings.theme === 'dark' 
                              ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-indigo-400 hover:border-indigo-400" 
                              : "bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-600"
                          )}
                        >
                          {showManualForm ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                          Manual Override
                        </button>
                      </div>

                      {showManualForm && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className={cn(
                            "p-6 rounded-lg border-2 space-y-6 overflow-hidden",
                            settings.theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-2">
                             <FileText className="w-4 h-4 text-indigo-500" />
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Manual Neural Ingestion</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Node Identification (URL)</label>
                              <input 
                                type="text"
                                placeholder="https://competitor.com/article"
                                value={manualEntry.url || ''}
                                onChange={(e) => setManualEntry({ ...manualEntry, url: e.target.value })}
                                className={cn(
                                  "w-full px-4 py-3 border-2 rounded-lg text-[11px] focus:outline-none focus:border-indigo-500 font-mono",
                                  settings.theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                                )}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Asset Title</label>
                              <input 
                                type="text"
                                placeholder="The Headline of the Competitor Asset"
                                value={manualEntry.title || ''}
                                onChange={(e) => setManualEntry({ ...manualEntry, title: e.target.value })}
                                className={cn(
                                  "w-full px-4 py-3 border-2 rounded-lg text-[11px] focus:outline-none focus:border-indigo-500",
                                  settings.theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                                )}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Word Count (Estimate)</label>
                              <input 
                                type="number"
                                value={manualEntry.wordCount || 0}
                                onChange={(e) => setManualEntry({ ...manualEntry, wordCount: parseInt(e.target.value) || 0 })}
                                className={cn(
                                  "w-full px-4 py-3 border-2 rounded-lg text-[11px] focus:outline-none focus:border-indigo-500",
                                  settings.theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                                )}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Media Count (Images/Video)</label>
                              <input 
                                type="number"
                                value={manualEntry.imageCount || 0}
                                onChange={(e) => setManualEntry({ ...manualEntry, imageCount: parseInt(e.target.value) || 0 })}
                                className={cn(
                                  "w-full px-4 py-3 border-2 rounded-lg text-[11px] focus:outline-none focus:border-indigo-500",
                                  settings.theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                                )}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Raw Content Analysis (Full Text Paste)</label>
                            <textarea 
                              placeholder="Paste the competitor article content here for deep analysis..."
                              value={manualEntry.fullContent || ''}
                              onChange={(e) => setManualEntry({ ...manualEntry, fullContent: e.target.value })}
                              className={cn(
                                "w-full min-h-[150px] px-4 py-3 border-2 rounded-lg text-[11px] focus:outline-none focus:border-indigo-500 resize-y",
                                settings.theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                              )}
                            />
                          </div>

                          <button 
                            onClick={handleManualCompetitorAdd}
                            className="w-full py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" /> Inject Competitor Node
                          </button>
                        </motion.div>
                      )}

                      {isScraping && scrapingProgress.total > 0 && (
                        <div className="space-y-4">
                           <div className="space-y-2">
                             <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                               <span>Content Research in Progress</span>
                               <span>{Math.min(scrapingProgress.processed, scrapingProgress.total)} / {scrapingProgress.total}</span>
                             </div>
                             <div className={cn(
                               "h-1.5 w-full rounded-full overflow-hidden",
                               settings.theme === 'dark' ? "bg-slate-800" : "bg-slate-200"
                             )}>
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${Math.min((scrapingProgress.processed / scrapingProgress.total) * 100, 100)}%` }}
                                 className="h-full bg-indigo-500"
                               />
                             </div>
                             <p className="text-[9px] text-slate-500 truncate italic">
                               Currently analyzing: <span className="text-indigo-400">{scrapingProgress.currentUrl}</span>
                             </p>
                           </div>

                          {researchLogs.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 px-1">
                                <Bot className="w-3 h-3 text-indigo-400" />
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Live Research Log</span>
                              </div>
                              <div className={cn(
                                "p-4 rounded-lg border-2 font-mono text-[9px] uppercase tracking-tighter max-h-[160px] overflow-y-auto space-y-1.5 scrollbar-hide",
                                settings.theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
                              )}>
                                {researchLogs.map((log) => (
                                  <div key={log.id} className="flex gap-3">
                                    <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                                    <span className={cn(
                                      "break-words",
                                      log.type === 'error' ? "text-red-500 font-bold" :
                                      log.type === 'warning' ? "text-amber-500 font-bold" :
                                      log.type === 'success' ? "text-emerald-500 font-bold" :
                                      settings.theme === 'dark' ? "text-slate-300" : "text-slate-700"
                                    )}>{log.message}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {lastSerpResults.length > 0 && !isScraping && (
                            <div className="space-y-3 pt-4 border-t-2 border-slate-900/50">
                              <div className="flex items-center gap-2 px-1">
                                <Layout className="w-3 h-3 text-indigo-400" />
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Identified SERP Nodes</span>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {lastSerpResults.map((serp) => (
                                  <div 
                                    key={serp.url} 
                                    className={cn(
                                      "px-4 py-2 rounded-lg border-2 flex items-center justify-between group",
                                      settings.theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
                                    )}
                                  >
                                    <span className="text-[9px] font-mono text-slate-400 truncate max-w-[80%]">{serp.url}</span>
                                    <a 
                                      href={serp.url} 
                                      target="_blank" 
                                      rel="no-referrer"
                                      className="p-1 hover:text-indigo-400 transition-colors"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {showResearchReport && currentResearch.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "mb-8 p-8 rounded-xl border-2 shadow-2xl relative overflow-hidden",
                      settings.theme === 'dark' ? "bg-slate-950 border-indigo-500/30" : "bg-white border-indigo-100"
                    )}
                  >
                    <div className="absolute top-0 right-0 p-4">
                      <button 
                        onClick={() => setShowResearchReport(false)}
                        className="text-slate-500 hover:text-indigo-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                      <div className="shrink-0">
                        <div className="w-24 h-24 rounded-2xl bg-indigo-600 flex flex-col items-center justify-center shadow-lg shadow-indigo-500/20">
                          <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Avg DNA</span>
                          <span className="text-3xl font-black text-white">
                            {Math.round(currentResearch.reduce((acc, c) => acc + (c.analysis?.topicalDepthScore || 0), 0) / currentResearch.length)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-6">
                        <div>
                          <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">Research Intelligence Report</h2>
                          {/* Aggregated Headings Snapshot */}
                          {currentResearch.length > 0 && (
                            <div className="mb-4 p-4 rounded-lg border-2" style={{ background: settings.theme === 'dark' ? 'rgba(15,23,42,0.4)' : '#f8fafc' }}>
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Headings Snapshot</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-auto">
                                {currentResearch.map((c, idx) => (
                                  <div key={c.url + idx} className="text-[11px]">
                                    <div className="text-[10px] font-black text-slate-400 uppercase">{new URL(c.url).hostname}</div>
                                    <div className="mt-1 text-[11px] text-slate-200">
                                      {(c.headings || []).slice(0,5).map((h, i) => (
                                        <div key={i} className="flex gap-2 items-start">
                                          <span className="text-[9px] font-mono text-slate-400 w-8">{h.level.toUpperCase()}</span>
                                          <span className="truncate">{h.text}</span>
                                        </div>
                                      ))}
                                      {(c.headings || []).length === 0 && <div className="text-[10px] text-slate-500">No headings found</div>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        <div className="flex flex-wrap gap-4 mb-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Word Gap:</span>
                              <span className="text-sm font-black text-indigo-400">
                                {currentResearch.length > 0 ? Math.round(currentResearch.reduce((acc, c) => acc + c.wordCount, 0) / currentResearch.length).toLocaleString() : 0} Avg / {settings.targetWordCount.toLocaleString()} Target
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Visual Density:</span>
                              <span className="text-sm font-black text-purple-400">
                                {currentResearch.length > 0 ? Math.round(currentResearch.reduce((acc, c) => acc + c.imageCount, 0) / currentResearch.length) : 0} Avg Imgs
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-slate-400 font-medium max-w-2xl leading-relaxed break-words">
                            Aggregated insights from {currentResearch.length} primary competitors. The content DNA suggests a high reliance on 
                            <span className="text-indigo-400 font-bold"> {currentResearch[0]?.analysis?.intentType || 'Unknown'}</span> intent with an emphasis on 
                            <span className="text-indigo-400 font-bold"> {currentResearch[0]?.analysis?.keyEntities?.slice(0, 2).join(' & ') || 'Topic Authority'}</span>.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className={cn("p-4 rounded-lg border-2", settings.theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200")}>
                            <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                              <Target className="w-3 h-3 text-emerald-500" />
                              Primary Strengths
                            </h3>
                            <ul className="space-y-2">
                              {Array.from(new Set(currentResearch.flatMap(c => c.analysis?.strengths || []).slice(0, 3))).map((s) => (
                                <li key={s} className={cn("text-[10px] flex items-start gap-2", settings.theme === 'dark' ? "text-slate-300" : "text-slate-600")}>
                                  <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          <div className={cn("p-4 rounded-lg border-2", settings.theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200")}>
                            <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                              <Zap className="w-3 h-3 text-amber-500" />
                              Critical Gaps
                            </h3>
                            <ul className="space-y-2">
                              {Array.from(new Set(currentResearch.flatMap(c => c.analysis?.weaknesses || []).slice(0, 3))).map((w) => (
                                <li key={w} className={cn("text-[10px] flex items-start gap-2", settings.theme === 'dark' ? "text-slate-300" : "text-slate-600")}>
                                  <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className={cn("p-4 rounded-lg border-2", settings.theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200")}>
                            <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                              <Database className="w-3 h-3 text-indigo-500" />
                              LSI Clusters
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                              {Array.from(new Set(currentResearch.flatMap(c => c.analysis?.lsiTerms || []).slice(0, 8))).map((t) => (
                                <span key={t} className={cn(
                                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                  settings.theme === 'dark' ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500 border border-slate-200"
                                )}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {currentResearch.map((c) => (
                    <div key={c.url}>
                      <CompetitorCard data={c} theme={settings.theme} onAnalyze={analyzeCompetitorContent} />
                    </div>
                  ))}
                  {currentResearch.length === 0 && (
                    <div className={cn(
                      "col-span-full py-24 text-center border-4 border-dashed rounded-lg",
                      settings.theme === 'dark' ? "bg-slate-950 border-slate-900" : "bg-slate-50 border-slate-200"
                    )}>
                      <div className={cn(
                        "w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-6 border-2",
                        settings.theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                      )}>
                        <TrendingUp className="text-slate-600 w-8 h-8" />
                      </div>
                      <p className={cn("text-base font-black uppercase tracking-widest", settings.theme === 'dark' ? "text-slate-400" : "text-slate-600")}>Research Buffer Empty</p>
                      <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest font-bold">Initiate Competitor URL Ingestion</p>
                    </div>
                  )}
                </div>

                {/* Heading & Title Editor — shown after research, before generation */}
                {currentResearch.length > 0 && editableHeadings !== null && (
                  <div className={cn(
                    "mt-6 p-6 rounded-lg border-2",
                    settings.theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                  )}>
                    <div className="flex items-center gap-2 mb-5">
                      <Edit3 className="w-4 h-4 text-indigo-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Article Structure Editor</span>
                      <span className={cn("text-[9px] font-black uppercase tracking-widest ml-auto", settings.theme === 'dark' ? "text-slate-600" : "text-slate-400")}>
                        Edit before generation — changes are used as-is
                      </span>
                    </div>

                    {/* Title editor */}
                    <div className="mb-5 space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Article Title</label>
                      <input
                        type="text"
                        value={editableTitle}
                        onChange={e => setEditableTitle(e.target.value)}
                        className={cn(
                          "w-full px-4 py-2.5 border-2 rounded-lg text-[11px] font-semibold focus:outline-none focus:border-indigo-500 transition-all",
                          settings.theme === 'dark' ? "bg-slate-950 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
                        )}
                        placeholder="Article title..."
                      />
                    </div>

                    {/* Headings list editor */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">
                          Headings ({editableHeadings.length})
                        </label>
                        <button
                          onClick={() => setEditableHeadings([...editableHeadings, { level: 'h2', text: '' }])}
                          className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      </div>
                      {editableHeadings.length === 0 && (
                        <p className="text-[10px] text-slate-500 text-center py-4 italic">No headings — AI will choose its own structure.</p>
                      )}
                      {editableHeadings.map((h, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={h.level}
                            onChange={e => {
                              const updated = [...editableHeadings];
                              updated[idx] = { ...updated[idx], level: e.target.value };
                              setEditableHeadings(updated);
                            }}
                            className={cn(
                              "px-2 py-2 border-2 rounded-lg text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-indigo-500 w-14 shrink-0",
                              settings.theme === 'dark' ? "bg-slate-950 border-slate-700 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"
                            )}
                          >
                            <option value="h2">H2</option>
                            <option value="h3">H3</option>
                          </select>
                          <input
                            type="text"
                            value={h.text}
                            onChange={e => {
                              const updated = [...editableHeadings];
                              updated[idx] = { ...updated[idx], text: e.target.value };
                              setEditableHeadings(updated);
                            }}
                            className={cn(
                              "flex-1 px-3 py-2 border-2 rounded-lg text-[11px] focus:outline-none focus:border-indigo-500 transition-all",
                              settings.theme === 'dark' ? "bg-slate-950 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
                            )}
                            placeholder="Heading text..."
                          />
                          <button
                            onClick={() => setEditableHeadings(editableHeadings.filter((_, i) => i !== idx))}
                            className="p-2 text-slate-500 hover:text-red-500 transition-colors shrink-0"
                            title="Remove heading"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentResearch.length > 0 && (
                  <div className="flex flex-col items-center pt-8 gap-8 w-full">
                    {isGenerating && (
                      <div className="w-full max-w-2xl mx-auto space-y-3">
                         <div className="flex justify-between items-end">
                           <span className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500 flex items-center gap-2">
                             <Zap className="w-4 h-4 animate-pulse" />
                             {generationProgress.label}
                           </span>
                           <span className="text-[10px] font-mono text-slate-500">
                             {Math.round((generationProgress.step / generationProgress.total) * 100)}%
                           </span>
                         </div>
                         <div className="h-2 w-full bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${(generationProgress.step / generationProgress.total) * 100}%` }}
                             className="h-full bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                           />
                         </div>
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        {isGenerating ? (
                          <button
                            onClick={handleCancelGeneration}
                            className="px-12 py-4 bg-red-600 text-white border-2 border-red-600 rounded-lg text-base font-black uppercase tracking-widest flex items-center gap-4 hover:bg-red-700 transition-all shadow-none"
                          >
                            <X className="w-5 h-5" />
                            Abort Protocol
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleGenerate()}
                              disabled={isGenerating}
                              className="px-12 py-4 bg-indigo-600 text-white border-2 border-indigo-600 rounded-lg text-base font-black uppercase tracking-widest flex items-center gap-4 hover:bg-indigo-700 active:scale-95 transition-all shadow-none"
                            >
                              <Zap className="w-5 h-5" />
                              Generate Optimized Article
                            </button>
                            <button
                              onClick={() => setSettings(s => ({ ...s, punMode: !s.punMode }))}
                              title="Toggle Pun Mode: generates 10-12 puns per heading"
                              className={cn(
                                "px-5 py-4 rounded-lg border-2 text-base font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-none",
                                settings.punMode
                                  ? "bg-amber-500/20 border-amber-500 text-amber-400 hover:bg-amber-500/30"
                                  : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600"
                              )}
                            >
                              <span>🥁</span>
                              <span className="text-[10px]">{settings.punMode ? 'Pun On' : 'Pun Off'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'optimizer' && (
              <motion.div 
                key="optimizer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8"
              >
                {isGenerating && (
                  <div className="lg:col-span-12 mb-4">
                     <div className={cn(
                       "w-full max-w-4xl mx-auto space-y-4 p-8 border-4 border-dashed rounded-lg transition-all",
                       settings.theme === 'dark' ? "bg-slate-950 border-slate-900" : "bg-slate-50 border-slate-200"
                     )}>
                        <div className="flex justify-between items-end">
                           <div className="space-y-1">
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Generation Protocol</p>
                             <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500 flex items-center gap-2">
                               <Zap className="w-4 h-4 animate-pulse" />
                               {generationProgress.label}
                             </h3>
                           </div>
                           <span className="text-xl font-black font-mono text-slate-400">
                             {Math.round((generationProgress.step / generationProgress.total) * 100)}%
                           </span>
                         </div>
                         <div className="h-4 w-full bg-slate-900 border-2 border-slate-800 rounded-full overflow-hidden">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${(generationProgress.step / generationProgress.total) * 100}%` }}
                             className="h-full bg-indigo-600 shadow-[0_0_30px_rgba(79,70,229,0.6)]"
                           />
                         </div>
                         <p className="text-[10px] text-slate-600 uppercase font-black text-center mt-2 tracking-widest opacity-60">Engineered by SEO Node Terminal • Do not interrupt</p>
                      </div>
                  </div>
                )}

                {blogDraft ? (
                  <React.Fragment>
                    <div className="lg:col-span-8 space-y-6">
                        <div className={cn(
                          "rounded-lg border-2 p-6 sm:p-10 transition-all",
                          settings.theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
                        )}>
                          <div className="flex items-center justify-between mb-8">
                             <div className="flex items-center gap-2">
                               {isAutosaving ? (
                                 <span className="flex items-center gap-1.5 text-[10px] text-indigo-500 font-black uppercase tracking-widest">
                                   <Zap className="w-3 h-3" /> Saving
                                 </span>
                               ) : (
                                 <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                                   <CheckCircle2 className="w-3 h-3" /> Saved
                                 </span>
                               )}
                             </div>
                             <div className="flex gap-2">
                               <button 
                                 onClick={() => setShowPreview(true)}
                                 className={cn(
                                   "px-4 py-2 rounded-lg border-2 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                                   settings.theme === 'dark' 
                                     ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-white" 
                                     : "bg-white border-slate-200 text-slate-500 hover:text-indigo-600"
                                 )}
                               >
                                 <Monitor className="w-3 h-3" /> Full Preview
                               </button>
                               <span className="text-[10px] text-slate-500 font-mono">Archive sync: {new Date().toLocaleTimeString()}</span>
                             </div>
                          </div>

                          {/* Comparison Optimizer Table */}
                          <div className={cn(
                            "rounded-xl border-2 p-6 mb-10",
                            settings.theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
                          )}>
                            <div className="flex items-center gap-3 mb-6">
                              <Layout className="w-5 h-5 text-indigo-500" />
                              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Competitor Gap Comparison</h3>
                            </div>
                            
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-separate border-spacing-y-2">
                                <thead>
                                  <tr className="text-xs font-black uppercase tracking-widest text-slate-400">
                                    <th className="pb-4 pl-4 text-left">Quality Metric</th>
                                    <th className="pb-4 px-4 text-center">Competitor Avg</th>
                                    <th className="pb-4 px-4 text-center">Your Draft</th>
                                    <th className="pb-4 pr-4 text-right">Strategic Edge</th>
                                  </tr>
                                </thead>
                                <tbody className="text-sm">
                                  {(blogDraft.comparisonMetrics || [
                                    { label: "Depth of Topic", competitorScore: 7, yourScore: 9, reasoning: "Enhanced technical detail" },
                                    { label: "Strategic Breadth", competitorScore: 6.5, yourScore: 8.5, reasoning: "Wider topical coverage" },
                                    { label: "Actionability", competitorScore: 5, yourScore: 9.5, reasoning: "Step-by-step implementation guides" },
                                    { label: "SEO Structure", competitorScore: 8, yourScore: 9, reasoning: "Optimized semantic hierarchy" }
                                  ]).map((row, idx) => (
                                    <tr key={idx} className={cn(
                                      "rounded-lg",
                                      settings.theme === 'dark' ? "bg-slate-900 shadow-xl shadow-indigo-900/5" : "bg-white shadow-sm shadow-slate-200"
                                    )}>
                                      <td className="py-4 pl-4 rounded-l-lg border-y-2 border-l-2 border-transparent">
                                        <div className="flex flex-col">
                                          <span className={cn(
                                            "font-bold",
                                            settings.theme === 'dark' ? "text-slate-300" : "text-slate-700"
                                          )}>{row.label}</span>
                                          {row.reasoning && (
                                            <span className="text-[10px] text-slate-500 italic mt-0.5 max-w-[200px] truncate">{row.reasoning}</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-4 px-4 text-center border-y-2 border-transparent">
                                        <span className="text-slate-500">{row.competitorScore}/10</span>
                                      </td>
                                      <td className="py-4 px-4 text-center border-y-2 border-transparent">
                                        <span className="font-black text-indigo-500">{row.yourScore}/10</span>
                                      </td>
                                      <td className="py-4 pr-4 rounded-r-lg text-right border-y-2 border-r-2 border-transparent">
                                        <span className={cn(
                                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm",
                                          row.yourScore > row.competitorScore ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                                        )}>
                                          {row.yourScore > row.competitorScore ? "Superior" : "Competitive"}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Featured Image Section */}
                          <div className={cn(
                            "mb-10 p-6 rounded-xl border-4 border-dashed relative group overflow-hidden",
                            settings.theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
                          )}>
                            {isImageGenerating ? (
                              <div className="aspect-video w-full rounded-lg overflow-hidden border-2 border-indigo-800/50 bg-slate-950 relative flex flex-col items-center justify-center gap-4">
                                <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-400 animate-pulse">Rendering Visual Asset...</p>
                              </div>
                            ) : blogDraft.featuredImage?.url ? (
                              <div className="space-y-6">
                                <div className="aspect-video w-full rounded-lg overflow-hidden border-2 border-slate-800 bg-slate-950 relative">
                                  <img
                                    src={blogDraft.featuredImage.url}
                                    alt={blogDraft.featuredImage.alt}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                  <button
                                    onClick={() => setBlogDraft({...blogDraft, featuredImage: undefined})}
                                    className="absolute top-4 right-4 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all shadow-xl"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                
                                <div className="space-y-4">
                                  <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-1">Visual Intelligence Prompt</label>
                                    <button 
                                      onClick={generateImagePrompt}
                                      className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-colors flex items-center gap-1.5"
                                    >
                                      <Zap className="w-3 h-3" /> Auto-Sync from Content
                                    </button>
                                  </div>
                                  <textarea 
                                    value={blogDraft.featuredImage.prompt || ''}
                                    onChange={(e) => setBlogDraft({...blogDraft, featuredImage: {...blogDraft.featuredImage!, prompt: e.target.value}})}
                                    placeholder="Enter custom image generation prompt..."
                                    className={cn(
                                      "w-full bg-slate-950 border-2 border-slate-800 rounded-lg py-3 px-4 text-xs text-white focus:outline-none focus:border-indigo-600 transition-all font-mono min-h-[80px] resize-none",
                                      settings.theme === 'dark' ? "" : "bg-white border-slate-200 text-black shadow-inner"
                                    )}
                                  />
                                  <div className="flex gap-3">
                                    <button 
                                      onClick={handleManualImageGeneration}
                                      className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all"
                                    >
                                      <RefreshCw className="w-3 h-3" /> Regenerate Asset
                                    </button>
                                    <div className="flex-1">
                                      <input 
                                        placeholder="Alt Text (Accessibility)"
                                        value={blogDraft.featuredImage.alt || ''}
                                        onChange={(e) => setBlogDraft({...blogDraft, featuredImage: {...blogDraft.featuredImage!, alt: e.target.value}})}
                                        className={cn(
                                          "w-full bg-slate-950 border-2 border-slate-800 rounded-lg py-3 px-4 text-xs text-white focus:outline-none focus:border-indigo-600 transition-all font-mono h-full",
                                          settings.theme === 'dark' ? "" : "bg-white border-slate-200 text-black shadow-inner"
                                        )}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
                                <div className="w-20 h-20 rounded-2xl bg-indigo-600/10 border-4 border-indigo-600/20 flex items-center justify-center text-indigo-500">
                                  <ImageIcon className="w-10 h-10" />
                                </div>
                                <div className="space-y-1">
                                  <h4 className={cn("text-lg font-black uppercase tracking-tighter", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>Visual Identity Locked</h4>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Generate or attach a high-converting featured image</p>
                                </div>
                                
                                <div className="w-full max-w-lg space-y-4">
                                  <div className="flex items-center gap-3">
                                    <textarea 
                                      value={blogDraft.featuredImage?.prompt || ''}
                                      onChange={(e) => setBlogDraft({...blogDraft, featuredImage: { url: '', alt: blogDraft.title, prompt: e.target.value }})}
                                      placeholder="Visual prompt for generation..."
                                      className={cn(
                                        "flex-1 bg-slate-950 border-2 border-slate-800 rounded-lg py-3 px-4 text-xs text-white focus:outline-none focus:border-indigo-600 transition-all font-mono min-h-[60px] resize-none",
                                        settings.theme === 'dark' ? "" : "bg-white border-slate-200 text-black shadow-inner"
                                      )}
                                    />
                                    <button 
                                      onClick={generateImagePrompt}
                                      title="Auto-create prompt from content"
                                      className="p-4 bg-slate-800 text-indigo-400 rounded-lg hover:bg-slate-700 transition-all border border-slate-700 h-full"
                                    >
                                      <Bot className="w-5 h-5" />
                                    </button>
                                  </div>

                                  <div className="flex flex-col sm:flex-row gap-3">
                                    <button 
                                      onClick={handleManualImageGeneration}
                                      className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
                                      disabled={!blogDraft.featuredImage?.prompt}
                                    >
                                      <Zap className="w-4 h-4" /> Finalize Generation
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const url = prompt("Enter Image URL:");
                                        if (url) {
                                          setBlogDraft({
                                            ...blogDraft,
                                            featuredImage: {
                                              url,
                                              alt: blogDraft.title,
                                              prompt: ''
                                            }
                                          });
                                        }
                                      }}
                                      className={cn(
                                        "flex-1 py-3 border-2 rounded-lg font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                                        settings.theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                      )}
                                    >
                                      <Plus className="w-4 h-4" /> Select Manual
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <input 
                            value={sanitizeHeadingText(blogDraft.title)}
                            onChange={(e) => setBlogDraft({...blogDraft, title: e.target.value})}
                            className={cn(
                              "w-full text-4xl font-extrabold border-none focus:ring-0 p-0 mb-8 bg-transparent transition-all",
                              settings.theme === 'dark' ? "text-white" : "text-black"
                            )}
                            placeholder="Article Title"
                          />
                        <div className={cn(
                          "space-y-10 prose max-w-none transition-all",
                          settings.theme === 'dark' ? "prose-invert prose-slate" : "prose-slate"
                        )}>
                          <section>
                            <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-indigo-500 mb-3">01. Introduction</h4>
                            <SimpleHtmlEditor 
                              value={sanitizeHeadingText(blogDraft.introduction)}
                              onChange={(v) => setBlogDraft({...blogDraft, introduction: v})}
                              theme={settings.theme}
                              placeholder="Draft compelling introduction..."
                            />
                            <SectionImageGroup 
                              type="content"
                              index={0}
                              sectionTitle="Introduction"
                              sectionContent={blogDraft.introduction}
                              draft={blogDraft}
                              onDraftUpdate={setBlogDraft}
                              engineerPrompt={engineerPromptForSection}
                              generateImage={generateIndividualImage}
                              theme={settings.theme}
                            />
                          </section>
                          <section>
                            <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-indigo-500 mb-3">02. Main Pillar Content</h4>
                            <SimpleHtmlEditor 
                              value={sanitizeHeadingText(blogDraft.content)}
                              onChange={(v) => setBlogDraft({...blogDraft, content: v})}
                              theme={settings.theme}
                              placeholder="Write pillar content bodies..."
                            />
                            <SectionImageGroup 
                              type="content"
                              index={1}
                              sectionTitle="Main Content"
                              sectionContent={blogDraft.content}
                              draft={blogDraft}
                              onDraftUpdate={setBlogDraft}
                              engineerPrompt={engineerPromptForSection}
                              generateImage={generateIndividualImage}
                              theme={settings.theme}
                            />
                          </section>
                          <section>
                            <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-indigo-500 mb-3">03. Conclusion</h4>
                            <SimpleHtmlEditor 
                              value={blogDraft.conclusion}
                              onChange={(v) => setBlogDraft({...blogDraft, conclusion: v})}
                              theme={settings.theme}
                              placeholder="Summarize key takeaways..."
                            />
                            <SectionImageGroup 
                              type="content"
                              index={2}
                              sectionTitle="Conclusion"
                              sectionContent={blogDraft.conclusion}
                              draft={blogDraft}
                              onDraftUpdate={setBlogDraft}
                              engineerPrompt={engineerPromptForSection}
                              generateImage={generateIndividualImage}
                              theme={settings.theme}
                            />
                          </section>
                          <section>
                            <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-indigo-500 mb-3">04. SEO Meta Analysis</h4>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Meta Title</label>
                                <input 
                                  value={blogDraft.meta_title || ''}
                                  onChange={(e) => setBlogDraft({...blogDraft, meta_title: e.target.value})}
                                  className={cn(
                                    "w-full border-2 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-indigo-600 transition-all font-mono",
                                    settings.theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-800"
                                  )}
                                  placeholder="Enter meta title..."
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Meta Description</label>
                                <textarea 
                                  value={blogDraft.meta_description || ''}
                                  onChange={(e) => setBlogDraft({...blogDraft, meta_description: e.target.value})}
                                  className={cn(
                                    "w-full border-2 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-indigo-600 transition-all font-mono min-h-[60px]",
                                    settings.theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-800"
                                  )}
                                  placeholder="Enter meta description..."
                                />
                              </div>
                            </div>
                          </section>
                          <section>
                            <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-indigo-500 mb-3">05. FAQ Integration</h4>
                            <div className="space-y-4">
                              {Array.isArray(blogDraft.faq) && blogDraft.faq.map((f, i) => (
                                <div key={i} className={cn(
                                  "space-y-2 p-4 border rounded-lg transition-all",
                                  settings.theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
                                )}>
                                  <input 
                                    value={f.question || ''}
                                    onChange={(e) => {
                                      const newFaq = [...blogDraft.faq];
                                      newFaq[i] = { ...newFaq[i], question: e.target.value };
                                      setBlogDraft({...blogDraft, faq: newFaq});
                                    }}
                                    className="w-full bg-transparent border-none text-[11px] font-black text-indigo-500 focus:ring-0 p-0 uppercase tracking-tight"
                                    placeholder="FAQ Question"
                                  />
                                  <textarea 
                                    value={f.answer || ''}
                                    onChange={(e) => {
                                      const newFaq = [...blogDraft.faq];
                                      newFaq[i] = { ...newFaq[i], answer: e.target.value };
                                      setBlogDraft({...blogDraft, faq: newFaq});
                                    }}
                                    className={cn(
                                      "w-full bg-transparent border-none text-xs focus:ring-0 p-0 min-h-[60px] resize-none leading-relaxed",
                                      settings.theme === 'dark' ? "text-slate-400" : "text-slate-600"
                                    )}
                                    placeholder="FAQ Answer"
                                  />
                                  <div className="flex justify-end">
                                    <button 
                                      onClick={() => setBlogDraft({...blogDraft, faq: blogDraft.faq.filter((_, idx) => idx !== i)})}
                                      className="text-[8px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button 
                                onClick={() => setBlogDraft({...blogDraft, faq: [...((Array.isArray(blogDraft.faq) ? blogDraft.faq : [])), {question: '', answer: ''}]})}
                                className="text-[10px] text-indigo-500 font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:text-indigo-400 transition-colors mt-2"
                              >
                                <Plus className="w-3 h-3" /> Add Research FAQ
                              </button>
                            </div>
                          </section>
                        </div>
                      </div>
                    </div>
                    
                    <div className="lg:col-span-4 space-y-6">
                      <div className={cn(
                        "rounded-lg p-8 border-2 relative overflow-hidden group transition-all",
                        settings.theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                      )}>
                        <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-indigo-500 mb-8 flex items-center gap-2">
                          <CheckSquare className="w-4 h-4" /> On-Page SEO Checklist
                        </h4>
                        <div className="space-y-3">
                          {(() => {
                            const faqHtml = (blogDraft.faq || []).map(f => f.question + ' ' + f.answer).join(' ');
                            const combinedHtml = (blogDraft.introduction || '') + (blogDraft.content || '') + (blogDraft.conclusion || '') + faqHtml;
                            const textOnly = combinedHtml.replace(/<[^>]*>/g, ' ');
                            const wordCount = textOnly.trim() === '' ? 0 : textOnly.trim().split(/\s+/).filter(w => w.length > 0).length;
                            const focusKeyword = settings.sopKeywords[0] || '';
                            
                            // Keyword Density
                            const keywordRegex = focusKeyword ? new RegExp(`\\b${focusKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi') : null;
                            const keywordMatches = keywordRegex ? (textOnly.match(keywordRegex) || []).length : 0;
                            const density = wordCount > 0 ? (keywordMatches / wordCount) * 100 : 0;
                            
                            // LSI Keywords
                            const lsiTotal = blogDraft.targetLsiKeywords?.length || 0;
                            const lsiUsed = blogDraft.targetLsiKeywords?.filter(k => 
                              textOnly.toLowerCase().includes(k.toLowerCase())
                            ).length || 0;

                            // Link count
                            const internalLinkCount = (combinedHtml.match(/href=["'](?!http)/g) || []).length;
                            const externalLinkCount = (combinedHtml.match(/href=["']http/g) || []).length;

                            // Heading Structure Analysis
                            const hasH1 = blogDraft.title?.trim().length > 0;
                            const h2Count = (combinedHtml.match(/<h2/g) || []).length;
                            const h3Count = (combinedHtml.match(/<h3/g) || []).length;
                            // Hierarchy logic: H1 must exist, and H2s must exist if H3s are used
                            const isHierarchyLogical = hasH1 && h2Count > 0 && (h3Count > 0 ? h2Count > 0 : true);
                            const headingStatus = `${h2Count} H2 / ${h3Count} H3`;

                            // Image Alt Tags
                            const images = [
                              ...(blogDraft.featuredImage ? [blogDraft.featuredImage] : []),
                              ...(blogDraft.contentImages || [])
                            ];
                            const imagesWithAlt = images.filter(img => img.alt?.trim().length > 0).length;
                            const allImagesHaveAlt = images.length > 0 && imagesWithAlt === images.length;

                            // Meta Description Length
                            const metaDescLength = blogDraft.meta_description?.length || 0;
                            const isMetaOptimal = metaDescLength >= 140 && metaDescLength <= 165;
                            
                            const isUnderTarget = wordCount < settings.targetWordCount * 0.9;
                            const introCount = (blogDraft.introduction || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(w => w.length > 0).length;
                            const conclusionCount = (blogDraft.conclusion || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(w => w.length > 0).length;

                            return (
                              <>
                                <ScoreItem 
                                  label="Word Volume" 
                                  value={`${wordCount.toLocaleString()} words`} 
                                  active={wordCount >= settings.targetWordCount} 
                                  theme={settings.theme} 
                                />
                                <ScoreItem 
                                  label="Keyword Density" 
                                  value={`${density.toFixed(1)}% (${keywordMatches})`} 
                                  active={density >= 0.5 && density <= 3.0} 
                                  theme={settings.theme} 
                                />
                                <ScoreItem 
                                  label="Meta Precision" 
                                  value={`${metaDescLength} chars`} 
                                  active={isMetaOptimal} 
                                  theme={settings.theme} 
                                />
                                <ScoreItem 
                                  label="Heading Structure" 
                                  value={headingStatus} 
                                  active={isHierarchyLogical} 
                                  theme={settings.theme} 
                                />
                                <ScoreItem 
                                  label="Link Network" 
                                  value={`${internalLinkCount} Int / ${externalLinkCount} Ext`} 
                                  active={internalLinkCount > 0 || externalLinkCount > 0} 
                                  theme={settings.theme} 
                                />
                                <ScoreItem 
                                  label="Alt Tags" 
                                  value={`${imagesWithAlt}/${images.length} tagged`} 
                                  active={allImagesHaveAlt} 
                                  theme={settings.theme} 
                                />
                                <ScoreItem 
                                  label="Semantic Depth" 
                                  value={`${lsiUsed}/${lsiTotal} LSI`} 
                                  active={lsiUsed >= Math.min(lsiTotal * 0.5, 5)} 
                                  theme={settings.theme} 
                                />

                                <AnimatePresence>
                                  {isUnderTarget && (
                                    <motion.div 
                                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                      animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                      className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 space-y-3 overflow-hidden"
                                    >
                                      <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.1em]">Expansion Protocol Suggested</span>
                                      </div>
                                      <p className="text-[10px] font-bold leading-tight opacity-90">
                                        Your content is {Math.round((1 - wordCount/settings.targetWordCount) * 100)}% short of the {settings.targetWordCount} word target. Consider:
                                      </p>
                                      <ul className="text-[9px] font-bold leading-relaxed list-disc pl-4 opacity-80 decoration-amber-500/30">
                                        {introCount < 150 && <li>Expand introduction for deeper context.</li>}
                                        {wordCount < settings.targetWordCount * 0.7 && <li>Add 2-3 detailed case studies or examples.</li>}
                                        {blogDraft.faq.length < 3 && <li>Add more FAQs for topical breadth.</li>}
                                        {conclusionCount < 100 && <li>Strengthen conclusion with key takeaways.</li>}
                                        {introCount >= 150 && wordCount >= settings.targetWordCount * 0.7 && blogDraft.faq.length >= 3 && conclusionCount >= 100 && (
                                          <li>Elaborate on current sub-sections with more detail.</li>
                                        )}
                                      </ul>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </>
                            );
                          })()}
                        </div>

                        <VisualGallery 
                          featuredImage={blogDraft.featuredImage} 
                          contentImages={blogDraft.contentImages} 
                          theme={settings.theme}
                          aspectRatio={settings.aspectRatio}
                          onAspectRatioChange={(ratio) => setSettings({ ...settings, aspectRatio: ratio })}
                          onUpload={(type, index) => triggerUpload(type, index)}
                          onAction={async (type, index) => {
                            let promptToUse = (type === 'featured' ? blogDraft.featuredImage?.prompt : blogDraft.contentImages?.[index!]?.prompt) || '';
                            if (!promptToUse) {
                              const userPrompt = prompt("Enter visual asset prompt (or leave empty to auto-engineer from content):");
                              if (userPrompt === null) return; // Cancel
                              if (userPrompt.trim()) {
                                promptToUse = userPrompt;
                                // Update draft with the manual prompt first
                                const updatedDraft = { ...blogDraft };
                                if (type === 'featured') {
                                  updatedDraft.featuredImage = { ...(updatedDraft.featuredImage || { url: '', alt: blogDraft.title, title: blogDraft.title, filename: '', prompt: '' }), prompt: promptToUse };
                                } else if (index !== undefined) {
                                  if (!updatedDraft.contentImages) updatedDraft.contentImages = [];
                                  updatedDraft.contentImages[index] = { ...(updatedDraft.contentImages[index] || { url: '', alt: `Section ${index + 1}`, filename: '', prompt: '' }), prompt: promptToUse };
                                }
                                setBlogDraft(updatedDraft);
                              } else {
                                // Auto-engineer
                                const context = type === 'featured' ? blogDraft.introduction : (blogDraft.content || '');
                                promptToUse = await engineerPromptForSection(context, `Article Title: ${blogDraft.title}`);
                              }
                            }
                            if (promptToUse) {
                              generateIndividualImage(promptToUse, type, index, settings.aspectRatio);
                            }
                          }}
                        />

                        <div className="mt-8 space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">Target Category</h4>
                            <button 
                              onClick={fetchCategories}
                              disabled={isFetchingCategories}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold tracking-widest uppercase transition-colors"
                            >
                              {isFetchingCategories ? '...' : <><Plus className="w-3 h-3" /> Sync Categories</>}
                            </button>
                          </div>
                          <select 
                            className="w-full bg-slate-950 border-2 border-slate-800 rounded-lg py-3 px-4 text-[10px] uppercase font-black tracking-widest text-slate-200 focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                            value={selectedCategory || ''}
                            onChange={(e) => setSelectedCategory(Number(e.target.value))}
                          >
                            <option value="">Select WP Category...</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-6 space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">Target Tags</h4>
                            <button 
                              onClick={fetchTags}
                              disabled={isFetchingTags}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold tracking-widest uppercase transition-colors"
                            >
                              {isFetchingTags ? '...' : <><Plus className="w-3 h-3" /> Sync Tags</>}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border-2 border-slate-800 rounded-lg bg-slate-950">
                            {tags.length === 0 && <p className="text-[10px] text-slate-600 col-span-2 text-center py-2 italic font-black uppercase">Null Tags</p>}
                            {tags.map(tag => (
                              <button
                                key={tag.id}
                                onClick={() => {
                                  setSelectedTags(prev => 
                                    prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                                  );
                                }}
                                className={cn(
                                  "px-2 py-1.5 rounded-md text-[10px] font-black border-2 transition-all text-left truncate uppercase tracking-tight",
                                  selectedTags.includes(tag.id) 
                                    ? "bg-indigo-600 border-indigo-700 text-white" 
                                    : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700"
                                )}
                              >
                                {tag.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-8 space-y-6">
                          <div className="space-y-3">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block px-1">Global Status / Schedule</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button 
                                onClick={() => setPublishStatus('draft')}
                                className={cn(
                                  "py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border-2",
                                  publishStatus === 'draft' 
                                    ? "bg-slate-800 text-white border-slate-600" 
                                    : "bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700"
                                )}
                              >
                                Draft
                              </button>
                              <button 
                                onClick={() => setPublishStatus('publish')}
                                className={cn(
                                  "py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border-2",
                                  publishStatus === 'publish' 
                                    ? "bg-indigo-600 text-white border-indigo-700" 
                                    : "bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700"
                                )}
                              >
                                Live
                              </button>
                            </div>
                            
                            <div className={cn(
                              "mt-4 p-4 rounded-lg border-2 transition-all space-y-4",
                              settings.theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200"
                            )}>
                              <div className="space-y-2">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Temporal Lock (Date/Time)</p>
                                <input 
                                  type="datetime-local"
                                  className={cn(
                                    "w-full bg-transparent border-none text-[10px] font-black uppercase focus:ring-0 transition-all",
                                    settings.theme === 'dark' ? "text-slate-300" : "text-slate-700"
                                  )}
                                  value={blogDraft.scheduledAt || ''}
                                  onChange={(e) => setBlogDraft({...blogDraft, scheduledAt: e.target.value, status: e.target.value ? 'scheduled' : 'draft'})}
                                />
                              </div>

                              <div className="pt-2 border-t border-slate-800/50 space-y-2">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                  <Layers className="w-3 h-3" /> Recurrence Engine
                                </p>
                                <div className="grid grid-cols-4 gap-1">
                                  {['none', 'daily', 'weekly', 'monthly'].map((p) => (
                                    <button
                                      key={p}
                                      onClick={() => setBlogDraft({...blogDraft, recurrence: p as any})}
                                      className={cn(
                                        "py-1.5 rounded-md text-[8px] font-black uppercase transition-all border",
                                        blogDraft.recurrence === p || (!blogDraft.recurrence && p === 'none')
                                          ? "bg-indigo-600 border-indigo-500 text-white"
                                          : (settings.theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300" : "bg-white border-slate-200 text-slate-400 hover:text-slate-600")
                                      )}
                                    >
                                      {p}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                            <button 
                              onClick={() => {
                                setShowPreview(true);
                              }}
                              className={cn(
                                "w-full py-4 rounded-lg font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all border-2 active:scale-95 bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"
                              )}
                            >
                              <Globe className="w-4 h-4" /> 
                              Preview
                            </button>
                            
                            <button 
                              onClick={() => {
                                savePostToFirestore(blogDraft);
                                showNotification("Draft Progress Synced", "success");
                              }}
                              className={cn(
                                "w-full py-4 rounded-lg font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all border-2 active:scale-95",
                                settings.theme === 'dark' ? "bg-slate-900 text-indigo-400 border-slate-800 hover:bg-slate-800" : "bg-white text-indigo-600 border-slate-200 hover:bg-slate-50"
                              )}
                            >
                              <Save className="w-4 h-4" /> 
                              Save Draft
                            </button>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <button 
                                className={cn(
                                  "py-4 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border-2 active:scale-95",
                                  settings.theme === 'dark' ? "bg-slate-900 text-white border-slate-800 hover:bg-slate-800" : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                )}
                                onClick={generateFeaturedImage}
                              >
                                <Zap className="w-3 h-3" /> 
                                Build
                              </button>
                              
                              <button 
                                onClick={() => triggerUpload('featured')}
                                className={cn(
                                  "py-4 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border-2 active:scale-95 cursor-pointer",
                                  settings.theme === 'dark' ? "bg-slate-900 text-white border-slate-800 hover:bg-slate-800" : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                )}
                              >
                                <ImageIcon className="w-3 h-3" /> 
                                Asset
                              </button>
                            </div>
                           <button 
                            onClick={handlePublish}
                            disabled={blogDraft.status === 'published'}
                            className={cn(
                              "w-full py-4 rounded-lg font-black text-xs flex items-center justify-center gap-2 transition-all border-2 active:scale-95 uppercase tracking-widest",
                              blogDraft.status === 'published' 
                                ? "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
                                : "bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700"
                            )}
                          >
                            <Share2 className="w-4 h-4" /> 
                            {blogDraft.status === 'published' ? 'Post Live' : 'Execute Publish'}
                          </button>

                          {blogDraft.status === 'published' && blogDraft.link && (
                            <a 
                              href={blogDraft.link} 
                              target="_blank" 
                              rel="noreferrer"
                              className="w-full py-4 bg-emerald-600 text-white rounded-lg font-black text-xs flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all border-2 border-emerald-700 active:scale-95 uppercase tracking-widest mt-3"
                            >
                              <ExternalLink className="w-4 h-4" /> 
                              View Live Post
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-950 rounded-lg border-4 border-slate-800 p-8 transition-all">
                        <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 mb-4 tracking-widest">Indexing Layer</h4>
                        <p className="text-xs text-slate-500 mb-6 leading-relaxed font-black uppercase tracking-tight opacity-70">
                          GSC Indexing Protocol acceleration (Coming Soon).
                        </p>
                        <button 
                          onClick={() => showNotification("Indexing API integration is coming in the next build.", "success")}
                          disabled={true}
                          className="w-full py-4 border-2 border-slate-800 text-slate-600 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-not-allowed"
                        >
                          <Search className="w-3 h-3" /> 
                          Indexing Restricted
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                  ) : (
                  <div className={cn(
                    "col-span-full py-48 text-center border-4 border-dashed rounded-lg transition-all",
                    settings.theme === 'dark' ? "bg-slate-950 border-slate-900" : "bg-slate-50 border-slate-200"
                  )}>
                    <Layers className="w-16 h-16 text-slate-800 mx-auto mb-6" />
                    <h2 className="text-xl font-black text-slate-500 uppercase tracking-widest">Null Workstation</h2>
                    <p className="text-[10px] text-slate-600 mt-2 uppercase tracking-[0.2em] font-black">Initiate researcher for orchestration</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'proofreader' && (
              <motion.div 
                key="proofreader"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-5xl mx-auto space-y-8"
              >
                {blogDraft ? (
                  <div className={cn(
                    "rounded-lg border-4 p-8 sm:p-12 transition-all",
                    settings.theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
                  )}>
                    <div className="flex items-center gap-4 mb-10">
                      <div className="p-3 bg-emerald-600 rounded-lg shrink-0">
                        <ShieldCheck className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className={cn("font-black text-2xl tracking-tighter uppercase transition-all", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>Proofreader Intelligence</h3>
                        <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mt-1">Humanize, Polish & Optimize Tone</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                      <div className="md:col-span-8 space-y-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Active Draft Content</label>
                           <SimpleHtmlEditor 
                             value={blogDraft.content}
                             onChange={(v) => setBlogDraft({...blogDraft, content: v})}
                             theme={settings.theme}
                             placeholder="Pillar content for proofreading..."
                           />
                        </div>
                      </div>

                      <div className="md:col-span-4 space-y-6">
                        <div className={cn(
                          "p-6 rounded-xl border-4 border-dashed",
                          settings.theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
                        )}>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Grade Specification</h4>
                          <div className="grid grid-cols-2 gap-2 mb-6">
                            {(['grade5-6', 'grade7-8', 'grade9-10', 'expert'] as const).map((grade) => (
                              <button
                                key={grade}
                                onClick={() => setProofreadGrade(grade)}
                                className={cn(
                                  "py-3 px-4 rounded-lg border-2 text-[10px] font-black uppercase tracking-widest transition-all text-left flex items-center justify-between",
                                  proofreadGrade === grade 
                                    ? "bg-emerald-600 border-emerald-600 text-white" 
                                    : (settings.theme === 'dark' ? "border-slate-800 text-slate-500 hover:border-slate-700" : "border-slate-200 text-slate-400 hover:border-slate-300")
                                )}
                              >
                                {grade.replace('-', ' ')}
                                {proofreadGrade === grade && <CheckCircle2 className="w-4 h-4" />}
                              </button>
                            ))}
                          </div>

                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Tone Architecture</h4>
                          <div className="grid grid-cols-2 gap-2 mb-6">
                            {(['neutral', 'professional', 'conversational', 'authoritative', 'friendly'] as const).map((tone) => (
                              <button
                                key={tone}
                                onClick={() => setProofreadTone(tone)}
                                className={cn(
                                  "py-3 px-4 rounded-lg border-2 text-[9px] font-black uppercase tracking-widest transition-all text-left flex items-center justify-between",
                                  proofreadTone === tone 
                                    ? "bg-indigo-600 border-indigo-600 text-white" 
                                    : (settings.theme === 'dark' ? "border-slate-800 text-slate-500 hover:border-slate-700" : "border-slate-200 text-slate-400 hover:border-slate-300")
                                )}
                              >
                                {tone}
                                {proofreadTone === tone && <CheckCircle2 className="w-3 h-3" />}
                              </button>
                            ))}
                          </div>

                          <div className="space-y-2 mb-6">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Active Neural Protocol</label>
                            <select
                              value={selectedProofreadSop}
                              onChange={(e) => setSelectedProofreadSop(e.target.value as any)}
                              className={cn(
                                "w-full p-3 rounded-lg border-2 text-[10px] font-black uppercase tracking-widest transition-all outline-none",
                                settings.theme === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                              )}
                            >
                              <option value="none">No Specific SOP</option>
                              <option value="title">Title SOP</option>
                              <option value="metaDescription">Meta Description SOP</option>
                              <option value="introduction">Introduction SOP</option>
                              <option value="content">Content Architecture SOP</option>
                              <option value="faq">FAQ Strategy SOP</option>
                              <option value="lsi">LSI Keywords SOP</option>
                            </select>
                          </div>

                          <div className="space-y-2 mb-6">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Special Refinement Directives</label>
                            <textarea 
                              value={proofreadContext}
                              onChange={(e) => setProofreadContext(e.target.value)}
                              placeholder="e.g. 'Make it sound more like a tech blog' or 'Add more bullet points for comparison'..."
                              className={cn(
                                "w-full h-24 p-4 rounded-lg border-2 text-xs font-medium transition-all focus:ring-2 focus:ring-indigo-500 outline-none resize-none",
                                settings.theme === 'dark' ? "bg-slate-900 border-slate-800 text-white placeholder-slate-600" : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"
                              )}
                            />
                          </div>

                          <div className="space-y-4">
                            <button 
                              onClick={handleProofread}
                              disabled={isProofreading}
                              className={cn(
                                "w-full py-5 rounded-xl border-4 border-dashed transition-all active:scale-95 flex items-center justify-center gap-3 group",
                                settings.theme === 'dark' 
                                  ? "bg-emerald-600/5 border-emerald-600/20 text-emerald-400 hover:bg-emerald-600/10 hover:border-emerald-600/40" 
                                  : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-300 shadow-lg shadow-emerald-100/50"
                              )}
                            >
                              {isProofreading ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                              ) : (
                                <ShieldCheck className="w-5 h-5 group-hover:scale-110 transition-transform text-emerald-500" />
                              )}
                              <div className="text-left">
                                <span className="block text-xs font-black uppercase tracking-widest">Execute Refinement</span>
                                <span className="block text-[8px] opacity-70 font-bold uppercase tracking-widest mt-0.5">Enforce {proofreadGrade.replace('-', ' ')} Human Tone</span>
                              </div>
                            </button>

                            <button 
                              onClick={handleRefineStructure}
                              disabled={isRefining}
                              className={cn(
                                "w-full py-4 rounded-xl border-4 border-dashed transition-all active:scale-95 flex items-center justify-center gap-3 group",
                                settings.theme === 'dark' 
                                  ? "bg-indigo-600/5 border-indigo-600/20 text-indigo-400 hover:bg-indigo-600/10 hover:border-indigo-600/40" 
                                  : "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 shadow-lg shadow-indigo-100/50"
                              )}
                            >
                              {isRefining ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                              ) : (
                                <Edit3 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                              )}
                              <div className="text-left">
                                <span className="block text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Architect Structure</span>
                                <span className="block text-[8px] opacity-70 font-bold uppercase tracking-widest mt-0.5">Optimize Logical Flow & Hierarchy</span>
                              </div>
                            </button>
                          </div>
                        </div>

                        <div className={cn(
                          "p-6 rounded-xl border-4 border-dashed",
                          settings.theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
                        )}>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                            <span className="text-indigo-500">Note:</span> The proofreader replaces the primary content block. Ensure you've reviewed the draft before execution.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    "py-48 text-center border-4 border-dashed rounded-lg transition-all",
                    settings.theme === 'dark' ? "bg-slate-950 border-slate-900" : "bg-slate-50 border-slate-200"
                  )}>
                    <ShieldCheck className="w-16 h-16 text-slate-800 mx-auto mb-6" />
                    <h2 className="text-xl font-black text-slate-500 uppercase tracking-widest">Draft Required</h2>
                    <p className="text-[10px] text-slate-600 mt-2 uppercase tracking-[0.2em] font-black">Generate content in Article Draft to initialize proofreader</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                  <div>
                    <h3 className={cn("text-xl font-bold tracking-tight", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>Search History</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{searches.length} Queries Logged</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {searches.length > 0 && (
                      <button 
                        onClick={() => {
                          if (selectedSearches.size === searches.length) setSelectedSearches(new Set());
                          else setSelectedSearches(new Set(searches.map(s => s.id)));
                        }}
                        className={cn(
                          "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded border-2 transition-all",
                          settings.theme === 'dark' ? "border-slate-800 text-slate-400 hover:text-white" : "border-slate-200 text-slate-600 hover:text-slate-900"
                        )}
                      >
                        {selectedSearches.size === searches.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                    {selectedSearches.size > 0 && (
                      <button 
                        onClick={handleDeleteSelectedSearches}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded bg-red-600/10 border-2 border-red-600/20 text-red-500 hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete ({selectedSearches.size})
                      </button>
                    )}
                  </div>
                </div>

                {searches.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                    {searches.map((s, idx) => (
                      <div
                        key={s.id || `search-${idx}`}
                        className={cn(
                          "relative border-2 rounded-lg transition-all group flex items-stretch",
                          settings.theme === 'dark' ? "bg-slate-950 border-slate-800 hover:border-indigo-500" : "bg-white border-slate-200 hover:border-indigo-500",
                          selectedSearches.has(s.id) && (settings.theme === 'dark' ? "border-indigo-600 bg-indigo-600/5" : "border-indigo-500 bg-indigo-50")
                        )}
                      >
                        <div 
                          onClick={() => {
                            const newSelected = new Set(selectedSearches);
                            if (newSelected.has(s.id)) newSelected.delete(s.id);
                            else newSelected.add(s.id);
                            setSelectedSearches(newSelected);
                          }}
                          className="px-4 flex items-center justify-center border-r-2 border-transparent group-hover:border-slate-800 transition-all cursor-pointer"
                        >
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-opacity",
                            selectedSearches.has(s.id) ? "bg-indigo-600 border-indigo-600" : "border-slate-700 opacity-30 group-hover:opacity-100"
                          )}>
                            {selectedSearches.has(s.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setFocusKeyword(s.query);
                            handleSerpAnalysis([s.query]);
                            setActiveTab('competitors');
                          }}
                          className="p-5 text-left flex-1 min-w-0"
                        >
                          <div className="flex items-center gap-3 mb-2 min-w-0">
                            <div className="p-2 bg-indigo-600 rounded-md shrink-0">
                              <Search className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest truncate flex-1 min-w-0">
                              {s.timestamp?.toDate ? s.timestamp.toDate().toLocaleDateString() : (s.timestamp instanceof Date ? s.timestamp.toLocaleDateString() : 'Recent')}
                            </span>
                          </div>
                          <p className={cn(
                            "font-black transition-colors truncate uppercase tracking-tight text-xs w-full",
                            settings.theme === 'dark' ? "text-white group-hover:text-indigo-400" : "text-slate-900 group-hover:text-indigo-600"
                          )}>{s.query}</p>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between mb-8 pt-8 border-t gap-4 transition-all", settings.theme === 'dark' ? "border-slate-800" : "border-slate-200")}>
                  <div>
                    <h3 className={cn("text-xl font-bold tracking-tight", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>Research Archive</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{competitors.length} Assets Found</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {competitors.length > 0 && (
                      <button 
                        onClick={() => {
                          if (selectedResearch.size === competitors.length) setSelectedResearch(new Set());
                          else setSelectedResearch(new Set(competitors.map(c => c.id!)));
                        }}
                        className={cn(
                          "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded border-2 transition-all",
                          settings.theme === 'dark' ? "border-slate-800 text-slate-400 hover:text-white" : "border-slate-200 text-slate-600 hover:text-slate-900"
                        )}
                      >
                        {selectedResearch.size === competitors.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                    {selectedResearch.size > 0 && (
                      <button 
                        onClick={handleDeleteSelectedResearch}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded bg-red-600/10 border-2 border-red-600/20 text-red-500 hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete ({selectedResearch.size})
                      </button>
                    )}
                  </div>
                </div>

                {competitors.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {competitors.map((c, idx) => (
                      <div 
                        key={c.id || `research-${idx}`} 
                        className={cn(
                          "relative group rounded-lg border-2 transition-all",
                          selectedResearch.has(c.id!) ? (settings.theme === 'dark' ? "border-indigo-600 bg-indigo-600/5" : "border-indigo-500 bg-indigo-50") : "border-transparent"
                        )}
                      >
                         <CompetitorCard data={c} theme={settings.theme} />
                         <div className="absolute top-4 right-4 flex items-center gap-2">
                           <button 
                             onClick={() => {
                               const newSelected = new Set(selectedResearch);
                               if (newSelected.has(c.id!)) newSelected.delete(c.id!);
                               else newSelected.add(c.id!);
                               setSelectedResearch(newSelected);
                             }}
                             className={cn(
                               "w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all",
                               selectedResearch.has(c.id!) ? "bg-indigo-600 border-indigo-600 text-white" : "bg-slate-900/50 border-slate-800 text-slate-400 opacity-0 group-hover:opacity-100"
                             )}
                           >
                             {selectedResearch.has(c.id!) ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                           </button>
                           <button 
                             onClick={() => {
                               setCurrentResearch(prev => [...prev, c]);
                               setActiveTab('competitors');
                               showNotification("Restored to active buffer");
                             }}
                             className="bg-indigo-600 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border-2 border-indigo-700"
                           >
                             <Zap className="w-4 h-4" />
                           </button>
                         </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between mb-8 pt-8 border-t gap-4 transition-all", settings.theme === 'dark' ? "border-slate-800" : "border-slate-200")}>
                  <div>
                    <h3 className={cn("text-xl font-bold tracking-tight", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>Publication Archive</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{publicationHistory.length} Posts Synced</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {publicationHistory.length > 0 && (
                      <button 
                        onClick={() => {
                          if (selectedPosts.size === publicationHistory.length) setSelectedPosts(new Set());
                          else setSelectedPosts(new Set(publicationHistory.map(p => p.id!)));
                        }}
                        className={cn(
                          "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded border-2 transition-all",
                          settings.theme === 'dark' ? "border-slate-800 text-slate-400 hover:text-white" : "border-slate-200 text-slate-600 hover:text-slate-900"
                        )}
                      >
                        {selectedPosts.size === publicationHistory.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                    {selectedPosts.size > 0 && (
                      <button 
                        onClick={handleDeleteSelectedPosts}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded bg-red-600/10 border-2 border-red-600/20 text-red-500 hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete ({selectedPosts.size})
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {publicationHistory.map((post, idx) => (
                        <div key={post.id || post.wpId || `post-${idx}`} className={cn(
                           "rounded-lg border-4 p-6 flex flex-col md:flex-row md:items-center justify-between transition-all group gap-6 overflow-hidden relative",
                           settings.theme === 'dark' ? "bg-slate-950 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-indigo-500",
                           selectedPosts.has(post.id!) && (settings.theme === 'dark' ? "border-indigo-600 bg-indigo-600/5" : "border-indigo-500 bg-indigo-50")
                        )}>
                      <div className="flex items-center gap-6 w-full md:w-auto min-w-0">
                        <div 
                          onClick={() => {
                            const newSelected = new Set(selectedPosts);
                            if (newSelected.has(post.id!)) newSelected.delete(post.id!);
                            else newSelected.add(post.id!);
                            setSelectedPosts(newSelected);
                          }}
                          className={cn(
                            "w-14 h-14 rounded-lg flex items-center justify-center border-2 transition-all shrink-0 cursor-pointer",
                            selectedPosts.has(post.id!) ? "bg-indigo-600 border-indigo-600" : "bg-slate-900/10 border-slate-800 group-hover:border-indigo-500"
                          )}
                        >
                          {selectedPosts.has(post.id!) ? <CheckCircle2 className="w-6 h-6 text-white" /> : (post.status === 'published' ? <CheckCircle2 className="w-6 h-6 text-slate-500 opacity-30" /> : <Layers className="w-6 h-6 text-slate-500 opacity-30" />)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-4 mb-2 min-w-0">
                            <h3 className={cn(
                              "font-black text-lg transition-colors line-clamp-2 sm:line-clamp-3 uppercase tracking-tighter flex-1 leading-tight",
                              settings.theme === 'dark' ? "text-white group-hover:text-indigo-400" : "text-slate-900 group-hover:text-indigo-600"
                            )}>{post.title}</h3>
                            {post.recurrence && post.recurrence !== 'none' && (
                              <div className="px-2 py-1 bg-indigo-600/20 border border-indigo-500/50 rounded text-[8px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1 shrink-0 mt-1">
                                <Layers className="w-2.5 h-2.5" />
                                {post.recurrence}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 mt-1">
                            <span className={cn(
                              "text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded border-2",
                              post.status === 'published' ? "bg-emerald-600 text-white border-emerald-700" : (post.status === 'scheduled' ? "bg-amber-600 text-white border-amber-700" : "bg-slate-600 text-white border-slate-700")
                            )}>
                              {post.status}
                            </span>
                            {post.scheduledAt && <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(post.scheduledAt).toLocaleDateString()}</span>}
                            {post.wpId && <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Node ID: {post.wpId}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-4 w-full md:w-auto justify-end">
                        {post.status === 'published' && (
                          <>
                            <button 
                              onClick={async () => {
                                const images = await loadImagesForPost(post.id!);
                                setBlogDraft({ ...post, ...images }); 
                                handleIndexRequest();
                              }}
                              className={cn(
                                "px-5 py-2.5 border-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest",
                                settings.theme === 'dark' ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600"
                              )}
                            >
                              Index
                            </button>
                            <a 
                              href={`${settings.wpUrl}/?p=${post.wpId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-5 py-2.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-all border-2 border-indigo-700 uppercase tracking-widest"
                            >
                              <ExternalLink className="w-3 h-3" /> View
                            </a>
                          </>
                        )}
                        <button 
                          onClick={async () => {
                            const images = await loadImagesForPost(post.id!);
                            setBlogDraft({ ...post, ...images });
                            setActiveTab('optimizer');
                          }}
                          className={cn(
                            "px-4 py-2.5 border-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest",
                            settings.theme === 'dark' ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600"
                          )}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id, post.title)}
                          className={cn(
                            "p-2.5 rounded-lg border-2 transition-all group/del",
                            settings.theme === 'dark' ? "border-slate-800 hover:border-red-500/50 hover:bg-red-500/10" : "border-slate-200 hover:border-red-500/50 hover:bg-red-50"
                          )}
                          title="Delete from history"
                        >
                          <Trash2 className="w-4 h-4 text-slate-500 group-hover/del:text-red-500 transition-colors" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {publicationHistory.length === 0 && (
                    <div className={cn(
                      "py-48 text-center border-4 border-dashed rounded-lg transition-all",
                      settings.theme === 'dark' ? "bg-slate-950 border-slate-900" : "bg-slate-50 border-slate-200"
                    )}>
                      <Database className="w-16 h-16 text-slate-800 mx-auto mb-6" />
                      <p className={cn("text-base font-black uppercase tracking-widest", settings.theme === 'dark' ? "text-slate-400" : "text-slate-600")}>Buffer Empty</p>
                      <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest font-black">History segment search yielded null</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'sops' && (
              <motion.div 
                key="sops"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className={cn(
                  "rounded-lg border-4 p-6 sm:p-12 transition-all",
                  settings.theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
                )}>
                  <div className="flex items-center gap-4 mb-10">
                    <div className="p-3 bg-indigo-600 rounded-lg">
                      <FileEdit className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className={cn("font-black text-2xl tracking-tighter uppercase transition-all", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>Protocols</h3>
                      <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mt-1">AI content constraint engineering</p>
                    </div>
                  </div>

                  {/* Blueprint Library */}
                  <div className="mb-12 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocol Blueprint Library</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text"
                          placeholder="Blueprint Name..."
                          value={blueprintName || ''}
                          onChange={(e) => setBlueprintName(e.target.value)}
                          className={cn(
                            "px-3 py-1.5 text-[10px] uppercase font-bold rounded border transition-all",
                            settings.theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-700"
                          )}
                        />
                        <button 
                          onClick={saveBlueprint}
                          disabled={isSavingBlueprint || !blueprintName.trim()}
                          className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-600/20 rounded text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          {isSavingBlueprint ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Save Blueprint'}
                        </button>
                      </div>
                    </div>

                    {blueprints.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {blueprints.map((blueprint) => (
                          <div 
                            key={blueprint.id}
                            className={cn(
                              "group relative p-4 rounded-lg border-2 transition-all cursor-pointer",
                              activeBlueprint === blueprint.id 
                                ? "border-indigo-600 bg-indigo-600/5 ring-1 ring-indigo-600" 
                                : settings.theme === 'dark' ? "bg-slate-900/50 border-slate-900 hover:border-slate-700" : "bg-white border-slate-100 hover:border-slate-300"
                            )}
                            onClick={() => loadBlueprint(blueprint)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2 mb-1">
                                <Zap className={cn("w-3 h-3", activeBlueprint === blueprint.id ? "text-indigo-400" : "text-slate-600")} />
                                <span className={cn("text-[10px] font-black uppercase tracking-tight", activeBlueprint === blueprint.id ? "text-white" : "text-slate-400")}>{blueprint.name}</span>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (blueprint.id) deleteBlueprint(blueprint.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed">
                              {blueprint.sopModels?.content || 'Standard'} • {blueprint.targetWordCount} Words
                            </p>
                            {activeBlueprint === blueprint.id && (
                              <div className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white p-0.5 rounded-full shadow-lg">
                                <CheckCircle2 className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={cn(
                        "p-8 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center",
                        settings.theme === 'dark' ? "border-slate-900 bg-slate-950/50" : "border-slate-100 bg-slate-50/50"
                      )}>
                        <Brain className="w-8 h-8 text-slate-800 mb-2 opacity-50" />
                        <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">No blueprints saved yet</p>
                        <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest mt-1">Define your protocols below and hit save</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    <div className="md:col-span-3">
                      <div className={cn(
                        "rounded-lg border-4 p-8 transition-all relative overflow-hidden",
                        settings.theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200 shadow-xl shadow-indigo-100/20"
                      )}>
                        <div className="flex items-center gap-4 mb-8">
                          <div className="p-3 bg-indigo-600 rounded-lg shrink-0">
                            <Globe className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className={cn("font-black text-xl tracking-tighter uppercase", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>Search Grounding Intelligence</h3>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Real-time "People Also Ask" & LSI Semantic Extraction</p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 mb-8">
                          <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                              type="text"
                              placeholder="Enter Primary Content Keyword..."
                              className={cn(
                                "w-full pl-12 pr-4 py-4 rounded-lg border-2 font-black text-sm transition-all focus:outline-none focus:border-indigo-500 uppercase tracking-tight",
                                settings.theme === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                              )}
                              value={groundingKeyword}
                              onChange={(e) => setGroundingKeyword(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleGrounding()}
                            />
                          </div>
                          <button 
                            onClick={handleGrounding}
                            disabled={isGrounding}
                            className={cn(
                              "px-8 py-4 rounded-lg font-black text-xs flex items-center justify-center gap-3 transition-all active:scale-95 uppercase tracking-widest",
                              isGrounding ? "bg-slate-800 text-slate-600 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20"
                            )}
                          >
                            {isGrounding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                            {isGrounding ? "Grounding..." : "Execute Grounding"}
                          </button>
                        </div>

                        {groundingResults && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <HelpCircle className="w-4 h-4 text-indigo-400" />
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">People Also Ask (PAA)</h4>
                              </div>
                              <div className="space-y-2">
                                {groundingResults.paa.map((q, i) => (
                                  <div key={i} className={cn(
                                    "p-3 rounded border-2 text-[11px] font-bold transition-all hover:border-indigo-500/50",
                                    settings.theme === 'dark' ? "bg-slate-900/50 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-100 text-slate-700"
                                  )}>
                                    {q}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <List className="w-4 h-4 text-indigo-400" />
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">LSI Semantic Keywords</h4>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {groundingResults.lsi.map((l, i) => (
                                  <span key={i} className={cn(
                                    "px-3 py-1.5 rounded border-2 text-[10px] font-black uppercase tracking-tight transition-all hover:bg-indigo-600 hover:text-white hover:border-indigo-600 cursor-default",
                                    settings.theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-white border-slate-200 text-slate-600"
                                  )}>
                                    {l}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-8 pt-6 border-t border-dashed border-slate-800/50">
                                <button
                                  onClick={() => {
                                    const lsiStr = groundingResults.lsi.join(', ');
                                    const paaStr = groundingResults.paa.join('\n- ');
                                    setSettings({
                                      ...settings,
                                      prompts: {
                                        ...settings.prompts,
                                        content: settings.prompts.content + `\n\n[CONTEXT: Include analysis of these LSI keywords: ${lsiStr}. Answer these PAAs if relevant: \n- ${paaStr}]`
                                      }
                                    });
                                    showNotification("Injected research into Content Directives", "success");
                                  }}
                                  className="w-full py-3 bg-indigo-600/10 border-2 border-indigo-600/20 text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  Inject Intelligence into Content Directives
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-end px-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Content Length</label>
                        <span className="text-xs font-mono font-bold text-indigo-400">{settings.targetWordCount} Words</span>
                      </div>
                      <input 
                        type="range"
                        min="500"
                        max="5000"
                        step="100"
                        value={settings.targetWordCount || 1200}
                        onChange={(e) => setSettings({ ...settings, targetWordCount: parseInt(e.target.value) })}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">
                        <span>Short (500)</span>
                        <span>Authority (5000)</span>
                      </div>
                      {competitors.length > 0 && (
                        <button 
                          onClick={() => {
                            const avg = Math.round(competitors.reduce((acc, curr) => acc + curr.wordCount, 0) / competitors.length);
                            const rec = Math.min(Math.max(Math.round(avg * 1.15 / 100) * 100, 500), 5000);
                            setSettings({...settings, targetWordCount: rec});
                            showNotification(`Intelligence Sync: Target set to ${rec} words`, 'success');
                          }}
                          className="w-full mt-2 py-2 border-2 border-dashed border-indigo-600/30 rounded text-[8px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-600/10 hover:border-indigo-500 transition-all flex items-center justify-center gap-2"
                        >
                          <TrendingUp className="w-3 h-3" />
                          Sync with Competitor Depth
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Semantic Intelligence</label>
                      <button 
                        onClick={() => setSettings({...settings, lsiKeywords: !settings.lsiKeywords})}
                        className={cn(
                          "w-full py-3.5 rounded-lg border-2 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all",
                          settings.lsiKeywords 
                            ? "bg-indigo-600/10 border-indigo-600/40 text-indigo-400" 
                            : "bg-slate-900 border-slate-800 text-slate-500 grayscale"
                        )}
                      >
                        <Brain className={cn("w-4 h-4", settings.lsiKeywords && "animate-pulse")} />
                        {settings.lsiKeywords ? 'LSI Optimization Active' : 'LSI Analysis Disabled'}
                      </button>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">FAQ Intelligence</label>
                      <button 
                        onClick={() => setSettings({...settings, includeFaqs: !settings.includeFaqs})}
                        className={cn(
                          "w-full py-3.5 rounded-lg border-2 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all",
                          settings.includeFaqs 
                            ? "bg-indigo-600/10 border-indigo-600/40 text-indigo-400" 
                            : "bg-slate-900 border-slate-800 text-slate-500 grayscale"
                        )}
                      >
                        <MessageSquare className={cn("w-4 h-4", settings.includeFaqs && "animate-pulse")} />
                        {settings.includeFaqs ? 'FAQ Strategy Active' : 'FAQ Segment Scoped Out'}
                      </button>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Conclusion Logic</label>
                      <button
                        onClick={() => setSettings({...settings, includeConclusion: !settings.includeConclusion})}
                        className={cn(
                          "w-full py-3.5 rounded-lg border-2 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all",
                          settings.includeConclusion
                            ? "bg-indigo-600/10 border-indigo-600/40 text-indigo-400"
                            : "bg-slate-900 border-slate-800 text-slate-500 grayscale"
                        )}
                      >
                        <ShieldCheck className={cn("w-4 h-4", settings.includeConclusion && "animate-pulse")} />
                        {settings.includeConclusion ? 'Conclusion Active' : 'Conclusion Disabled'}
                      </button>
                    </div>


                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Visual Anchoring</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['random', 'after-h2', 'after-h3'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setSettings({...settings, imagePlacement: mode})}
                            className={cn(
                              "py-3 rounded-lg border-2 font-black text-[9px] uppercase tracking-tighter transition-all",
                              settings.imagePlacement === mode 
                                ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20" 
                                : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700"
                            )}
                          >
                            {mode.replace('-', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-10">
                    <SopInput 
                      label="01. Title Generation Directive" 
                      value={settings.prompts.title} 
                      onChange={(v) => setSettings({ ...settings, prompts: { ...settings.prompts, title: v } })} 
                      selectedModel={settings.sopModels?.title}
                      onModelChange={(m) => setSettings({ ...settings, sopModels: { ...settings.sopModels!, title: m } })}
                      theme={settings.theme}
                      tip="CTR maximization engineering"
                    />
                    <SopInput 
                      label="Meta Description Architecture Protocol" 
                      value={settings.prompts.metaDescription} 
                      onChange={(v) => setSettings({ ...settings, prompts: { ...settings.prompts, metaDescription: v } })} 
                      selectedModel={settings.sopModels?.metaDescription}
                      onModelChange={(m) => setSettings({ ...settings, sopModels: { ...settings.sopModels!, metaDescription: m } })}
                      theme={settings.theme}
                      tip="SERP snippet high-conversion engineering"
                    />
                    <SopInput 
                      label="02. Introduction Directive" 
                      value={settings.prompts.introduction} 
                      onChange={(v) => setSettings({ ...settings, prompts: { ...settings.prompts, introduction: v } })} 
                      selectedModel={settings.sopModels?.introduction}
                      onModelChange={(m) => setSettings({ ...settings, sopModels: { ...settings.sopModels!, introduction: m } })}
                      theme={settings.theme}
                      tip="User retention & gap acknowledgment"
                    />
                    <SopInput 
                      label="03. Main Content Protocol" 
                      value={settings.prompts.content} 
                      onChange={(v) => setSettings({ ...settings, prompts: { ...settings.prompts, content: v } })} 
                      selectedModel={settings.sopModels?.content}
                      onModelChange={(m) => setSettings({ ...settings, sopModels: { ...settings.sopModels!, content: m } })}
                      long
                      theme={settings.theme}
                      tip="Topical density & inverted pyramid"
                    />
                    {settings.includeFaqs && (
                      <SopInput 
                        label="04. FAQ Integration Directive" 
                        value={settings.prompts.faq} 
                        onChange={(v) => setSettings({ ...settings, prompts: { ...settings.prompts, faq: v } })} 
                        selectedModel={settings.sopModels?.faq}
                        onModelChange={(m) => setSettings({ ...settings, sopModels: { ...settings.sopModels!, faq: m } })}
                        theme={settings.theme}
                        tip="PAA trigger optimization"
                      />
                    )}
                    {settings.lsiKeywords && (
                      <SopInput 
                        label="LSI Semantic Optimization Protocol" 
                        value={settings.prompts.lsi} 
                        onChange={(v) => setSettings({ ...settings, prompts: { ...settings.prompts, lsi: v } })} 
                        selectedModel={settings.sopModels?.lsi}
                        onModelChange={(m) => setSettings({ ...settings, sopModels: { ...settings.sopModels!, lsi: m } })}
                        theme={settings.theme}
                        long
                        tip="Latent semantic indexing logic"
                      />
                    )}
                    <SopInput 
                      label="05. Conclusion Directive" 
                      value={settings.prompts.conclusion} 
                      onChange={(v) => setSettings({ ...settings, prompts: { ...settings.prompts, conclusion: v } })} 
                      selectedModel={settings.sopModels?.conclusion}
                      onModelChange={(m) => setSettings({ ...settings, sopModels: { ...settings.sopModels!, conclusion: m } })}
                      theme={settings.theme}
                      long
                      tip="CTA urgency & value reinforcement"
                    />
                  </div>

                  <div className="flex justify-end pt-12">
                    <button 
                      onClick={handleSaveSettings}
                      className="px-10 py-4 bg-indigo-600 text-white rounded-lg font-black text-sm flex items-center gap-3 hover:bg-indigo-700 transition-all border-2 border-indigo-600 active:scale-95 uppercase tracking-widest"
                    >
                      <Save className="w-5 h-5" /> Lock Protocols
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'setup' && (
              <motion.div 
                key="setup"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-2xl mx-auto space-y-8 pb-12"
              >
                <div className={cn(
                  "rounded-lg border-4 p-6 sm:p-12 transition-all",
                  settings.theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
                )}>
                  <div className="flex items-center gap-4 mb-10">
                    <div className="p-3 bg-indigo-600 rounded-lg">
                      <Globe className="w-6 h-6 text-white" />
                    </div>
                    <h3 className={cn("font-black text-2xl tracking-tighter uppercase", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>WordPress</h3>
                  </div>
                  <div className="space-y-8">
                    <InputGroup label="Root URL" placeholder="https://yourblog.com" value={settings.wpUrl} onChange={(v) => setSettings({...settings, wpUrl: v})} theme={settings.theme} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <InputGroup label="WP Username" placeholder="admin" value={settings.wpUsername} onChange={(v) => setSettings({...settings, wpUsername: v})} theme={settings.theme} />
                      <InputGroup label="App Password" placeholder="xxxx xxxx xxxx xxxx" type="password" value={settings.wpAppPassword} onChange={(v) => setSettings({...settings, wpAppPassword: v})} theme={settings.theme} />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-12">
                    <button 
                      onClick={testWordPressConnection}
                      className={cn(
                        "px-8 py-4 rounded-lg font-black text-[10px] flex items-center gap-3 transition-all border-2 uppercase tracking-[0.2em]",
                        settings.theme === 'dark' ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600"
                      )}
                    >
                      <RefreshCw className="w-4 h-4" /> Test Neural Node
                    </button>
                    <button 
                      onClick={handleSaveSettings}
                      className="px-10 py-4 bg-indigo-600 text-white rounded-lg font-black text-[10px] flex items-center gap-3 hover:bg-indigo-700 transition-all border-2 border-indigo-700 active:scale-95 uppercase tracking-[0.2em]"
                    >
                      <Save className="w-5 h-5" /> Save WordPress Node
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto space-y-8 pb-12"
              >
                <div className={cn(
                  "rounded-lg border-4 p-6 sm:p-12 transition-all",
                  settings.theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
                )}>
                  <div className="flex items-center justify-between gap-4 mb-10">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-indigo-600 rounded-lg">
                        <Zap className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className={cn("font-black text-2xl tracking-tighter uppercase", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>AI Intelligence Engine</h3>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Multi-Provider Neural Network Configuration</p>
                      </div>
                    </div>
                    {settings.aiModel && (
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Active Core</span>
                        <div className="px-3 py-1 bg-indigo-600/10 border border-indigo-500/50 rounded-full text-[9px] font-mono font-black text-indigo-400 uppercase tracking-tighter">
                          {settings.aiModel}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-10">
                    <div className="bg-slate-900/40 rounded-xl p-2 border-2 border-slate-900 flex flex-wrap gap-1">
                      {[
                        { id: 'google', label: 'Google Gemini', icon: <Bot className="w-3.5 h-3.5" /> },
                        { id: 'openai', label: 'OpenAI GPT', icon: <Brain className="w-3.5 h-3.5" /> },
                        { id: 'anthropic', label: 'Anthropic Claude', icon: <Cpu className="w-3.5 h-3.5" /> }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveProviderTab(tab.id as any)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all",
                            activeProviderTab === tab.id 
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                          )}
                        >
                          {tab.icon}
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="min-h-[400px]">
                      <AnimatePresence mode="wait">
                        {activeProviderTab === 'google' && (
                          <motion.div
                            key="google-settings"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-8"
                          >
                            <div className="space-y-4">
                              <div className="flex items-center justify-between px-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Gemini Core</label>
                                <span className="text-[8px] italic text-slate-600 font-bold uppercase">Self-Grounding Enabled</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   {[
                                    { id: 'models/gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Default — best balance of speed and quality' },
                                    { id: 'models/gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', desc: 'Ultra-fast, lowest cost option' },
                                  ].map((model) => (
                                  <button
                                    key={model.id}
                                    onClick={() => setSettings({...settings, aiModel: model.id})}
                                    className={cn(
                                      "flex flex-col items-start p-5 rounded-xl border-2 transition-all text-left relative group",
                                      settings.aiModel === model.id 
                                        ? "border-indigo-600 bg-indigo-600/10" 
                                        : (settings.theme === 'dark' ? "border-slate-800 bg-slate-900/30 hover:border-slate-700" : "border-slate-200 bg-white hover:border-indigo-200")
                                    )}
                                  >
                                    <p className={cn("text-xs font-black uppercase tracking-tighter mb-1", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>{model.name}</p>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-normal">{model.desc}</p>
                                    {settings.aiModel === model.id && (
                                      <div className="absolute top-4 right-4 text-indigo-500">
                                        <Zap className="w-4 h-4 fill-current" />
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                              <div className="flex justify-end pt-2">
                                <button
                                  onClick={() => {
                                    setSettings({
                                      ...settings,
                                      sopModels: { title: '', introduction: '', content: '', faq: '', conclusion: '', lsi: '' }
                                    });
                                    showNotification("All protocol nodes reset to follow global model", "success");
                                  }}
                                  className="text-[9px] font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-widest flex items-center gap-2 group transition-all"
                                >
                                  <Layers className="w-3 h-3 group-hover:rotate-12 transition-transform" />
                                  Sync All Protocol Nodes to Global
                                </button>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <InputGroup 
                                label="Gemini API Key" 
                                placeholder="Enter your AI Studio key..." 
                                value={settings.geminiKey || ''} 
                                onChange={(v) => setSettings({...settings, geminiKey: v})} 
                                type="password" 
                                theme={settings.theme} 
                              />
                              <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-[9px] text-amber-500/80 uppercase font-black tracking-widest leading-relaxed">
                                  Defaulting to system-integrated key. Providing a custom key will isolate your protocol usage from the main cluster.
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {activeProviderTab === 'openai' && (
                          <motion.div
                            key="openai-settings"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-8"
                          >
                            <div className="space-y-4">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Select GPT Instance</label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Smart, affordable — best value for SEO' },
                                  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', desc: 'Fastest and cheapest GPT option' }
                                ].map((model) => (
                                  <button
                                    key={model.id}
                                    onClick={() => setSettings({...settings, aiModel: model.id})}
                                    className={cn(
                                      "flex flex-col items-start p-5 rounded-xl border-2 transition-all text-left relative group",
                                      settings.aiModel === model.id 
                                        ? "border-indigo-600 bg-indigo-600/10" 
                                        : (settings.theme === 'dark' ? "border-slate-800 bg-slate-900/30 hover:border-slate-700" : "border-slate-200 bg-white hover:border-indigo-200")
                                    )}
                                  >
                                    <p className={cn("text-xs font-black uppercase tracking-tighter mb-1", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>{model.name}</p>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-normal">{model.desc}</p>
                                    {settings.aiModel === model.id && (
                                      <div className="absolute top-4 right-4 text-indigo-500">
                                        <CheckCircle2 className="w-4 h-4" />
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                              <div className="flex justify-end pt-2">
                                <button
                                  onClick={() => {
                                    setSettings({
                                      ...settings,
                                      sopModels: { title: '', introduction: '', content: '', faq: '', conclusion: '', lsi: '' }
                                    });
                                    showNotification("All protocol nodes reset to follow global model", "success");
                                  }}
                                  className="text-[9px] font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-widest flex items-center gap-2 group transition-all"
                                >
                                  <Layers className="w-3 h-3 group-hover:rotate-12 transition-transform" />
                                  Sync All Protocol Nodes to Global
                                </button>
                              </div>
                            </div>
                            
                            <InputGroup 
                              label="OpenAI Private Access Secret" 
                              placeholder="sk-..." 
                              value={settings.openaiKey || ''} 
                              onChange={(v) => setSettings({...settings, openaiKey: v})} 
                              type="password" 
                              theme={settings.theme} 
                            />
                          </motion.div>
                        )}

                        {activeProviderTab === 'anthropic' && (
                          <motion.div
                            key="anthropic-settings"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-8"
                          >
                            <div className="space-y-4">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Select Claude Model</label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', desc: 'Latest, fastest, most affordable Claude' },
                                  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', desc: 'Proven fast and low-cost' }
                                ].map((model) => (
                                  <button
                                    key={model.id}
                                    onClick={() => setSettings({...settings, aiModel: model.id})}
                                    className={cn(
                                      "flex flex-col items-start p-5 rounded-xl border-2 transition-all text-left relative group",
                                      settings.aiModel === model.id 
                                        ? "border-indigo-600 bg-indigo-600/10" 
                                        : (settings.theme === 'dark' ? "border-slate-800 bg-slate-900/30 hover:border-slate-700" : "border-slate-200 bg-white hover:border-indigo-200")
                                    )}
                                  >
                                    <p className={cn("text-xs font-black uppercase tracking-tighter mb-1", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>{model.name}</p>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-normal">{model.desc}</p>
                                    {settings.aiModel === model.id && (
                                      <div className="absolute top-4 right-4 text-indigo-500">
                                        <Cpu className="w-4 h-4" />
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                              <div className="flex justify-end pt-2">
                                <button
                                  onClick={() => {
                                    setSettings({
                                      ...settings,
                                      sopModels: { title: '', introduction: '', content: '', faq: '', conclusion: '', lsi: '' }
                                    });
                                    showNotification("All protocol nodes reset to follow global model", "success");
                                  }}
                                  className="text-[9px] font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-widest flex items-center gap-2 group transition-all"
                                >
                                  <Layers className="w-3 h-3 group-hover:rotate-12 transition-transform" />
                                  Sync All Protocol Nodes to Global
                                </button>
                              </div>
                            </div>
                            
                            <InputGroup 
                              label="Anthropic User Secret Key" 
                              placeholder="sk-ant-..." 
                              value={settings.anthropicKey || ''} 
                              onChange={(v) => setSettings({...settings, anthropicKey: v})} 
                              type="password" 
                              theme={settings.theme} 
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="flex justify-end pt-8 border-t-2 border-slate-900/50 mt-10">
                    <button 
                      onClick={handleSaveSettings}
                      className="px-10 py-4 bg-indigo-600 text-white rounded-lg font-black text-[10px] flex items-center gap-3 hover:bg-indigo-700 transition-all border-2 border-indigo-700 active:scale-95 uppercase tracking-[0.2em]"
                    >
                      <Save className="w-5 h-5" /> Sync AI Node
                    </button>
                  </div>
                </div>

                <div className={cn(
                  "rounded-lg border-4 p-6 sm:p-12 transition-all space-y-8",
                  settings.theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
                )}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-indigo-600 rounded-lg">
                      <Layout className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className={cn("font-black text-2xl tracking-tighter uppercase", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>Preferences</h3>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Interface & Content Parameters</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className={cn(
                      "flex items-center justify-between p-6 rounded-lg border-2 transition-all",
                      settings.theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
                    )}>
                      <div className="flex-1">
                        <p className={cn("text-sm font-bold", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>Target Length</p>
                        <p className="text-[10px] text-slate-500 uppercase font-medium mt-1">Approximate word count per article</p>
                      </div>
                      <div className="w-32">
                        <input 
                          type="number"
                          value={settings.targetWordCount || 1200}
                          onChange={(e) => setSettings({ ...settings, targetWordCount: parseInt(e.target.value) || 1200 })}
                          className={cn(
                            "w-full px-4 py-2 rounded-lg border-2 font-black text-xs transition-all focus:outline-none focus:border-indigo-500",
                            settings.theme === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                          )}
                        />
                      </div>
                    </div>

                    <div className={cn(
                      "flex items-center justify-between p-6 rounded-lg border-2 transition-all",
                      settings.theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-100"
                    )}>
                      <div>
                        <p className={cn("text-sm font-bold", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>Visual Theme</p>
                        <p className="text-[10px] text-slate-500 uppercase font-medium mt-1">Interface aesthetics</p>
                      </div>
                      <div className={cn("flex rounded-lg p-1 border-2", settings.theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                        <button 
                          onClick={() => setSettings({...settings, theme: 'dark'})}
                          className={cn("px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all", settings.theme === 'dark' ? "bg-indigo-600 text-white" : "text-slate-500")}
                        >
                          Dark
                        </button>
                        <button 
                          onClick={() => setSettings({...settings, theme: 'light'})}
                          className={cn("px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all", settings.theme === 'light' ? "bg-indigo-600 text-white" : "text-slate-500")}
                        >
                          Light
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "rounded-lg border-4 p-6 sm:p-12 transition-all",
                  settings.theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
                )}>
                  <div className="flex items-center gap-4 mb-10">
                    <div className="p-3 bg-indigo-600 rounded-lg">
                      <Search className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className={cn("font-black text-2xl tracking-tighter uppercase", settings.theme === 'dark' ? "text-white" : "text-slate-900")}>Search Console</h3>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Performance Data Integrity</p>
                    </div>
                  </div>
                  <InputGroup label="Property URL" placeholder="https://yourblog.com/" value={settings.gscProperty} onChange={(v) => setSettings({...settings, gscProperty: v})} theme={settings.theme} />
                </div>

                <div className="flex justify-end pt-6">
                  <button 
                    onClick={handleSaveSettings}
                    className="px-10 py-4 bg-indigo-600 text-white rounded-lg font-black text-[10px] flex items-center gap-3 hover:bg-indigo-700 transition-all border-2 border-indigo-700 active:scale-95 uppercase tracking-[0.2em]"
                  >
                    <Save className="w-5 h-5" /> Sync Global Prefs
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Global Hidden Image Input for Managed Uploads */}
      <input 
        type="file" 
        ref={fileInputRef}
        className="hidden" 
        accept="image/*" 
        onChange={handleImageUpload} 
      />

      {/* Global Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={cn(
              "fixed bottom-8 right-8 max-w-sm rounded-lg text-white font-black text-xs border-4 flex flex-col z-[100] shadow-2xl",
              notification.type === 'success' ? "bg-indigo-600 border-indigo-700 shadow-indigo-500/20" : 
              notification.type === 'warning' ? "bg-amber-500 border-amber-600 shadow-amber-500/20" :
              "bg-red-600 border-red-700 shadow-red-500/20"
            )}
          >
            <div className="flex items-center gap-3 px-6 py-4">
              {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : 
               notification.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> :
               <AlertCircle className="w-5 h-5" />}
              <span className="uppercase tracking-widest">{notification.message}</span>
            </div>
            {notification.detail && (
              <div className="px-6 pb-4 border-t border-white/10 pt-3">
                <p className="text-[10px] lowercase font-mono opacity-80 leading-relaxed break-words">{notification.detail}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && blogDraft && (
          <PreviewModal 
            blogDraft={blogDraft} 
            onClose={() => setShowPreview(false)} 
            theme={settings.theme}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function SectionImageGroup({ 
  type, 
  index, 
  sectionTitle, 
  sectionContent, 
  draft, 
  onDraftUpdate, 
  engineerPrompt, 
  generateImage, 
  theme 
}: { 
  type: 'featured' | 'content', 
  index?: number, 
  sectionTitle: string, 
  sectionContent: string, 
  draft: BlogPost, 
  onDraftUpdate: React.Dispatch<React.SetStateAction<BlogPost | null>>, 
  engineerPrompt: (text: string, ctx: string) => Promise<string>,
  generateImage: (prompt: string, type: 'featured' | 'content', index?: number) => Promise<void>,
  theme: 'light' | 'dark'
}) {
  const currentImage = index !== undefined ? draft.contentImages?.[index] : draft.featuredImage;
  const [localPrompt, setLocalPrompt] = React.useState(currentImage?.prompt || '');

  React.useEffect(() => {
    if (currentImage?.prompt) setLocalPrompt(currentImage.prompt);
  }, [currentImage?.prompt]);

  const handleAutoPrompt = async () => {
    const p = await engineerPrompt(sectionContent, `Article Title: ${draft.title}. Section: ${sectionTitle}`);
    if (p) {
      setLocalPrompt(p);
      onDraftUpdate(prev => {
        if (!prev) return prev;
        const updated = { ...prev };
        if (type === 'featured') {
          updated.featuredImage = { 
            ...(updated.featuredImage || { url: '', alt: draft.title, filename: '', title: draft.title }), 
            prompt: p 
          };
        } else if (index !== undefined) {
          if (!updated.contentImages) updated.contentImages = [];
          updated.contentImages[index] = { 
            ...(updated.contentImages[index] || { url: '', alt: sectionTitle, filename: '' }), 
            prompt: p 
          };
        }
        return updated;
      });
    }
  };

  const handleGenerate = () => {
    generateImage(localPrompt, type, index);
  };

  return (
    <div className={cn(
      "mt-4 p-4 rounded-lg border-2 border-dashed transition-all",
      theme === 'dark' ? "bg-slate-900/30 border-slate-800" : "bg-slate-50 border-slate-200"
    )}>
      <div className="flex items-center justify-between mb-4">
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Section Visual: {sectionTitle}</label>
        <button 
          onClick={handleAutoPrompt}
          className="text-[8px] font-black uppercase text-indigo-500 flex items-center gap-1 hover:text-indigo-400 transition-colors"
        >
          <Bot className="w-3 h-3" /> Auto-Prompt from Section
        </button>
      </div>

      <div className="flex gap-4">
        {currentImage?.url ? (
          <div className="w-32 h-20 rounded border-2 border-slate-800 overflow-hidden shrink-0 group relative">
            <img 
              src={currentImage.url} 
              alt={currentImage.alt} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <button 
              onClick={() => {
                onDraftUpdate(prev => {
                  if (!prev) return prev;
                  const updated = { ...prev };
                  if (type === 'featured') {
                    if (updated.featuredImage) updated.featuredImage = { ...updated.featuredImage, url: '' };
                  } else if (index !== undefined && updated.contentImages) {
                    const newImages = [...updated.contentImages];
                    newImages[index] = { ...newImages[index], url: '' };
                    updated.contentImages = newImages;
                  }
                  return updated;
                });
              }}
              className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="w-32 h-20 rounded border-2 border-slate-800 bg-slate-950 flex items-center justify-center shrink-0">
            <ImageIcon className="w-6 h-6 text-slate-800" />
          </div>
        )}

        <div className="flex-1 space-y-2">
          <textarea 
            value={localPrompt || ''}
            onChange={(e) => {
              const val = e.target.value;
              setLocalPrompt(val);
              onDraftUpdate(prev => {
                if (!prev) return prev;
                const updated = { ...prev };
                if (type === 'featured') {
                  updated.featuredImage = { 
                    ...(updated.featuredImage || { url: '', alt: draft.title, filename: '', title: draft.title }), 
                    prompt: val 
                  };
                } else if (index !== undefined) {
                  if (!updated.contentImages) updated.contentImages = [];
                  updated.contentImages[index] = { 
                    ...(updated.contentImages[index] || { url: '', alt: sectionTitle, filename: '' }), 
                    prompt: val
                  };
                }
                return updated;
              });
            }}
            placeholder="Visual generation prompt..."
            className={cn(
              "w-full bg-slate-950 border-2 border-slate-800 rounded py-2 px-3 text-[10px] text-white focus:outline-none focus:border-indigo-600 font-mono min-h-[40px] resize-none",
              theme === 'dark' ? "" : "bg-white border-slate-200 text-black shadow-inner"
            )}
          />
          <button 
            disabled={!localPrompt}
            onClick={handleGenerate}
            className="w-full py-2 bg-indigo-600 text-white rounded font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-30"
          >
            <Zap className="w-3 h-3" /> Generate Section Asset
          </button>
        </div>
      </div>
    </div>
  );
}

function VisualGallery({ featuredImage, contentImages, theme, aspectRatio, onAspectRatioChange, onAction, onUpload }: { 
  featuredImage?: any, 
  contentImages?: any[], 
  theme: 'light' | 'dark',
  aspectRatio?: string,
  onAspectRatioChange?: (ratio: any) => void,
  onAction?: (type: 'featured' | 'content', index?: number) => void,
  onUpload?: (type: 'featured' | 'content', index?: number) => void
}) {
  const images = [
    ...(featuredImage?.url ? [{ ...featuredImage, type: 'Featured', nativeType: 'featured' }] : []),
    ...(contentImages?.filter(img => img.url).map((img, idx) => ({ ...img, type: 'In-Content', nativeType: 'content', index: idx })) || [])
  ];

  const aspectRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className={cn(
          "text-[10px] uppercase tracking-[0.3em] font-black flex items-center gap-2",
          theme === 'dark' ? "text-indigo-400" : "text-indigo-600"
        )}>
          <ImageIcon className="w-3 h-3" /> Visual Asset Ecosystem ({images.length})
        </h3>
        
        {onAspectRatioChange && (
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Ratio:</span>
            <div className={cn(
              "flex p-1 rounded-lg border",
              theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200"
            )}>
              {aspectRatios.map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => onAspectRatioChange(ratio)}
                  className={cn(
                    "px-2 py-1 rounded text-[8px] font-black transition-all",
                    aspectRatio === ratio
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (onUpload) {
                const nextIdx = (contentImages?.length || 0);
                onUpload('content', nextIdx);
              }
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg border-2 border-dashed text-[8px] font-black uppercase tracking-widest flex items-center gap-2 transition-all",
              theme === 'dark' ? "border-slate-800 text-slate-500 hover:border-emerald-500 hover:text-emerald-400" : "border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-500"
            )}
          >
            <Upload className="w-3 h-3" /> Upload Node
          </button>
          <button 
            onClick={() => {
              if (onAction) {
                const nextIdx = (contentImages?.length || 0);
                onAction('content', nextIdx);
              }
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg border-2 border-dashed text-[8px] font-black uppercase tracking-widest flex items-center gap-2 transition-all",
              theme === 'dark' ? "border-slate-800 text-slate-500 hover:border-indigo-500 hover:text-indigo-400" : "border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-500"
            )}
          >
            <Plus className="w-3 h-3" /> Add Vision Node
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {images.map((img, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className={cn(
              "group relative overflow-hidden rounded-lg border-2 transition-all hover:border-indigo-500",
              theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}
          >
            <div className="aspect-video relative overflow-hidden">
              <img 
                src={img.url} 
                alt={img.alt} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-3 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                <p className="text-[8px] text-white font-black uppercase tracking-tight line-clamp-1 opacity-80 mb-1">{img.prompt}</p>
              </div>
              <div className="absolute top-2 right-2 flex gap-2 translate-x-32 group-hover:translate-x-0 transition-transform">
                <button 
                  onClick={() => onUpload?.(img.nativeType, img.index)}
                  className="p-1.5 bg-emerald-600 text-white rounded-md shadow-lg hover:bg-emerald-500 transition-colors"
                  title="Upload Replacement"
                >
                  <Upload className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => onAction?.(img.nativeType, img.index)}
                  className="p-1.5 bg-indigo-600 text-white rounded-md shadow-lg hover:bg-indigo-500 transition-colors"
                  title="Regenerate Asset"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
              <div className={cn(
                "absolute top-2 left-2 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest rounded shadow-sm",
                img.nativeType === 'featured' ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"
              )}>
                {img.type}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PreviewModal({ blogDraft, onClose, theme }: { blogDraft: BlogPost, onClose: () => void, theme: 'light' | 'dark' }) {
  const escapeHtml = (s?: string) => {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const buildPreviewDoc = (d: BlogPost) => {
    const title = escapeHtml(d.title || '');
    const meta = escapeHtml(d.meta_description || d.meta_title || '');
    const intro = (d as any).rawIntroduction || d.introduction || '';
    const content = (d as any).rawContent || d.content || '';
    const conclusion = (d as any).rawConclusion || d.conclusion || '';
    const faqHtml = d.faq && d.faq.length > 0
      ? `<h2>Frequently Asked Questions</h2>${d.faq.map((f: FAQItem) => `<h3>${escapeHtml(f.question)}</h3>${f.answer}`).join('')}`
      : '';
    const featured = d.featuredImage?.url ? (`<figure><img src="${escapeHtml(d.featuredImage!.url!)}" alt="${escapeHtml(d.featuredImage!.alt || '')}" style="width:100%;height:auto;border-radius:12px;object-fit:cover;margin-bottom:20px;"/></figure>`) : '';

    // Minimal inline styling to approximate site render (prose-like)
    const style = `
      *{box-sizing:border-box}
      body{font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; background:${theme === 'dark' ? '#0f172a' : '#ffffff'}; color:${theme === 'dark' ? '#e6edf3' : '#0f172a'}; padding:40px; font-size:18px; line-height:1.8;}
      .container{max-width:900px;margin:0 auto}
      h1{font-size:2.5rem;font-weight:800;letter-spacing:-0.03em;line-height:1.1;margin:0 0 1.5rem}
      h2{font-size:1.75rem;font-weight:800;letter-spacing:-0.02em;line-height:1.2;margin:2.5rem 0 1rem;padding-bottom:0.5rem;border-bottom:2px solid ${theme === 'dark' ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)'}}
      h3{font-size:1.35rem;font-weight:700;letter-spacing:-0.01em;line-height:1.3;margin:2rem 0 0.75rem;color:${theme === 'dark' ? 'rgb(129,140,248)' : 'rgb(79,70,229)'}}
      h4{font-size:1.1rem;font-weight:700;margin:1.5rem 0 0.5rem;color:${theme === 'dark' ? 'rgb(165,180,252)' : 'rgb(99,102,241)'}}
      p{margin:0 0 1.25rem}
      ul,ol{padding-left:1.5rem;margin:0 0 1.25rem}
      li{margin-bottom:0.5rem}
      a{color:${theme === 'dark' ? 'rgb(129,140,248)' : 'rgb(79,70,229)'};text-decoration:underline}
      strong{font-weight:700}
      img{max-width:100%;height:auto;border-radius:12px}
      figure{margin:0 0 2rem}
    `;

    return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><meta name="description" content="${meta}"><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${style}</style></head><body><div class="container"><article class="prose">${featured}${intro}${content}${faqHtml}${conclusion}</article></div></body></html>`;
  };
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10 pointer-events-none"
    >
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/90 backdrop-blur-md pointer-events-auto"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={cn(
          "w-full max-w-6xl max-h-full overflow-hidden rounded-2xl border-4 relative pointer-events-auto flex flex-col transition-all shadow-[0_0_100px_rgba(0,0,0,0.5)]",
          theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
        )}
      >
        <div className={cn(
          "flex items-center justify-between p-6 border-b-2 shrink-0",
          theme === 'dark' ? "border-slate-800" : "border-slate-100"
        )}>
          <div className="flex items-center gap-4">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Monitor className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className={cn("text-lg font-black uppercase tracking-tighter", theme === 'dark' ? "text-white" : "text-slate-900")}>Draft Architecture Preview</h3>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Full Semantic & Format Audit</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={cn(
              "p-3 rounded-xl border-2 transition-all hover:scale-110",
              theme === 'dark' ? "border-slate-800 text-white hover:bg-slate-800" : "border-slate-200 text-slate-400 hover:bg-slate-50"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 sm:p-20">
          <article className={cn(
            "prose max-w-4xl mx-auto space-y-12 transition-all",
            theme === 'dark' ? "prose-invert prose-indigo" : "prose-slate"
          )}>
            {blogDraft.featuredImage?.url && (
              <figure className="mb-12">
                <img 
                  src={blogDraft.featuredImage.url} 
                  alt={blogDraft.featuredImage.alt}
                  className="w-full aspect-video object-cover rounded-2xl border-4 border-slate-800 shadow-2xl"
                  referrerPolicy="no-referrer"
                />
                {blogDraft.featuredImage.alt && (
                  <figcaption className="text-center mt-4 italic text-sm text-slate-500 uppercase font-black tracking-widest">{blogDraft.featuredImage.alt}</figcaption>
                )}
              </figure>
            )}

            <header className="space-y-6">
              <h1 className={cn(
                "text-6xl font-black tracking-tighter leading-none mb-8 uppercase",
                theme === 'dark' ? "text-white" : "text-slate-900"
              )}>
                {blogDraft.title}
              </h1>
            </header>

            <div className="space-y-12">
              <div 
                className="text-xl font-bold border-l-8 border-indigo-600 pl-8 py-4 opacity-90 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: (blogDraft as any).rawIntroduction || blogDraft.introduction }} 
              />
              
              <div 
                className="blog-content prose-lg"
                dangerouslySetInnerHTML={{ __html: (blogDraft as any).rawContent || blogDraft.content }} 
              />

              {blogDraft.faq && blogDraft.faq.length > 0 && (
                <div className={cn(
                  "pt-16 border-t-8 border-double",
                  theme === 'dark' ? "border-slate-800" : "border-slate-100"
                )}>
                  <h2 className="text-4xl font-black uppercase tracking-tighter mb-12">Frequently Asked Questions</h2>
                  <div className="space-y-12">
                    {blogDraft.faq.map((f, i) => (
                      <div key={i} className="space-y-4">
                        <h3 className="text-2xl font-black text-indigo-500 uppercase tracking-tight">{f.question}</h3>
                        <div className="text-lg leading-relaxed opacity-80 blog-content" dangerouslySetInnerHTML={{ __html: f.answer }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                className={cn(
                  "blog-content p-10 border-4 border-dashed rounded-2xl",
                  theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
                )}
                dangerouslySetInnerHTML={{ __html: (blogDraft as any).rawConclusion || blogDraft.conclusion }}
              />
            </div>
          </article>
        </div>

        <div className={cn(
          "p-6 border-t-2 shrink-0 flex justify-between items-center",
          theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-100"
        )}>
          <div className="flex gap-6">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Total Words</span>
              <span className="text-sm font-black text-indigo-500 font-mono">
                {Math.round((((blogDraft as any).rawIntroduction || blogDraft.introduction || '') + ((blogDraft as any).rawContent || blogDraft.content || '') + ((blogDraft as any).rawConclusion || blogDraft.conclusion || '')).replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Neural Assets</span>
              <span className="text-sm font-black text-indigo-500 font-mono">{(blogDraft.contentImages?.length || 0) + (blogDraft.featuredImage ? 1 : 0)}</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="px-10 py-4 bg-indigo-600 text-white rounded-lg font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
          >
            Terminal Return
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  label: string;
  theme: 'light' | 'dark';
}

const NavItem: React.FC<NavItemProps> = ({ icon, active, onClick, label, theme }) => {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-4 w-full px-5 py-4 rounded-lg transition-all border-2",
        active 
          ? "bg-indigo-600 text-white border-indigo-600 font-black uppercase tracking-widest text-[10px]" 
          : theme === 'dark' 
            ? "text-slate-400 border-transparent hover:border-slate-800 hover:text-slate-200 bg-transparent"
            : "text-slate-500 border-transparent hover:border-slate-200 hover:text-slate-900 bg-transparent"
      )}
    >
      <span className={cn(
        "transition-transform",
        active ? "scale-100" : ""
      )}>
        {icon}
      </span>
      <span>{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-sm"></div>}
    </button>
  );
}

function CompetitorCard({ data, theme, onAnalyze }: { data: CompetitorData, theme: 'light' | 'dark', onAnalyze?: (d: CompetitorData) => void }) {
  const [showAnalysis, setShowAnalysis] = React.useState(false);

  return (
    <div className={cn(
      "rounded-lg border-4 p-6 transition-all border-b-8 border-b-slate-800",
      theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
            <Globe className="w-5 h-5 text-white" />
          </div>
                          <div className={cn(
                            "grow overflow-hidden min-w-0 pr-4",
                            theme === 'dark' ? "text-white" : "text-slate-900"
                          )}>
                            <h4 className="font-black text-sm line-clamp-2 uppercase tracking-tighter leading-tight">{data.title || 'Incomplete Node'}</h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">{new URL(data.url).hostname}</p>
                          </div>
                        </div>
                        {data.analysis?.topicalDepthScore && (
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-[8px] font-black uppercase text-indigo-500 tracking-widest leading-none mb-1">DNA Score</span>
                            <span className={cn("text-xl font-black leading-none", theme === 'dark' ? "text-white" : "text-indigo-600")}>{data.analysis.topicalDepthScore}</span>
                          </div>
                        )}
                      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Badge label={`${data.wordCount} words`} color="blue" />
        <Badge label={`${data.imageCount} imgs`} color="purple" />
        {data.analysis?.readabilityLevel && (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black border-2 uppercase tracking-widest font-mono bg-slate-900 border-slate-800 text-slate-400 shrink-0">
            {data.analysis.readabilityLevel}
          </span>
        )}
      </div>
      
      <p className="text-xs text-slate-500 line-clamp-2 mb-6 leading-relaxed font-medium">{data.description}</p>
      
      {data.images && data.images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-6 scrollbar-hide">
          {data.images.slice(0, 5).map((img, i) => (
            <img 
              key={i} 
              src={img} 
              alt="Competitor Asset" 
              className="w-20 h-14 object-cover rounded-md border-2 border-slate-800 shrink-0 bg-slate-900 shadow-lg" 
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          ))}
        </div>
      )}
      
      {data.analysis ? (
        <div className="mb-6 space-y-4">
          <button 
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="w-full py-2 bg-slate-900 text-[9px] font-black uppercase text-indigo-400 rounded border border-slate-800 tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
          >
            {showAnalysis ? 'Hide Analysis' : 'View AI Intelligence'}
            <TrendingUp className={cn("w-3 h-3 transition-transform", showAnalysis && "rotate-180")} />
          </button>
          
          {showAnalysis && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="space-y-4 overflow-hidden pt-2"
            >
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Target Intent</p>
                <p className="text-[10px] font-bold text-indigo-500 uppercase">{data.analysis.intentType}</p>
                {data.analysis.intentReasoning && (
                  <p className="text-[9px] text-slate-400 italic leading-tight">{data.analysis.intentReasoning}</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Winning Strategies</p>
                <ul className="space-y-1">
                  {data.analysis.strengths.map((s, i) => <li key={i} className="text-[10px] text-slate-400 flex items-start gap-2"><div className="w-1 h-1 bg-indigo-500 rounded-full mt-1.5 shrink-0" /> {s}</li>)}
                </ul>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Content Gaps</p>
                <ul className="space-y-1">
                  {data.analysis.weaknesses.map((w, i) => <li key={i} className="text-[10px] text-slate-400 flex items-start gap-2"><div className="w-1 h-1 bg-red-500 rounded-full mt-1.5 shrink-0" /> {w}</li>)}
                </ul>
              </div>
            </motion.div>
          )}
        </div>
  ) : (
        <button 
          onClick={() => onAnalyze && onAnalyze(data)}
          className="w-full mb-6 py-2 bg-indigo-600/10 text-[9px] font-black uppercase text-indigo-500 rounded border border-indigo-600/20 tracking-widest hover:bg-indigo-600/20 transition-all flex items-center justify-center gap-2"
        >
          <Zap className="w-3 h-3 animate-pulse" />
          Run Content Analysis
        </button>
      )}
      

  {/* Headings display: show a compact list of headings if available */}
      {data.headings && data.headings.length > 0 && (
        <div className="mb-4">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Headings</p>
          <div className="space-y-2 max-h-40 overflow-auto">
            {data.headings.slice(0, 10).map((h, i) => (
              <div key={i} className="text-[11px] font-bold text-slate-200 flex items-start gap-3">
                <span className="w-8 text-[10px] font-mono text-slate-400">{h.level.toUpperCase()}</span>
                <span className="break-words">{h.text}</span>
              </div>
            ))}
            {data.headings.length > 10 && (
              <div className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">+{data.headings.length - 10} more</div>
            )}
          </div>
        </div>
      )}
      <a 
        href={data.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-[10px] font-black text-indigo-500 hover:text-indigo-400 flex items-center gap-1.5 uppercase tracking-widest transition-colors"
      >
        Source Intelligence <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

function Badge({ label, color }: { label: string, color: 'blue' | 'purple' }) {
  const styles = {
    blue: "bg-indigo-600 text-white border-indigo-600",
    purple: "bg-purple-600 text-white border-purple-600"
  };
  return (
    <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-black border-2 uppercase tracking-widest font-mono", styles[color])}>
      {label}
    </span>
  );
}

function ScoreItem({ label, value, active = false, theme }: { label: string, value: string, active?: boolean, theme?: 'light' | 'dark' }) {
  return (
    <div className={cn(
      "flex items-center justify-between py-2 border-b-2 last:border-0 grow",
      theme === 'dark' ? "border-slate-900" : "border-slate-100"
    )}>
      <span className="text-xs text-slate-500 font-black uppercase tracking-tighter">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn("text-xs font-black font-mono tracking-tighter", theme === 'dark' || !theme ? "text-white" : "text-slate-900")}>{value}</span>
        {active ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> : <div className={cn("w-3.5 h-3.5 rounded-sm border-2", theme === 'dark' || !theme ? "border-slate-800" : "border-slate-300")} />}
      </div>
    </div>
  );
}

function SopInput({ 
  label, 
  value, 
  onChange, 
  long = false, 
  theme, 
  tip,
  selectedModel,
  onModelChange
}: { 
  label: string, 
  value: string, 
  onChange: (v: string) => void, 
  long?: boolean, 
  theme?: 'light' | 'dark', 
  tip?: string,
  selectedModel?: string,
  onModelChange?: (m: string) => void
}) {
  const baseClasses = cn(
    "w-full border-2 rounded-lg px-6 py-5 text-sm focus:outline-none focus:border-indigo-500 transition-all font-black placeholder:text-slate-700 tracking-tight leading-relaxed",
    theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-800"
  );
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] underline decoration-indigo-600 decoration-2 underline-offset-4">{label}</label>
        {/* <div className="flex items-center gap-6">
          {onModelChange && (
            <div className="flex items-center gap-2">
              <Cpu className="w-3 h-3 text-indigo-500" />
              <select 
                value={selectedModel || 'inherit'}
                onChange={(e) => onModelChange(e.target.value === 'inherit' ? '' : e.target.value)}
                className={cn(
                  "bg-transparent border-0 text-[10px] font-black uppercase tracking-widest focus:ring-0 cursor-pointer p-0",
                  theme === 'dark' ? "text-slate-400" : "text-slate-500"
                )}
              >
                <option value="inherit">Inherit Global Model</option>
                <optgroup label="Google Gemini">
                  <option value="models/gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="models/gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                </optgroup>
                <optgroup label="OpenAI">
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </optgroup>
                <optgroup label="Anthropic Claude">
                  <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                  <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                </optgroup>
              </select>
            </div>
          )}
          {tip && (
            <div className="flex items-center gap-2 text-indigo-400">
              <Zap className="w-3 h-3" />
              <span className="text-[8px] font-black uppercase tracking-widest leading-none">{tip}</span>
            </div>
          )}
        </div> */}
      </div>
      {long ? (
        <textarea 
          className={cn(baseClasses, "min-h-[160px] resize-none")}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input 
          type="text"
          className={baseClasses}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function InputGroup({ label, placeholder, value, onChange, type = "text", theme }: { label: string, placeholder: string, value: string, onChange: (v: string) => void, type?: string, theme?: 'light' | 'dark' }) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</label>
      <input 
        type={type}
        placeholder={placeholder}
        className={cn(
          "w-full border-2 rounded-lg px-5 py-3.5 text-sm focus:outline-none focus:border-indigo-500 transition-all font-black tracking-tight",
          theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-700" : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
        )}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
