import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Download, Plus, Search, ChevronLeft, Trash2, Upload } from 'lucide-react';
import { exportDB, importInto } from 'dexie-export-import';

function App() {
  const [currentView, setCurrentView] = useState('list'); // 'list' | 'detail'
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const fileInputRef = useRef(null);

  // Request persistent storage
  useEffect(() => {
    async function requestPersist() {
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.log(`Persisted storage granted: ${isPersisted}`);
      }
    }
    requestPersist();
  }, []);

  const clientes = useLiveQuery(
    () => {
      if (searchTerm) {
        return db.clientes
          .filter(c => c.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
          .toArray();
      }
      return db.clientes.toArray();
    },
    [searchTerm]
  );

  const allEnvases = useLiveQuery(() => db.saldos_envases.toArray(), []);

  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    try {
      const id = await db.clientes.add({
        nombre: newClientName,
        saldo_dinero: 0
      });
      await db.saldos_envases.add({
        clienteId: id,
        coca_600: 0,
        coca_2lts: 0,
        coca_3lts: 0,
        caguama: 0
      });
      setNewClientName('');
      setShowNewClientModal(false);
      setSelectedClientId(id);
      setCurrentView('detail');
    } catch (error) {
      console.error("Error creating client", error);
      alert("Error al crear el cliente");
    }
  };

  const exportBackup = async () => {
    try {
      const blob = await exportDB(db, { prettyJson: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_clientes_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Backup error", error);
      alert("Error al exportar la base de datos.");
    }
  };

  const handleImportBackup = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if(window.confirm('¿Estás seguro de importar este respaldo? Esto reemplazará TODOS los datos actuales.')) {
      try {
        await importInto(db, file, { clearTablesBeforeImport: true });
        alert("Respaldo importado exitosamente.");
        setCurrentView('list');
        setSelectedClientId(null);
      } catch (error) {
        console.error("Import error", error);
        alert("Error al importar el archivo: " + error.message);
      }
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <header className="app-header">
        <div className="header-top">
          {currentView === 'detail' ? (
            <button className="btn-outline btn-icon" onClick={() => { setCurrentView('list'); setSelectedClientId(null); }}>
               <ChevronLeft />
            </button>
          ) : (
            <h2>Mis Clientes</h2>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-outline btn-icon" onClick={() => fileInputRef.current?.click()} title="Importar Backup JSON">
              <Upload />
            </button>
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImportBackup} 
            />
            <button className="btn-outline btn-icon" onClick={exportBackup} title="Exportar Backup JSON">
              <Download />
            </button>
          </div>
        </div>
        
        {currentView === 'list' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-secondary)' }} />
              <input 
                type="text" 
                placeholder="Buscar cliente..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '40px' }}
              />
            </div>
            <button className="btn-primary" onClick={() => setShowNewClientModal(true)}>
              <Plus />
            </button>
          </div>
        )}
      </header>

      <main className="content">
        {currentView === 'list' ? (
          <div className="client-list">
            {clientes?.length === 0 && <p style={{ textAlign: 'center', marginTop: '2rem' }}>No hay clientes encontrados.</p>}
            {clientes?.map(cliente => {
              const env = allEnvases?.find(e => e.clienteId === cliente.id);
              const totalEnvases = env ? (Number(env.coca_600) + Number(env.coca_2lts) + Number(env.coca_3lts) + Number(env.caguama)) : 0;
              
              return (
              <div 
                key={cliente.id} 
                className="card client-list-item"
                onClick={() => { setSelectedClientId(cliente.id); setCurrentView('detail'); }}
              >
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{cliente.nombre}</h3>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <p>Deuda: <strong className={cliente.saldo_dinero > 0 ? "money-negative" : "money-neutral"}>${cliente.saldo_dinero.toFixed(2)}</strong></p>
                    {totalEnvases > 0 && (
                      <p style={{ color: 'var(--color-envase)', fontWeight: '600' }}>
                        Envases: {totalEnvases}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronLeft style={{ transform: 'rotate(180deg)', color: 'var(--text-secondary)' }} />
              </div>
              );
            })}
          </div>
        ) : (
          <ClientDetail clientId={selectedClientId} onBack={() => { setCurrentView('list'); setSelectedClientId(null); }} />
        )}
      </main>

      {/* Modal Nuevo Cliente */}
      {showNewClientModal && (
        <div className="modal-overlay" onClick={() => setShowNewClientModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Nuevo Cliente</h2>
            <form onSubmit={handleCreateClient} style={{ marginTop: '1rem' }}>
              <input 
                type="text" 
                placeholder="Nombre del cliente" 
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                autoFocus
              />
              <div className="modal-actions">
                <button type="button" className="btn-outline" onClick={() => setShowNewClientModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function ClientDetail({ clientId, onBack }) {
  const cliente = useLiveQuery(() => db.clientes.get(clientId), [clientId]);
  const envases = useLiveQuery(() => db.saldos_envases.where('clienteId').equals(clientId).first(), [clientId]);
  const historial = useLiveQuery(async () => {
    const list = await db.historial_movimientos.where('clienteId').equals(clientId).toArray();
    return list.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [clientId]);
  
  const [showMoneyModal, setShowMoneyModal] = useState(false);
  const [moneyAction, setMoneyAction] = useState('add'); // 'add' | 'subtract'
  const [moneyAmount, setMoneyAmount] = useState('');
  const [moneyNota, setMoneyNota] = useState('');

  if (!cliente || !envases) return <p>Cargando cliente...</p>;

  const handleMoneySubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(moneyAmount);
    if (!amount || amount <= 0) return;

    let newSaldo = cliente.saldo_dinero;
    if (moneyAction === 'add') {
      newSaldo += amount;
    } else {
      newSaldo -= amount;
      if (newSaldo < 0) newSaldo = 0; // Evitar saldos negativos confusos, aunque podría ser saldo a favor.
    }

    try {
      await db.transaction('rw', db.clientes, db.historial_movimientos, async () => {
        await db.clientes.update(clientId, { saldo_dinero: newSaldo });
        await db.historial_movimientos.add({
          clienteId: clientId,
          tipo: 'Dinero',
          subtipo: moneyAction === 'add' ? 'Deuda' : 'Abono',
          cantidad: amount,
          fecha: new Date().toISOString(),
          nota: moneyNota.trim()
        });
      });
      setShowMoneyModal(false);
      setMoneyAmount('');
    } catch (err) {
      console.error(err);
      alert("Error actualizando saldo");
    }
  };

  const openMoneyModal = (action) => {
    setMoneyAction(action);
    setMoneyAmount('');
    setMoneyNota('');
    setShowMoneyModal(true);
  };

  const updateEnvase = async (tipo, delta) => {
    const currentVal = Number(envases[tipo]) || 0;
    const newVal = currentVal + delta;
    if (newVal < 0) return; // No puede deber envases negativos
    
    try {
      await db.transaction('rw', db.saldos_envases, db.historial_movimientos, async () => {
        await db.saldos_envases.where('clienteId').equals(clientId).modify({ [tipo]: newVal });
        await db.historial_movimientos.add({
          clienteId: clientId,
          tipo: 'Envase',
          subtipo: tipo,
          cantidad: Math.abs(delta),
          fecha: new Date().toISOString(),
          nota: delta > 0 ? 'Se lleva' : 'Regresa'
        });
      });
    } catch (err) {
      console.error("Error updating envase", err);
      alert("Error guardando el envase: " + err.message);
    }
  };

  const handleDeleteClient = async () => {
    if(window.confirm(`¿Estás seguro de eliminar a ${cliente.nombre}? Esta acción es irreversible.`)) {
      try {
        await db.transaction('rw', db.clientes, db.saldos_envases, db.historial_movimientos, async () => {
          await db.clientes.delete(clientId);
          await db.saldos_envases.where('clienteId').equals(clientId).delete();
          await db.historial_movimientos.where('clienteId').equals(clientId).delete();
        });
        onBack();
      } catch (e) {
        console.error(e);
        alert("Error al eliminar");
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{cliente.nombre}</h2>
        <button className="btn-outline btn-icon" onClick={handleDeleteClient} style={{ color: 'var(--color-debt)', borderColor: 'var(--color-debt)' }}>
          <Trash2 size={20} />
        </button>
      </div>

      <section className="card">
        <h3>Saldo Dinero</h3>
        <div className={`money-display ${cliente.saldo_dinero > 0 ? 'money-negative' : 'money-neutral'}`}>
          ${cliente.saldo_dinero.toFixed(2)}
        </div>
        <div className="money-actions">
          <button className="btn-pay" onClick={() => openMoneyModal('subtract')}>
             ▬ Abono
          </button>
          <button className="btn-debt" onClick={() => openMoneyModal('add')}>
             ✚ Deuda
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Inventario de Envases (Adeudados)</h3>
        <div className="envases-grid">
          <EnvaseItem 
            title="Coca 600ml" 
            count={envases.coca_600} 
            onAdd={() => updateEnvase('coca_600', 1)} 
            onSub={() => updateEnvase('coca_600', -1)} 
          />
          <EnvaseItem 
            title="Coca 2 Lts" 
            count={envases.coca_2lts} 
            onAdd={() => updateEnvase('coca_2lts', 1)} 
            onSub={() => updateEnvase('coca_2lts', -1)} 
          />
          <EnvaseItem 
            title="Coca 3 Lts" 
            count={envases.coca_3lts} 
            onAdd={() => updateEnvase('coca_3lts', 1)} 
            onSub={() => updateEnvase('coca_3lts', -1)} 
          />
          <EnvaseItem 
            title="Caguama" 
            count={envases.caguama} 
            onAdd={() => updateEnvase('caguama', 1)} 
            onSub={() => updateEnvase('caguama', -1)} 
          />
        </div>
      </section>

      {/* Historial */}
      {historial && historial.length > 0 && (
        <section className="card">
          <h3>Historial de Movimientos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            {historial.map((mov) => {
              const dateObj = new Date(mov.fecha);
              const formattedDate = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isMoney = mov.tipo === 'Dinero';
              
              let accentColor = 'var(--text-primary)';
              if (mov.subtipo.includes('Deuda') || mov.subtipo === 'Se lleva') accentColor = 'var(--color-debt)';
              if (mov.subtipo.includes('Abono') || mov.subtipo === 'Regresa') accentColor = 'var(--color-pay)';

              return (
                <div key={mov.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ display: 'block', color: accentColor }}>
                      {mov.tipo} - {mov.subtipo}: {isMoney ? '$' : ''}{mov.cantidad}
                    </strong>
                    {mov.nota && <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Nota: {mov.nota}</span>}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formattedDate}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Modal Dinero */}
      {showMoneyModal && (
        <div className="modal-overlay" onClick={() => setShowMoneyModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ color: moneyAction === 'add' ? 'var(--color-debt)' : 'var(--color-pay)' }}>
              {moneyAction === 'add' ? '✚ Agregar Deuda' : '▬ Registrar Abono'}
            </h2>
            <form onSubmit={handleMoneySubmit} style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input 
                type="number" 
                inputMode="decimal"
                step="0.01"
                placeholder="Cantidad ($)" 
                value={moneyAmount}
                onChange={e => setMoneyAmount(e.target.value)}
                autoFocus
                required
              />
              <input 
                type="text" 
                placeholder="Nota (opcional)..." 
                value={moneyNota}
                onChange={e => setMoneyNota(e.target.value)}
              />
              <div className="modal-actions">
                <button type="button" className="btn-outline" onClick={() => setShowMoneyModal(false)}>Cancelar</button>
                <button type="submit" className={moneyAction === 'add' ? 'btn-debt' : 'btn-pay'}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function EnvaseItem({ title, count, onAdd, onSub }) {
  return (
    <div className="envase-item">
      <div className="envase-title">{title}</div>
      <div className="envase-controls">
        <button 
          className="envase-control-btn minus" 
          onClick={onSub} 
          disabled={count <= 0}
          style={{ opacity: count <= 0 ? 0.3 : 1 }}
        >
          -
        </button>
        <span className="envase-count">{count}</span>
        <button className="envase-control-btn plus" onClick={onAdd}>
          +
        </button>
      </div>
    </div>
  );
}

export default App;
