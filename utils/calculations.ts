// utils/calculations.ts

interface PriceRow {
  date: string;
  close_price: number;
}

// 특정 날짜의 가격 조회 (DB 데이터 기반)
export function getPriceAtDate(prices: PriceRow[], targetDate: string): number {
  // 날짜 오름차순 정렬 가정 (또는 안전하게 정렬)
  const sorted = [...prices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // 정확히 그 날짜가 있으면 반환
  const exact = sorted.find((p) => p.date === targetDate);
  if (exact) return exact.close_price;
  
  // 정확한 날짜가 없으면 그 이전 가장 최근 날짜 찾기 (Fallback)
  const valid = sorted.filter(p => p.date <= targetDate);
  return valid.length > 0 ? valid[valid.length - 1].close_price : 0;
}

// 3가지 수익률 계산 함수
// 반드시 export 키워드가 붙어있어야 합니다.
export async function calculateReturns(
  stock: any, 
  additionalBuys: any[], 
  prices: PriceRow[]
) {
  const CAPITAL_KRW = 100_000_000;
  const CAPITAL_USD = 100_000;
  const FIXED_CAPITAL = stock.country === 'US' ? CAPITAL_USD : CAPITAL_KRW;

  const currentPrice = prices.length > 0 ? prices[prices.length - 1].close_price : 0;
  const basePrice = getPriceAtDate(prices, stock.rec_date);

  // 1. 거치식 (Lump Sum)
  let roiLump = 0;
  if (basePrice > 0) {
    roiLump = ((currentPrice - basePrice) / basePrice) * 100;
  }

  // 2. 적립식 (DCA) - 매일 1주 매수 가정
  let roiDca = 0;
  if (prices.length > 0) {
    // 추천일 이후 데이터 필터링
    const dcaPrices = prices.filter(p => p.date >= stock.rec_date);
    const totalInvested = dcaPrices.reduce((sum, p) => sum + p.close_price, 0);
    const totalQty = dcaPrices.length;
    const currentEval = totalQty * currentPrice;

    if (totalInvested > 0) {
      roiDca = ((currentEval - totalInvested) / totalInvested) * 100;
    }
  }

  // 3. 복합식 (Composite) - 리밸런싱
  let roiComp = 0;
  let hasAdditional = false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let debugInfo = null;

  if (basePrice > 0) {
    const initQty = Math.floor(FIXED_CAPITAL / basePrice);
    let totalQty = initQty;
    let totalInvested = initQty * basePrice;
    
    // 해당 종목의 추가 매수 내역 필터링
    const myAdds = additionalBuys.filter(a => a.code === stock.code && a.date >= stock.rec_date);
    
    let currentRatioSum = 0;
    let addCount = 0;

    for (const add of myAdds) {
        if (currentRatioSum + add.ratio > 0.5) continue; // 50% 한도

        const addPrice = getPriceAtDate(prices, add.date);
        if (addPrice > 0) {
            const addLimit = FIXED_CAPITAL * add.ratio;
            const addShares = Math.floor(addLimit / addPrice);
            
            totalQty += addShares;
            totalInvested += (addShares * addPrice);
            currentRatioSum += add.ratio;
            addCount++;
        }
    }

    const finalEval = totalQty * currentPrice;
    if (totalInvested > 0) {
        roiComp = ((finalEval - totalInvested) / totalInvested) * 100;
    }

    if (addCount > 0) {
        hasAdditional = true;
        debugInfo = { totalInvested, finalEval, totalQty };
    }
  }

  return { roiLump, roiDca, roiComp, hasAdditional, currentPrice, basePrice };
}