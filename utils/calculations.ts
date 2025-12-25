// utils/calculations.ts

// [설정] 초기 자본금 (코드1 Python 설정과 동일)
const CAPITAL_KRW = 100_000_000;
const CAPITAL_USD = 100_000;

/**
 * [중요] Python 코드의 get_table_name과 동일한 로직
 * 예: 005930 -> T_005930, AAPL -> T_AAPL
 */
export const getTableName = (code: string) => {
  if (!code) return "";
  const safeCode = String(code).trim().toUpperCase().replace(/\./g, "_").replace(/-/g, "_");
  return `price_${safeCode}`; 
};

/**
 * 날짜로 가격 찾기 (휴일 보정 포함)
 * targetDate에 데이터가 없으면, 그보다 과거 데이터 중 가장 최신 데이터를 반환
 */
const getPriceAtDate = (prices: any[], targetDate: string) => {
  if (!prices || prices.length === 0) return 0;

  // 1. 정확한 날짜 일치
  const exact = prices.find((p) => p.date === targetDate);
  if (exact) return exact.close_price;

  // 2. 과거 데이터 중 가장 최근 날짜 (prices는 오름차순 정렬 상태라고 가정)
  const pastPrices = prices.filter((p) => p.date <= targetDate);
  if (pastPrices.length > 0) {
    return pastPrices[pastPrices.length - 1].close_price;
  }
  
  return 0; // 매수일 이전 데이터만 있거나 데이터가 아예 없는 경우
};

/**
 * 3가지 수익률(거치/적립/복합) 계산 함수
 */
export const calculateReturns = async (stock: any, adds: any[], prices: any[]) => {
  const code = stock.code;
  const recDate = stock.rec_date;
  const country = stock.country;

  // 1. 데이터 유효성 체크
  if (!prices || prices.length === 0) {
    return { roiLump: 0, roiDca: 0, roiComp: 0, currentPrice: 0, hasAdditional: false };
  }

  // 기준가(추천일) 및 현재가(마지막 데이터)
  const basePrice = getPriceAtDate(prices, recDate);
  const currentPrice = prices[prices.length - 1].close_price;

  // 기준가가 없으면 계산 불가
  if (basePrice <= 0 || currentPrice <= 0) {
    return { roiLump: 0, roiDca: 0, roiComp: 0, currentPrice, hasAdditional: false };
  }

  // ---------------------------------------------------
  // [1] 수익률(거치) - Lump Sum
  // ---------------------------------------------------
  const roiLump = ((currentPrice - basePrice) / basePrice) * 100;

  // ---------------------------------------------------
  // [2] 수익률(적립) - DCA (추천일부터 매일 1주 매수)
  // ---------------------------------------------------
  // 추천일 이후의 데이터만 필터링
  const dcaPrices = prices.filter((p: any) => p.date >= recDate);
  let roiDca = 0;
  
  if (dcaPrices.length > 0) {
    const totalQty = dcaPrices.length; 
    const totalInvested = dcaPrices.reduce((sum: number, p: any) => sum + (p.close_price || 0), 0);
    const currentEval = totalQty * currentPrice;
    
    if (totalInvested > 0) {
      roiDca = ((currentEval - totalInvested) / totalInvested) * 100;
    }
  }

  // ---------------------------------------------------
  // [3] 수익률(복합) - 초기자본 + 리밸런싱
  // ---------------------------------------------------
  const FIXED_CAPITAL = country === 'KR' ? CAPITAL_KRW : CAPITAL_USD;
  
  // (A) 초기 매수
  const initQty = Math.floor(FIXED_CAPITAL / basePrice);
  let totalQty = initQty;
  let totalInvestedComp = initQty * basePrice;
  let addCount = 0;

  // (B) 추가 매수 반영 (해당 종목 코드만 필터링)
  const myAdds = adds
    .filter((a: any) => String(a.code).trim().toUpperCase() === String(code).trim().toUpperCase())
    .sort((a: any, b: any) => a.date.localeCompare(b.date));
  
  let currentAddRatioSum = 0.0;
  const lastPriceDate = prices[prices.length - 1].date;

  for (const add of myAdds) {
    // 미래 날짜 데이터 제외 (가격 데이터에 없는 미래 날짜)
    if (add.date > lastPriceDate) continue;

    // 한도 체크 (50% 제한)
    if (currentAddRatioSum + add.ratio > 0.5) continue;

    const addPrice = getPriceAtDate(prices, add.date);

    if (addPrice > 0) {
      const addLimit = FIXED_CAPITAL * add.ratio;
      const addShares = Math.floor(addLimit / addPrice);

      // 수량 및 원금 누적
      totalQty += addShares;
      totalInvestedComp += (addShares * addPrice);
      currentAddRatioSum += add.ratio;
      addCount++;
    }
  }

  // (C) 최종 복합 수익률
  const finalEvalComp = totalQty * currentPrice;
  let roiComp = 0;
  if (totalInvestedComp > 0) {
    roiComp = ((finalEvalComp - totalInvestedComp) / totalInvestedComp) * 100;
  }

  return {
    roiLump,
    roiDca,
    roiComp: addCount > 0 ? roiComp : 0, // 추가 매수 없으면 0 처리 (화면 표시용)
    currentPrice,
    hasAdditional: addCount > 0,
    meta: {
      totalInvestedComp,
      finalEvalComp,
      totalQty
    }
  };
};