// Una pantalla puede pedir que, antes de salir a otra sección, se termine una tarea (por ejemplo guardar lo último que se tipeó).
let guard: (() => Promise<void>) | null = null;

export function setNavGuard(fn: (() => Promise<void>) | null) {
  guard = fn;
}

export const getNavGuard = () => guard;
