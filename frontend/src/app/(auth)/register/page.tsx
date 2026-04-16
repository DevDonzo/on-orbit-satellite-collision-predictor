"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { register } from "@/services/authService";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("Create operator credentials.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    setStatus("Creating account...");
    try {
      await register({ username, password });
      setStatus("Registration complete. Redirecting to login...");
      router.replace("/login");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.12em] text-cyan-200/80">Operator Enrollment</p>
        <h1 className="mt-1 font-[var(--font-display)] text-2xl font-bold">Register Mission Operator</h1>
      </header>
      <form className="space-y-3" onSubmit={onSubmit}>
        <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
        <Input
          value={password}
          type="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
        />
        <Input
          value={confirmPassword}
          type="password"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm password"
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Registering..." : "Create Account"}
        </Button>
      </form>
      <p className="text-sm text-slate-300/85">{status}</p>
      <p className="text-sm text-slate-300/85">
        Already have credentials?{" "}
        <Link href="/login" className="text-neon-cyan hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}
