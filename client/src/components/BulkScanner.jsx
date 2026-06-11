import React, { useState, useEffect, useRef } from 'react';

export default function BulkScanner({ collectionId, serverUrl, geminiKey, onCarSaved }) {
  const [queue, setQueue] = useState([]); // Array: { id, file, status, progress, result, error, previewUrl }
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  
  const fileInputRef = useRef(null);

  // Limpiar URLs de vista previa al desmontar
  useEffect(() => {
    return () => {
      queue.forEach(item => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [queue]);

  // Manejar archivos seleccionados
  const handleFiles = (filesList) => {
    if (!filesList || filesList.length === 0) return;

    const newItems = Array.from(filesList).map(file => ({
      id: 'bulk_' + Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending', // 'pending', 'processing', 'success', 'error', 'saved'
      progress: 0,
      result: null,
      error: null,
      previewUrl: URL.createObjectURL(file)
    }));

    setQueue(prev => [...prev, ...newItems]);
  };

  const handleFileChange = (e) => {
    handleFiles(e.target.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  // Iniciar el procesamiento de la cola
  const startQueueProcessing = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    // Bucle para procesar uno por uno
    while (true) {
      // Obtener el siguiente elemento pendiente
      let nextItem = null;
      setQueue(prev => {
        nextItem = prev.find(item => item.status === 'pending');
        return prev;
      });

      if (!nextItem) break; // No hay más pendientes

      // Actualizar estado a 'processing'
      updateItemStatus(nextItem.id, 'processing');

      try {
        const formData = new FormData();
        formData.append('photo', nextItem.file);

        const response = await fetch(`${serverUrl}/api/identify`, {
          method: 'POST',
          headers: {
            'x-gemini-key': geminiKey || ''
          },
          body: formData
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error al identificar el auto.');
        }

        // Éxito: Guardar resultado
        updateItemSuccess(nextItem.id, data);
      } catch (err) {
        console.error("Error en cola masiva:", err);
        updateItemError(nextItem.id, err.message || 'Error en el servidor de IA.');
      }

      // Retraso de 4 segundos antes de la siguiente petición (Rate limit friendly)
      await new Promise(resolve => setTimeout(resolve, 4000));
    }

    setIsProcessing(false);
  };

  // Helpers para actualizar el estado de la cola
  const updateItemStatus = (id, status) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, status } : item));
  };

  const updateItemSuccess = (id, result) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, status: 'success', result } : item));
  };

  const updateItemError = (id, error) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, status: 'error', error } : item));
  };

  // Eliminar un elemento de la lista/cola
  const discardItem = (id) => {
    setQueue(prev => {
      const item = prev.find(i => i.id === id);
      if (item && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(i => i.id !== id);
    });
    if (editingItemId === id) {
      setEditingItemId(null);
      setEditForm(null);
    }
  };

  // Reintentar procesar una imagen que dio error
  const retryItem = (id) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, status: 'pending', error: null } : item));
    // Ejecutar procesamiento si no está corriendo
    setTimeout(() => startQueueProcessing(), 100);
  };

  // Guardar un auto individual
  const saveCarItem = async (id, customData = null) => {
    const item = queue.find(i => i.id === id);
    if (!item || (!item.result && !customData)) return;

    const carToSave = customData || item.result;

    try {
      // Usar la imagen de Fandom si está disponible, sino, podemos adjuntar la imagen local como base64
      // pero en este backend, las imágenes se leen de Fandom. Si queremos guardar la foto del usuario:
      // el endpoint '/add' acepta el body. Vamos a convertir la imagen local a Base64
      // para que quede guardada como 'userImage' si es necesario.
      let userImage = '';
      if (item.file) {
        userImage = await fileToBase64(item.file);
      }

      const bodyData = {
        ...carToSave,
        userImage: userImage || ''
      };

      const response = await fetch(`${serverUrl}/api/collection/${collectionId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const data = await response.json();
      if (data.success) {
        setQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'saved' } : i));
        if (onCarSaved) onCarSaved();
        if (editingItemId === id) {
          setEditingItemId(null);
          setEditForm(null);
        }
      } else {
        alert("Error al guardar: " + data.error);
      }
    } catch (err) {
      console.error("Error al guardar auto:", err);
      alert("No se pudo conectar con el servidor.");
    }
  };

  // Guardar todos los elementos identificados exitosamente
  const saveAllSuccessItems = async () => {
    const successItems = queue.filter(item => item.status === 'success');
    if (successItems.length === 0) return;

    for (const item of successItems) {
      await saveCarItem(item.id);
    }
  };

  // Limpiar todos los guardados de la lista
  const clearSavedItems = () => {
    setQueue(prev => prev.filter(item => item.status !== 'saved'));
  };

  // Iniciar la edición de un auto
  const startEditing = (item) => {
    setEditingItemId(item.id);
    setEditForm({ ...(item.result) });
  };

  // Guardar cambios del formulario de edición
  const handleEditSubmit = (e, id) => {
    e.preventDefault();
    // Guardar los datos modificados directamente
    saveCarItem(id, editForm);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: name === 'year' ? parseInt(value) || new Date().getFullYear() : value
    }));
  };

  // Convertir file a Base64 de forma asíncrona
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  // Estadísticas de la cola
  const totalItems = queue.length;
  const processedItems = queue.filter(i => ['success', 'error', 'saved'].includes(i.status)).length;
  const successItemsCount = queue.filter(i => i.status === 'success').length;
  const pendingItemsCount = queue.filter(i => i.status === 'pending').length;
  const isQueueEmpty = totalItems === 0;

  // Auto-iniciar procesamiento cuando se agregan archivos pendientes y no está corriendo
  useEffect(() => {
    if (pendingItemsCount > 0 && !isProcessing) {
      startQueueProcessing();
    }
  }, [pendingItemsCount, isProcessing]);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '10px' }}>
      
      {/* Zona de Drop / Carga de archivos */}
      <div 
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          width: '100%',
          padding: '40px 20px',
          borderRadius: '20px',
          border: '2px dashed var(--border-color)',
          background: 'rgba(255, 255, 255, 0.02)',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          marginBottom: '24px'
        }}
        className="drag-drop-area"
      >
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '12px' }}>📂</span>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '6px', fontFamily: 'Outfit' }}>
          Selecciona o arrastra múltiples fotos
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Sube todas las fotos de tus Hot Wheels. Se identificarán secuencialmente por IA.
        </p>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          multiple 
          style={{ display: 'none' }} 
        />
      </div>

      {/* Controles de la cola y barra de progreso */}
      {!isQueueEmpty && (
        <div className="glass-panel" style={{ borderRadius: '20px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontFamily: 'Outfit', fontSize: '1.05rem' }}>
              {isProcessing ? '🔄 Procesando cola de fotos...' : '✓ Procesamiento completado'}
            </h4>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {processedItems} de {totalItems} fotos procesadas
            </span>
          </div>

          {/* Barra de progreso */}
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '16px'
          }}>
            <div style={{
              width: `${(processedItems / totalItems) * 100}%`,
              height: '100%',
              background: 'var(--accent-gradient)',
              transition: 'width 0.4s ease'
            }} />
          </div>

          {/* Acciones en lote */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {successItemsCount > 0 && (
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={saveAllSuccessItems}
                style={{ fontSize: '0.85rem' }}
              >
                📥 Guardar todos los validados ({successItemsCount})
              </button>
            )}
            {queue.some(i => i.status === 'saved') && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={clearSavedItems}
                style={{ fontSize: '0.85rem' }}
              >
                🧹 Limpiar guardados
              </button>
            )}
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => {
                queue.forEach(item => {
                  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                });
                setQueue([]);
              }}
              style={{ fontSize: '0.85rem' }}
            >
              Borrar todo
            </button>
          </div>
        </div>
      )}

      {/* Lista / Grid de Validación */}
      {!isQueueEmpty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontFamily: 'Outfit', fontSize: '1.2rem', marginBottom: '4px' }}>
            Lista de Validación
          </h3>

          {queue.map(item => (
            <div 
              key={item.id} 
              className="glass-panel" 
              style={{ 
                borderRadius: '16px', 
                padding: '16px', 
                display: 'flex', 
                gap: '16px',
                flexWrap: 'wrap',
                border: item.status === 'saved' ? '1px solid rgba(16, 185, 129, 0.2)' : 
                        item.status === 'error' ? '1px solid rgba(239, 68, 68, 0.2)' : 
                        item.status === 'processing' ? '1px solid rgba(0, 230, 255, 0.2)' : '1px solid var(--border-color)',
                background: item.status === 'saved' ? 'rgba(16, 185, 129, 0.02)' : 'rgba(255,255,255,0.01)',
                opacity: item.status === 'saved' ? 0.75 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              {/* Foto cargada */}
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '12px',
                background: '#090a0d',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-color)',
                position: 'relative'
              }}>
                <img 
                  src={item.previewUrl} 
                  alt="Vista previa" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                
                {/* Estados superpuestos */}
                {item.status === 'pending' && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    En espera...
                  </div>
                )}
                {item.status === 'processing' && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', border: '2px solid rgba(0, 230, 255, 0.1)', borderTopColor: '#00e6ff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: '#00e6ff', fontSize: '0.7rem', fontWeight: 'bold' }}>Identificando...</span>
                  </div>
                )}
                {item.status === 'saved' && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(16, 185, 129, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.8rem' }}>
                    ✓
                  </div>
                )}
              </div>

              {/* Detalles / Resultado */}
              <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {item.status === 'pending' && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', height: '100%' }}>
                    Esperando turno en la cola de procesamiento de la IA...
                  </div>
                )}

                {item.status === 'processing' && (
                  <div style={{ color: '#00e6ff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', height: '100%' }}>
                    Gemini está analizando la imagen de este auto...
                  </div>
                )}

                {item.status === 'error' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', justifyContent: 'center' }}>
                    <span style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 'bold' }}>⚠️ Error al identificar</span>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>{item.error}</p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button type="button" className="btn btn-primary" onClick={() => retryItem(item.id)} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Reintentar</button>
                      <button type="button" className="btn btn-secondary" onClick={() => discardItem(item.id)} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Descartar</button>
                    </div>
                  </div>
                )}

                {item.status === 'saved' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', height: '100%', justifyContent: 'center' }}>
                    <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 'bold' }}>✓ Guardado con éxito</span>
                    <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{item.result?.name} ({item.result?.year})</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{item.result?.series}</span>
                  </div>
                )}

                {item.status === 'success' && editingItemId !== item.id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>{item.result.name}</h4>
                      <span className={`badge-rarity ${
                        item.result.rarity?.toLowerCase() === 'treasure hunt' ? 'rarity-th' :
                        item.result.rarity?.toLowerCase() === 'super treasure hunt' ? 'rarity-sth' :
                        item.result.rarity?.toLowerCase() === 'zamac' ? 'rarity-zamac' : 'rarity-mainline'
                      }`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                        {item.result.rarity}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>Año: <strong style={{ color: '#fff' }}>{item.result.year}</strong></span>
                      <span>Serie: <strong style={{ color: '#fff' }}>{item.result.series}</strong></span>
                      <span>Color: <strong style={{ color: '#fff' }}>{item.result.color}</strong></span>
                      <span>Colector: <strong style={{ color: '#fff' }}>{item.result.collectorNumber}</strong></span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button 
                        type="button" 
                        className="btn btn-primary" 
                        onClick={() => saveCarItem(item.id)} 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        Confirmar y Guardar
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => startEditing(item)} 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        Editar
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => discardItem(item.id)} 
                        style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#ef4444' }}
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                )}

                {/* Formulario de Edición Integrado (Inline) */}
                {item.status === 'success' && editingItemId === item.id && (
                  <form onSubmit={(e) => handleEditSubmit(e, item.id)} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                      <div>
                        <label style={labelStyle}>NOMBRE DEL MODELO</label>
                        <input type="text" name="name" value={editForm.name} onChange={handleEditChange} required style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>AÑO</label>
                        <input type="number" name="year" value={editForm.year} onChange={handleEditChange} required style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>SERIE</label>
                        <input type="text" name="series" value={editForm.series} onChange={handleEditChange} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Nº COLECTOR</label>
                        <input type="text" name="collectorNumber" value={editForm.collectorNumber} onChange={handleEditChange} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>COLOR</label>
                        <input type="text" name="color" value={editForm.color} onChange={handleEditChange} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>RAREZA</label>
                        <select name="rarity" value={editForm.rarity} onChange={handleEditChange} style={selectStyle}>
                          <option value="Mainline">Mainline</option>
                          <option value="Treasure Hunt">Treasure Hunt</option>
                          <option value="Super Treasure Hunt">Super Treasure Hunt</option>
                          <option value="Zamac">Zamac</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        Guardar Cambios
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => {
                          setEditingItemId(null);
                          setEditForm(null);
                        }}
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Estilos de formulario inline
const labelStyle = {
  display: 'block',
  fontSize: '0.65rem',
  color: 'var(--text-secondary)',
  marginBottom: '2px',
  fontWeight: 'bold'
};

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: '6px',
  background: '#0c0d12',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff',
  fontSize: '0.8rem',
  outline: 'none'
};

const selectStyle = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: '6px',
  background: '#0c0d12',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff',
  fontSize: '0.8rem',
  outline: 'none',
  cursor: 'pointer'
};
