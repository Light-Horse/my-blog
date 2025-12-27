'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { calculateReturns, getTableName } from '../utils/calculations';
import { 
  RefreshCw, TrendingUp, Trash2, History, PlusCircle, BarChart3, 
  AlertTriangle, DollarSign, ChevronDown, ChevronRight, 
  ArrowUp, ArrowDown, ArrowUpDown 
} from 'lucide-react';

// ==============================================================================
// [스타일 설정] 테이블 높이, 간격, 폰트 제어
// ==============================================================================
const TABLE_STYLES = {
  rowPadding: "py-1.25", 
  cellPadding: "px-1 md:px-2",
  compactPadding: "px-0.5 md:px-1",
  fontSize: "text-[11px] md:text-sm",
  headerFontSize: "text-[10px] md:text-xs",
};

// 날짜 포맷 헬퍼 (2025-12-23 -> 25-12-23)
const formatDateSimple = (dateString: string) => {
  if (!dateString) return '-';
  return dateString.slice(2);
};

// [헬퍼] 오늘 날짜 반환 (YYYY-MM-DD) - 입력 폼 디폴트값용
const getTodayDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- 탭 UI ---
const Tabs = ({ active, setActive }: any) => {
  const menus = [
    { id: "대시보드", icon: <BarChart3 size={16} /> },
    { id: "종목 추가", icon: <PlusCircle size={16} /> },
    { id: "추가 매수", icon: <DollarSign size={16} /> },
    { id: "종목 매도", icon: <Trash2 size={16} /> },
    { id: "매도 이력", icon: <History size={16} /> }
  ];
  
return (
    <div className="w-full mb-4 border-b border-gray-800 pb-2">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 px-1">
        {menus.map(menu => (
          <button
            key={menu.id}
            onClick={() => setActive(menu.id)}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] md:text-sm font-bold rounded-lg transition-all whitespace-nowrap ${
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
  const [loading, setLoading] = useState(true);
  
  // 데이터 상태
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any[]>([]);
  const [addBuys, setAddBuys] = useState<any[]>([]);
  const [sellHistory, setSellHistory] = useState<any[]>([]);

  // 아코디언 상태
  const [isAddHistoryOpen, setAddHistoryOpen] = useState(false);
  const [isSellHistoryOpen, setSellHistoryOpen] = useState(false);

  // 정렬 상태
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({
    key: 'rec_date',
    direction: 'desc'
  });

  const fetchData = async (retryCount = 0) => {
    if (retryCount === 0) setLoading(true);
    
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
            
            if (priceError || !prices || prices.length === 0) {
              return { 
                ...stock, 
                isUpdating: true, 
                roiLump: 0, roiDca: 0, roiComp: 0, currentPrice: 0 
              };
            }

            const calcs = await calculateReturns(stock, adds, prices);
            return { ...stock, isUpdating: false, ...calcs };
          } catch (innerError) {
            return { ...stock, isUpdating: false, roiLump: 0, roiDca: 0, roiComp: 0, currentPrice: 0 };
          }
        }));
        
        setDashboardData(calculatedResults);

        const hasUpdatingItems = calculatedResults.some((item: any) => item.isUpdating);
        if (hasUpdatingItems && retryCount > 0) {
          setTimeout(() => {
            fetchData(retryCount - 1);
          }, 1000);
        }

      } else {
        setDashboardData([]);
      }
    } catch (e: any) {
      alert("오류: " + e.message);
    } finally {
      if (retryCount === 0) setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const uniqueRecommenders = useMemo(() => {
    if (!portfolio || portfolio.length === 0) return [];
    const recommenders = portfolio.map(p => p.recommender).filter(Boolean);
    return [...new Set(recommenders)].sort();
  }, [portfolio]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedDashboardData = useMemo(() => {
    if (!sortConfig) return dashboardData;

    return [...dashboardData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aString = String(aValue || '').toLowerCase();
      const bString = String(bValue || '').toLowerCase();
      
      if (aString < bString) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aString > bString) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [dashboardData, sortConfig]);

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown size={10} className="text-gray-600 ml-0.5 opacity-50" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={10} className="text-blue-400 ml-0.5" /> 
      : <ArrowDown size={10} className="text-red-400 ml-0.5" />;
  };

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

  const getReturnCellStyle = (val: number | undefined | null) => {
    if (!val || val === 0) return {};
    const absVal = Math.abs(val);
    const opacity = Math.min(0.15 + (absVal * 0.02), 0.95);
    const color = val > 0 ? `rgba(220, 38, 38, ${opacity})` : `rgba(37, 99, 235, ${opacity})`;
    return { backgroundColor: color, color: 'white' };
  };

  const formatPctSimple = (val: number) => {
    if (val === undefined || val === null) return '-';
    if (val === 0) return <span className="text-gray-500">0%</span>;
    return `${val.toFixed(1)}%`;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans pb-10">
      <div className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex justify-between items-center">
        <h1 className="text-lg font-bold flex items-center gap-2 text-white">
          <TrendingUp className="text-blue-500" size={20} /> 투자 대시보드
        </h1>
        <button onClick={() => fetchData(0)} disabled={loading} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition">
          <RefreshCw size={18} className={`text-gray-300 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-2 md:p-4">
        <Tabs active={activeTab} setActive={setActiveTab} />

        {activeTab === "대시보드" && (
          <div className="animate-fade-in space-y-4">
            
            {/* 1. 메인 테이블 */}
            <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-900 shadow-lg">
              <div className="overflow-x-auto relative">
                <table className={`w-full text-left whitespace-nowrap ${TABLE_STYLES.fontSize}`}>
                  <thead className={`${TABLE_STYLES.headerFontSize} text-gray-400 uppercase bg-gray-800`}>
                    <tr>
                      <th onClick={() => handleSort('name')} className={`sticky left-0 z-20 bg-gray-800 ${TABLE_STYLES.compactPadding} ${TABLE_STYLES.rowPadding} border-r border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] cursor-pointer hover:bg-gray-700`}>
                        <div className="flex items-center">종목 {getSortIcon('name')}</div>
                      </th>
                      <th onClick={() => handleSort('roiLump')} className={`${TABLE_STYLES.compactPadding} ${TABLE_STYLES.rowPadding} text-right cursor-pointer hover:bg-gray-700`}>
                        <div className="flex items-center justify-end">거치 {getSortIcon('roiLump')}</div>
                      </th>
                      <th onClick={() => handleSort('roiDca')} className={`${TABLE_STYLES.compactPadding} ${TABLE_STYLES.rowPadding} text-right cursor-pointer hover:bg-gray-700`}>
                          <div className="flex items-center justify-end">적립 {getSortIcon('roiDca')}</div>
                      </th>
                      <th onClick={() => handleSort('roiComp')} className={`${TABLE_STYLES.compactPadding} ${TABLE_STYLES.rowPadding} text-right cursor-pointer hover:bg-gray-700`}>
                          <div className="flex items-center justify-end">복합 {getSortIcon('roiComp')}</div>
                      </th>
                      <th onClick={() => handleSort('rec_date')} className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} text-center cursor-pointer hover:bg-gray-700`}>
                          <div className="flex items-center justify-center">날짜 {getSortIcon('rec_date')}</div>
                      </th>
                      <th onClick={() => handleSort('recommender')} className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} text-center cursor-pointer hover:bg-gray-700`}>
                          <div className="flex items-center justify-center">추천인 {getSortIcon('recommender')}</div>
                      </th>
                    </tr>
                  </thead>


                  <tbody className="divide-y divide-gray-800">
                    {/* [1] 로딩 상태일 때 (최우선 표시) */}
                    {loading ? (
                        <tr>
                        <td colSpan={6} className="text-center py-16">
                            <div className="flex flex-col items-center justify-center gap-3 text-gray-400">
                            <RefreshCw size={24} className="animate-spin text-blue-500" />
                            <span className="text-sm font-bold animate-pulse">데이터 업데이트 중...</span>
                            </div>
                        </td>
                        </tr>
                    ) : sortedDashboardData.length === 0 ? (
                        /* [2] 데이터가 없을 때 */
                        <tr>
                        <td colSpan={6} className="text-center py-12 text-gray-500">
                            데이터가 없습니다.
                        </td>
                        </tr>
                    ) : (
                        /* [3] 데이터가 있을 때 (목록 렌더링) */
                        sortedDashboardData.map((row) => (
                        <tr key={row.id} className="bg-gray-900 hover:bg-gray-800 transition">
                            {/* 종목명 & 티커 */}
                            <td
                            className={`sticky left-0 z-10 bg-gray-900 ${TABLE_STYLES.compactPadding} ${TABLE_STYLES.rowPadding} border-r border-gray-800 font-bold text-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] max-w-[100px] md:max-w-none truncate`}
                            >
                            <a 
                              href={row.country === 'KR' ? `https://finance.naver.com/item/main.naver?code=${row.code}` : `https://finance.yahoo.com/quote/${row.code}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-400 hover:underline cursor-pointer"
                            >
                              {row.name}
                            </a>
                            <span className="block text-[9px] md:text-[10px] font-normal text-gray-500 leading-none mt-0.5 truncate">
                                {row.code}
                            </span>
                            </td>

                            {/* 개별 행 업데이트 중일 때 vs 완료되었을 때 */}
                            {row.isUpdating ? (
                            <td
                                colSpan={3}
                                className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} text-center`}
                            >
                                <div className="flex items-center justify-center gap-1.5 text-yellow-500 text-[10px] md:text-xs py-1">
                                <RefreshCw size={12} className="animate-spin" />
                                <span>계산 중...</span>
                                </div>
                            </td>
                            ) : (
                            <>
                                <td
                                className={`${TABLE_STYLES.compactPadding} ${TABLE_STYLES.rowPadding} text-right font-bold transition-colors duration-300`}
                                style={getReturnCellStyle(row.roiLump)}
                                >
                                {formatPctSimple(row.roiLump)}
                                </td>
                                <td
                                className={`${TABLE_STYLES.compactPadding} ${TABLE_STYLES.rowPadding} text-right font-bold transition-colors duration-300`}
                                style={getReturnCellStyle(row.roiDca)}
                                >
                                {formatPctSimple(row.roiDca)}
                                </td>
                                <td
                                className={`${TABLE_STYLES.compactPadding} ${TABLE_STYLES.rowPadding} text-right font-bold transition-colors duration-300`}
                                style={getReturnCellStyle(row.roiComp)}
                                >
                                {formatPctSimple(row.roiComp)}
                                </td>
                            </>
                            )}

                            {/* 추천일 & 추천인 */}
                            <td
                            className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} text-center font-mono text-gray-500 tracking-tighter`}
                            >
                            {formatDateSimple(row.rec_date)}
                            </td>
                            <td
                            className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} text-center text-gray-500`}
                            >
                            {row.recommender}
                            </td>
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
                className="w-full flex justify-between items-center p-1.5 bg-gray-800 hover:bg-gray-750 transition"
              >
                <div className="flex items-center gap-2 font-bold text-sm text-gray-200">
                   <DollarSign size={16} className="text-green-500" /> 
                   추가 매수
                   <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{addBuys.length}</span>
                </div>
                {isAddHistoryOpen ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
              </button>

              {isAddHistoryOpen && (
                <div className="border-t border-gray-700 animate-fade-in">
                  <div className="overflow-x-auto relative max-h-[300px] overflow-y-auto custom-scrollbar">
                    <table className={`w-full text-left whitespace-nowrap ${TABLE_STYLES.fontSize}`}>
                      <thead className={`${TABLE_STYLES.headerFontSize} text-gray-400 uppercase bg-gray-800/50 sticky top-0 z-30`}>
                        <tr>
                          <th className={`sticky left-0 z-20 bg-gray-800 ${TABLE_STYLES.cellPadding} py-2 border-r border-gray-700`}>종목명</th>
                          <th className={`${TABLE_STYLES.cellPadding} py-2`}>매수일</th>
                          <th className={`${TABLE_STYLES.cellPadding} py-2 text-right`}>비중</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {addBuys.length === 0 ? (
                           <tr><td colSpan={3} className="text-center py-6 text-gray-500">내역 없음</td></tr>
                        ) : (
                          [...addBuys].sort((a,b) => b.date.localeCompare(a.date)).map((item, idx) => {
                             const stockName = portfolio.find(p => p.code === item.code)?.name || item.code;
                             return (
                              <tr key={idx} className="bg-gray-900 hover:bg-gray-800 transition">
                                <td className={`sticky left-0 z-10 bg-gray-900 ${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} border-r border-gray-800 font-bold text-gray-200`}>
                                  {stockName}
                                </td>
                                <td className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} font-mono text-gray-400`}>{formatDateSimple(item.date)}</td>
                                <td className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} text-right font-bold text-green-400`}>+{item.ratio * 100}%</td>
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
                className="w-full flex justify-between items-center p-1.5 bg-gray-800 hover:bg-gray-750 transition"
              >
                <div className="flex items-center gap-2 font-bold text-sm text-gray-200">
                   <History size={16} className="text-blue-500" /> 
                   매도 완료
                   <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{sellHistory.length}</span>
                </div>
                {isSellHistoryOpen ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
              </button>

              {isSellHistoryOpen && (
                <div className="border-t border-gray-700 animate-fade-in">
                  <div className="overflow-x-auto relative max-h-[300px] overflow-y-auto custom-scrollbar">
                    <table className={`w-full text-left whitespace-nowrap ${TABLE_STYLES.fontSize}`}>
                      <thead className={`${TABLE_STYLES.headerFontSize} text-gray-400 uppercase bg-gray-800/50 sticky top-0 z-30`}>
                        <tr>
                          <th className={`sticky left-0 z-20 bg-gray-800 ${TABLE_STYLES.cellPadding} py-2 border-r border-gray-700`}>종목명</th>
                          <th className={`${TABLE_STYLES.cellPadding} py-2`}>매도일</th>
                          <th className={`${TABLE_STYLES.cellPadding} py-2 text-right`}>수익(복합)</th>
                          <th className={`${TABLE_STYLES.cellPadding} py-2 text-right`}>평가금</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {sellHistory.length === 0 ? (
                           <tr><td colSpan={4} className="text-center py-6 text-gray-500">내역 없음</td></tr>
                        ) : (
                          sellHistory.map((h: any) => (
                            <tr key={h.id} className="bg-gray-900 hover:bg-gray-800 transition">
                              <td className={`sticky left-0 z-10 bg-gray-900 ${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} border-r border-gray-800 font-bold text-gray-200`}>
                                {h.name}
                              </td>
                              <td className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} font-mono text-gray-400`}>{formatDateSimple(h.sell_date)}</td>
                              <td className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} text-right`} style={getReturnCellStyle(h.return_comp)}>
                                {formatPctSimple(h.return_comp)}
                              </td>
                              <td className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} text-right font-mono text-gray-400`}>{h.final_eval?.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-2 text-center border-t border-gray-800 bg-gray-900">
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
            <StockAddForm recommenders={uniqueRecommenders} onSuccess={() => { setActiveTab("대시보드"); fetchData(20); }} />
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
              <table className={`w-full text-left whitespace-nowrap ${TABLE_STYLES.fontSize}`}>
                <thead className={`${TABLE_STYLES.headerFontSize} text-gray-400 uppercase bg-gray-800`}>
                  <tr>
                    <th className={`sticky left-0 z-20 bg-gray-800 ${TABLE_STYLES.cellPadding} py-2 border-r border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]`}>종목명</th>
                    <th className={`${TABLE_STYLES.cellPadding} py-2`}>매도일</th>
                    <th className={`${TABLE_STYLES.cellPadding} py-2 text-right`}>거치</th>
                    <th className={`${TABLE_STYLES.cellPadding} py-2 text-right`}>적립</th>
                    <th className={`${TABLE_STYLES.cellPadding} py-2 text-right`}>복합</th>
                    <th className={`${TABLE_STYLES.cellPadding} py-2 text-right`}>최종평가</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sellHistory.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-500">이력이 없습니다.</td></tr>
                  ) : (
                    sellHistory.map((h: any) => (
                      <tr key={h.id} className="bg-gray-900 hover:bg-gray-800 transition">
                          <td className={`sticky left-0 z-10 bg-gray-900 ${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} border-r border-gray-800 font-bold text-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] max-w-[100px] md:max-w-none truncate`}>
                            {h.name}
                        </td>
                        <td className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} font-mono text-[10px] text-gray-500`}>{h.sell_date}</td>
                        <td className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} text-right font-bold transition-colors duration-300`} style={getReturnCellStyle(h.return_lump)}>
                          {formatPctSimple(h.return_lump)}
                        </td>
                        <td className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} text-right font-bold transition-colors duration-300`} style={getReturnCellStyle(h.return_dca)}>
                          {formatPctSimple(h.return_dca)}
                        </td>
                        <td className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} text-right font-bold transition-colors duration-300`} style={getReturnCellStyle(h.return_comp)}>
                          {formatPctSimple(h.return_comp)}
                        </td>
                        <td className={`${TABLE_STYLES.cellPadding} ${TABLE_STYLES.rowPadding} text-right font-mono text-gray-300`}>{h.final_eval?.toLocaleString()}</td>
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
// 하위 컴포넌트
// ----------------------------------------------------------------------

