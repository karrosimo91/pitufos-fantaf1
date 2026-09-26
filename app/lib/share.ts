"use client";

/** Condivide testo con navigator.share, altrimenti copia negli appunti. Ritorna "shared" | "copied" | "failed". */
export async function shareText(title: string, text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text });
      return "shared";
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return "failed";
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
