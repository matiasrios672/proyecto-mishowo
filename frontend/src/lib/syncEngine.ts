// Motor de sincronización del editor con el servidor. Sin React: se puede probar con reloj simulado.
//  - agrupa ráfagas de cambios (debounce) y nunca hay dos guardados en vuelo a la vez
//  - lleva la versión del servidor y la manda en cada guardado (detecta ediciones desde otro dispositivo)
//  - sin conexión: reintenta con espera creciente y no pierde el último cambio
//  - ante un conflicto o una sesión vencida se detiene hasta que la persona resuelva

export type PushResult =
  | { ok: true; version: number }
  | { ok: false; reason: "conflict"; version: number }
  | { ok: false; reason: "network" }
  | { ok: false; reason: "unauthorized" }
  | { ok: false; reason: "invalid" };

export type SyncState =
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "synced"; version: number }
  | { kind: "offline"; retryInMs: number }
  | { kind: "conflict"; serverVersion: number }
  | { kind: "unauthorized" }
  | { kind: "rejected" };

export interface SyncOptions<T> {
  push: (doc: T, baseVersion: number | null) => Promise<PushResult>;
  onState: (s: SyncState) => void;
  onSynced?: (version: number) => void;
  debounceMs?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
}

export function createSyncEngine<T>(opts: SyncOptions<T>, initialVersion: number | null) {
  const debounceMs = opts.debounceMs ?? 800;
  const retryBase = opts.retryBaseMs ?? 5000;
  const retryMax = opts.retryMaxMs ?? 60_000;

  let version = initialVersion;
  let latest: T | undefined;
  let dirty = false;
  let inflight = false;
  let stopped = false; // conflicto o sesión vencida: no se guarda hasta que se resuelva
  let disposed = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clear = () => { if (timer) { clearTimeout(timer); timer = undefined; } };
  const state = (s: SyncState) => { if (!disposed) opts.onState(s); };

  async function run(): Promise<void> {
    if (disposed || stopped || inflight || !dirty || latest === undefined) return;
    inflight = true;
    dirty = false;
    state({ kind: "syncing" });
    const doc = latest;
    let result: PushResult;
    try {
      result = await opts.push(doc, version);
    } catch {
      result = { ok: false, reason: "network" };
    }
    inflight = false;
    if (disposed) return;

    if (result.ok) {
      version = result.version;
      failures = 0;
      opts.onSynced?.(result.version);
      if (dirty) return void run(); // hubo cambios mientras se guardaba: se guardan ahora mismo
      return state({ kind: "synced", version: result.version });
    }
    dirty = true; // lo último que escribió la persona sigue sin estar en el servidor
    if (result.reason === "conflict") {
      stopped = true;
      return state({ kind: "conflict", serverVersion: result.version });
    }
    if (result.reason === "unauthorized") {
      stopped = true;
      return state({ kind: "unauthorized" });
    }
    if (result.reason === "invalid") {
      // El servidor rechazó el contenido: reintentar lo mismo no sirve. Se espera al próximo cambio.
      dirty = false;
      return state({ kind: "rejected" });
    }
    const wait = Math.min(retryMax, retryBase * 2 ** failures);
    failures++;
    state({ kind: "offline", retryInMs: wait });
    clear();
    timer = setTimeout(() => void run(), wait);
  }

  return {
    /** Programa un guardado: junta cambios seguidos y manda solo el último. */
    schedule(doc: T) {
      latest = doc;
      dirty = true;
      clear();
      if (stopped) return;
      timer = setTimeout(() => void run(), debounceMs);
    },
    /** Guarda ya, sin esperar (ej. al migrar el borrador o antes de cerrar sesión). */
    flushNow(doc: T): Promise<void> {
      latest = doc;
      dirty = true;
      clear();
      return run();
    },
    /** La persona eligió qué versión conservar: se retoma el guardado con la versión actual del servidor. */
    resolve(doc: T, serverVersion: number) {
      version = serverVersion;
      stopped = false;
      failures = 0;
      latest = doc;
      dirty = true;
      clear();
      return run();
    },
    /** La persona eligió la versión del servidor: se descarta lo pendiente y se sigue desde esa versión. */
    adopt(serverVersion: number) {
      version = serverVersion;
      stopped = false;
      dirty = false;
      failures = 0;
      clear();
      state({ kind: "synced", version: serverVersion });
    },
    /** Retoma luego de volver a iniciar sesión. */
    resume() {
      stopped = false;
      clear();
      return run();
    },
    getVersion: () => version,
    isBusy: () => inflight || dirty,
    dispose() {
      disposed = true;
      clear();
    },
  };
}

export type SyncEngine<T> = ReturnType<typeof createSyncEngine<T>>;
