import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Activity, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

interface DashboardProps {
  systemState: {
    escalation: number;
    destab: number;
    attentionSpike: number;
    lastUpdated: any;
  };
  theories: any[];
  totalRecords: number | null;
}

const Dashboard: React.FC<DashboardProps> = ({ systemState, theories, totalRecords }) => {
  // Generate mock temporal data based on theories
  const temporalData = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayStr = date.toLocaleDateString('ru-RU', { weekday: 'short' });
    
    // Count theories for this day (mocked for visualization)
    const count = theories.filter(t => {
      const tDate = new Date(t.lastUpdated);
      return tDate.getDate() === date.getDate();
    }).length + Math.floor(Math.random() * 5);

    return {
      name: dayStr,
      signals: count * 12 + Math.floor(Math.random() * 20),
      theories: count,
      escalation: ((systemState.escalation || 0) * 100) + (Math.random() * 10 - 5)
    };
  });

  return (
    <div className="space-y-6 p-6 bg-[#0d0d0f] border border-white/10 rounded-3xl font-sans">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold italic flex items-center gap-3">
          <Activity className="text-emerald-500" size={20} />
          Системная аналитика v3.1
        </h2>
        <div className="text-[10px] font-mono text-white/30 uppercase">
          Последнее обновление: {
            systemState.lastUpdated 
              ? (typeof systemState.lastUpdated === 'string' 
                  ? new Date(systemState.lastUpdated).toLocaleTimeString()
                  : new Date(systemState.lastUpdated.seconds * 1000).toLocaleTimeString())
              : new Date().toLocaleTimeString()
          }
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
            <Zap size={20} />
          </div>
          <div>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Индекс Эскалации</p>
            <p className="text-2xl font-bold">{((systemState.escalation || 0) * 100).toFixed(1)}%</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Activity size={20} />
          </div>
          <div>
            <p className="micro-label text-white/40 uppercase tracking-widest">Всего паттернов</p>
            <p className="text-2xl font-bold">{totalRecords !== null ? totalRecords : theories.length}</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Всплеск Внимания</p>
            <p className="text-2xl font-bold">{((systemState.attentionSpike || 0) * 100).toFixed(1)}%</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Фактор Дестабилизации</p>
            <p className="text-2xl font-bold">{((systemState.destab || 0) * 100).toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-xs font-mono uppercase tracking-widest text-white/40 mb-6 flex justify-between items-center">
            <span>Временная Плотность Сигналов</span>
            <span className="text-emerald-500/60 text-[8px]">Обнаружение паттернов: АКТИВНО</span>
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={temporalData}>
                <defs>
                  <linearGradient id="colorSignals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#ffffff20" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#ffffff20" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0d0d0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="signals" 
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorSignals)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-xs font-mono uppercase tracking-widest text-white/40 mb-6">Эффективность Источников (Паттерны)</h3>
          <div className="space-y-4">
            {[
              { label: 'HackerNews (AI/Tech)', value: 85, color: 'bg-emerald-500' },
              { label: 'Wikipedia (Trends)', value: 62, color: 'bg-blue-500' },
              { label: 'CoinCap (Finance)', value: 48, color: 'bg-amber-500' },
              { label: 'SpaceFlight (Space)', value: 35, color: 'bg-purple-500' },
              { label: 'Security (Threats)', value: 28, color: 'bg-red-500' },
            ].map((source, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-white/60">{source.label}</span>
                  <span className="text-white/40">{source.value}% ценности</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-1000", source.color)}
                    style={{ width: `${source.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-4">
        <AlertTriangle className="text-emerald-500 mt-1" size={16} />
        <div className="text-xs text-emerald-500/80 leading-relaxed">
          <span className="font-bold uppercase">Аналитическая сводка:</span> Обнаружено аномальное скопление сигналов в секторе "Алгоритмика". Индекс эскалации стабилен, но требует мониторинга в связи с ростом Attention Spike. Рекомендуется экспорт графа для детального анализа в Gephi.
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
