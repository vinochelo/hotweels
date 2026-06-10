import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Configurar dotenv
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar directorios
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

// Crear directorio de datos si no existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Inicializar base de datos local si no existe
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ collections: {} }, null, 2));
}

// Helper para leer/escribir base de datos
const readDB = () => {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Error leyendo la base de datos:", error);
    return { collections: {} };
  }
};

const writeDB = (data) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error escribiendo en la base de datos:", error);
  }
};

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Configurar Multer para recibir imágenes en memoria
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Máximo 10MB
});

// Helper para formatear imagen para Gemini
function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType
    },
  };
}

// Generar un código de colección corto
function generateCollectionCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'HW-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Traducir colores comunes de español a inglés para la Wiki de Fandom
function translateColorToEnglish(colorEsp) {
  if (!colorEsp) return '';
  const colorMap = {
    'blanco': 'white',
    'negro': 'black',
    'rojo': 'red',
    'azul': 'blue',
    'verde': 'green',
    'amarillo': 'yellow',
    'dorado': 'gold',
    'plata': 'silver',
    'gris': 'grey',
    'naranja': 'orange',
    'morado': 'purple',
    'violeta': 'purple',
    'café': 'brown',
    'marrón': 'brown',
    'rosa': 'pink',
    'rosado': 'pink'
  };
  
  const words = colorEsp.toLowerCase().split(/[\s,]+/);
  for (const word of words) {
    if (colorMap[word]) return colorMap[word];
  }
  return '';
}

