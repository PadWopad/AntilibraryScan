import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { CONSPIRACY_CATALOG } from "../constants/conspiracyCatalog";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface SignalData {
  news: any[];
  finance: any[];
  space: any[];
  weather: any;
  geography: any[];
  art: any[];
  entertainment: any;
  security: any[];
  culture: any[];
  military: any[];
  emergency: any[];
  spaceWeather: any[];
  science: any[];
  politics: any[];
  religion: any;
  energy: any;
  ai: any[];
  social: any[];
  trending: any[];
  software: any[];
  demographics: any[];
  labor: any[];
  timestamp: string;
}

// Simple cache to save tokens
let theoryCache: { [key: string]: { theories: Theory[], timestamp: number } } = {};
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

// Global Knowledge Base (Memory)
export interface GraphNode {
  id: string;
  label: string;
  type: "theory" | "signal" | "concept";
  val: number;
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
}

let globalKnowledgeBase: { nodes: GraphNode[], links: GraphLink[] } = {
  nodes: [],
  links: []
};

export interface Theory {
  id: string;
  title: string;
  thesis: string;
  observations: string[];
  connections: { from: string; to: string; label: string }[];
  persuasionIndex: number; // 0-100
  artisticPower: number; // 0-100
  counterArgument: string;
  criticalAnalysis: string;
  prediction: string;
  category: "синхронизация" | "символизм" | "напряжение" | "география" | "алгоритмика" | "история";
  status: "Черновик" | "Активно" | "Подтверждено" | "Опровергнуто";
  version: number;
  parentTheoryId?: string;
  oracleScore?: number;
  lastUpdated: number;
  sentiment?: {
    score: number; // -1 to 1
    label: string;
  };
  archiveLinks?: { id: string; title: string }[];
}

export interface UserSignal {
  id: string;
  text: string;
  timestamp: number;
  source?: string;
  type: 'manual' | 'extracted';
}

/**
 * Extracts atomic signals from large text blocks (e.g., file uploads)
 * to save tokens during final theory synthesis.
 */
