/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Shield, 
  Globe, 
  Zap, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  Radio, 
  Cpu, 
  Share2,
  Maximize2,
  ChevronRight,
  RefreshCcw,
  Terminal,
  X,
  FileText,
  Download,
  Link as LinkIcon,
  Folder,
  Database,
  LogIn,
  LogOut,
  TrendingUp,
  AlertCircle,
  Network,
  Upload
} from 'lucide-react';
import { useFirebase } from './context/FirebaseContext';
import { db, collection, onSnapshot, doc, setDoc, handleFirestoreError, OperationType, storage, ref, uploadBytes, query, where, orderBy, limit, getDocs, getCountFromServer } from './firebase';
import { 
  generateTheories, 
  Theory, 
  SignalData, 
  getKnowledgeGraph, 
  injectUserSignal, 
  validatePredictions,
  extractSignalsFromText
} from './services/narrativeEngine';
import KnowledgeGraph from './components/KnowledgeGraph';
import Dashboard from './components/Dashboard';
import { exportToGexf, downloadFile } from './utils/exportUtils';
import { CONSPIRACY_CATALOG } from './constants/conspiracyCatalog';
import { cn } from './lib/utils';

type Mode = 'Fiction' | 'Analyst' | 'Paranoia' | 'Debunk';

const GlitchOverlay = () => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 0.1, 0, 0.05, 0] }}
    transition={{ duration: 0.5, repeat: Infinity }}
    className="fixed inset-0 pointer-events-none z-[200] bg-emerald-500/5 mix-blend-overlay"
  />
);

import { runBackgroundSync } from './services/signalProcessor';

