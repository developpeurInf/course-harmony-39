/**
 * Canaux temps réel de la messagerie.
 * Canal privé (Realtime Authorization : règles sur realtime.messages, migration du chat) ;
 * si le projet refuse les canaux privés, on retombe sur un canal public dont le nom
 * contient l'id (non devinable) de la discussion.
 */
import { supabase } from "@/integrations/supabase/client";

type Channel = ReturnType<typeof supabase.channel>;
/** supabase-js fournit lui-même le jeton de session au temps réel : on force juste son chargement */
async function ensureRealtimeAuth() {
  try {
    await (supabase.realtime as any).setAuth();
  } catch {
    /* sans jeton : le canal privé sera refusé et on passera au canal public */
  }
}

let privateRefused = false;

/**
 * Ouvre un canal (diffusion + présence). `setup` ajoute les écouteurs avant l'abonnement.
 * Le nom doit rester exact (il est contrôlé par la base) : un ancien canal du même nom
 * est d'abord fermé, sinon supabase.channel() le renverrait déjà abonné.
 */
export async function openChannel(
  topic: string,
  setup: (ch: Channel) => void,
  opts: { presenceKey?: string; onStatus?: (s: string) => void } = {},
): Promise<{ channel: Channel; close: () => void }> {
  await ensureRealtimeAuth();
  const old = supabase.getChannels().filter((c: any) => c.topic === `realtime:${topic}`);
  for (const c of old) {
    try { await supabase.removeChannel(c); } catch { /* ignore */ }
  }
  const make = (isPrivate: boolean) => {
    const ch = supabase.channel(topic, {
      config: { private: isPrivate, broadcast: { self: false, ack: false }, presence: { key: opts.presenceKey || "" } },
    } as any);
    setup(ch);
    return ch;
  };

  return new Promise(resolve => {
    let settled = false;
    let current: Channel;
    const finish = (ch: Channel) => {
      if (settled) return;
      settled = true;
      resolve({ channel: ch, close: () => { void supabase.removeChannel(ch); } });
    };
    const subscribe = (isPrivate: boolean) => {
      current = make(isPrivate);
      current.subscribe((status: string) => {
        opts.onStatus?.(status);
        if (status === "SUBSCRIBED") finish(current);
        else if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && isPrivate && !settled) {
          privateRefused = true;
          void supabase.removeChannel(current);
          subscribe(false);
        }
      });
    };
    subscribe(!privateRefused);
    // Ne bloque jamais l'appelant : au bout de 8 s on rend le canal tel quel
    setTimeout(() => finish(current), 8000);
  });
}
