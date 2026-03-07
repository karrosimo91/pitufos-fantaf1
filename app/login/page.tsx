"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const err = await signIn(email, password);
    if (err) {
      setError(err.message === "Invalid login credentials" ? "Email o password errati" : err.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#E8002D] to-[#ff4466] flex items-center justify-center font-black text-sm tracking-wider">
              LP
            </div>
          </Link>
          <h1 className="text-2xl font-black font-[family-name:var(--font-oswald)] mt-4">
            ACCEDI
          </h1>
          <p className="text-white/30 text-sm mt-1">Entra nella tua scuderia</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] tracking-[2px] text-white/40 uppercase block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#E8002D]/30 transition-all"
              placeholder="la-tua@email.com"
            />
          </div>

          <div>
            <label className="text-[10px] tracking-[2px] text-white/40 uppercase block mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#E8002D]/30 transition-all"
              placeholder="Min. 6 caratteri"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#E8002D] hover:bg-[#ff1a3d] text-white font-bold text-sm tracking-[2px] uppercase py-4 rounded-xl transition-all hover:shadow-[0_0_30px_rgba(232,0,45,0.3)] disabled:opacity-50"
          >
            {loading ? "Accesso..." : "Accedi"}
          </button>
        </form>

        <p className="text-center text-white/30 text-sm mt-6">
          Non hai un account?{" "}
          <Link href="/registrati" className="text-[#E8002D] hover:text-[#ff4466] font-semibold">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}
