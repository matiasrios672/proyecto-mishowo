"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { DRAFT_KEY, contentToDraft, loadDraft, saveDraft, type Draft } from "@/lib/draft";
import { fetchServerBusiness, getSyncMarker, setSyncMarker, type ServerState } from "@/lib/serverSync";
import { Button } from "@/components/ui/button";
import { useUser } from "@/components/auth/authStore";
import type { PublicUser } from "@/lib/authClient";
import { Editor } from "./Editor";

const LOADING = "__loading__";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
function readRaw(): string {
  try {
    return window.localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function Message({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md space-y-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}

const NoDraft = () => (
  <Message title="Todavía no elegiste un rubro">
    <Button render={<Link href="/crear" />}>Elegir rubro</Button>
  </Message>
);

/** Decide con qué arranca el editor: el borrador de este dispositivo, o la página guardada en la cuenta. */
export function EditorShell() {
  const user = useUser();
  const raw = useSyncExternalStore(subscribe, readRaw, () => LOADING);
  // El editor usa este valor solo al montarse y desde ahí es dueño del estado (guarda por su cuenta).
  const local = useMemo(
    () => (raw === LOADING ? undefined : loadDraft({ getItem: () => raw || null, setItem() {}, removeItem() {} })),
    [raw],
  );

  if (user === undefined || local === undefined) return <main className="p-6 text-muted-foreground">Cargando tu borrador…</main>;
  if (user === null) return local ? <Editor key="local" initial={local} /> : <NoDraft />;
  return <AccountEditor user={user} local={local} />;
}

function AccountEditor({ user, local }: { user: PublicUser; local: Draft | null }) {
  const [server, setServer] = useState<ServerState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [choice, setChoice] = useState<"server" | "local" | "offline" | null>(null);

  useEffect(() => {
    let alive = true;
    fetchServerBusiness().then((r) => alive && setServer(r));
    return () => { alive = false; };
  }, [user.id, attempt]);

  if (server.kind === "loading") return <main className="p-6 text-muted-foreground">Cargando tu página…</main>;

  if (server.kind === "error" && choice !== "offline")
    return (
      <Message title="No pudimos cargar tu página">
        <p className="text-muted-foreground">Revisá tu conexión e intentá de nuevo.</p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => { setServer({ kind: "loading" }); setAttempt((n) => n + 1); }}>Reintentar</Button>
          {local && <Button variant="outline" onClick={() => setChoice("offline")}>Seguir con el borrador de este dispositivo</Button>}
        </div>
      </Message>
    );
  if (server.kind === "error") return local ? <Editor key="offline" initial={local} /> : <NoDraft />;

  const { business, content } = server;

  // Cuenta sin negocio todavía: el borrador local se migra al servidor al abrir el editor.
  if (!business || !content)
    return local ? <Editor key={`new:${user.id}`} initial={local} sync={{ userId: user.id, initialVersion: null }} /> : <NoDraft />;

  const fromServer = () => contentToDraft(content);

  // Sin borrador local: se abre lo guardado en la cuenta.
  if (!local)
    return <Editor key={`srv:${user.id}`} initial={fromServer()} sync={{ userId: user.id, initialVersion: business.version }} />;

  // Lo que la persona eligió manda sobre cualquier otra regla. (Va primero: al elegir la versión de la
  // cuenta se guarda la marca de sincronización, y eso haría creer que el borrador local está al día.)
  if (choice === "server")
    return <Editor key={`srv:${user.id}`} initial={fromServer()} sync={{ userId: user.id, initialVersion: business.version }} />;
  if (choice === "local")
    return <Editor key={`mine:${user.id}`} initial={local} sync={{ userId: user.id, initialVersion: business.version }} />;

  // El borrador local es exactamente lo último que se sincronizó: se sigue desde ahí.
  const marker = getSyncMarker();
  if (marker?.userId === user.id && marker.version === business.version)
    return <Editor key={`cur:${user.id}`} initial={local} sync={{ userId: user.id, initialVersion: business.version }} />;

  return (
    <Message title="Ya tenés una página guardada">
      <p className="text-muted-foreground">
        En tu cuenta hay una página guardada, y en este dispositivo hay un borrador distinto. ¿Cuál querés usar?
      </p>
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          onClick={() => {
            saveDraft(fromServer());
            setSyncMarker({ userId: user.id, version: business.version });
            setChoice("server");
          }}
        >
          Usar la página de mi cuenta
        </Button>
        <Button size="lg" variant="outline" onClick={() => setChoice("local")}>
          Reemplazarla con el borrador de este dispositivo
        </Button>
      </div>
    </Message>
  );
}
