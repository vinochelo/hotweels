import React, { useState, useEffect, useCallback } from 'react';
import Scanner from './components/Scanner';
import CarDetailModal from './components/CarDetailModal';
import SyncSettings from './components/SyncSettings';
import GuiaTH from './components/GuiaTH';

// Configurar URL del backend dinámicamente para soportar red local (Wi-Fi) y producción
const SERVER_URL = window.location.port === '5173'
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : window.location.origin;

export default function App() {
  const [activeView, setActiveView] = useState('gallery'); // 'gallery', 'scan', 'guia', 'sync', 'settings'
  const [collectionId, setCollectionId] = useState('');
  const [cars, setCars] = useState([]);
  const [geminiKey, setGeminiKey] = useState('');
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.className = `theme-${theme}`;
    localStorage.setItem('app-theme', theme);
  }, [theme]);
  
  // Estados de filtros y orden
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortBy, setSortBy] = useState('dateAddedDesc');

  // Estados del modal de detalles
  const [selectedCar, setSelectedCar] = useState(null);
  const [isModalNew, setIsModalNew] = useState(false);
  const [scannedFile, setScannedFile] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estado de carga global
  const [loading, setLoading] = useState(true);

  // Cargar clave de Gemini e inicializar colección
  useEffect(() => {
    // Clave de Gemini
    const savedKey = localStorage.getItem('gemini_api_key') || '';
    setGeminiKey(savedKey);

    // ID de Colección
    const initializeCollection = async () => {
      let savedColId = localStorage.getItem('collection_id');
      
      if (!savedColId) {
        try {
          const res = await fetch(`${SERVER_URL}/api/collection/create`, { method: 'POST' });
          const data = await res.json();
          savedColId = data.collectionId;
          localStorage.setItem('collection_id', savedColId);
        } catch (err) {
          console.error("Error creando colección inicial:", err);
          // Fallback local en caso de error de red inicial
          savedColId = 'HW-OFFLINE';
          localStorage.setItem('collection_id', savedColId);
        }
      }
      setCollectionId(savedColId);
    };

    initializeCollection();
  }, []);

  // Cargar lista de autos de la colección activa
  const fetchCars = useCallback(async () => {
    if (!collectionId) return;
    
    try {
      const res = await fetch(`${SERVER_URL}/api/collection/${collectionId}`);
      const data = await res.json();
      setCars(data.cars || []);
    } catch (err) {
      console.error("Error cargando autos de la colección:", err);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  // Cargar autos al cambiar de ID de colección o vista
  useEffect(() => {
    fetchCars();
  }, [collectionId, fetchCars]);

  // Sincronización en tiempo real: polling cada 10 segundos para actualizar el listado compartido
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeView === 'gallery' && collectionId) {
        fetchCars();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [activeView, collectionId, fetchCars]);

  // Manejar el resultado de un escaneo de IA exitoso
  const handleScanResult = (carDetails, file) => {
    setSelectedCar(carDetails);
    setScannedFile(file);
    setIsModalNew(true);
    setIsModalOpen(true);
  };

  // Guardar un auto (nuevo o modificado)
  const handleSaveCar = async (carData) => {
    try {
      const isEdit = carData.id && !isModalNew;
      
      // Si es un auto nuevo, enviarlo al endpoint /add
      if (isModalNew) {
        const response = await fetch(`${SERVER_URL}/api/collection/${collectionId}/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(carData)
        });
        const data = await response.json();
        if (data.success) {
          fetchCars();
          setActiveView('gallery');
        }
      } else {
        // Para simplificar ediciones, removemos el viejo y agregamos el nuevo modificado
        // en el backend (o podrías expandir los endpoints). Hagamos un reemplazo limpio:
        await fetch(`${SERVER_URL}/api/collection/${collectionId}/car/${carData.id}`, {
          method: 'DELETE'
        });
        
        await fetch(`${SERVER_URL}/api/collection/${collectionId}/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(carData)
        });
        
        fetchCars();
      }
    } catch (err) {
      console.error("Error al guardar auto:", err);
      alert("No se pudo guardar el auto. Inténtalo de nuevo.");
    } finally {
      setScannedFile(null);
      setIsModalNew(false);
    }
  };

  // Eliminar un auto
  const handleDeleteCar = async (carId) => {
    try {
      const response = await fetch(`${SERVER_URL}/api/collection/${collectionId}/car/${carId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        fetchCars();
      }
    } catch (err) {
      console.error("Error eliminando auto:", err);
    }
  };

  // Agregar auto manualmente con valores en blanco
  const handleAddManualCar = () => {
    const blankCar = {
      name: 'Nuevo Auto',
      series: 'Línea Principal',
      seriesNumber: '1/10',
      collectorNumber: '1/250',
      year: new Date().getFullYear(),
      color: '',
      baseMaterial: 'Desconocido',
      wheelType: '',
      rarity: 'Mainline',
      description: '',
      image: ''
    };
    setSelectedCar(blankCar);
    setScannedFile(null);
    setIsModalNew(true);
    setIsModalOpen(true);
  };

  // Guardar clave API de Gemini desde la configuración
  const handleSaveGeminiKey = (e) => {
    e.preventDefault();
    const inputKey = e.target.elements.keyInput.value.trim();
    localStorage.setItem('gemini_api_key', inputKey);
    setGeminiKey(inputKey);
    alert("Clave API de Gemini guardada correctamente.");
    setActiveView('scan'); // Redirigir al escáner
  };

  // Sincronización exitosa con otra colección
  const handleSyncComplete = (newCollectionId) => {
    localStorage.setItem('collection_id', newCollectionId);
    setCollectionId(newCollectionId);
    setActiveView('gallery');
  };

  // Restablecer colección (crear una nueva vacía)
  const handleResetCollection = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/collection/create`, { method: 'POST' });
      const data = await res.json();
      const newColId = data.collectionId;
      localStorage.setItem('collection_id', newColId);
      setCollectionId(newColId);
      setActiveView('gallery');
    } catch (err) {
      console.error("Error al crear colección limpia:", err);
    }
  };

  // Filtrado y ordenamiento local de los autos
  const getFilteredCars = () => {
    let result = [...cars];

    // Buscar
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(car => 
        car.name.toLowerCase().includes(query) || 
        car.series?.toLowerCase().includes(query) || 
        car.color?.toLowerCase().includes(query)
      );
    }

    // Filtrar por Rareza
    if (rarityFilter !== 'all') {
      result = result.filter(car => car.rarity?.toLowerCase() === rarityFilter.toLowerCase());
    }

    // Filtrar por Año
    if (yearFilter !== 'all') {
      result = result.filter(car => car.year?.toString() === yearFilter);
    }

    // Ordenar
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'year') {
        return b.year - a.year; // Más recientes primero
      }
      if (sortBy === 'dateAddedAsc') {
        return new Date(a.dateAdded) - new Date(b.dateAdded);
      }
      // dateAddedDesc (Por defecto)
      return new Date(b.dateAdded) - new Date(a.dateAdded);
    });

    return result;
  };

  // Extraer años únicos para los filtros dropdown
  const getUniqueYears = () => {
    const years = cars.map(car => car.year).filter(Boolean);
    return [...new Set(years)].sort((a, b) => b - a);
  };

  const filteredCars = getFilteredCars();
  const uniqueYears = getUniqueYears();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* --- Encabezado / Nav --- */}
      <header className="glass-panel" style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-color)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Logo */}
        <div 
          onClick={() => setActiveView('gallery')}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            cursor: 'pointer',
            fontSize: '1.4rem',
            fontFamily: 'Outfit',
            fontWeight: '800',
            textShadow: '0 0 10px var(--accent-glow)'
          }}
        >
          <span style={{ fontSize: '1.8rem' }}>🔥</span>
          <span style={{
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Hot Wheels AI</span>
        </div>

        {/* Links de Navegación */}
        <nav style={{ display: 'flex', gap: '8px' }}>
          <button 
            type="button"
            onClick={() => setActiveView('gallery')}
            style={navBtnStyle(activeView === 'gallery')}
          >
            🚗 Mi Galería
          </button>
          <button 
            type="button"
            onClick={() => setActiveView('scan')}
            style={navBtnStyle(activeView === 'scan')}
          >
            📸 Escanear
          </button>
          <button 
            type="button"
            onClick={() => setActiveView('guia')}
            style={navBtnStyle(activeView === 'guia')}
          >
            📖 Guía TH/STH
          </button>
          <button 
            type="button"
            onClick={() => setActiveView('sync')}
            style={navBtnStyle(activeView === 'sync')}
          >
            🔗 Sincronizar
          </button>
          <button 
            type="button"
            onClick={() => setActiveView('settings')}
            style={navBtnStyle(activeView === 'settings')}
          >
            ⚙️ Configuración
          </button>
        </nav>

        {/* Resumen de colección activa y Selector de Tema */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select 
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: '600'
            }}
          >
            <option value="dark" style={{ background: '#121318', color: '#fff' }}>🌑 Stitch Oscuro</option>
            <option value="light" style={{ background: '#fff', color: '#000' }}>☀️ Claro</option>
            <option value="gt" style={{ background: '#140505', color: '#fff' }}>🏎️ GT Rojo</option>
            <option value="banana" style={{ background: '#141405', color: '#fff' }}>🍌 Banana Amarillo</option>
          </select>
          <span style={{ 
            fontSize: '0.8rem', 
            background: 'rgba(255,255,255,0.05)', 
            padding: '6px 12px', 
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)'
          }}>
            Código: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{collectionId}</strong>
          </span>
          <span style={{ 
            fontSize: '0.8rem', 
            background: 'var(--accent-glow)', 
            padding: '6px 12px', 
            borderRadius: '20px',
            border: '1px solid var(--border-color-active)',
            color: 'var(--text-primary)',
            fontWeight: '700'
          }}>
            {cars.length} autos
          </span>
        </div>
      </header>

      {/* --- Contenedor de Contenido Principal --- */}
      <main style={{ flex: 1, padding: '32px 24px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        
        {/* VISTA 1: GALERÍA DE AUTOS */}
        {activeView === 'gallery' && (
          <div>
            {/* Controles de Búsqueda y Filtros */}
            <div className="glass-panel" style={{
              borderRadius: '20px',
              padding: '20px',
              marginBottom: '32px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              alignItems: 'center',
              border: '1px solid var(--border-color)'
            }}>
              {/* Buscador */}
              <div style={{ flex: '1 1 300px', position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Buscar por nombre, serie o color..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 40px',
                    borderRadius: '12px',
                    background: '#0c0d12',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '0.9rem'
                  }}
                />
                <span style={{ position: 'absolute', left: '14px', top: '12px', fontSize: '1.1rem', color: 'var(--text-muted)' }}>🔍</span>
              </div>

              {/* Filtro Rareza */}
              <div style={{ flex: '1 1 150px' }}>
                <select 
                  value={rarityFilter}
                  onChange={(e) => setRarityFilter(e.target.value)}
                  style={filterSelectStyle}
                >
                  <option value="all">Todas las rarezas</option>
                  <option value="mainline">Mainline (Común)</option>
                  <option value="treasure hunt">Treasure Hunt (TH 🔥)</option>
                  <option value="super treasure hunt">Super Treasure Hunt (STH ⚡)</option>
                  <option value="zamac">Zamac</option>
                </select>
              </div>

              {/* Filtro Año */}
              <div style={{ flex: '1 1 120px' }}>
                <select 
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  style={filterSelectStyle}
                >
                  <option value="all">Todos los años</option>
                  {uniqueYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {/* Ordenamiento */}
              <div style={{ flex: '1 1 180px' }}>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={filterSelectStyle}
                >
                  <option value="dateAddedDesc">Agregado reciente</option>
                  <option value="dateAddedAsc">Agregado antiguo</option>
                  <option value="name">Alfabético (A-Z)</option>
                  <option value="year">Año (Más nuevos primero)</option>
                </select>
              </div>

              {/* Acciones */}
              <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={fetchCars}
                  title="Refrescar lista"
                  style={{ padding: '12px' }}
                >
                  🔄
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleAddManualCar}
                >
                  ➕ Agregar Manual
                </button>
              </div>
            </div>

            {/* Listado de autos en Grid */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid rgba(255, 51, 0, 0.1)',
                  borderTopColor: 'var(--accent-color)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }} />
                <p style={{ color: 'var(--text-secondary)' }}>Cargando galería de coleccionista...</p>
              </div>
            ) : filteredCars.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '24px'
              }}>
                {filteredCars.map(car => (
                  <div 
                    key={car.id} 
                    className="glass-card" 
                    onClick={() => {
                      setSelectedCar(car);
                      setScannedFile(null);
                      setIsModalNew(false);
                      setIsModalOpen(true);
                    }}
                    style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%' }}
                  >
                    {/* Imagen del Auto */}
                    <div style={{
                      height: '160px',
                      background: 'radial-gradient(circle, #1c1d24 0%, #0d0e12 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative',
                      borderBottom: '1px solid var(--border-color)'
                    }}>
                      {car.image || car.userImage ? (
                        <img 
                          src={car.image || car.userImage} 
                          alt={car.name} 
                          style={{ width: '90%', height: '90%', objectFit: 'contain', transition: 'transform 0.3s ease' }}
                          className="car-image"
                        />
                      ) : (
                        <div style={{ fontSize: '2.5rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}>🚗</div>
                      )}
                      
                      {/* Pestaña de Año */}
                      <span style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        background: 'rgba(0,0,0,0.6)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        color: '#ffaa66'
                      }}>
                        {car.year}
                      </span>
                    </div>

                    {/* Contenido / Textos */}
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <h4 style={{ fontSize: '0.95rem', marginBottom: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {car.name}
                      </h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '12px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {car.series || 'Línea Principal'}
                      </p>
                      
                      {/* Fila inferior con rareza */}
                      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={`badge-rarity ${
                          car.rarity?.toLowerCase() === 'treasure hunt' ? 'rarity-th' :
                          car.rarity?.toLowerCase() === 'super treasure hunt' ? 'rarity-sth' :
                          car.rarity?.toLowerCase() === 'zamac' ? 'rarity-zamac' : 'rarity-mainline'
                        }`} style={{ fontSize: '0.65rem', padding: '3px 8px' }}>
                          {car.rarity}
                        </span>
                        
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {car.collectorNumber !== 'N/A' ? car.collectorNumber : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Estado Vacío */
              <div className="glass-panel" style={{
                borderRadius: '24px',
                padding: '60px 40px',
                textAlign: 'center',
                border: '1px dashed var(--border-color)',
                maxWidth: '500px',
                margin: '40px auto'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📦</div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', fontFamily: 'Outfit' }}>Galería Vacía</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.5 }}>
                  {searchQuery || rarityFilter !== 'all' || yearFilter !== 'all' 
                    ? 'No hay autos en tu colección que coincidan con los filtros aplicados.' 
                    : 'Aún no has agregado autos a esta colección. ¡Escanea tu primer auto con IA o agrégalo manualmente!'}
                </p>
                {searchQuery || rarityFilter !== 'all' || yearFilter !== 'all' ? (
                  <button 
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setSearchQuery('');
                      setRarityFilter('all');
                      setYearFilter('all');
                    }}
                  >
                    Limpiar Filtros
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button 
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setActiveView('scan')}
                    >
                      📸 Escanear con IA
                    </button>
                    <button 
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAddManualCar}
                    >
                      Agregar Manual
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VISTA 2: ESCÁNER CON IA */}
        {activeView === 'scan' && (
          <div>
            {!geminiKey && (
              <div className="glass-panel" style={{
                borderRadius: '20px',
                padding: '24px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                background: 'rgba(245, 158, 11, 0.03)',
                maxWidth: '600px',
                margin: '0 auto 24px',
                color: '#fbbf24',
                fontSize: '0.9rem',
                lineHeight: 1.5
              }}>
                <strong>⚠️ Clave API de Gemini Requerida:</strong> Para usar la cámara y la identificación por visión de IA, necesitas ingresar tu clave API de Gemini. Puedes configurarla rápidamente en la pestaña de <strong>Configuración</strong> de forma gratuita.
              </div>
            )}
            <Scanner 
              onScanResult={handleScanResult} 
              serverUrl={SERVER_URL} 
              geminiKey={geminiKey}
              collectionId={collectionId}
              onCarSaved={fetchCars}
            />
          </div>
        )}

        {/* VISTA 3: SINCRONIZAR GALERÍA */}
        {activeView === 'sync' && (
          <SyncSettings 
            collectionId={collectionId}
            onSyncComplete={handleSyncComplete}
            onResetCollection={handleResetCollection}
            serverUrl={SERVER_URL}
          />
        )}

        {/* VISTA 4: CONFIGURACIÓN DE CLAVE API */}
        {activeView === 'settings' && (
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
            <div className="glass-panel" style={{ borderRadius: '24px', padding: '28px' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>⚙️</span> Configuración de la IA
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.5 }}>
                Esta aplicación procesa tus fotos de Hot Wheels localmente utilizando la API de Google Gemini (modelo 2.5 Flash).
                La clave se guardará localmente de forma segura en tu navegador y nunca se compartirá con terceros.
              </p>

              <form onSubmit={handleSaveGeminiKey}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '700' }}>
                    CLAVE API DE GOOGLE GEMINI
                  </label>
                  <input 
                    type="password" 
                    name="keyInput"
                    defaultValue={geminiKey}
                    placeholder="AIzaSy..."
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: '#0c0d12',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '0.95rem',
                      outline: 'none'
                    }}
                  />
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.75rem', color: 'var(--accent-color)', textDecoration: 'none', fontWeight: '600' }}
                    >
                      🔑 Obtener clave gratis en Google AI Studio &nearr;
                    </a>
                    {geminiKey && (
                      <span style={{ fontSize: '0.75rem', color: '#10b981' }}>✓ Clave configurada</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Guardar Configuración
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => {
                      localStorage.removeItem('gemini_api_key');
                      setGeminiKey('');
                      alert("Clave eliminada.");
                    }}
                  >
                    Borrar Clave
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VISTA DE GUÍA TH/STH */}
        {activeView === 'guia' && (
          <GuiaTH />
        )}

      </main>

      {/* --- Pie de Página --- */}
      <footer style={{
        padding: '24px',
        textAlign: 'center',
        borderTop: '1px solid var(--border-color)',
        color: 'var(--text-muted)',
        fontSize: '0.8rem'
      }}>
        <p>© 2026 Hot Wheels AI Collector - Desarrollado en Español. Estilo de interfaz diseñado con Google Stitch.</p>
      </footer>

      {/* --- Modal de Detalles del Auto --- */}
      <CarDetailModal
        isOpen={isModalOpen}
        car={selectedCar}
        isNew={isModalNew}
        scannedImageFile={scannedFile}
        existingCars={cars}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCar(null);
          setScannedFile(null);
        }}
        onSave={handleSaveCar}
        onDelete={handleDeleteCar}
      />

    </div>
  );
}

// Estilos de Nav en línea
const navBtnStyle = (isActive) => ({
  background: isActive ? 'var(--accent-glow)' : 'transparent',
  border: '1px solid',
  borderColor: isActive ? 'var(--border-color-active)' : 'transparent',
  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
  padding: '8px 16px',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: '600',
  fontFamily: 'Outfit, sans-serif',
  transition: 'all 0.2s ease'
});

// Estilos comunes para selectores de filtros
const filterSelectStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  background: '#0c0d12',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff',
  fontSize: '0.85rem',
  outline: 'none',
  cursor: 'pointer'
};
