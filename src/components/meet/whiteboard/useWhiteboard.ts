"use client";

/**
 * Branche le tableau sur la salle LiveKit :
 *  - petits messages : canal de données (sujet "wb"), fiable ou non selon l'opération
 *  - gros messages (images, état complet pour un retardataire) : flux texte LiveKit (sujet "wb-big")
 *  - le professeur garde une copie locale du tableau (rechargement de page sans perte)
 */
import { useEffect, useState } from "react";
import { ConnectionState, RoomEvent, type Participant, type RemoteParticipant, type Room } from "livekit-client";
import { WbStore, type Op } from "./model";

const enc = new TextEncoder();
const dec = new TextDecoder();
const SMALL = 12_000;

const roleOf = (p?: Participant) => (p?.attributes?.role === "host" ? "host" : "student");

export function useWhiteboard(room: Room, opts: { me: string; myName: string; isHost: boolean; meetingId: string }) {
  const [store] = useState(() => new WbStore(opts.me, opts.myName, opts.isHost));

  useEffect(() => {
    store.isHost = opts.isHost;
    store.myName = opts.myName;
    store.isHostId = id => (id === opts.me ? opts.isHost : roleOf(room.remoteParticipants.get(id)) === "host");
    store.nameOf = id => room.remoteParticipants.get(id)?.name || "";

    store.transport = {
      send: (op, o) => {
        if (room.state !== ConnectionState.Connected) return;
        const json = JSON.stringify(op);
        if (json.length > SMALL) {
          void room.localParticipant.sendText(json, { topic: "wb-big", destinationIdentities: o?.to }).catch(() => undefined);
          return;
        }
        void room.localParticipant
          .publishData(enc.encode(json), { reliable: !o?.lossy, topic: "wb", destinationIdentities: o?.to })
          .catch(() => undefined);
      },
    };

    // qui répond à un retardataire ? le professeur s'il est là, sinon le plus ancien participant
    const responder = (asker: string) => {
      const all: Participant[] = [room.localParticipant, ...Array.from(room.remoteParticipants.values())].filter(p => p.identity !== asker);
      const hosts = all.filter(p => (p.isLocal ? opts.isHost : roleOf(p) === "host"));
      const pool = hosts.length ? hosts : all;
      pool.sort((a, b) => (a.joinedAt?.getTime() || 0) - (b.joinedAt?.getTime() || 0) || a.identity.localeCompare(b.identity));
      return pool[0]?.identity;
    };

    const handle = (op: Op, from?: string) => {
      if (!from || from === opts.me || !op) return;
      if (op.o === "req") {
        if (responder(from) === opts.me) store.transport.send(store.snapshotFor(from), { to: [from] });
        return;
      }
      store.receive(op, from);
    };

    const onData = (payload: Uint8Array, p?: RemoteParticipant, _k?: unknown, topic?: string) => {
      if (topic !== "wb") return;
      try {
        handle(JSON.parse(dec.decode(payload)), p?.identity);
      } catch {
        /* message illisible */
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    try {
      room.registerTextStreamHandler("wb-big", async (reader, info) => {
        try {
          const text = await reader.readAll();
          handle(JSON.parse(text), info.identity);
        } catch {
          /* flux interrompu */
        }
      });
    } catch {
      /* déjà enregistré (double montage en développement) */
    }

    // demander l'état du tableau en arrivant (et après une reconnexion)
    const ask = () => store.transport.send({ o: "req" });
    let askTimer = 0;
    const askSoon = () => {
      window.clearTimeout(askTimer);
      askTimer = window.setTimeout(ask, 400);
    };
    if (room.state === ConnectionState.Connected) askSoon();
    const onState = (s: ConnectionState) => s === ConnectionState.Connected && askSoon();
    room.on(RoomEvent.ConnectionStateChanged, onState);
    room.on(RoomEvent.Reconnected, askSoon);

    // le professeur republie l'état quand un élève arrive (ouvre le tableau chez lui)
    const onJoin = (p: RemoteParticipant) => {
      if (opts.isHost && store.state.open) store.transport.send({ o: "state", s: store.state }, { to: [p.identity] });
    };
    room.on(RoomEvent.ParticipantConnected, onJoin);

    return () => {
      window.clearTimeout(askTimer);
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ConnectionStateChanged, onState);
      room.off(RoomEvent.Reconnected, askSoon);
      room.off(RoomEvent.ParticipantConnected, onJoin);
      try {
        room.unregisterTextStreamHandler("wb-big");
      } catch {
        /* ignore */
      }
    };
  }, [room, store, opts.me, opts.myName, opts.isHost]);

  // copie locale du professeur
  useEffect(() => {
    if (!opts.isHost) return;
    const key = `wb:${opts.meetingId}`;
    // anciens tableaux (plus de 3 jours) : on fait de la place
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k?.startsWith("wb:") || k === key) continue;
        const at = JSON.parse(localStorage.getItem(k) || "{}")?.at || 0;
        if (Date.now() - at > 3 * 86_400_000) localStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved?.board) store.load(saved.board, saved.screen || []);
      if (saved?.state) store.setState({ ...saved.state });
    } catch {
      /* rien d'enregistré */
    }
    let t = 0;
    const save = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify({ board: store.list("board").filter(e => !e.ttl), state: store.state, at: Date.now() }));
        } catch {
          // trop gros (images) : on garde au moins les traits
          try {
            localStorage.setItem(key, JSON.stringify({ board: store.list("board").filter(e => !e.ttl && e.k !== "image"), state: store.state, at: Date.now() }));
          } catch {
            /* stockage plein */
          }
        }
      }, 1500);
    };
    const un = store.subscribeState(save);
    const un2 = store.subscribe(save);
    return () => {
      window.clearTimeout(t);
      un();
      un2();
    };
  }, [store, opts.isHost, opts.meetingId]);

  return store;
}
