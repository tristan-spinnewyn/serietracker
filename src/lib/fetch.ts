export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    let message = `HTTP ${res.status}`;
    try { message = JSON.parse(text).error ?? message; } catch { /* */ }
    throw new Error(message);
  }
  return res.json();
}
