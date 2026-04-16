"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "@/services/authService";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("mission_operator");
  const [password, setPassword] = useState("change-me-now");
  const [status, setStatus] = useState("Authenticate to access mission control.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("Authenticating...");
    try {
      await login({ username, password });
      setStatus("Authenticated. Redirecting...");
      router.replace("/");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.12em] text-cyan-200/80">Secure Access</p>
        <h1 className="mt-1 font-[var(--font-display)] text-2xl font-bold">Mission Control Login</h1>
      </header>
      <form className="space-y-3" onSubmit={onSubmit}>
        <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
        <Input
          value={password}
          type="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign In"}
        </Button>
      </form>
      <p className="text-sm text-slate-300/85">{status}</p>
      <p className="text-sm text-slate-300/85">
        Need an operator account?{" "}
        <Link href="/register" className="text-neon-cyan hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
