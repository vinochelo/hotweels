import React, { useState } from 'react';
import thGuideData from '../data/th_guide.json';

export default function GuiaTH() {
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'TH', 'STH'
  const [yearFilter, setYearFilter] = useState('all'); // 'all', '2024', '2025', '2026'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  const filteredItems = thGuideData.filter(item => {
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesYear = yearFilter === 'all' || item.year.toString() === yearFilter;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.series.toLowerCase().includes(queryCleaner(searchQuery)) ||
                          item.toyNum.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesYear && matchesSearch;
  });

  function queryCleaner(q) {
    return q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  const getRarityBadge = (type) => {
    if (type === 'STH') {
      return <span className="badge-rarity rarity-sth">⚡ STH</span>;
    }
    return <span className="badge-rarity rarity-th">🔥 TH</span>;
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Encabezado */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '8px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          🕵️‍♂️ Guía de Identificación Visual
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
          Listado oficial precargado de modelos Treasure Hunt (TH) y Super Treasure Hunt (STH) de 2024 a 2026.
        </p>
      </div>

      {/* Controles de Filtros */}
      <div className="glass-panel" style={{
        padding: '20px',
        borderRadius: '16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', flex: 1, minWidth: '280px' }}>
          {/* Buscador */}
          <input 
            type="text" 
            placeholder="Buscar por nombre o Toy # (ej. JJM01)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchStyle}
          />
          
          {/* Filtro Rápido de Tipo */}
          <select 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">Todas las rarezas</option>
            <option value="TH">Treasure Hunts (TH 🔥)</option>
            <option value="STH">Super Treasure Hunts (STH ⚡)</option>
          </select>

          {/* Filtro de Año */}
          <select 
            value={yearFilter} 
            onChange={(e) => setYearFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">Todos los años</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        </div>

        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Mostrando <strong>{filteredItems.length}</strong> de {thGuideData.length} modelos.
        </div>
      </div>

      {/* Grid de Modelos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '20px'
      }}>
        {filteredItems.map((item, idx) => (
          <div 
            key={`${item.toyNum}-${idx}`}
            className="glass-card"
            onClick={() => setSelectedItem(item)}
            style={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              height: '320px',
              position: 'relative'
            }}
          >
            {/* Foto */}
            <div style={{
              height: '160px',
              background: 'radial-gradient(circle, var(--bg-card-hover) 0%, var(--bg-card) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              borderBottom: '1px solid var(--border-color)'
            }}>
              {item.imageUrl ? (
                <img 
                  src={item.imageUrl} 
                  alt={item.name} 
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  loading="lazy"
                />
              ) : (
                <span style={{ fontSize: '2.5rem' }}>🚗</span>
              )}
            </div>

            {/* Detalles */}
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  {getRarityBadge(item.type)}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{item.year}</span>
                </div>
                <h4 style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '4px', lineHeight: 1.2 }}>
                  {item.name}
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {item.series}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                <span>SKU: {item.toyNum}</span>
                <span>Col: {item.colNum}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>🔍</span>
          No se encontraron modelos con los filtros seleccionados.
        </div>
      )}

      {/* Modal Detallado de Tips de Identificación */}
      {selectedItem && (
        <div style={modalOverlayStyle} onClick={() => setSelectedItem(null)}>
          <div 
            className="glass-panel" 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '90%',
              maxWidth: '480px',
              borderRadius: '20px',
              padding: '24px',
              position: 'relative',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              border: '1px solid var(--border-color)'
            }}
          >
            {/* Botón cerrar */}
            <button 
              onClick={() => setSelectedItem(null)}
              style={closeBtnStyle}
            >
              &times;
            </button>

            {/* Título */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ marginBottom: '8px' }}>{getRarityBadge(selectedItem.type)}</div>
              <h3 style={{ fontSize: '1.35rem', fontFamily: 'Outfit' }}>{selectedItem.name}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {selectedItem.series} &bull; {selectedItem.year}
              </p>
            </div>

            {/* Imagen Grande */}
            <div style={{
              height: '200px',
              background: 'radial-gradient(circle, var(--bg-card-hover) 0%, var(--bg-card) 100%)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              marginBottom: '20px'
            }}>
              {selectedItem.imageUrl ? (
                <img 
                  src={selectedItem.imageUrl} 
                  alt={selectedItem.name} 
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontSize: '4rem' }}>🚗</span>
              )}
            </div>

            {/* Info Técnica */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Número de Juguete (Toy #)</span>
                <strong>{selectedItem.toyNum}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Número de Colector</span>
                <strong>{selectedItem.colNum}</strong>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Color de Carrocería</span>
                <strong>{selectedItem.color || 'Ver descripción oficial'}</strong>
              </div>
            </div>

            {/* Tips de Identificación */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '16px'
            }}>
              <h5 style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '8px', fontFamily: 'Outfit' }}>
                💡 ¿Cómo identificarlo en la tienda?
              </h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {selectedItem.type === 'STH' ? (
                  <>
                    Los <strong>Super Treasure Hunts (STH)</strong> son versiones premium muy raras. Búscalos por:
                    <br />• <strong>Pintura Spectraflame</strong> brillante y metálica.
                    <br />• Llantas de goma <strong>Real Riders</strong> con rines detallados.
                    <br />• El logotipo <strong>"TH"</strong> impreso en la carrocería.
                    <br />• Un círculo con una flama dorada impreso en el cartón detrás del auto.
                  </>
                ) : (
                  <>
                    Los <strong>Treasure Hunts (TH)</strong> regulares son modelos de producción limitada. Búscalos por:
                    <br />• El símbolo de la <strong>flama en un círculo</strong> impreso en el auto.
                    <br />• Un círculo con una flama plateada impreso en el cartón detrás del auto en la caja.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Estilos locales
const searchStyle = {
  flex: 2,
  minWidth: '200px',
  padding: '10px 14px',
  borderRadius: '10px',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  color: '#fff',
  fontSize: '0.9rem',
  outline: 'none',
  fontFamily: 'inherit'
};

const selectStyle = {
  flex: 1,
  minWidth: '130px',
  padding: '10px 14px',
  borderRadius: '10px',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  color: '#fff',
  fontSize: '0.9rem',
  outline: 'none',
  fontFamily: 'inherit',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: '30px'
};

const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(5, 5, 8, 0.85)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  padding: '20px'
};

const closeBtnStyle = {
  position: 'absolute',
  top: '12px',
  right: '16px',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  fontSize: '1.8rem',
  cursor: 'pointer',
  lineHeight: 1
};
