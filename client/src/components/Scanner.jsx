import React, { useState, useRef, useEffect } from 'react';

export default function Scanner({ onScanResult, serverUrl, geminiKey }) {
  const [useCamera, setUseCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraPermission, setCameraPermission] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Detener la cámara al desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setUseCamera(true);
        setCameraPermission(true);
      }
    } catch (err) {
      console.error("Error al acceder a la cámara:", err);
      setCameraPermission(false);
      setError("No se pudo acceder a la cámara. Permite los accesos o sube una imagen desde tu galería.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setUseCamera(false);
  };

  // Procesar archivo de imagen (cámara o galería)
  const processImageFile = async (file) => {
    if (!file) return;
    
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const response = await fetch(`${serverUrl}/api/identify`, {
        method: 'POST',
        headers: {
          'x-gemini-key': geminiKey || ''
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error desconocido al identificar el auto.');
      }

      onScanResult(data, file); // Pasar detalles identificados y archivo original
    } catch (err) {
      console.error("Error identificando auto:", err);
      setError(err.message || "Error al comunicarse con el servidor de IA.");
    } finally {
      setLoading(false);
    }
  };

  // Capturar frame del stream de video
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Configurar dimensiones
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Dibujar imagen
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convertir a blob para enviar
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
          stopCamera();
          processImageFile(file);
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <div className="glass-panel" style={{ borderRadius: '24px', padding: '24px', position: 'relative' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>📸</span> Escanear con IA
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
          Toma una foto de tu Hot Wheels o sube una imagen de tu galería para que la IA identifique el modelo y sus detalles.
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

        {/* --- Visor / Área de Escaneo --- */}
        <div 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            width: '100%',
            height: '350px',
            borderRadius: '16px',
            border: useCamera ? '2px solid var(--accent-color)' : '2px dashed var(--border-color)',
            background: '#090a0d',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            boxShadow: useCamera ? '0 0 25px rgba(255, 51, 0, 0.15)' : 'none'
          }}
        >
          {loading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(11, 12, 14, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              gap: '16px'
            }}>
              <div style={{
                width: '50px',
                height: '50px',
                border: '4px solid rgba(255, 51, 0, 0.1)',
                borderTopColor: 'var(--accent-color)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              `}</style>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: '600', color: '#fff', fontSize: '1rem' }}>Identificando Auto...</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Gemini está analizando los detalles del casting
                </p>
              </div>
            </div>
          )}

          {useCamera ? (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div className="laser-line" />
              
              {/* Esquinas del Viewfinder */}
              <div style={{
                position: 'absolute',
                inset: '20px',
                pointerEvents: 'none',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '20px', height: '20px', borderTop: '4px solid var(--accent-color)', borderLeft: '4px solid var(--accent-color)' }} />
                <div style={{ position: 'absolute', top: 0, right: 0, width: '20px', height: '20px', borderTop: '4px solid var(--accent-color)', borderRight: '4px solid var(--accent-color)' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '20px', height: '20px', borderBottom: '4px solid var(--accent-color)', borderLeft: '4px solid var(--accent-color)' }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', borderBottom: '4px solid var(--accent-color)', borderRight: '4px solid var(--accent-color)' }} />
              </div>
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '16px', filter: 'grayscale(0.3)' }}>🚗</div>
              <p style={{ fontWeight: '600', marginBottom: '8px' }}>Arrastra tu foto aquí</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '20px' }}>
                Soporta archivos PNG, JPG o WEBP
              </p>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: '0.85rem' }}
              >
                Buscar Imagen
              </button>
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
        </div>

        {/* --- Controles --- */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          {useCamera ? (
            <>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={capturePhoto} 
                style={{ flex: 1 }}
              >
                📷 Capturar Foto
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={stopCamera}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={startCamera} 
                style={{ flex: 1 }}
              >
                🎥 Usar Cámara
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => fileInputRef.current?.click()}
              >
                Subir Archivo
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Canvas oculto para la captura */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