function StockAddForm({ onSuccess, recommenders }: { onSuccess: () => void, recommenders: string[] }) {
  // [수정] rec_date 초기값 오늘 날짜
  const [form, setForm] = useState({ name: '', code: '', recommender: '', rec_date: getTodayDate(), country: 'KR' });
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleNameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm({ ...form, name: value });
    
    // [수정] 국가(KR/US)에 따른 테이블 분기 검색
    if (value.length > 0) {
      const tableName = form.country === 'KR' ? 'kr_code' : 'us_code';
      const { data } = await supabase.from(tableName).select('name, code').ilike('name', `%${value}%`).limit(5);
      
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
          <button 
            type="button" 
            key={c} 
            // [수정] 국가 탭 전환 시 검색 결과(드롭다운) 초기화 추가
            onClick={() => {
                setForm({ ...form, country: c, name: '', code: '' });
                setSearchResults([]);
                setShowDropdown(false);
            }}
            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${form.country === c ? 'bg-gray-800 text-blue-400 shadow-sm' : 'text-gray-500'}`}>
            {c === 'KR' ? '한국 (KR)' : '미국 (US)'}
          </button>
        ))}
      </div>
      <div className="relative">
        <label className="text-xs text-gray-500 mb-1 block">종목명</label>
        {/* [수정] 국가별 placeholder 적용 */}
        <input 
            placeholder={form.country === 'KR' ? "예: 삼성전자" : "예: Apple, Tesla"} 
            className="w-full bg-gray-950 border border-gray-800 text-white p-3 rounded-lg focus:border-blue-500 outline-none" 
            value={form.name} 
            onChange={handleNameChange} 
            required 
        />
        {showDropdown && searchResults.length > 0 && (
          <ul className="absolute z-30 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto custom-scrollbar">
            {searchResults.map((stock) => (
              <li key={stock.code} onClick={() => selectStock(stock)} className="px-4 py-3 hover:bg-gray-700 border-b border-gray-700/50 last:border-0 text-sm flex justify-between text-gray-200 cursor-pointer">
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
          <input 
            className="w-full bg-gray-950 border border-gray-800 text-white p-3 rounded-lg outline-none" 
            value={form.recommender} 
            onChange={e => setForm({...form, recommender: e.target.value})} 
            required 
            list="recommender-list"
          />
          <datalist id="recommender-list">
            {recommenders.map((r) => <option key={r} value={r} />)}
          </datalist>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">추천일</label>
          <input type="date" className="w-full bg-gray-950 border border-gray-800 text-white p-3 rounded-lg outline-none" value={form.rec_date} onChange={e => setForm({...form, rec_date: e.target.value})} onClick={(e) => e.currentTarget.showPicker()} required />
        </div>
      </div>
      <button type="submit" className="w-full bg-blue-600 text-white py-3.5 rounded-lg font-bold hover:bg-blue-700 transition mt-2 shadow-lg shadow-blue-900/20">저장하기</button>
    </form>
  );
}

function AdditionalBuyForm({ portfolio, onSuccess }: { portfolio: any[], onSuccess: () => void }) {
    const [selectedCode, setSelectedCode] = useState("");
    // [수정] 초기값 오늘 날짜
    const [date, setDate] = useState(getTodayDate());
    const [ratio, setRatio] = useState(0);

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        if(ratio <= 0) return alert("비중 확인 필요");
        const { error } = await supabase.from('additional_buys').insert([{ code: selectedCode, date: date, ratio: ratio / 100 }]);
        if (!error) { 
            alert("✅ 등록 완료"); 
            setRatio(0); 
            setDate(getTodayDate()); // [수정] 성공 시 날짜 초기화
            onSuccess(); 
        } else { alert("실패: " + error.message); }
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
                <input type="date" className="w-full bg-gray-950 border border-gray-800 text-white p-3 rounded-lg outline-none" value={date} onChange={e => setDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker()} required />
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
  // [수정] 초기값 오늘 날짜
  const [date, setDate] = useState(getTodayDate());

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
        <input type="date" className="w-full bg-gray-950 border border-gray-800 text-white p-3 rounded-lg outline-none" value={date} onChange={e => setDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker()} />
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