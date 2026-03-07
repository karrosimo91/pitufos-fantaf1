"use client";
import { useEffect, useState } from "react";
import { createClient } from "./supabase";
import type { User } from "@supabase/supabase-js";
import type { DbProfile } from "./database.types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) loadProfile(user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadProfile(u.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }

  async function signUp(email: string, password: string, teamPrincipalName: string, scuderiaName: string) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error;

    // Aggiorna profilo con nome team principal e scuderia
    if (data.user) {
      await supabase
        .from("profiles")
        .update({ team_principal_name: teamPrincipalName, scuderia_name: scuderiaName })
        .eq("id", data.user.id);
    }
    return null;
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function updateProfile(updates: Partial<Pick<DbProfile, "team_principal_name" | "scuderia_name">>) {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();
    if (data) setProfile(data);
  }

  return { user, profile, loading, signIn, signUp, signOut, updateProfile };
}
