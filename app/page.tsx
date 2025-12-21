// app/page.tsx
'use client' // 클라이언트 컴포넌트 사용
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Home() {
  const [posts, setPosts] = useState<any[]>([])

  // 데이터 가져오기
  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false })
      if (data) setPosts(data)
    }
    fetchPosts()
  }, [])

  return (
    <div className="p-10 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">게시판</h1>
      <Link href="/create" className="bg-blue-500 text-white px-4 py-2 rounded mb-4 inline-block">글쓰기</Link>
      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="border p-4 rounded shadow hover:bg-gray-50">
            <h2 className="text-xl font-bold">{post.title}</h2>
            <p className="text-gray-600">{post.content}</p>
            <div className="mt-2 text-sm text-gray-400">
              {new Date(post.created_at).toLocaleString()}
              {/* 수정/삭제 버튼 공간 (나중에 구현) */}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}