// Analizar wikitexto para encontrar el archivo de imagen de la variante específica
function parseWikitextTable(wikitext, targetColorEng, targetYear, targetColNum) {
  const rows = wikitext.split('|-');
  let bestMatchPhoto = null;
  let scoreMax = 0;
  
  for (const row of rows) {
    if (!row.includes('|')) continue;
    
    // Limpiar marcadores de fila
    let rowClean = row.trim();
    if (rowClean.startsWith('|-')) {
      rowClean = rowClean.substring(2).trim();
    }
    if (rowClean.startsWith('|')) {
      rowClean = rowClean.substring(1).trim();
    }
    
    // Las columnas se separan por \n| o ||
    const cols = rowClean.split(/\n\||\|\|/).map(c => c.trim());
    if (cols.length < 5) continue;
    
    // Mapeo típico de columnas en tablas sortable de Hot Wheels Wiki:
    const colNumText = cols[0] || '';
    const yearText = cols[1] || '';
    const colorText = cols[3] || '';
    const toyNumText = cols[9] || '';
    
    // Encontrar la columna que contenga la imagen de este renglón
    let photoCol = '';
    for (let i = cols.length - 1; i >= 0; i--) {
      if (cols[i].includes('[[Image:') || cols[i].includes('[[File:')) {
        photoCol = cols[i];
        break;
      }
    }
    
    if (!photoCol) continue;
    
    const fileMatch = photoCol.match(/\[\[(?:Image|File):([^|\]]+)/i);
    if (!fileMatch) continue;
    const filename = fileMatch[1];
    
    let score = 0;
    
    // 1. Coincidencia por Número de Coleccionista (e.g. "29/250" o "029/250" o "29")
    if (targetColNum) {
      const cleanTarget = targetColNum.replace(/^0+/, '').toLowerCase();
      const cleanColText = colNumText.replace(/^0+/, '').toLowerCase();
      if (cleanColText.includes(cleanTarget) || cleanTarget.includes(cleanColText)) {
        score += 30;
      }
    }
    
    // 2. Coincidencia por Año (ej: 2024)
    if (targetYear && yearText.includes(targetYear.toString())) {
      score += 15;
    }
    
    // 3. Coincidencia por Color (ej: white)
    if (targetColorEng && colorText.toLowerCase().includes(targetColorEng.toLowerCase())) {
      score += 10;
    }
    
    if (score > scoreMax) {
      scoreMax = score;
      bestMatchPhoto = filename;
    }
  }
  
  return bestMatchPhoto;
}

// Helper para buscar la imagen oficial en Hot Wheels Fandom Wiki
async function getFandomImage(carName, colorEsp = '', year = '', colNum = '') {
  try {
    // 1. Buscar el artículo de Fandom relacionado directamente por nombre
    const searchUrl = `https://hotwheels.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(carName)}&format=json&utf8=1`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    const searchResults = searchData?.query?.search || [];
    if (searchResults.length === 0) return null;
    
    const bestTitle = searchResults[0].title;
    
    // 2. Intentar buscar por wikitexto para variantes de color
    const wikitextUrl = `https://hotwheels.fandom.com/api.php?action=parse&page=${encodeURIComponent(bestTitle)}&prop=wikitext&format=json`;
    const wikitextRes = await fetch(wikitextUrl);
    const wikitextData = await wikitextRes.json();
    
    const wikitext = wikitextData?.parse?.wikitext?.['*'];
    if (wikitext) {
      const targetColorEng = translateColorToEnglish(colorEsp);
      const filename = parseWikitextTable(wikitext, targetColorEng, year, colNum);
      
      if (filename) {
        console.log(`Variante de color encontrada en wikitext: ${filename}`);
        const resolveUrl = `https://hotwheels.fandom.com/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url&format=json`;
        const resolveRes = await fetch(resolveUrl);
        const resolveData = await resolveRes.json();
        
        const pages = resolveData?.query?.pages || {};
        const pageId = Object.keys(pages)[0];
        const imgUrl = pages[pageId]?.imageinfo?.[0]?.url;
        
        if (imgUrl) return imgUrl;
      }
    }
    
    // 3. Fallback: imagen genérica por defecto de la página
    console.log("Variante no detectada. Usando imagen genérica de la página.");
    const imageQueryUrl = `https://hotwheels.fandom.com/api.php?action=query&titles=${encodeURIComponent(bestTitle)}&prop=pageimages&format=json&pithumbsize=500`;
    const imageRes = await fetch(imageQueryUrl);
    const imageData = await imageRes.json();
    
    const pages = imageData?.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    
    if (pageId && pages[pageId]?.thumbnail?.source) {
      return pages[pageId].thumbnail.source;
    }
    return null;
  } catch (error) {
    console.error("Error buscando imagen en Fandom:", error);
    return null;
  }
}

// Endpoint para buscar imagen oficial en Fandom manual o automáticamente
app.get('/api/wiki-image', async (req, res) => {
  const { name, color, year, colNum } = req.query;
  if (!name) {
    return res.status(400).json({ error: 'Se requiere el nombre del modelo.' });
  }
  const image = await getFandomImage(name, color || '', year || '', colNum || '');
  res.json({ image: image || '' });
});

// 1. Identificar Hot Wheels usando Gemini
app.post('/api/identify', upload.single('photo'), async (req, res) => {
  try {
    const apiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'Falta la clave API de Gemini. Proporciónala en la configuración de la app o configúrala en el servidor.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ninguna foto.' });
    }

    // Inicializar Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const imagePart = fileToGenerativePart(req.file.buffer, req.file.mimetype);

    const prompt = `
      Analiza esta foto de un auto de juguete Hot Wheels. Identifica el modelo exacto de Hot Wheels.
      Debes responder ÚNICAMENTE con un objeto JSON en español que tenga la siguiente estructura:
      {
        "name": "Nombre exacto del modelo (ej. Twin Mill, Bone Shaker, etc.)",
        "series": "Nombre de la serie o línea (ej. HW Screen Time, HW Mainline, HW Hot Trucks, etc.). Si no la conoces pon 'Línea Principal'",
        "seriesNumber": "Número dentro de la serie (ej. 3/10 o 'N/A' si no se sabe)",
        "collectorNumber": "Número de colector de Hot Wheels (ej. 124/250 o 'N/A')",
        "year": 2024, // Año aproximado de lanzamiento de esta edición (número entero)
        "color": "Color de carrocería y detalles del diseño/calcomanías",
        "baseMaterial": "Material de la base si es visible (Metal o Plástico o 'Desconocido')",
        "wheelType": "Descripción breve del estilo de las llantas",
        "rarity": "Clasifica en una de estas opciones: 'Mainline', 'Treasure Hunt', 'Super Treasure Hunt', o 'Zamac'",
        "description": "Una breve descripción histórica del casting, curiosidades o por qué es popular entre los coleccionistas."
      }
      No agregues explicaciones, ni bloques de código markdown, solo el objeto JSON crudo.
    `;

    console.log("Enviando foto a Gemini...");
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    console.log("Respuesta de Gemini recibida.");

    let carDetails;
    try {
      carDetails = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Error al parsear la respuesta JSON de Gemini:", responseText);
      return res.status(500).json({
        error: 'La IA no devolvió un formato JSON válido.',
        rawText: responseText
      });
    }

    // Intentar buscar imagen de referencia oficial en Fandom Wiki
    console.log(`Buscando imagen de catálogo en Fandom para: ${carDetails.name} (${carDetails.color})...`);
    const fandomImage = await getFandomImage(carDetails.name, carDetails.color, carDetails.year, carDetails.collectorNumber);
    if (fandomImage) {
      console.log(`¡Imagen encontrada!: ${fandomImage}`);
      carDetails.image = fandomImage;
    } else {
      console.log("No se encontró imagen en Fandom.");
      carDetails.image = '';
    }

    res.json(carDetails);

  } catch (error) {
    console.error("Error en /api/identify:", error);
    res.status(500).json({ error: 'Error al procesar la imagen con la IA: ' + error.message });
  }
});

