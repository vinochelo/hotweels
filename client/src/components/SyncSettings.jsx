import React, { useState } from 'react';

export default function SyncSettings({ collectionId, onSyncComplete, onResetCollection, serverUrl }) {
  const [targetCode, setTargetCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(collectionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("No se pudo copiar el código:", err);
    }
  };

  const handleSyncSubmit = async (e) => {
    e.preventDefault();
    if (!targetCode.trim()) return;

    const formattedCode = targetCode.trim().toUpperCase();

    if (formattedCode === collectionId) {
      setError("Ya estás en esta colección.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // Llamar al endpoint de fusionado
      const response = await fetch(`${serverUrl}/api/collection/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: collectionId, // Colección local actual
          targetId: formattedCode // Colección remota con la que fusionar
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error vinculando colecciones.');
      }

      setSuccessMsg(`¡Sincronización exitosa! Fusionado con la colección ${formattedCode}.`);
      setTargetCode('');
      
      // Notificar al componente padre que adopte el nuevo ID
      setTimeout(() => {
        onSyncComplete(formattedCode);
      }, 1500);

    } catch (err) {
      console.error("Error al sincronizar:", err);
      setError(err.message || "No se pudo vincular la colección. Verifica que el código sea correcto.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm("¿Estás seguro de que quieres desvincularte? Se creará una colección nueva vacía. Los autos existentes en la colección actual permanecerán en ella, pero tú comenzarás con una lista en blanco.")) {
      onResetCollection();
      setSuccessMsg("Se ha creado una nueva colección.");
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <div className="glass-panel" style={{ borderRadius: '24px', padding: '28px' }}>
        
        <h2 style={{ fontSize: '1.5rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>🔗</span> Compartir e Inventario Sincronizado
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.5 }}>
          Puedes compartir tu galería completa con otro usuario para tener <strong>el mismo listado de autos</strong>.
          Al vincular colecciones, los autos de ambos se fusionarán y cualquier cambio se verá reflejado en tiempo real para ambos.
        </p>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#f87171',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '20px',
            fontSize: '0.85rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: '#34d399',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '20px',
            fontSize: '0.85rem'
          }}>
            ✅ {successMsg}
          </div>
        )}

        {/* --- Sección 1: Tu Código de Colección --- */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid var(--border-color)',
          marginBottom: '28px'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '700', letterSpacing: '0.05em' }}>
            TU CÓDIGO DE COLECCIÓN ACTIVO
          </span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginTop: '8px'
          }}>
            <div style={{
              flex: 1,
              background: '#0c0d12',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '12px 16px',
              fontFamily: 'monospace',
              fontSize: '1.2rem',
              fontWeight: '700',
              color: 'var(--accent-color)',
              letterSpacing: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {collectionId}
            </div>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleCopyCode}
              style={{ padding: '12px 20px', minWidth: '130px' }}
            >
              {copied ? '¡Copiado! ✓' : '📋 Copiar Código'}
            </button>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '10px' }}>
            Comparte este código con otra persona para que lo ingrese en su aplicación y se sincronice con tu galería.
          </p>
        </div>

        {/* --- Sección 2: Vincular Colección Ajena --- */}
        <form onSubmit={handleSyncSubmit} style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '8px', fontFamily: 'Outfit' }}>
            Unirse a otra colección
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>
            Ingresa el código de colección de tu amigo para fusionar tus autos actuales y compartir la lista desde ahora.
          </p>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="Ej: HW-5A9F2D"
              value={targetCode}
              onChange={(e) => setTargetCode(e.target.value)}
              disabled={loading}
              maxLength={12}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '12px',
                background: '#0c0d12',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                textTransform: 'uppercase',
                outline: 'none'
              }}
            />
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading || !targetCode.trim()}
              style={{ padding: '12px 24px' }}
            >
              {loading ? 'Sincronizando...' : '🔗 Vincular Galería'}
            </button>
          </div>
        </form>

        {/* --- Sección 3: Acciones de restablecimiento --- */}
        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>¿Quieres tu propia lista individual?</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Desvincula la colección actual y crea una nueva.</span>
          </div>
          <button 
            type="button" 
            className="btn btn-danger" 
            onClick={handleReset}
            style={{ fontSize: '0.8rem', padding: '8px 16px' }}
          >
            🔌 Desvincular e Inicializar
          </button>
        </div>

      </div>
    </div>
  );
}
