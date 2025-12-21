// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link"; // 링크 이동을 위해 추가

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "나만의 블로그", // 브라우저 탭 이름 변경
  description: "Next.js와 Supabase로 만든 블로그입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* ▼▼▼ 여기서부터 추가된 부분 (상단 네비게이션) ▼▼▼ */}
        <nav className="border-b p-4 mb-4 flex gap-4">
          <Link href="/" className="font-bold text-xl">
            My Blog
          </Link>
          <Link href="/create" className="text-blue-500 hover:underline">
            글쓰기
          </Link>
        </nav>
        {/* ▲▲▲ 여기까지 추가됨 ▲▲▲ */}

        {/* children이 바로 우리가 만든 page.tsx 내용들이 들어가는 자리입니다 */}
        <main className="min-h-screen">
          {children}
        </main>
        
        {/* 하단 푸터도 넣어볼 수 있습니다 */}
        <footer className="p-4 text-center text-gray-500 text-sm border-t mt-10">
          © 2024 My Blog. All rights reserved.
        </footer>
      </body>
    </html>
  );
}