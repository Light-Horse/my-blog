import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "투자 대시보드", // 탭 이름 수정
  description: "개인 주식 포트폴리오 관리",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      {/* [수정 포인트]
        1. bg-gray-950: 대시보드와 동일한 어두운 배경색 적용
        2. text-gray-100: 기본 글자색을 밝은 회색으로 설정
        3. antialiased: 폰트 가독성 향상
      */}
      <body className={`${inter.className} bg-gray-950 text-gray-100 antialiased`}>
        
        {/* [변경 사항] 
          기존의 <nav> (My Blog 링크 등)는 제거했습니다.
          이유: page.tsx 내부에 이미 대시보드 전용 헤더가 존재합니다.
        */}

        <main className="min-h-screen">
          {children}
        </main>
        
        {/* 필요하다면 푸터 유지 (색상은 다크 모드에 맞춤) */}
        {/* <footer className="p-4 text-center text-gray-600 text-xs border-t border-gray-800 mt-10">
          © 2025 Investment Dashboard. All rights reserved.
        </footer> */}
      </body>
    </html>
  );
}