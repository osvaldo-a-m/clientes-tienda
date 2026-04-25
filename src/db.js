import Dexie from 'dexie';

export const db = new Dexie('SistemaClientes_v1');

db.version(1).stores({
  clientes: '++id, nombre, saldo_dinero',
  saldos_envases: '++id, clienteId, coca_600, coca_2lts, coca_3lts, caguama',
  historial_movimientos: '++id, clienteId, tipo, subtipo, cantidad, fecha, nota'
});