export default function App() {
  const { user, login, logout, loading: authLoading } = useFirebase();
  const [signals, setSignals] = useState<SignalData | null>(null);
  const [theories, setTheories] = useState<Theory[]>([]);
  const [graphData, setGraphData] = useState(getKnowledgeGraph());
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('Fiction');
  const [selectedTheory, setSelectedTheory] = useState<Theory | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [userSignalInput, setUserSignalInput] = useState('');
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [tokenBudget, setTokenBudget] = useState(100); // 100% budget
  const [showOracle, setShowOracle] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [systemState, setSystemState] = useState({
    escalation: 0.12,
    destab: 0.05,
    attentionSpike: 0.08,
    lastUpdated: new Date().toISOString()
  });

  const [showManual, setShowManual] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showSignalArchive, setShowSignalArchive] = useState(false);
  const [selectedArchiveSignal, setSelectedArchiveSignal] = useState<any>(null);
  const [isGraphExpanded, setIsGraphExpanded] = useState(false);
  const [theoryLimit, setTheoryLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [dbStatus, setDbStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [totalRecords, setTotalRecords] = useState<number | null>(null);
  const systemStateRef = React.useRef(systemState);

  useEffect(() => {
    systemStateRef.current = systemState;
  }, [systemState]);

  // Check Database Connection & Get Total Count
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Simple ping to Firestore
        const snapshot = await getDocs(query(collection(db, 'theories'), limit(1)));
        setDbStatus('online');
        
        // Get total count
        const countSnapshot = await getCountFromServer(collection(db, 'theories'));
        setTotalRecords(countSnapshot.data().count);
      } catch (error) {
        console.error("Database connection failed:", error);
        setDbStatus('offline');
      }
    };
    checkConnection();
  }, []);

  // Listen to Theories from Firestore
  useEffect(() => {
    let q;
    if (showOracle) {
      q = query(
        collection(db, 'theories'), 
        where('status', 'in', ['Подтверждено', 'Опровергнуто']),
        orderBy('lastUpdated', 'desc'), 
        limit(theoryLimit)
      );
    } else {
      q = query(
        collection(db, 'theories'), 
        where('status', 'in', ['Активно', 'Черновик']),
        orderBy('lastUpdated', 'desc'), 
        limit(theoryLimit)
      );
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedTheories = snapshot.docs.map(doc => doc.data() as Theory);
      setTheories(fetchedTheories);
      setHasMore(snapshot.docs.length === theoryLimit);
      setLoading(false);

      // Update total count whenever data changes
      try {
        const countSnapshot = await getCountFromServer(collection(db, 'theories'));
        setTotalRecords(countSnapshot.data().count);
      } catch (error) {
        console.error("Failed to update total count:", error);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'theories');
    });
    return () => unsubscribe();
  }, [theoryLimit, showOracle]);

  const groupedTheories = useMemo(() => {
    const filtered = theories.filter(t => 
      showOracle ? (t.status === 'Подтверждено' || t.status === 'Опровергнуто') : (t.status !== 'Подтверждено' && t.status !== 'Опровергнуто')
    );
    
    const groups: { day: string, month: string, year: string, theories: Theory[] }[] = [];
    let currentDay = "";
    
    filtered.forEach(theory => {
      const date = new Date(theory.lastUpdated);
      const day = date.getDate().toString().padStart(2, '0');
      const month = date.toLocaleString('ru-RU', { month: 'long' });
      const year = date.getFullYear().toString();
      const dayMonthYear = `${day} ${month} ${year}`;
      
      if (dayMonthYear !== currentDay) {
        currentDay = dayMonthYear;
        groups.push({ day, month, year, theories: [theory] });
      } else {
        groups[groups.length - 1].theories.push(theory);
      }
    });
    
    return groups;
  }, [theories, showOracle]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100 && hasMore && !loading) {
      setTheoryLimit(prev => prev + 20);
    }
  };

  // Listen to System State from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'systemState', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemState(snapshot.data() as any);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'systemState/global');
    });
    return () => unsubscribe();
  }, []);

  const syncHistoricalData = async () => {
    if (!user) return;
    addLog("Синхронизация исторических архивов...");
    try {
      await Promise.all(CONSPIRACY_CATALOG.map(item => {
        const theory = transformHistoricalToTheory(item);
        return setDoc(doc(db, 'theories', theory.id), { ...theory, authorUid: user.uid }, { merge: true });
      }));
      addLog("Исторические архивы интегрированы.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'theories/historical');
    }
  };

  // Background Sync (Simulated Cron)
  useEffect(() => {
    if (user) {
      // Initial sync
      runBackgroundSync();

      // Run every 5 minutes (300000 ms)
      const syncInterval = setInterval(() => {
        addLog("Запуск фоновой синхронизации Deep API...");
        runBackgroundSync();
      }, 300000);

      // System State Simulation (Escalation logic) - Only for admin to avoid conflicts
      let stateInterval: any = null;
      if (user.email === "mikle339900@gmail.com") {
        stateInterval = setInterval(async () => {
          const currentEscalation = typeof systemStateRef.current.escalation === 'number' ? systemStateRef.current.escalation : 0.12;
          const currentDestab = typeof systemStateRef.current.destab === 'number' ? systemStateRef.current.destab : 0.05;

          const newState = {
            escalation: Math.min(1, Math.max(0, currentEscalation + (Math.random() * 0.02 - 0.005))),
            destab: Math.min(1, Math.max(0, currentDestab + (Math.random() * 0.01))),
            attentionSpike: Math.random(),
            lastUpdated: new Date().toISOString()
          };
          
          try {
            await setDoc(doc(db, 'systemState', 'global'), newState, { merge: true });
          } catch (error) {
            // Silent fail for state updates to avoid spamming
            console.error("System state update failed:", error);
          }
        }, 60000); // Update every minute
      }

      return () => {
        clearInterval(syncInterval);
        if (stateInterval) clearInterval(stateInterval);
      };
    }
  }, [user]);

  // Historical Data Sync - Only run once on mount if user exists
  useEffect(() => {
    if (user) {
      const hasSynced = localStorage.getItem(`synced_${user.uid}`);
      if (!hasSynced) {
        syncHistoricalData();
        localStorage.setItem(`synced_${user.uid}`, 'true');
      }
    }
  }, [user]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsGraphExpanded(false);
        setSelectedTheory(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const transformHistoricalToTheory = (item: any): Theory => {
    let timestamp = Date.now();
    if (item.period) {
      const yearMatch = item.period.match(/\d{4}/);
      if (yearMatch) {
        const year = parseInt(yearMatch[0]);
        const date = new Date(year, 0, 1);
        timestamp = date.getTime();
      }
    }

    return {
      id: item.id,
      title: item.title,
      thesis: item.description,
      observations: item.evidence || [],
      connections: item.keywords.map((kw: string) => ({ from: item.title, to: kw, label: "связь" })),
      persuasionIndex: 100,
      artisticPower: 100,
      counterArgument: "Данные засекречены или утеряны в ходе исторических манипуляций.",
      criticalAnalysis: "Исторический прецедент, подтвержденный временем или официальными документами.",
      prediction: "Паттерны прошлого имеют тенденцию к повторению в текущем инфо-поле.",
      category: "история",
      status: item.status === 'Рассекречено' ? "Подтверждено" : "Активно",
      version: 1,
      lastUpdated: timestamp,
      archiveLinks: []
    };
  };

  const handleNodeClick = (node: any) => {
    // 1. Check active theories
    const theory = theories.find(t => t.id === node.id);
    if (theory) {
      setSelectedTheory(theory);
      return;
    }

    // 2. Check historical archives
    const historical = CONSPIRACY_CATALOG.find(c => c.id === node.id);
    if (historical) {
      setSelectedTheory(transformHistoricalToTheory(historical));
      return;
    }

    // 3. Check if it's a concept node linked to a theory
    const relatedTheory = theories.find(t => 
      t.connections.some(c => c.from === node.id || c.to === node.id)
    );
    if (relatedTheory) {
      setSelectedTheory(relatedTheory);
      return;
    }

    // 4. Check if it's a concept node linked to a historical entry
    const relatedHistorical = CONSPIRACY_CATALOG.find(c => 
      c.keywords.includes(node.id)
    );
    if (relatedHistorical) {
      setSelectedTheory(transformHistoricalToTheory(relatedHistorical));
      return;
    }
  };

  const addLog = (msg: string) => {
    setLogMessages(prev => [msg, ...prev].slice(0, 5));
  };

  const fetchData = async () => {
    setLoading(true);
    setIsAnalyzing(true);
    addLog("Инициализация протоколов Министерства...");
    try {
      addLog("Перехват глобальных потоков сигналов...");
      const res = await fetch('/api/signals');
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setSignals(data);
      addLog("Сигналы захвачены. Синтез мифологий...");
      
      const generated = await generateTheories(data, mode);
      
      // Sync to Firestore (onSnapshot will handle the state update)
      if (user) {
        await Promise.all(generated.map(t => 
          setDoc(doc(db, 'theories', t.id), { ...t, authorUid: user.uid }, { merge: true })
        ));
      } else {
        // Fallback for unauthenticated users (local state only)
        setTheories(generated);
      }
      
      setGraphData({ ...getKnowledgeGraph() });
      addLog("Досье успешно составлено.");
    } catch (err) {
      addLog("КРИТИЧЕСКАЯ ОШИБКА: Обнаружен прорыв сигнала.");
      console.error(err);
    } finally {
      setLoading(false);
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (theories.length > 0) {
      const timer = setInterval(() => {
        setTheories(prev => validatePredictions(prev));
      }, 30000); // Check every 30s for demo purposes
      return () => clearInterval(timer);
    }
  }, [theories.length]);

  const handleInjectSignal = async () => {
    if (!userSignalInput.trim()) return;
    injectUserSignal(userSignalInput, "Ручной ввод оператора");
    setUserSignalInput('');
    addLog("Ручной сигнал внедрен в поток.");
    await fetchData();
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setIsProcessingFiles(true);
    addLog(`Загрузка ${files.length} файлов в облачное хранилище для фоновой обработки...`);

    let uploadedCount = 0;
    const batchSize = 10;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = Array.from(files).slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (fileObj) => {
        const file = fileObj as File;
        try {
          // Upload to Firebase Storage
          const storageRef = ref(storage, `uploads/${user.uid}/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          uploadedCount++;
          
          if (uploadedCount % 10 === 0) {
            addLog(`Загружено ${uploadedCount}/${files.length} файлов...`);
          }
        } catch (err) {
          console.error(`Ошибка при загрузке ${file.name}:`, err);
        }
      }));

      // Update budget (simulated cost of upload/storage)
      setTokenBudget(prev => Math.max(0, prev - 0.5));
    }

    setIsProcessingFiles(false);
    addLog(`Загрузка завершена. ${uploadedCount} файлов передано в очередь обработки.`);
    addLog("Cloud Functions начали парсинг архива в фоновом режиме.");
  };

  useEffect(() => {
    fetchData();
  }, [mode]);

  const exportToMarkdown = (theory: Theory) => {
    const content = `
# ОТЧЕТ РАЗВЕДКИ: ${theory.title}
**ID:** ${theory.id} | **ВЕРСИЯ:** ${theory.version} | **СТАТУС:** ${theory.status}
**ДАТА:** ${new Date(theory.lastUpdated).toLocaleString()}
**КЛАССИФИКАЦИЯ:** ${theory.category.toUpperCase()}

## ТЕЗИС
${theory.thesis}

## НАБЛЮДЕНИЯ
${theory.observations.map(o => `- ${o}`).join('\n')}

## СВЯЗИ
${theory.connections.map(c => `- ${c.from} -> ${c.to} (${c.label})`).join('\n')}

## РАЦИОНАЛЬНЫЙ АНАЛИЗ (КОГНИТИВНАЯ БЕЗОПАСНОСТЬ)
${theory.criticalAnalysis}

## ПРОГНОЗ
${theory.prediction}

## АНАЛИЗ НАСТРОЕНИЙ
**МЕТКА:** ${theory.sentiment?.label || 'Н/Д'}
**БАЛЛ:** ${theory.sentiment?.score || 0}

---
*Сгенерировано Лабораторией Совпадений*
    `;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `REPORT_${theory.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
    addLog(`Отчет ${theory.id} экспортирован.`);
  };

  return (
    <div className={cn("min-h-screen grid-bg relative", mode === 'Paranoia' && "animate-pulse")}>
      {mode === 'Paranoia' && <GlitchOverlay />}
      <div className="scanline pointer-events-none opacity-20" />
      
      {/* Header / System Status Bar */}
      <header className="sticky top-0 z-50 bg-[#0d0d0f]/90 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between hardware-surface">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 glow-accent">
              <Shield size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tighter uppercase italic leading-none">Лаборатория совпадений</h1>
              <p className="micro-label mt-1">Нарративный Движок v3.1 // OSINT-CORE</p>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-10 border-l border-white/10 pl-8">
            <div className="space-y-1">
              <p className="micro-label">Эскалация</p>
              <p className={cn("text-xs font-bold font-mono leading-none", systemState.escalation > 0.7 ? "text-red-500" : "text-emerald-500")}>
                {(systemState.escalation * 100).toFixed(1)}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="micro-label">Дестаб.</p>
              <p className="text-xs font-bold font-mono text-amber-500 leading-none">{(systemState.destab * 100).toFixed(1)}%</p>
            </div>
            <div className="space-y-1">
              <p className="micro-label">Внимание</p>
              <p className={cn("text-xs font-bold font-mono leading-none", systemState.attentionSpike ? "text-orange-500" : "text-emerald-500")}>
                {systemState.attentionSpike ? 'ПИК' : 'СТАБИЛЬНО'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="micro-label">Паттерны</p>
              <p className="text-xs font-bold font-mono text-emerald-500 leading-none">
                {totalRecords !== null ? totalRecords : theories.length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="micro-label">База данных</p>
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  dbStatus === 'online' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
                  dbStatus === 'offline' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : 
                  "bg-white/20 animate-pulse"
                )} />
                <p className={cn(
                  "text-[10px] font-mono font-bold leading-none",
                  dbStatus === 'online' ? "text-emerald-500" : 
                  dbStatus === 'offline' ? "text-red-500" : 
                  "text-white/30"
                )}>
                  {dbStatus === 'online' ? `ONLINE ${totalRecords !== null ? `[${totalRecords}]` : ''}` : dbStatus === 'offline' ? 'OFFLINE' : 'WAIT'}
                </p>
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="micro-label">Синхронизация</p>
              <p className="text-[10px] font-mono text-white/30 leading-none">{new Date(systemState.lastUpdated).toLocaleTimeString()}</p>
            </div>
            
            <button 
              onClick={() => setShowDashboard(!showDashboard)}
              className={cn(
                "px-3 py-1 rounded-md text-[9px] font-mono uppercase tracking-widest border transition-all ml-2",
                showDashboard ? "bg-emerald-500 text-black border-emerald-500" : "border-white/10 text-white/30 hover:border-white/30"
              )}
            >
              {showDashboard ? "Закрыть" : "Аналитика"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {authLoading ? (
            <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="micro-label">Оператор</p>
                <p className="text-[10px] font-mono text-white/60">{user.displayName || user.email?.split('@')[0]}</p>
              </div>
              <button 
                onClick={logout}
                className="p-2 hover:bg-white/5 rounded-lg border border-white/10 transition-all text-white/40 hover:text-white"
                title="Выход"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={login}
              className="px-4 py-1.5 bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-emerald-400 transition-all flex items-center gap-2"
            >
              <LogIn size={14} /> Доступ
            </button>
          )}
          <div className="w-px h-6 bg-white/10 mx-2" />
          <button 
            onClick={fetchData}
            disabled={loading}
            className="p-2 hover:bg-white/5 rounded-lg border border-white/10 transition-all disabled:opacity-50 text-white/40 hover:text-emerald-500"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 grid-bg min-h-screen">
        {/* Left Column: Signals & Logs */}
        <div className="lg:col-span-4 space-y-6">
          {showDashboard && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="hardware-surface rounded-2xl p-5 border border-white/10"
            >
              <Dashboard theories={theories} systemState={systemState} totalRecords={totalRecords} />
            </motion.div>
          )}

          {/* Knowledge Graph Button/Modal */}
          {!isGraphExpanded ? (
            <button 
              onClick={() => setIsGraphExpanded(true)}
              className="w-full hardware-surface rounded-2xl p-5 border border-white/10 flex items-center justify-between hover:border-emerald-500/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                  <Network size={20} />
                </div>
                <div className="text-left">
                  <h2 className="micro-label text-white/90">Граф Знаний</h2>
                  <p className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Визуализация связей</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Открыть</span>
                <ChevronRight size={16} className="text-white/20 group-hover:text-emerald-500 transition-colors" />
              </div>
            </button>
          ) : (
            <section className="fixed inset-4 z-[300] bg-[#0d0d0f] border border-emerald-500/30 rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]">
              <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
                <h2 className="micro-label flex items-center gap-2 bg-[#0d0d0f]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 pointer-events-auto">
                  <Network size={12} className="text-emerald-500" /> Граф Знаний <span className="text-white/20 ml-2">| Полноэкранный режим</span>
                </h2>
                <div className="flex items-center gap-2 pointer-events-auto">
                  <button 
                    onClick={() => {
                      const gexf = exportToGexf(graphData.nodes, graphData.links);
                      downloadFile(gexf, `ministry_graph_${Date.now()}.gexf`, 'application/xml');
                      addLog('Граф экспортирован в Gephi.');
                    }}
                    className="p-2 bg-[#0d0d0f]/80 backdrop-blur-md hover:bg-white/5 rounded-lg border border-white/10 text-white/40 hover:text-white transition-all flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest"
                  >
                    <Share2 size={12} /> Экспорт
                  </button>
                  <button 
                    onClick={() => setIsGraphExpanded(false)}
                    className="p-2 bg-[#0d0d0f]/80 backdrop-blur-md hover:bg-red-500/20 rounded-lg border border-white/10 text-white/40 hover:text-red-500 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="w-full h-full">
                <KnowledgeGraph data={graphData} onNodeClick={handleNodeClick} />
              </div>
            </section>
          )}

          <section className="bg-black/40 border border-white/5 rounded-xl p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-mono uppercase tracking-widest text-white/40 flex items-center gap-2">
                <Terminal size={14} /> Системные логи
              </h2>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="space-y-2 font-mono text-[11px]">
              {logMessages.map((msg, i) => (
                <div key={i} className={cn("flex gap-2", i === 0 ? "text-emerald-400" : "text-white/30")}>
                  <span className="opacity-50">[{new Date().toLocaleTimeString()}]</span>
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-black/40 border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-mono uppercase tracking-widest text-white/40 flex items-center gap-2">
                <Activity size={14} /> Активные сигналы
              </h2>
              <button 
                onClick={() => setShowSignalArchive(true)}
                className="text-[9px] font-mono uppercase tracking-widest text-emerald-500/60 hover:text-emerald-500 transition-colors flex items-center gap-1"
              >
                Архив <ChevronRight size={10} />
              </button>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
              {signals?.news?.slice(0, 10).map((n: any) => (
                <div 
                  key={n.id} 
                  onClick={() => {
                    setSelectedArchiveSignal({ ...n, type: 'news' });
                    setShowSignalArchive(true);
                  }}
                  className="hardware-surface border border-white/5 p-3 rounded-lg hover:border-emerald-500/30 transition-all cursor-pointer group"
                >
                  <p className="text-[11px] font-medium text-white/80 line-clamp-2 leading-tight group-hover:text-emerald-400 transition-colors">{n.title}</p>
                  <p className="text-[9px] text-emerald-500/40 font-mono uppercase mt-2">HackerNews // Сигнал: Высокий</p>
                </div>
              ))}
              {signals?.finance?.slice(0, 5).map((f: any) => (
                <div 
                  key={f.id} 
                  onClick={() => {
                    setSelectedArchiveSignal({ ...f, type: 'finance' });
                    setShowSignalArchive(true);
                  }}
                  className="hardware-surface border border-white/5 p-3 rounded-lg hover:border-amber-500/30 transition-all cursor-pointer group"
                >
                  <p className="text-[11px] font-medium text-white/80 group-hover:text-amber-400 transition-colors">{f.name} ({f.symbol})</p>
                  <p className="text-[9px] text-amber-500/60 font-mono uppercase mt-2">Давление: {parseFloat(f.changePercent24Hr).toFixed(2)}% // Волатильность</p>
                </div>
              ))}
              {signals?.space?.slice(0, 5).map((s: any) => (
                <div 
                  key={s.id} 
                  onClick={() => {
                    setSelectedArchiveSignal({ ...s, type: 'space' });
                    setShowSignalArchive(true);
                  }}
                  className="hardware-surface border border-white/5 p-3 rounded-lg hover:border-purple-500/30 transition-all cursor-pointer group"
                >
                  <p className="text-[11px] font-medium text-white/80 line-clamp-2 leading-tight group-hover:text-purple-400 transition-colors">{s.title}</p>
                  <p className="text-[9px] text-purple-500/60 font-mono uppercase mt-2">{s.news_site} // Орбита</p>
                </div>
              ))}
              {signals?.geography?.slice(0, 5).map((g: any, i: number) => (
                <div 
                  key={i} 
                  onClick={() => {
                    setSelectedArchiveSignal({ ...g, type: 'geography' });
                    setShowSignalArchive(true);
                  }}
                  className="hardware-surface border border-white/5 p-3 rounded-lg hover:border-blue-500/30 transition-all cursor-pointer group"
                >
                  <p className="text-[11px] font-medium text-white/80 group-hover:text-blue-400 transition-colors">{g.name?.common}</p>
                  <p className="text-[9px] text-blue-500/60 font-mono uppercase mt-2">{g.region} // Узел: {g.cca2}</p>
                </div>
              ))}
              {signals?.security?.slice(0, 2).map((s: any, i: number) => (
                <div 
                  key={i} 
                  onClick={() => {
                    setSelectedArchiveSignal({ ...s, type: 'security' });
                    setShowSignalArchive(true);
                  }}
                  className="border-l-2 border-red-500/20 pl-3 py-1 cursor-pointer hover:bg-white/5 transition-all group"
                >
                  <p className="text-xs font-medium text-white/80 line-clamp-1 truncate group-hover:text-red-400 transition-colors">{s.url}</p>
                  <p className="text-[10px] text-red-500/60 uppercase mt-1">Угроза: {s.threat} // Утечка: Обнаружена</p>
                </div>
              ))}
              {signals?.art?.slice(0, 2).map((a: any, i: number) => (
                <div key={i} className="border-l-2 border-pink-500/20 pl-3 py-1">
                  <p className="text-xs font-medium text-white/80 line-clamp-1">{a.title}</p>
                  <p className="text-[10px] text-pink-500/60 uppercase mt-1">Архетип: {a.artist_display?.split('\n')[0]} // Слой: Эстетика</p>
                </div>
              ))}
              {signals?.military?.slice(0, 2).map((m: any, i: number) => (
                <div key={i} className="border-l-2 border-orange-500/20 pl-3 py-1">
                  <p className="text-xs font-medium text-white/80 line-clamp-1">{m.fields?.title}</p>
                  <p className="text-[10px] text-orange-500/60 uppercase mt-1">Конфликт: {m.fields?.source?.[0]?.name} // Статус: Активен</p>
                </div>
              ))}
              {signals?.science?.slice(0, 2).map((s: any, i: number) => (
                <div key={i} className="border-l-2 border-cyan-500/20 pl-3 py-1">
                  <p className="text-xs font-medium text-white/80 line-clamp-1">{s.title?.[0]}</p>
                  <p className="text-[10px] text-cyan-500/60 uppercase mt-1">Исследование: {s.publisher} // Вектор: Открытие</p>
                </div>
              ))}
              {signals?.ai?.slice(0, 2).map((a: any, i: number) => (
                <div 
                  key={i} 
                  onClick={() => {
                    setSelectedArchiveSignal({ ...a, type: 'ai' });
                    setShowSignalArchive(true);
                  }}
                  className="border-l-2 border-emerald-500/20 pl-3 py-1 cursor-pointer hover:bg-white/5 transition-all group"
                >
                  <p className="text-xs font-medium text-white/80 line-clamp-1 group-hover:text-emerald-400 transition-colors">{a.title}</p>
                  <p className="text-[10px] text-emerald-500/60 uppercase mt-1">Узел ИИ: {a.author} // Протокол: Интеллект</p>
                </div>
              ))}
              {signals?.spaceWeather?.slice(0, 1).map((sw: any, i: number) => (
                <div key={i} className="border-l-2 border-yellow-500/20 pl-3 py-1">
                  <p className="text-xs font-medium text-white/80">Планетарный K-индекс: {sw.kp_index}</p>
                  <p className="text-[10px] text-yellow-500/60 uppercase mt-1">Солнце: {sw.observed_time} // Поток: Переменный</p>
                </div>
              ))}
              {signals?.social?.slice(0, 2).map((s: any, i: number) => (
                <div key={i} className="border-l-2 border-orange-400/20 pl-3 py-1">
                  <p className="text-xs font-medium text-white/80 line-clamp-1">{s.title}</p>
                  <p className="text-[10px] text-orange-400/60 uppercase mt-1">Хайп: {s.subreddit} // Балл: {s.score}</p>
                </div>
              ))}
              {signals?.trending?.slice(0, 2).map((t: any, i: number) => (
                <div key={i} className="border-l-2 border-white/20 pl-3 py-1">
                  <p className="text-xs font-medium text-white/80 line-clamp-1">{t.article.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-white/40 uppercase mt-1">Тренды: Wikipedia // Просмотры: {t.views.toLocaleString()}</p>
                </div>
              ))}
              {signals?.software?.slice(0, 2).map((s: any, i: number) => (
                <div key={i} className="border-l-2 border-gray-500/20 pl-3 py-1">
                  <p className="text-xs font-medium text-white/80 line-clamp-1">{s.full_name}</p>
                  <p className="text-[10px] text-gray-500/60 uppercase mt-1">Репозиторий: {s.language} // Звезды: {s.stargazers_count}</p>
                </div>
              ))}
              {signals?.demographics?.slice(0, 1).map((d: any, i: number) => (
                <div key={i} className="border-l-2 border-green-500/20 pl-3 py-1">
                  <p className="text-xs font-medium text-white/80">{d.country?.value}</p>
                  <p className="text-[10px] text-green-500/60 uppercase mt-1">Население: {d.value ? (d.value / 1000000).toFixed(1) : '---'} млн // Рост: Стабильный</p>
                </div>
              ))}
              {signals?.labor?.slice(0, 1).map((l: any, i: number) => (
                <div key={i} className="border-l-2 border-indigo-500/20 pl-3 py-1">
                  <p className="text-xs font-medium text-white/80">{l.country?.value}</p>
                  <p className="text-[10px] text-indigo-500/60 uppercase mt-1">Безработица: {l.value !== null && l.value !== undefined ? l.value.toFixed(2) : '---'}% // Труд: Активен</p>
                </div>
              ))}
            </div>
          </section>

          {/* Sentiment Section */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="text-emerald-500" size={16} />
              <h2 className="text-xs font-mono uppercase tracking-widest text-white/60">Глобальные настроения</h2>
            </div>
            {theories.length > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase">
                  <span>{theories[0].sentiment?.label || 'Нейтрально'}</span>
                  <span>{Math.round(((theories[0].sentiment?.score || 0) + 1) * 50)}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${((theories[0].sentiment?.score || 0) + 1) * 50}%` }}
                    className={cn(
                      "h-full transition-colors",
                      (theories[0].sentiment?.score || 0) > 0.3 ? "bg-emerald-500" : 
                      (theories[0].sentiment?.score || 0) < -0.3 ? "bg-red-500" : "bg-blue-500"
                    )}
                  />
                </div>
                <p className="text-[9px] text-white/30 italic">В глобальном потоке сигналов обнаружен эмоциональный заряд.</p>
              </div>
            ) : (
              <p className="text-[10px] text-white/20 font-mono italic">Ожидание данных...</p>
            )}
          </section>

          {/* Signal Injection Section */}
          <section className="hardware-surface rounded-2xl p-5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="text-emerald-500" size={14} />
                <h2 className="micro-label">Инъекция Сигнала</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="micro-label text-[8px]">Бюджет</div>
                <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all",
                      tokenBudget > 50 ? "bg-emerald-500" : tokenBudget > 20 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${tokenBudget}%` }}
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <textarea 
                value={userSignalInput}
                onChange={(e) => setUserSignalInput(e.target.value)}
                placeholder="Введите сигнал вручную или URL..."
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[11px] font-mono text-emerald-400/80 focus:border-emerald-500/50 focus:outline-none min-h-[80px] resize-none"
              />
              
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleInjectSignal}
                  disabled={!userSignalInput.trim() || isAnalyzing || isProcessingFiles}
                  className="py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-[10px] font-mono uppercase tracking-widest text-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Zap size={12} /> {isAnalyzing ? "..." : "Ввести"}
                </button>
                
                <label className={cn(
                  "py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-mono uppercase tracking-widest text-white/60 transition-all cursor-pointer flex items-center justify-center gap-2",
                  isProcessingFiles && "opacity-50 cursor-wait"
                )}>
                  <Folder size={12} /> {isProcessingFiles ? "Парсинг..." : "Папка"}
                  <input 
                    type="file" 
                    {...({ webkitdirectory: "", directory: "" } as any)}
                    multiple 
                    className="hidden" 
                    onChange={handleFolderUpload}
                    disabled={isProcessingFiles}
                  />
                </label>
              </div>
              
              <p className="text-[9px] text-white/30 italic text-center uppercase tracking-tighter">
                Поддерживает .txt, .json, .md (Obsidian) и экспорт Telegram .html.
              </p>
            </div>
          </section>

          {/* Archives Section */}
          <section className="hardware-surface rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="text-emerald-500" size={14} />
              <h2 className="micro-label">Исторические Архивы</h2>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {CONSPIRACY_CATALOG.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedTheory(transformHistoricalToTheory(item))}
                  className="group hardware-surface border border-white/5 hover:border-emerald-500/40 p-4 rounded-xl transition-all cursor-pointer hover:shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[11px] font-bold text-white/80 group-hover:text-emerald-400 transition-colors leading-tight">{item.title}</p>
                    <span className={cn(
                      "text-[7px] px-1.5 py-0.5 rounded uppercase font-mono whitespace-nowrap ml-2",
                      item.status === 'Рассекречено' ? "bg-red-500/10 text-red-400" : 
                      item.status === 'Научное' ? "bg-blue-500/10 text-blue-400" :
                      "bg-white/10 text-white/40"
                    )}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/40 line-clamp-2 italic leading-tight mb-3">{item.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.keywords.slice(0, 3).map(kw => (
                      <span key={kw} className="text-[8px] text-emerald-500/40 font-mono bg-emerald-500/5 px-1.5 py-0.5 rounded">#{kw}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Middle Column: Theories */}
        <div className="lg:col-span-8 space-y-8">
          <AnimatePresence>
            {showDashboard && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden hardware-surface rounded-2xl p-6 border border-white/10"
              >
                <Dashboard theories={theories} systemState={systemState} totalRecords={totalRecords} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold italic tracking-tight text-white/90">
                {showOracle ? "Архив Оракула" : "Досье"}: <span className="text-emerald-500">{showOracle ? "Подтвержденные Аномалии" : "Проявление Паттернов"}</span>
              </h2>
              <button 
                onClick={() => setShowOracle(!showOracle)}
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest border transition-all",
                  showOracle ? "bg-emerald-500 text-black border-emerald-500" : "border-white/20 text-white/40 hover:border-white/40"
                )}
              >
                {showOracle ? "Просмотр Гипотез" : "Просмотр Оракула"}
              </button>
            </div>
          </div>

          <div 
            onScroll={handleScroll}
            className="h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar pr-4 -mr-4"
          >
            {loading ? (
              <div className="h-96 flex flex-col items-center justify-center gap-4 text-white/20">
                <Cpu size={48} className="animate-spin" />
                <p className="font-mono text-xs animate-pulse">Синтез нарративных слоев...</p>
              </div>
            ) : (
              <div className="space-y-12 pb-20">
                {groupedTheories.map((group, groupIdx) => (
                  <section key={groupIdx} className="relative">
                    {/* Chronology Header */}
                    <div className="sticky top-0 z-10 flex items-center gap-4 mb-4 py-2 bg-[#0d0d0f]/80 backdrop-blur-sm">
                      <div className="month-label">{group.day} {group.month}</div>
                      <div className="text-[40px] font-display font-black opacity-10 leading-none">{group.year}</div>
                      <div className="h-px flex-1 bg-white/5" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <AnimatePresence>
                        {group.theories.map((theory, idx) => (
                          <motion.div
                            key={theory.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: Math.min(idx * 0.02, 0.4) }}
                            onClick={() => setSelectedTheory(theory)}
                            className="group relative hardware-surface border border-white/10 rounded-2xl p-6 cursor-pointer hover:border-emerald-500/50 transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] overflow-hidden"
                          >
                            {/* Status Badge for Oracle */}
                            {showOracle && (
                              <div className={cn(
                                "absolute top-0 right-0 px-4 py-1 rounded-bl-xl text-[8px] font-mono uppercase tracking-widest",
                                theory.status === 'Подтверждено' ? "bg-emerald-500 text-black" : "bg-red-500 text-white"
                              )}>
                                {theory.status}
                              </div>
                            )}

                            <div className="absolute top-4 right-4 text-[10px] font-mono text-white/20 group-hover:text-emerald-500 transition-colors">
                              {theory.version > 1 ? `v${theory.version}` : `0${idx + 1}`}
                            </div>
                            
                            <div className="mb-4 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                                  {theory.category}
                                </span>
                                {theory.parentTheoryId && (
                                  <span className="text-[8px] font-mono text-white/40 uppercase">Эволюция</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-500/40 uppercase">
                                <Shield size={10} /> Рациональный Аудит
                              </div>
                            </div>

                            <h3 className="text-xl font-bold mb-3 group-hover:text-emerald-400 transition-colors">{theory.title}</h3>
                            <p className="text-sm text-white/60 line-clamp-3 leading-relaxed mb-6 italic">
                              "{theory.thesis}"
                            </p>

                            <div className="flex items-center gap-4 mt-auto pt-4 border-t border-white/5">
                              <div className="flex-1">
                                <div className="flex justify-between text-[9px] font-mono text-white/40 mb-1 uppercase">
                                  <span>Убедительность</span>
                                  <span>{theory.persuasionIndex}%</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${theory.persuasionIndex}%` }}
                                    className="h-full bg-emerald-500" 
                                  />
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between text-[9px] font-mono text-white/40 mb-1 uppercase">
                                  <span>Балл Оракула</span>
                                  <span>{theory.oracleScore || 0}</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(theory.oracleScore || 0) * 10}%` }}
                                    className="h-full bg-blue-500" 
                                  />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </section>
                ))}

                {hasMore && (
                  <div className="flex flex-col items-center gap-4 py-12">
                    <button 
                      onClick={() => setTheoryLimit(prev => prev + 20)}
                      className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-mono uppercase tracking-widest text-white/40 transition-all"
                    >
                      Загрузить еще
                    </button>
                    <div className="flex items-center gap-2 text-white/10 font-mono text-[8px] uppercase tracking-widest">
                      <RefreshCcw size={10} className="animate-spin" />
                      Синхронизация с глубокими слоями...
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {!loading && theories.filter(t => showOracle ? (t.status === 'Подтверждено' || t.status === 'Опровергнуто') : (t.status !== 'Подтверждено' && t.status !== 'Опровергнуто')).length === 0 && (
            <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
              <p className="text-white/20 font-mono text-sm uppercase tracking-widest">
                {showOracle ? "В архиве нет подтвержденных аномалий" : "Ожидание синхронизации сигналов..."}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Manual Modal */}
      <AnimatePresence>
        {showManual && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManual(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0d0d0f] border border-white/10 rounded-3xl p-8 overflow-y-auto max-h-[80vh] font-sans"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold italic tracking-tight uppercase">Инструкция Оператора</h2>
                <button onClick={() => setShowManual(false)} className="text-white/40 hover:text-white"><EyeOff size={20}/></button>
              </div>

              <div className="space-y-6 text-sm leading-relaxed text-white/70">
                <section>
                  <h3 className="text-emerald-500 font-mono uppercase text-xs mb-2 tracking-widest">01. Концепция</h3>
                  <p>
                    <strong>Лаборатория Совпадений</strong> — это аналитическая машина, которая превращает шум реального мира в многослойные мифологии. Мы не доказываем заговоры, мы строим художественные интерпретации глобальных синхроний.
                  </p>
                </section>

                <section>
                  <h3 className="text-emerald-500 font-mono uppercase text-xs mb-2 tracking-widest">02. Источники (Сигналы)</h3>
                  <p>Приложение перехватывает открытые данные из трех контуров:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><span className="text-emerald-400">Инфо-поле:</span> Последние заголовки Hacker News.</li>
                    <li><span className="text-amber-400">Финансовое давление:</span> Колебания рынка криптовалют.</li>
                    <li><span className="text-purple-400">Космический слой:</span> События на орбите и в космосе.</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-emerald-500 font-mono uppercase text-xs mb-2 tracking-widest">03. Режимы работы</h3>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                      <strong className="text-white block mb-1">Вымысел (Fiction)</strong>
                      Чистая мифология и художественный сторителлинг.
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                      <strong className="text-white block mb-1">Аналитик (Analyst)</strong>
                      Поиск логических корреляций и фактов.
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                      <strong className="text-white block mb-1">Паранойя (Paranoia)</strong>
                      Театральный режим с визуальными искажениями.
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                      <strong className="text-white block mb-1">Разоблачение (Debunk)</strong>
                      Критический разбор и поиск рациональных объяснений.
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-emerald-500 font-mono uppercase text-xs mb-2 tracking-widest">04. Навигация</h3>
                  <p>
                    Нажмите на карточку теории, чтобы открыть полное <strong>Досье</strong>. Внутри вы найдете цепочку наблюдений и прогноз развития событий.
                  </p>
                </section>

                <div className="pt-6 border-t border-white/5 text-[10px] font-mono text-white/30 text-center uppercase tracking-widest">
                  Внимание: Данное приложение является арт-объектом. Любые совпадения не случайны, но и не обязательны.
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Signal Archive Modal */}
      <AnimatePresence>
        {showSignalArchive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-12"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-6xl h-full bg-[#0d0d0f] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <Database className="text-emerald-500" size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white uppercase">Архив Сигналов</h2>
                    <p className="micro-label text-white/30">Глобальная база данных входящих потоков</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowSignalArchive(false);
                    setSelectedArchiveSignal(null);
                  }}
                  className="p-2 hover:bg-white/5 rounded-full border border-white/10 text-white/40 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex">
                {/* Sidebar: Categories */}
                <div className="w-64 border-r border-white/5 p-4 space-y-6 overflow-y-auto custom-scrollbar bg-black/20">
                  <div>
                    <h3 className="micro-label text-[10px] mb-4 px-2">Категории</h3>
                    <div className="space-y-1">
                      {[
                        { id: 'news', label: 'Новости', icon: Globe, color: 'text-emerald-500' },
                        { id: 'finance', label: 'Финансы', icon: TrendingUp, color: 'text-amber-500' },
                        { id: 'space', label: 'Космос', icon: Zap, color: 'text-purple-500' },
                        { id: 'geography', label: 'География', icon: Globe, color: 'text-blue-500' },
                        { id: 'security', label: 'Безопасность', icon: Shield, color: 'text-red-500' },
                        { id: 'ai', label: 'Интеллект', icon: Cpu, color: 'text-emerald-400' },
                        { id: 'social', label: 'Социум', icon: Activity, color: 'text-orange-400' },
                      ].map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            // Filter logic could go here, for now just sets type for detail view if needed
                            if (signals && (signals as any)[cat.id]) {
                              setSelectedArchiveSignal({ ...(signals as any)[cat.id][0], type: cat.id });
                            }
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-mono transition-all border",
                            selectedArchiveSignal?.type === cat.id 
                              ? "bg-white/10 border-white/20 text-white" 
                              : "border-transparent text-white/40 hover:bg-white/5 hover:text-white/60"
                          )}
                        >
                          <cat.icon size={14} className={cat.color} />
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5">
                    <h3 className="micro-label text-[10px] mb-4 px-2">Эффективность</h3>
                    <div className="space-y-3 px-2">
                      {[
                        { label: 'AI/Tech', val: 92 },
                        { label: 'Finance', val: 78 },
                        { label: 'Geopolitics', val: 64 }
                      ].map((stat, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-[8px] font-mono text-white/40 uppercase">
                            <span>{stat.label}</span>
                            <span>{stat.val}%</span>
                          </div>
                          <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500/40" style={{ width: `${stat.val}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Main Content: Signal List & Detail */}
                <div className="flex-1 flex overflow-hidden">
                  {/* List */}
                  <div className="w-1/2 border-r border-white/5 overflow-y-auto custom-scrollbar p-6 space-y-4">
                    <h3 className="micro-label text-[10px] mb-4">Входящие потоки</h3>
                    {Object.entries(signals || {}).filter(([_, list]) => Array.isArray(list)).map(([type, list]: [string, any]) => (
                      <div key={type} className="space-y-3">
                        {list.map((s: any, i: number) => (
                          <div 
                            key={s.id || i}
                            onClick={() => setSelectedArchiveSignal({ ...s, type })}
                            className={cn(
                              "p-4 rounded-xl border transition-all cursor-pointer group",
                              selectedArchiveSignal?.id === s.id || (selectedArchiveSignal?.title === s.title && selectedArchiveSignal?.type === type)
                                ? "bg-emerald-500/10 border-emerald-500/30" 
                                : "bg-white/5 border-white/5 hover:border-white/20"
                            )}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[9px] font-mono uppercase text-white/30">{type}</span>
                              <span className="text-[9px] font-mono text-emerald-500/60">#{Math.random().toString(36).substr(2, 6).toUpperCase()}</span>
                            </div>
                            <p className="text-xs font-medium text-white/80 group-hover:text-white transition-colors">
                              {s.title || s.name || s.url || s.article || "Безымянный сигнал"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Detail View */}
                  <div className="w-1/2 bg-black/40 p-8 overflow-y-auto custom-scrollbar">
                    {selectedArchiveSignal ? (
                      <div className="space-y-8">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-500 text-[9px] font-mono uppercase rounded border border-emerald-500/30">
                              {selectedArchiveSignal.type}
                            </span>
                            <span className="text-[10px] font-mono text-white/20">
                              ID: {Math.random().toString(36).substr(2, 12).toUpperCase()}
                            </span>
                          </div>
                          <h1 className="text-2xl font-bold text-white leading-tight">
                            {selectedArchiveSignal.title || selectedArchiveSignal.name || selectedArchiveSignal.url || selectedArchiveSignal.article}
                          </h1>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="hardware-surface p-4 rounded-xl border border-white/5">
                            <p className="micro-label text-[8px] mb-1">Источник</p>
                            <p className="text-sm font-mono text-emerald-500">
                              {selectedArchiveSignal.news_site || selectedArchiveSignal.source || selectedArchiveSignal.author || "Внешний узел"}
                            </p>
                          </div>
                          <div className="hardware-surface p-4 rounded-xl border border-white/5">
                            <p className="micro-label text-[8px] mb-1">Время обнаружения</p>
                            <p className="text-sm font-mono text-white/60">
                              {new Date().toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="micro-label flex items-center gap-2">
                            <Terminal size={12} className="text-emerald-500" /> Сырые данные
                          </h4>
                          <div className="bg-black p-4 rounded-xl border border-white/5 font-mono text-[11px] text-emerald-500/70 leading-relaxed overflow-x-auto">
                            <pre>{JSON.stringify(selectedArchiveSignal, null, 2)}</pre>
                          </div>
                        </div>

                        <div className="pt-8 border-t border-white/5">
                          <button className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-mono uppercase tracking-widest text-white/60 hover:text-white transition-all flex items-center justify-center gap-2">
                            <Share2 size={14} /> Переслать в Оракул
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                        <Database size={48} />
                        <div>
                          <p className="text-sm font-mono uppercase tracking-widest">Выберите сигнал</p>
                          <p className="text-[10px] font-mono mt-1">Ожидание выбора узла для анализа</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Theory Modal */}
      <AnimatePresence>
        {selectedTheory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTheory(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-[#0d0d0f] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono uppercase tracking-[0.3em] text-emerald-500">Классификация: {selectedTheory.category}</span>
                    <span className="text-[10px] font-mono text-white/20 uppercase">v{selectedTheory.version}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => exportToMarkdown(selectedTheory)}
                      className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-emerald-500"
                      title="Экспорт отчета разведки"
                    >
                      <Download size={20} />
                    </button>
                    <button 
                      onClick={() => setSelectedTheory(null)}
                      className="p-2 hover:bg-white/5 rounded-full transition-colors"
                    >
                      <EyeOff size={20} />
                    </button>
                  </div>
                </div>

                <h2 className="text-4xl font-bold italic mb-6 tracking-tight">{selectedTheory.title}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-8">
                    <section>
                      <h4 className="micro-label mb-3 flex items-center gap-2">
                        <Zap size={12} className="text-emerald-500" /> Тезис
                      </h4>
                      <p className="text-lg text-white/80 leading-relaxed font-medium">
                        {selectedTheory.thesis}
                      </p>
                    </section>

                    <section>
                      <h4 className="micro-label mb-3 flex items-center gap-2">
                        <Activity size={12} className="text-emerald-500" /> Цепочка Наблюдений
                      </h4>
                      <ul className="space-y-3">
                        {selectedTheory.observations.map((obs, i) => (
                          <li key={i} className="flex gap-3 text-sm text-white/60">
                            <span className="text-emerald-500 font-mono">[{i+1}]</span>
                            <span>{obs}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section className="p-6 bg-red-500/5 border border-red-500/10 rounded-2xl">
                      <h4 className="micro-label text-red-400/60 mb-3 flex items-center gap-2">
                        <Shield size={12} /> Контраргумент (Контрразведка)
                      </h4>
                      <p className="text-sm text-red-200/60 italic leading-relaxed">
                        {selectedTheory.counterArgument}
                      </p>
                    </section>

                    <section className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                      <h4 className="micro-label text-emerald-400/60 mb-3 flex items-center gap-2">
                        <Zap size={12} /> Рациональный Анализ (Когнитивная Безопасность)
                      </h4>
                      <p className="text-sm text-emerald-200/60 leading-relaxed">
                        {selectedTheory.criticalAnalysis}
                      </p>
                      <div className="mt-4 pt-4 border-t border-emerald-500/10 flex items-center gap-2">
                        <AlertTriangle size={10} className="text-emerald-500/40" />
                        <span className="text-[9px] font-mono text-emerald-500/40 uppercase tracking-wider">Протокол: Анти-Предвзятость Активен</span>
                      </div>
                    </section>
                  </div>

                  <div className="space-y-8">

                    <section>
                      <h4 className="micro-label mb-3 flex items-center gap-2">
                        <AlertTriangle size={12} className="text-emerald-500" /> Прогностический Вектор
                      </h4>
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                        <p className="text-xs text-white/50 leading-relaxed italic">
                          "{selectedTheory.prediction}"
                        </p>
                        {selectedTheory.oracleScore !== undefined && (
                          <div className="flex justify-between items-center pt-2 border-t border-white/5">
                            <span className="micro-label text-[8px]">Балл Оракула</span>
                            <span className="text-xs font-mono text-emerald-500">+{selectedTheory.oracleScore}</span>
                          </div>
                        )}
                      </div>
                    </section>

                    {selectedTheory.sentiment && (
                      <section>
                        <h4 className="micro-label mb-3 flex items-center gap-2">
                          <Activity size={12} className="text-emerald-500" /> Слой Настроений
                        </h4>
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                          <div className="flex justify-between text-[10px] font-mono text-white/40 mb-2 uppercase">
                            <span>{selectedTheory.sentiment.label}</span>
                            <span>{Math.round(((selectedTheory.sentiment.score || 0) + 1) * 50)}%</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all",
                                selectedTheory.sentiment.score > 0.3 ? "bg-emerald-500" : 
                                selectedTheory.sentiment.score < -0.3 ? "bg-red-500" : "bg-blue-500"
                              )}
                              style={{ width: `${((selectedTheory.sentiment.score || 0) + 1) * 50}%` }} 
                            />
                          </div>
                        </div>
                      </section>
                    )}

                    {selectedTheory.archiveLinks && selectedTheory.archiveLinks.length > 0 && (
                      <section>
                        <h4 className="micro-label mb-3 flex items-center gap-2">
                          <LinkIcon size={12} className="text-emerald-500" /> Архивные Параллели
                        </h4>
                        <div className="space-y-2">
                          {selectedTheory.archiveLinks.map(link => (
                            <div key={link.id} className="text-[10px] font-mono p-2 bg-white/5 rounded border border-white/5 text-emerald-500/60 italic">
                              {link.title}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-black/50 border-t border-white/5 flex justify-center">
                <button 
                  onClick={() => setSelectedTheory(null)}
                  className="px-12 py-2 bg-emerald-500 text-black font-bold uppercase text-[10px] tracking-widest rounded-lg hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  Закрыть Досье
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer / Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0d0d0f]/90 backdrop-blur-md border-t border-white/10 px-6 py-1.5 flex items-center justify-between hardware-surface z-[100]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="micro-label text-white/40">Сеть: Зашифрована</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield size={10} className="text-white/20" />
            <span className="micro-label text-white/40">Протокол: ShadowAtlas v3.1</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="micro-label text-white/20">Режим:</span>
            <span className="micro-label text-emerald-500/80">{mode}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="micro-label text-white/20">Время работы:</span>
            <span className="micro-label text-white/40 font-mono">04:21:09:12</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
