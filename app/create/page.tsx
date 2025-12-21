// app/create/page.tsx
'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function CreatePost() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Supabase에 데이터 저장
    const { error } = await supabase.from('posts').insert([{ title, content }])
    
    if (!error) {
      router.push('/') // 성공 시 메인으로 이동
      router.refresh()
    } else {
      alert('저장 실패')
    }
  }

  return (
    <div className="p-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">새 글 작성</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="제목"
          className="border p-2 rounded"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="내용"
          className="border p-2 rounded h-32"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button type="submit" className="bg-green-500 text-white p-2 rounded">저장하기</button>
      </form>
    </div>
  )
}