export async function extractSignalsFromText(text: string, sourceName: string): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  // Limit input size to avoid token overflow in extraction phase
  const truncatedText = text.slice(0, 15000); 

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Извлеки самые "подозрительные", "совпадающие" или "формирующие паттерны" факты из этого текста.
      Сосредоточься на именах, датах, локациях и необычных событиях.
      Верни простой список из 5-10 атомарных сигналов.
      
      ТЕКСТ ИЗ ${sourceName}:
      ${truncatedText}
    `,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Signal extraction failed:", e);
    return [];
  }
}

let userSignals: UserSignal[] = [];
let activeThreads: Theory[] = [];

export function getKnowledgeGraph() {
  return globalKnowledgeBase;
}

export function injectUserSignal(text: string, source?: string, type: 'manual' | 'extracted' = 'manual') {
  const signal: UserSignal = {
    id: Math.random().toString(36).substr(2, 9),
    text,
    timestamp: Date.now(),
    source,
    type
  };
  userSignals.push(signal);
  // Keep only last 20 user signals to prevent context bloat
  if (userSignals.length > 20) userSignals.shift();
  return signal;
}

export function getUserSignals() {
  return userSignals;
}

/**
 * Compresses raw signal data into a minimal text format to save tokens.
 */
function compressSignals(signals: SignalData): string {
  const summary: string[] = [];
  
  if (signals.news?.length) summary.push(`Новости: ${signals.news.map(n => `${n.title} ${n.text ? `(${n.text.slice(0, 100)}...)` : ""}`).join("; ")}`);
  if (signals.finance?.length) summary.push(`Финансы: ${signals.finance.map(f => `${f.symbol}:${f.priceUsd}`).join(", ")}`);
  if (signals.space?.length) summary.push(`Космос: ${signals.space.map(s => `${s.title}: ${s.summary?.slice(0, 150)}...`).join("; ")}`);
  if (signals.military?.length) summary.push(`Военные: ${signals.military.map(m => `${m.fields?.title} (${m.fields?.body?.slice(0, 150)}...)`).join("; ")}`);
  if (signals.emergency?.length) summary.push(`ЧП: ${signals.emergency.map(e => e.fields?.name).join("; ")}`);
  if (signals.ai?.length) summary.push(`ИИ: ${signals.ai.map(a => `${a.title} ${a.comment_text ? `[${a.comment_text.slice(0, 100)}...]` : ""}`).join("; ")}`);
  if (signals.social?.length) summary.push(`Соцсети: ${signals.social.map(s => `${s.title} (subreddit: ${s.subreddit})`).join("; ")}`);
  if (signals.trending?.length) summary.push(`Тренды: ${signals.trending.map(t => t.article).join("; ")}`);
  if (signals.software?.length) summary.push(`ПО: ${signals.software.map(s => `${s.name}: ${s.description?.slice(0, 100)}...`).join("; ")}`);
  if (signals.science?.length) summary.push(`Наука: ${signals.science.map(s => `${s.title?.[0]} (изд: ${s.publisher})`).join("; ")}`);
  
  // Add metadata for context
  if (signals.weather) summary.push(`Погода: ${signals.weather.temperature}C, Код ${signals.weather.weathercode}`);
  if (signals.spaceWeather?.length) summary.push(`Солнечный K-индекс: ${signals.spaceWeather[0].kp_index}`);
  
  return summary.join("\n").slice(0, 4000); // Hard limit to ensure token safety
}

export async function generateTheories(signals: SignalData, mode: string = "Fiction"): Promise<Theory[]> {
  const compressed = compressSignals(signals);
  const userSignalsText = userSignals.map(s => `[СИГНАЛ ПОЛЬЗОВАТЕЛЯ]: ${s.text}`).join("\n");
  const activeThreadsSummary = activeThreads.map(t => `[ПОТОК ${t.id} v${t.version}]: ${t.title} - ${t.thesis}`).join("\n");

  const cacheKey = `${mode}_${compressed.slice(0, 500)}_${userSignalsText.slice(0, 200)}`;
  
  const now = Date.now();
  if (theoryCache[cacheKey] && (now - theoryCache[cacheKey].timestamp < CACHE_TTL)) {
    console.log("Returning cached theories to save tokens.");
    return theoryCache[cacheKey].theories;
  }

  const archiveSummary = CONSPIRACY_CATALOG.map(t => `${t.id}: ${t.title} (${t.status})`).join(", ");

  const prompt = `
    Проанализируй эти глобальные сигналы и создай 3 различных "Спекулятивных теории" (синхронизация, символизм, напряжение, география или алгоритмика).
    
    ВАЖНО: В поле "observations" (цепочка наблюдений) предоставь развернутые цитаты или подробные саммари из сигналов, которые подтверждают теорию. Каждое наблюдение должно быть информативным и содержать конкретные детали (минимум 15-20 слов на пункт).
    
    СИГНАЛЫ:
    ${compressed}

    СИГНАЛЫ, ВВЕДЕННЫЕ ПОЛЬЗОВАТЕЛЕМ (Высокий приоритет):
    ${userSignalsText || "Нет"}

    АКТИВНЫЕ ПОТОКИ (Развивай их, если уместно, или создавай новые):
    ${activeThreadsSummary || "Нет"}
    
    КОНТЕКСТ АРХИВА (Проведи параллели, если уместно, укажи ID для archiveLinks):
    ${archiveSummary}
    
    РЕЖИМ: ${mode}

    КРИТИЧЕСКОЕ ТРЕБОВАНИЕ БЕЗОПАСНОСТИ:
    Для каждой теории предоставь поле "criticalAnalysis". Это должно быть рациональное, научное или логическое объяснение, которое опровергает теорию или объясняет ее как результат когнитивных искажений (таких как апофения или предвзятость подтверждения). Используй трезвый, объективный тон.

    ДЛЯ ЭВОЛЮЦИИ ПОТОКА:
    Если теория является развитием существующего потока, установи "parentTheoryId" в ID этого потока и увеличь "version".
    
    ДЛЯ АНАЛИЗА НАСТРОЕНИЙ:
    Предоставь объект "sentiment" с полями "score" (от -1 до 1) и "label" (например, "Высокое напряжение", "Эйфория", "Паранойя") на основе эмоционального заряда сигналов.

    ДЛЯ СВЯЗИ С АРХИВОМ:
    Если теория имеет сильные параллели с записью в КОНТЕКСТЕ АРХИВА, укажи ее ID в "archiveLinks".
    
    Вывод строго в формате JSON. Все текстовые поля должны быть на РУССКОМ языке.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, // Optimize for speed/cost
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            thesis: { type: Type.STRING },
            observations: { type: Type.ARRAY, items: { type: Type.STRING } },
            connections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  from: { type: Type.STRING },
                  to: { type: Type.STRING },
                  label: { type: Type.STRING }
                }
              }
            },
            persuasionIndex: { type: Type.INTEGER },
            artisticPower: { type: Type.INTEGER },
            counterArgument: { type: Type.STRING },
            criticalAnalysis: { type: Type.STRING },
            prediction: { type: Type.STRING },
            category: { type: Type.STRING, enum: ["синхронизация", "символизм", "напряжение", "география", "алгоритмика", "история"] },
            status: { type: Type.STRING, enum: ["Черновик", "Активно", "Подтверждено", "Опровергнуто"] },
            version: { type: Type.INTEGER },
            parentTheoryId: { type: Type.STRING },
            oracleScore: { type: Type.INTEGER },
            sentiment: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                label: { type: Type.STRING }
              }
            },
            archiveLinks: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["id", "title", "thesis", "observations", "connections", "persuasionIndex", "artisticPower", "counterArgument", "criticalAnalysis", "prediction", "category", "status", "version"]
        }
      }
    }
  });

  try {
    const theories = (JSON.parse(response.text || "[]") as any[]).map(t => {
      const links = (t.archiveLinks || []).map((id: string) => {
        const entry = CONSPIRACY_CATALOG.find(c => c.id === id);
        return entry ? { id: entry.id, title: entry.title } : null;
      }).filter(Boolean);

      return {
        ...t,
        archiveLinks: links,
        lastUpdated: Date.now()
      } as Theory;
    });
    
    // Update active threads
    theories.forEach(t => {
      const idx = activeThreads.findIndex(at => at.id === t.id || at.id === t.parentTheoryId);
      if (idx !== -1) {
        activeThreads[idx] = t;
      } else {
        activeThreads.push(t);
      }
    });
    
    // Update Global Knowledge Base
    theories.forEach(theory => {
      // Add theory node
      if (!globalKnowledgeBase.nodes.find(n => n.id === theory.id)) {
        globalKnowledgeBase.nodes.push({ id: theory.id, label: theory.title, type: "theory", val: 15 });
      }
      
      // Add connection nodes and links
      theory.connections.forEach(conn => {
        if (!globalKnowledgeBase.nodes.find(n => n.id === conn.from)) {
          globalKnowledgeBase.nodes.push({ id: conn.from, label: conn.from, type: "concept", val: 8 });
        }
        if (!globalKnowledgeBase.nodes.find(n => n.id === conn.to)) {
          globalKnowledgeBase.nodes.push({ id: conn.to, label: conn.to, type: "concept", val: 8 });
        }
        
        // Link from -> to
        globalKnowledgeBase.links.push({ source: conn.from, target: conn.to, label: conn.label });
        // Link theory -> from
        globalKnowledgeBase.links.push({ source: theory.id, target: conn.from, label: "origin" });
      });
    });

    // Keep knowledge base manageable
    if (globalKnowledgeBase.nodes.length > 100) {
      globalKnowledgeBase.nodes = globalKnowledgeBase.nodes.slice(-100);
      globalKnowledgeBase.links = globalKnowledgeBase.links.slice(-200);
    }

    theoryCache[cacheKey] = { theories, timestamp: now };
    return theories;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return [];
  }
}

/**
 * Mock function to simulate prediction validation.
 */
export function validatePredictions(theories: Theory[]): Theory[] {
  return theories.map(t => {
    if (t.status === "Активно" && Math.random() > 0.8) {
      return {
        ...t,
        status: "Подтверждено",
        oracleScore: (t.oracleScore || 0) + 25,
        lastUpdated: Date.now()
      };
    }
    return t;
  });
}