const DEMO_CARS = [
  {
    id: "car_demo1",
    name: "Twin Mill",
    series: "HW Mainline",
    seriesNumber: "3/10",
    collectorNumber: "118/250",
    year: 2024,
    color: "Verde Eléctrico con calcomanías de flamas",
    baseMaterial: "Metal",
    wheelType: "5SP (5 Spokes)",
    rarity: "Treasure Hunt",
    description: "El Twin Mill es uno de los diseños originales más famosos e icónicos de Hot Wheels. Fue diseñado por Ira Gilford y se caracteriza por sus motores duales expuestos.",
    image: "",
    dateAdded: new Date().toISOString()
  },
  {
    id: "car_demo2",
    name: "Bone Shaker",
    series: "HW Art Cars",
    seriesNumber: "2/5",
    collectorNumber: "95/250",
    year: 2025,
    color: "Negro Mate con calavera dorada",
    baseMaterial: "Metal",
    wheelType: "OH5 (Open Hole 5 Spoke)",
    rarity: "Mainline",
    description: "El Bone Shaker es un casting de Hot Wheels muy popular diseñado por Larry Wood. Se asemeja a un Hot Rod clásico y presenta una calavera distintiva en la parrilla delantera.",
    image: "",
    dateAdded: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: "car_demo3",
    name: "DeLorean Time Machine",
    series: "HW Screen Time",
    seriesNumber: "1/10",
    collectorNumber: "42/250",
    year: 2024,
    color: "Plata Cepillado con detalles de condensador de flujo",
    baseMaterial: "Plástico",
    wheelType: "RR (Real Riders)",
    rarity: "Super Treasure Hunt",
    description: "Esta edición especial Super Treasure Hunt presenta pintura Spectraflame plata y llantas Real Riders de goma. Réplica del auto de Volver al Futuro.",
    image: "",
    dateAdded: new Date(Date.now() - 7200000).toISOString()
  }
];

// 2. Crear una nueva colección
app.post('/api/collection/create', (req, res) => {
  const db = readDB();
  const code = generateCollectionCode();
  
  db.collections[code] = [...DEMO_CARS];
  writeDB(db);
  
  res.json({ collectionId: code });
});

// 3. Obtener los autos de una colección
app.get('/api/collection/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();

  // Si la colección no existe, la inicializamos
  if (!db.collections[id]) {
    db.collections[id] = [];
    writeDB(db);
  }

  res.json({ collectionId: id, cars: db.collections[id] });
});

// 4. Agregar un auto a una colección
app.post('/api/collection/:id/add', (req, res) => {
  const { id } = req.params;
  const car = req.body;
  const db = readDB();

  if (!db.collections[id]) {
    db.collections[id] = [];
  }

  // Crear ID único para el auto
  const newCar = {
    ...car,
    id: 'car_' + Math.random().toString(36).substr(2, 9),
    dateAdded: new Date().toISOString()
  };

  db.collections[id].push(newCar);
  writeDB(db);

  res.json({ success: true, car: newCar });
});

// 5. Eliminar un auto de una colección
app.delete('/api/collection/:id/car/:carId', (req, res) => {
  const { id, carId } = req.params;
  const db = readDB();

  if (!db.collections[id]) {
    return res.status(404).json({ error: 'Colección no encontrada.' });
  }

  const initialLength = db.collections[id].length;
  db.collections[id] = db.collections[id].filter(car => car.id !== carId);
  
  if (db.collections[id].length === initialLength) {
    return res.status(404).json({ error: 'Auto no encontrado.' });
  }

  writeDB(db);
  res.json({ success: true });
});

// 6. Fusionar y sincronizar dos colecciones (ej: al compartir/sincronizar el inventario)
app.post('/api/collection/merge', (req, res) => {
  const { sourceId, targetId } = req.body;
  const db = readDB();

  if (!db.collections[sourceId] || !db.collections[targetId]) {
    return res.status(400).json({ error: 'Una o ambas colecciones no existen.' });
  }

  const sourceCars = db.collections[sourceId];
  const targetCars = db.collections[targetId];

  // Fusionar autos evitando duplicados exactos (basado en nombre y año)
  const mergedCars = [...targetCars];

  sourceCars.forEach(sCar => {
    const isDuplicate = targetCars.some(tCar => 
      tCar.name.toLowerCase() === sCar.name.toLowerCase() && 
      tCar.year === sCar.year
    );
    if (!isDuplicate) {
      // Re-asignar ID del auto para evitar colisiones
      mergedCars.push({
        ...sCar,
        id: 'car_' + Math.random().toString(36).substr(2, 9)
      });
    }
  });

  db.collections[targetId] = mergedCars;
  // Apuntar la colección de origen al mismo set o mantenerla para no romper el historial,
  // pero para sincronización el cliente adoptará 'targetId' como su nuevo ID activo.
  writeDB(db);

  res.json({ success: true, mergedCount: mergedCars.length, targetId });
});

// Servir archivos estáticos del frontend en producción
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(CLIENT_DIST));

// Capturar el resto de las rutas y redirigir a index.html (SPA)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend no compilado. Corre npm run build en la carpeta client.');
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de Hot Wheels corriendo en http://localhost:${PORT}`);
});
