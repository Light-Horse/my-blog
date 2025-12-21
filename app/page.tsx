'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { calculateReturns } from '../utils/calculations';
import { RefreshCw, Plus, TrendingUp, DollarSign } from 'lucide-react';

// 간단한 탭 컴포넌트
const Tabs = ({ active, setActive }: any) => {
  const menus = ["대시보드", "종목 추가", "추가 매수", "종목 매도"];
  return (
    <div className="flex space-x-2 border-b mb-6">
      {menus.map(menu => (
        <button
          key={menu}
          onClick={() => setActive(menu)}
          className={`px-4 py-2 ${active === menu ? 'border-b-2 border-blue-500 font-bold text-blue-600' : 'text-gray-500'}`}
        >
          {menu}
        </button>
      ))}
    </div>
  );
};

export default function Home() {
  const [activeTab, setActiveTab] = useState("대시보드");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [addBuys, setAddBuys] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);

  // 데이터 로딩 함수
  const fetchData = async () => {
    setLoading(true);
    
    // 1. 포트폴리오 가져오기
    const { data: pfData } = await supabase.from('portfolio').select('*').eq('country', 'KR'); // 일단 KR만 예시
    if (!pfData) { setLoading(false); return; }
    setPortfolio(pfData);

    // 2. 추가 매수 내역 가져오기
    const { data: adds } = await supabase.from('additional_buys').select('*');
    setAddBuys(adds || []);

    // 3. 각 종목별 가격 테이블 조회 및 수익률 계산 (병렬 처리)
    const results = await Promise.all(pfData.map(async (stock) => {
      // 2번 코드가 만든 테이블명: price_{code}
      const tableName = `price_${stock.code}`; // 실제 운영시 접두사 확인 필요
      
      // 가격 데이터 가져오기 (전체 or 최근 N일)
      const { data: prices, error } = await supabase.from(tableName).select('*').order('date', { ascending: true });
      
      if (error || !prices) {
        return { ...stock, roiLump: 0, roiDca: 0, roiComp: 0, currentPrice: 0 };
      }

      // 수익률 계산 로직 실행
      const calcs = await calculateReturns(stock, adds || [], prices);
      return { ...stock, ...calcs };
    }));

    setData(results);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // -- 렌더링 헬퍼 함수들 --
  const formatPct = (val: number) => {
    const color = val > 0 ? 'text-red-600' : val < 0 ? 'text-blue-600' : 'text-gray-600';
    return <span className={`font-bold ${color}`}>{val.toFixed(2)}%</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp /> 한/미 통합 수익률 대시보드
        </h1>
        
        <Tabs active={activeTab} setActive={setActiveTab} />

        {/* 1. 대시보드 탭 */}
        {activeTab === "대시보드" && (
          <div>
            <div className="flex justify-end mb-4">
              <button 
                onClick={fetchData} 
                className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                {loading ? "계산 중..." : "데이터 갱신"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-700">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                  <tr>
                    <th className="px-6 py-3">종목명</th>
                    <th className="px-6 py-3">종목코드</th>
                    <th className="px-6 py-3">현재가</th>
                    <th className="px-6 py-3">수익률(거치)</th>
                    <th className="px-6 py-3">수익률(적립)</th>
                    <th className="px-6 py-3">수익률(복합)</th>
                    <th className="px-6 py-3">추천인</th>
                    <th className="px-6 py-3">추천일</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{row.name}</td>
                      <td className="px-6 py-4">{row.code}</td>
                      <td className="px-6 py-4">{row.currentPrice?.toLocaleString()}</td>
                      <td className="px-6 py-4">{formatPct(row.roiLump)}</td>
                      <td className="px-6 py-4">{formatPct(row.roiDca)}</td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        {formatPct(row.roiComp)}
                        {row.hasAdditional && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Add</span>}
                      </td>
                      <td className="px-6 py-4">{row.recommender}</td>
                      <td className="px-6 py-4">{row.rec_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-8">
                <h3 className="font-bold text-lg mb-2">➕ 추가 매수 현황</h3>
                {/* 추가 매수 내역 테이블 표시 (생략 가능) */}
            </div>
          </div>
        )}

        {/* 2. 종목 추가 탭 */}
        {activeTab === "종목 추가" && (
          <StockAddForm onSuccess={() => { setActiveTab("대시보드"); fetchData(); }} />
        )}

        {/* 3. 추가 매수 탭 */}
        {activeTab === "추가 매수" && (
          <AdditionalBuyForm portfolio={portfolio} onSuccess={() => { setActiveTab("대시보드"); fetchData(); }} />
        )}
        
        {/* 4. 종목 매도 탭 */}
        {activeTab === "종목 매도" && (
            <div className="text-gray-500 p-10 text-center">
                매도 기능은 1번 코드의 로직을 참고하여<br/>
                Next.js Server Actions 또는 Client Side 로직으로 구현해야 합니다.
            </div>
        )}
      </div>
    </div>
  );
}

// -- 하위 컴포넌트: 종목 추가 폼 --
function StockAddForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', code: '', recommender: '', rec_date: '', country: 'KR' });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    // 2번 코드가 감지하도록 portfolio에 insert
    const { error } = await supabase.from('portfolio').insert([{
      ...form, 
      is_initialized: false // 2번 코드가 이를 보고 테이블 생성함
    }]);

    if (!error) {
      alert("종목이 추가되었습니다. 데이터 수집은 2번 워커가 수행합니다.");
      onSuccess();
    } else {
      alert("에러: " + error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <input 
        placeholder="종목명" className="w-full border p-2 rounded" 
        value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
      />
      <input 
        placeholder="종목코드 (예: 005930)" className="w-full border p-2 rounded" 
        value={form.code} onChange={e => setForm({...form, code: e.target.value})} required
      />
      <input 
        placeholder="추천인" className="w-full border p-2 rounded" 
        value={form.recommender} onChange={e => setForm({...form, recommender: e.target.value})} required
      />
      <input 
        type="date" className="w-full border p-2 rounded" 
        value={form.rec_date} onChange={e => setForm({...form, rec_date: e.target.value})} required
      />
      <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">저장</button>
    </form>
  );
}

// -- 하위 컴포넌트: 추가 매수 폼 --
function AdditionalBuyForm({ portfolio, onSuccess }: { portfolio: any[], onSuccess: () => void }) {
    const [selectedCode, setSelectedCode] = useState("");
    const [date, setDate] = useState("");
    const [ratio, setRatio] = useState(0);

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        const { error } = await supabase.from('additional_buys').insert([{
            code: selectedCode,
            date: date,
            ratio: ratio / 100 // %를 소수점으로 변환
        }]);

        if (!error) {
            alert("추가 매수 등록 완료");
            setRatio(0);
            onSuccess();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-md space-y-4">
            <select 
                className="w-full border p-2 rounded" 
                onChange={e => setSelectedCode(e.target.value)} required
            >
                <option value="">종목 선택</option>
                {portfolio.map(p => <option key={p.id} value={p.code}>{p.name}</option>)}
            </select>
            <input 
                type="date" className="w-full border p-2 rounded" 
                value={date} onChange={e => setDate(e.target.value)} required 
            />
            <div className="flex gap-2">
                <input 
                    type="number" placeholder="비중 (%)" className="w-full border p-2 rounded"
                    value={ratio} onChange={e => setRatio(Number(e.target.value))} required 
                />
                <button type="button" onClick={() => setRatio(r => r + 5)} className="border px-3 rounded">+5%</button>
            </div>
            <button type="submit" className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700">등록</button>
        </form>
    );
}