'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { calculateReturns, getTableName } from '../utils/calculations';
import { RefreshCw, TrendingUp, Trash2, History, PlusCircle, BarChart3, AlertTriangle, DollarSign, ChevronDown, ChevronRight } from 'lucide-react';

// --- 탭 UI (가로 스크롤 최적화) ---
const Tabs = ({ active, setActive }: any) => {
  const menus = [
    { id: "대시보드", icon: <BarChart3 size={18} /> },
    { id: "종목 추가", icon: <PlusCircle size={18} /> },
    { id: "추가 매수", icon: <DollarSign size={18} /> },
    { id: "종목 매도", icon: <Trash2 size={18} /> },
    { id: "매도 이력", icon: <History size={18} /> }
  ];
  
  return (
    <div className="w-full overflow-x-auto pb-2 mb-4 scrollbar-hide border-b border-gray-800">
      <div className="flex space-x-2 min-w-max px-2">
        {menus.map(menu => (
          <button
            key={menu.id}
            onClick={() => setActive(menu.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${
              active === menu.id 
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50' 
                : 'bg-gray-800 text-gray-400 border border-transparent hover:bg-gray-700'
            }`}
          >
            {menu.icon}
            {menu.id}
          </button>
        ))}
      </div>
    </div>
  );
};

// --- 메인 페이지 ---
export default function Home() {
  const [activeTab, setActiveTab] = useState("대시보드");
  const [loading, setLoading] = useState(false);
  
  // 데이터 상태
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any[]>([]);
  const [addBuys, setAddBuys] = useState<any[]>([]);
  const [sellHistory, setSellHistory] = useState<any[]>([]);

  // [추가] 대시보드 내역 접기/펼치기 상태
  const [isAddHistoryOpen, setAddHistoryOpen] = useState(false);
  const [isSellHistoryOpen, setSellHistoryOpen] = useState(false);

  // ------------------------------------------
  // 데이터 로딩
  // ------------------------------------------
  const fetchData = async () => {
    setLoading(true);
    try {
      const [pfRes, addRes, histRes] = await Promise.all([
        supabase.from('portfolio').select('*'),
        supabase.from('additional_buys').select('*'),
        supabase.from('sell_history').select('*').order('sell_date', { ascending: false })
      ]);

      const pfData = pfRes.data || [];
      const adds = addRes.data || [];
      const history = histRes.data || [];

      setPortfolio(pfData);
      setAddBuys(adds);
      setSellHistory(history);

      if (pfData.length > 0) {
        const calculatedResults = await Promise.all(pfData.map(async (stock) => {
          try {
            const tableName = getTableName(stock.code);
            const { data: prices, error: priceError } = await supabase
              .from(tableName)
              .select('*')
              .order('date', { ascending: true });
            
            if (priceError || !prices) return { ...stock, roiLump: 0, roiDca: 0, roiComp: 0, currentPrice: 0 };
            const calcs = await calculateReturns(stock, adds, prices);
            return { ...stock, ...calcs };
          } catch (innerError) {
            return { ...stock, roiLump: 0, roiDca: 0, roiComp: 0, currentPrice: 0 };
          }
        }));
        setDashboardData(calculatedResults.sort((a, b) => a.rec_date.localeCompare(b.rec_date)));
      } else {
        setDashboardData([]);
      }
    } catch (e: any) {
      alert("오류: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ------------------------------------------
  // 매도 처리
  // ------------------------------------------
  const handleSell = async (stockId: number, sellDate: string) => {
    const targetStock = portfolio.find(p => p.id === Number(stockId));
    if (!targetStock) return alert("종목 선택 필요");
    if (!sellDate) return alert("매도일 선택 필요");
    
    if (!confirm(`[${targetStock.name}] 매도하시겠습니까?`)) return;

    setLoading(true);
    try {
      const tableName = getTableName(targetStock.code);
      const { data: prices, error } = await supabase
        .from(tableName).select('*').lte('date', sellDate).order('date', { ascending: true });

      if (error || !prices || prices.length === 0) throw new Error("데이터 없음");

      const calcs = await calculateReturns(targetStock, addBuys, prices);

      const { error: insertError } = await supabase.from('sell_history').insert([{
        name: targetStock.name,
        code: targetStock.code,
        recommender: targetStock.recommender,
        country: targetStock.country,
        rec_date: targetStock.rec_date,
        sell_date: sellDate,
        return_lump: calcs.roiLump,
        return_dca: calcs.roiDca,
        return_comp: calcs.roiComp,
        total_invested: calcs.meta?.totalInvestedComp || 0,
        final_eval: calcs.meta?.finalEvalComp || 0,
        note: `매도가: ${calcs.currentPrice.toLocaleString()}`
      }]);

      if (insertError) throw insertError;
      await supabase.from('portfolio').delete().eq('id', targetStock.id);

      alert(`✅ 매도 완료`);
      setActiveTab("매도 이력");
      fetchData(); 
    } catch (e: any) {
      alert(`실패: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatPct = (val: number) => {
    if (val === undefined || val === null) return <span className="text-gray-600">-</span>;
    const color = val > 0 ? 'text-red-400' : val < 0 ? 'text-blue-400' : 'text-gray-500';
    return <span className={`font-bold ${color}`}>{val.toFixed(2)}%</span>;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans pb-10">
      {/* 헤더 */}
      <div className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex justify-between items-center">
        <h1 className="text-lg font-bold flex items-center gap-2 text-white">
          <TrendingUp className="text-blue-500" size={20} /> 투자 대시보드
        </h1>
        <button onClick={fetchData} disabled={loading} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition">
          <RefreshCw size={18} className={`text-gray-300 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <Tabs active={activeTab} setActive={setActiveTab} />

        {/* --- [1] 대시보드 --- */}
        {activeTab === "대시보드" && (
          <div className="animate-fade-in space-y-6">
            
            {/* 1. 메인 포트폴리오 현황 (테이블) */}
            <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-900 shadow-lg">
              <div className="overflow-x-auto relative">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                    <tr>
                      <th className="sticky left-0 z-20 bg-gray-800 px-4 py-3 border-r border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">종목명</th>
                      <th className="px-4 py-3 text-right">현재가</th>
                      <th className="px-4 py-3 text-right">수익률(복합)</th>
                      <th className="px-4 py-3 text-right text-gray-500">수익률(거치)</th>
                      <th className="px-4 py-3 text-right text-gray-500">수익률(적립)</th>
                      <th className="px-4 py-3 text-center">추천일</th>
                      <th className="px-4 py-3 text-center">추천인</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {dashboardData.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-500">데이터가 없습니다.</td></tr>
                    ) : (
                      dashboardData.map((row) => (
                        <tr key={row.id} className="bg-gray-900 hover:bg-gray-800 transition">
                          <td className="sticky left-0 z-10 bg-gray-900 px-4 py-3 border-r border-gray-800 font-bold text-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                            {row.name}
                            <span className="block text-[10px] font-normal text-gray-500">{row.code}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-300">{row.currentPrice?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-base">{formatPct(row.roiComp)}</td>
                          <td className="px-4 py-3 text-right text-gray-400">{formatPct(row.roiLump)}</td>
                          <td className="px-4 py-3 text-right text-gray-400">{formatPct(row.roiDca)}</td>
                          <td className="px-4 py-3 text-center font-mono text-xs text-gray-500">{row.rec_date}</td>
                          <td className="px-4 py-3 text-center text-xs text-gray-500">{row.recommender}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. 추가 매수 내역 (아코디언) */}
            <div className="border border-gray-700 rounded-xl bg-gray-900 overflow-hidden shadow-md">
              <button 
                onClick={() => setAddHistoryOpen(!isAddHistoryOpen)}
                className="w-full flex justify-between items-center p-4 bg-gray-800 hover:bg-gray-750 transition"
              >
                <div className="flex items-center gap-2 font-bold text-gray-200">
                   <DollarSign size={18} className="text-green-500" /> 
                   추가 매수 내역
                   <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{addBuys.length}</span>
                </div>
                {isAddHistoryOpen ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
              </button>

              {isAddHistoryOpen && (
                <div className="border-t border-gray-700 animate-fade-in">
                  <div className="overflow-x-auto relative max-h-[300px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 sticky top-0 z-30">
                        <tr>
                          <th className="sticky left-0 z-20 bg-gray-800 px-4 py-3 border-r border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">종목명</th>
                          <th className="px-4 py-3">매수일</th>
                          <th className="px-4 py-3 text-right">비중(%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {addBuys.length === 0 ? (
                           <tr><td colSpan={3} className="text-center py-6 text-gray-500">추가 매수 내역이 없습니다.</td></tr>
                        ) : (
                          [...addBuys].sort((a,b) => b.date.localeCompare(a.date)).map((item, idx) => {
                             const stockName = portfolio.find(p => p.code === item.code)?.name || item.code;
                             return (
                              <tr key={idx} className="bg-gray-900 hover:bg-gray-800 transition">
                                <td className="sticky left-0 z-10 bg-gray-900 px-4 py-3 border-r border-gray-800 font-bold text-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                                  {stockName}
                                  {stockName !== item.code && <span className="block text-[10px] font-normal text-gray-500">{item.code}</span>}
                                </td>
                                <td className="px-4 py-3 font-mono text-gray-400">{item.date}</td>
                                <td className="px-4 py-3 text-right font-bold text-green-400">+{item.ratio * 100}%</td>
                              </tr>
                             );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* 3. 매도 내역 (아코디언) */}
            <div className="border border-gray-700 rounded-xl bg-gray-900 overflow-hidden shadow-md">
              <button 
                onClick={() => setSellHistoryOpen(!isSellHistoryOpen)}
                className="w-full flex justify-between items-center p-4 bg-gray-800 hover:bg-gray-750 transition"
              >
                <div className="flex items-center gap-2 font-bold text-gray-200">
                   <History size={18} className="text-blue-500" /> 
                   매도 완료 내역
                   <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{sellHistory.length}</span>
                </div>
                {isSellHistoryOpen ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
              </button>

              {isSellHistoryOpen && (
                <div className="border-t border-gray-700 animate-fade-in">
                  <div className="overflow-x-auto relative max-h-[300px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 sticky top-0 z-30">
                        <tr>
                          <th className="sticky left-0 z-20 bg-gray-800 px-4 py-3 border-r border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">종목명</th>
                          <th className="px-4 py-3">매도일</th>
                          <th className="px-4 py-3 text-right">최종 수익률</th>
                          <th className="px-4 py-3 text-right">평가금액</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {sellHistory.length === 0 ? (
                           <tr><td colSpan={4} className="text-center py-6 text-gray-500">매도 이력이 없습니다.</td></tr>
                        ) : (
                          sellHistory.map((h: any) => (
                            <tr key={h.id} className="bg-gray-900 hover:bg-gray-800 transition">
                              <td className="sticky left-0 z-10 bg-gray-900 px-4 py-3 border-r border-gray-800 font-bold text-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                                {h.name}
                              </td>
                              <td className="px-4 py-3 font-mono text-gray-400">{h.sell_date}</td>
                              <td className="px-4 py-3 text-right">{formatPct(h.return_comp)}</td>
                              <td className="px-4 py-3 text-right font-mono text-gray-400">{h.final_eval?.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3 text-center border-t border-gray-800 bg-gray-900">
                     <button onClick={() => setActiveTab("매도 이력")} className="text-xs text-blue-400 hover:underline">
                        전체 상세 내역 보기 →
                     </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* --- [2] 종목 추가 --- */}
        {activeTab === "종목 추가" && (
            <StockAddForm onSuccess={() => { setActiveTab("대시보드"); fetchData(); }} />
        )}

        {/* --- [3] 추가 매수 --- */}
        {activeTab === "추가 매수" && (
            <AdditionalBuyForm portfolio={portfolio} onSuccess={() => { setActiveTab("대시보드"); fetchData(); }} />
        )}

        {/* --- [4] 종목 매도 --- */}
        {activeTab === "종목 매도" && (
            <div className="animate-fade-in">
                <div className="bg-red-900/10 border border-red-900/30 p-4 rounded-xl mb-4 flex gap-3 text-sm">
                    <AlertTriangle className="text-red-500 shrink-0" size={18} />
                    <p className="text-red-300">매도 확정 시 포트폴리오에서 삭제되며, <b>매도 이력</b> 탭으로 이동합니다.</p>
                </div>
                <SellForm portfolio={portfolio} onSell={handleSell} loading={loading} />
            </div>
        )}

        {/* --- [5] 매도 이력 (상세 테이블) --- */}
        {activeTab === "매도 이력" && (
           <div className="animate-fade-in border border-gray-700 rounded-xl overflow-hidden bg-gray-900 shadow-lg">
            <div className="overflow-x-auto relative">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-800 px-4 py-3 border-r border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">종목명</th>
                    <th className="px-4 py-3">매도일</th>
                    <th className="px-4 py-3 text-right">수익률(복합)</th>
                    <th className="px-4 py-3 text-right">수익률(거치)</th>
                    <th className="px-4 py-3 text-right">수익률(적립)</th>
                    <th className="px-4 py-3 text-right">최종평가액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sellHistory.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-500">이력이 없습니다.</td></tr>
                  ) : (
                    sellHistory.map((h: any) => (
                      <tr key={h.id} className="bg-gray-900 hover:bg-gray-800 transition">
                         <td className="sticky left-0 z-10 bg-gray-900 px-4 py-3 border-r border-gray-800 font-bold text-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                            {h.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{h.sell_date}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatPct(h.return_comp)}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{formatPct(h.return_lump)}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{formatPct(h.return_dca)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">{h.final_eval?.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 하위 컴포넌트 (모바일 최적화 폼)
// ----------------------------------------------------------------------

function StockAddForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', code: '', recommender: '', rec_date: '', country: 'KR' });
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleNameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm({ ...form, name: value });
    if (form.country === 'KR' && value.length > 0) {
      const { data } = await supabase.from('kr_code').select('name, code').ilike('name', `%${value}%`).limit(5);
      if (data && data.length > 0) { setSearchResults(data); setShowDropdown(true); } 
      else { setSearchResults([]); setShowDropdown(false); }
    } else { setShowDropdown(false); }
  };

  const selectStock = (stock: any) => {
    setForm({ ...form, name: stock.name, code: stock.code });
    setShowDropdown(false); 
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const { error } = await supabase.from('portfolio').insert([{ ...form }]);
    if (!error) { alert(`✅ 저장 완료`); onSuccess(); } else { alert("실패: " + error.message); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4 shadow-lg">
      <h3 className="font-bold text-gray-200">새 종목 추가</h3>
      <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-800">
        {['KR', 'US'].map((c) => (
          <button type="button" key={c} onClick={() => setForm({ ...form, country: c, name: '', code: '' })}
            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${form.country === c ? 'bg-gray-800 text-blue-400 shadow-sm' : 'text-gray-500'}`}>
            {c === 'KR' ? '한국 (KR)' : '미국 (US)'}
          </button>
        ))}
      </div>
      <div className="relative">
        <label className="text-xs text-gray-500 mb-1 block">종목명</label>
        <input placeholder="예: 삼성전자" className="w-full bg-gray-950 border border-gray-800 text-white p-3 rounded-lg focus:border-blue-500 outline-none" value={form.name} onChange={handleNameChange} required />
        {showDropdown && searchResults.length > 0 && (
          <ul className="absolute z-30 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-xl mt-1">
            {searchResults.map((stock) => (
              <li key={stock.code} onClick={() => selectStock(stock)} className="px-4 py-3 hover:bg-gray-700 border-b border-gray-700/50 last:border-0 text-sm flex justify-between text-gray-200">
                <span>{stock.name}</span> <span className="text-gray-500">{stock.code}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">티커</label>
        <input className="w-full bg-gray-950 border border-gray-800 text-white p-3 rounded-lg uppercase outline-none" value={form.code} onChange={e => setForm({...form, code: e.target.value})} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">추천인</label>
          <input className="w-full bg-gray-950 border border-gray-800 text-white p-3 rounded-lg outline-none" value={form.recommender} onChange={e => setForm({...form, recommender: e.target.value})} required />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">추천일</label>
          <input type="date" className="w-full bg-gray-950 border border-gray-800 text-white p-3 rounded-lg outline-none" value={form.rec_date} onChange={e => setForm({...form, rec_date: e.target.value})} required />
        </div>
      </div>
      <button type="submit" className="w-full bg-blue-600 text-white py-3.5 rounded-lg font-bold hover:bg-blue-700 transition mt-2 shadow-lg shadow-blue-900/20">저장하기</button>
    </form>
  );
}

function AdditionalBuyForm({ portfolio, onSuccess }: { portfolio: any[], onSuccess: () => void }) {
    const [selectedCode, setSelectedCode] = useState("");
    const [date, setDate] = useState("");
    const [ratio, setRatio] = useState(0);

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        if(ratio <= 0) return alert("비중 확인 필요");
        const { error } = await supabase.from('additional_buys').insert([{ code: selectedCode, date: date, ratio: ratio / 100 }]);
        if (!error) { alert("✅ 등록 완료"); setRatio(0); onSuccess(); } else { alert("실패: " + error.message); }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4 shadow-lg">
            <h3 className="font-bold text-gray-200">추가 매수 등록</h3>
            <div>
                <label className="text-xs text-gray-500 mb-1 block">종목</label>
                <select className="w-full bg-gray-950 border border-gray-800 text-white p-3 rounded-lg outline-none" onChange={e => setSelectedCode(e.target.value)} required value={selectedCode}>
                    <option value="">선택하세요</option>
                    {portfolio.map(p => <option key={p.id} value={p.code}>{p.name}</option>)}
                </select>
            </div>
            <div>
                <label className="text-xs text-gray-500 mb-1 block">매수일</label>
                <input type="date" className="w-full bg-gray-950 border border-gray-800 text-white p-3 rounded-lg outline-none" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div>
                <label className="text-xs text-gray-500 mb-1 block">추가 비중 (%)</label>
                <div className="flex gap-2">
                    <input type="number" className="flex-1 bg-gray-950 border border-gray-800 text-white p-3 rounded-lg outline-none" value={ratio} onChange={e => setRatio(Number(e.target.value))} required placeholder="0" />
                    <button type="button" onClick={() => setRatio(r => r + 5)} className="bg-gray-800 border border-gray-700 text-gray-300 px-3 rounded-lg text-sm font-bold">+5</button>
                    <button type="button" onClick={() => setRatio(r => r + 10)} className="bg-gray-800 border border-gray-700 text-gray-300 px-3 rounded-lg text-sm font-bold">+10</button>
                </div>
            </div>
            <button type="submit" className="w-full bg-green-600 text-white py-3.5 rounded-lg font-bold hover:bg-green-700 transition mt-2 shadow-lg shadow-green-900/20">등록하기</button>
        </form>
    );
}

function SellForm({ portfolio, onSell, loading }: { portfolio: any[], onSell: (id: number, date: string) => void, loading: boolean }) {
  const [targetId, setTargetId] = useState<string>("");
  const [date, setDate] = useState("");

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4 shadow-lg">
      <div>
          <label className="text-xs text-gray-500 mb-1 block">종목 선택</label>
          <select className="w-full bg-gray-950 border border-gray-800 text-white p-3 rounded-lg outline-none" value={targetId} onChange={e => setTargetId(e.target.value)}>
            <option value="">선택해주세요</option>
            {portfolio.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">매도일</label>
        <input type="date" className="w-full bg-gray-950 border border-gray-800 text-white p-3 rounded-lg outline-none" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      <button 
        onClick={() => onSell(Number(targetId), date)} 
        disabled={loading || !targetId || !date}
        className="w-full bg-red-600 text-white py-3.5 rounded-lg font-bold hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition shadow-lg shadow-red-900/20"
      >
        {loading ? "처리 중..." : "매도 확정"}
      </button>
    </div>
  );
}