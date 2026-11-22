// El registro de auditoría es de solo agregar: la propia base impide modificar o borrar filas, aunque un bug o
// alguien con acceso a la app lo intente. (TRUNCATE no activa triggers de fila: se usa solo en los tests.)
export const AUDIT_GUARD_SQL = `
create or replace function audit_log_immutable() returns trigger as $$
begin
  raise exception 'audit_log es de solo lectura: no se puede modificar ni borrar';
end;
$$ language plpgsql;
drop trigger if exists audit_log_no_change on audit_log;
create trigger audit_log_no_change before update or delete on audit_log for each row execute function audit_log_immutable();
`;
