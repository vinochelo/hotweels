import React, { useState, useEffect } from 'react';

export default function CarDetailModal({ car, isOpen, onClose, onSave, onDelete, isNew, scannedImageFile, existingCars = [] }) {
  const [editedCar, setEditedCar] = useState(null);
  const [isEditing, setIsEditing] = useState(isNew);
  const [catalogUrl, setCatalogUrl] = useState(null);
  const [userPhotoUrl, setUserPhotoUrl] = useState(null);

  // Determinar si es un auto duplicado en la galería actual (por nombre y año)
  const isDuplicate = editedCar && existingCars.some(ec => 
    (isNew || ec.id !== editedCar.id) &&
    ec.name && editedCar.name &&
    ec.name.trim().toLowerCase() === editedCar.name.trim().toLowerCase() && 
    Number(ec.year) === Number(editedCar.year)
  );

  // Cargar auto al abrir o cambiar
  useEffect(() => {
    if (car) {
      setEditedCar({ ...car });
      setIsEditing(isNew);
    }
  }, [car, isNew]);

  // Generar URLs para imagen oficial de Fandom y foto tomada
  useEffect(() => {
    if (car?.image) {
      setCatalogUrl(car.image);
    } else {
      setCatalogUrl(null);
    }

    if (scannedImageFile) {
      const url = URL.createObjectURL(scannedImageFile);
      setUserPhotoUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (car?.userImage) {
      setUserPhotoUrl(car.userImage);
    } else {
      setUserPhotoUrl(null);
    }
  }, [scannedImageFile, car]);

  if (!isOpen || !editedCar) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedCar(prev => ({
      ...prev,
      [name]: name === 'year' ? parseInt(value) || '' : value
    }));
  };

  const handleSave = () => {
    // Si hay una foto tomada nueva, convertirla a base64 y guardarla en userImage
    if (scannedImageFile) {
      const reader = new FileReader();
      reader.readAsDataURL(scannedImageFile);
      reader.onloadend = () => {
        const base64data = reader.result;
        onSave({ ...editedCar, userImage: base64data });
        onClose();
      };
    } else {
      onSave(editedCar);
      onClose();
    }
  };

  const handleSearchFandomImage = async () => {
    if (!editedCar.name) return;
    try {
      const serverUrl = window.location.port === '5173'
        ? `${window.location.protocol}//${window.location.hostname}:3001`
        : window.location.origin;

      const response = await fetch(`${serverUrl}/api/wiki-image?name=${encodeURIComponent(editedCar.name)}&color=${encodeURIComponent(editedCar.color || '')}&year=${encodeURIComponent(editedCar.year || '')}&colNum=${encodeURIComponent(editedCar.collectorNumber || '')}`);
      const data = await response.json();
      if (data.image) {
        setEditedCar(prev => ({ ...prev, image: data.image }));
        setCatalogUrl(data.image);
      } else {
        alert("No se encontró ninguna imagen oficial en Fandom Wiki para este nombre. Intenta ajustar el nombre del modelo.");
      }
    } catch (err) {
      console.error("Error buscando imagen en Fandom:", err);
      alert("Error de comunicación con el servidor.");
    }
  };

  const getRarityClass = (rarity) => {
    switch (rarity?.toLowerCase()) {
      case 'treasure hunt': return 'rarity-th';
      case 'super treasure hunt': return 'rarity-sth';
      case 'zamac': return 'rarity-zamac';
      default: return 'rarity-mainline';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 5, 8, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div 
        className="glass-panel" 
        style={{
          width: '100%',
          maxWidth: '650px',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* --- Cabecera --- */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontFamily: 'Outfit' }}>
            {isNew ? '✨ Nuevo Auto Detectado' : '🚗 Detalles del Vehículo'}
          </h3>
          <button 
            type="button" 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            &times;
          </button>
        </div>

        {/* --- Contenido --- */}
        <div style={{ padding: '24px', overflowY: 'auto', maxHeight: 'calc(80vh - 120px)' }}>
          
          {/* Contenedor de Imágenes (Catálogo y Captura) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: (catalogUrl || isEditing) && userPhotoUrl ? '1fr 1fr' : '1fr',
            gap: '16px',
            marginBottom: '24px'
          }}>
            {/* Foto de Catálogo (Fandom Wiki) */}
            {catalogUrl ? (
              <div style={{
                borderRadius: '16px',
                overflow: 'hidden',
                background: 'radial-gradient(circle, #1c1d24 0%, #0d0e12 100%)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px',
                position: 'relative'
              }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '8px' }}>
                  📖 FOTO OFICIAL (FANDOM WIKI)
                </span>
                <div style={{ width: '100%', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img 
                    src={catalogUrl} 
                    alt="Foto de catálogo oficial" 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
                {isEditing && (
                  <button 
                    type="button"
                    onClick={handleSearchFandomImage}
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      background: 'rgba(0,0,0,0.6)',
                      border: '1px solid var(--border-color)',
                      color: '#fff',
                      fontSize: '0.65rem',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Buscar de nuevo
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                borderRadius: '16px',
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.02)',
                border: '1px dashed var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                height: '208px'
              }}>
                <span style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📖</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Sin foto oficial de catálogo</span>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={handleSearchFandomImage}
                  style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                >
                  🔍 Buscar Foto Oficial
                </button>
              </div>
            )}

            {/* Foto Capturada por el Usuario */}
            {userPhotoUrl && (
              <div style={{
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#090a0d',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px'
              }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '8px' }}>
                  📸 TU FOTO CAPTURADA
                </span>
                <div style={{ width: '100%', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img 
                    src={userPhotoUrl} 
                    alt="Tu foto capturada" 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Formulario de información */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            
            {isDuplicate && (
              <div style={{
                gridColumn: '1 / -1',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.85rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <span>⚠️</span> DUPLICADO: Ya tienes este modelo ({editedCar.name} - {editedCar.year}) en tu galería.
              </div>
            )}

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                NOMBRE DEL MODELO
              </label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="name" 
                  value={editedCar.name || ''} 
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Ej. Bone Shaker"
                />
              ) : (
                <p style={valueStyle}>{editedCar.name}</p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                SERIE / LÍNEA
              </label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="series" 
                  value={editedCar.series || ''} 
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Ej. HW Screen Time"
                />
              ) : (
                <p style={valueStyle}>{editedCar.series || 'N/A'}</p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                AÑO DE LANZAMIENTO
              </label>
              {isEditing ? (
                <input 
                  type="number" 
                  name="year" 
                  value={editedCar.year || ''} 
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Ej. 2024"
                />
              ) : (
                <p style={valueStyle}>{editedCar.year || 'Desconocido'}</p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                Nº DE SERIE
              </label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="seriesNumber" 
                  value={editedCar.seriesNumber || ''} 
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Ej. 3/10"
                />
              ) : (
                <p style={valueStyle}>{editedCar.seriesNumber || 'N/A'}</p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                Nº COLECTOR (SKU)
              </label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="collectorNumber" 
                  value={editedCar.collectorNumber || ''} 
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Ej. 142/250"
                />
              ) : (
                <p style={valueStyle}>{editedCar.collectorNumber || 'N/A'}</p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                COLOR DE CARROCERÍA
              </label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="color" 
                  value={editedCar.color || ''} 
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Ej. Rojo con flamas"
                />
              ) : (
                <p style={valueStyle}>{editedCar.color || 'Desconocido'}</p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                TIPO DE LLANTAS
              </label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="wheelType" 
                  value={editedCar.wheelType || ''} 
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Ej. 5SP (5 Spokes)"
                />
              ) : (
                <p style={valueStyle}>{editedCar.wheelType || 'Desconocido'}</p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                MATERIAL DE LA BASE
              </label>
              {isEditing ? (
                <select 
                  name="baseMaterial" 
                  value={editedCar.baseMaterial || ''} 
                  onChange={handleChange}
                  style={selectStyle}
                >
                  <option value="Metal">Metal</option>
                  <option value="Plástico">Plástico</option>
                  <option value="Desconocido">Desconocido</option>
                </select>
              ) : (
                <p style={valueStyle}>{editedCar.baseMaterial || 'Desconocido'}</p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                CLASE / RAREZA
              </label>
              {isEditing ? (
                <select 
                  name="rarity" 
                  value={editedCar.rarity || 'Mainline'} 
                  onChange={handleChange}
                  style={selectStyle}
                >
                  <option value="Mainline">Mainline (Común)</option>
                  <option value="Treasure Hunt">Treasure Hunt (TH 🔥)</option>
                  <option value="Super Treasure Hunt">Super Treasure Hunt (STH ⚡)</option>
                  <option value="Zamac">Zamac</option>
                </select>
              ) : (
                <div style={{ marginTop: '4px' }}>
                  <span className={`badge-rarity ${getRarityClass(editedCar.rarity)}`}>
                    {editedCar.rarity === 'Treasure Hunt' && '🔥 '}
                    {editedCar.rarity === 'Super Treasure Hunt' && '⚡ '}
                    {editedCar.rarity}
                  </span>
                </div>
              )}
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                DESCRIPCIÓN / HISTORIA
              </label>
              {isEditing ? (
                <textarea 
                  name="description" 
                  value={editedCar.description || ''} 
                  onChange={handleChange}
                  style={{ ...inputStyle, height: '80px', resize: 'vertical' }}
                  placeholder="Detalles históricos o variaciones del auto..."
                />
              ) : (
                <p style={{ ...valueStyle, whiteSpace: 'pre-wrap', lineHeight: 1.4, fontSize: '0.85rem' }}>
                  {editedCar.description || 'Sin descripción disponible.'}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* --- Pie de Modal --- */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.01)'
        }}>
          <div>
            {!isNew && !isEditing && (
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={() => {
                  if (confirm('¿Estás seguro de que quieres eliminar este auto de tu colección?')) {
                    onDelete(editedCar.id);
                    onClose();
                  }
                }}
              >
                🗑️ Eliminar
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {isEditing ? (
              <>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    if (isNew) {
                      onClose();
                    } else {
                      setIsEditing(false);
                      setEditedCar({ ...car });
                    }
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleSave}
                >
                  {isNew ? '💾 Guardar en Galería' : 'Guardar Cambios'}
                </button>
              </>
            ) : (
              <>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsEditing(true)}
                >
                  ✏️ Editar Datos
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={onClose}
                >
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// Estilos comunes reutilizables
const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  background: '#0c0d12',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.2s ease',
  boxSizing: 'border-box'
};

const selectStyle = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: '30px'
};

const valueStyle = {
  padding: '10px 0',
  color: '#f1f5f9',
  fontSize: '0.95rem',
  fontWeight: '500',
  borderBottom: '1px solid rgba(255,255,255,0.03)'
};
