"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("admin@bantutrack.com")
  const [password, setPassword] = useState("demo1234")
  const [loading, setLoading] = useState(false)

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => router.push("/dashboard"), 1200)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: "radial-gradient(1000px 700px at 70% 20%, rgba(245,166,35,.12), transparent 55%), radial-gradient(800px 600px at 20% 90%, rgba(45,212,191,.08), transparent 55%), #070a0f",
      }}
    >
      <div className="w-[420px] max-w-[92vw]">
        <div
          className="rounded-2xl border border-[#28374d] p-10 relative overflow-hidden"
          style={{ background: "linear-gradient(180deg, rgba(22,31,46,.95), rgba(14,19,28,.98))" }}
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-orange-500" />

          <div className="flex items-center gap-3.5 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center font-black text-xl text-amber-900 shadow-xl shadow-amber-500/30">
              A
            </div>
            <div>
              <div className="font-black text-2xl tracking-tight text-white">
                AFI<span className="text-amber-400">S</span>
              </div>
              <div className="text-xs text-[#5b6b82] font-mono tracking-widest uppercase mt-0.5">
                Fleet Intelligence
              </div>
            </div>
          </div>

          <h1 className="text-base font-bold text-white mb-1.5">Operations Console</h1>
          <p className="text-sm text-[#94a3b8] mb-7 leading-relaxed">
            AI-powered fleet management for the SADC region. Enter your credentials to continue.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[#5b6b82] mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0a0f17] border border-[#28374d] text-white px-4 py-3 rounded-xl text-sm outline-none transition-all focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[#5b6b82] mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0f17] border border-[#28374d] text-white px-4 py-3 rounded-xl text-sm outline-none transition-all focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-amber-500 to-orange-500 text-amber-900 font-bold py-3.5 rounded-xl text-sm transition-all hover:-translate-y-0.5 shadow-xl shadow-amber-500/30 disabled:opacity-70"
            >
              {loading ? "Authenticating…" : "Access Operations Console"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[#5b6b82]">
            Demo credentials pre-filled — <span className="text-[#94a3b8] font-semibold">click the button.</span>
          </p>

          <div className="mt-6 pt-5 border-t border-[#1f2a3a] flex justify-between text-[11px] font-mono text-[#5b6b82]">
            <span>v2.5.0-prod</span>
            <span>Bantu Track Pvt Ltd</span>
          </div>
        </div>
      </div>
    </div>
  )
}
