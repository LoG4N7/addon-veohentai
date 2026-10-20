const http = require('http');
const app = require('../api/index');

// Helper para hacer peticiones HTTP al servidor de prueba
function request(baseUrl, path) {
  return new Promise((resolve, reject) => {
    const url = `${baseUrl}${path}`;
    http
      .get(url, (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch (e) {
            // Not JSON
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: json,
            text: rawData
          });
        });
      })
      .on('error', (err) => reject(err));
  });
}

async function runTests() {
  console.log('\n=======================================================');
  console.log('🧪 Iniciando Suite de Pruebas Automatizadas para VeoHentai Addon');
  console.log('=======================================================\n');

  // Iniciar servidor en puerto dinámico
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[INFO] Servidor de prueba levantado en ${baseUrl}\n`);

  let passed = 0;
  let failed = 0;

  async function assertTest(name, fn) {
    try {
      process.stdout.write(`⏳ Ejecutando: ${name}... `);
      await fn();
      console.log('✅ PASÓ (HTTP 200 & JSON Válido)');
      passed++;
    } catch (err) {
      console.log(`❌ FALLÓ`);
      console.error(`   -> Error: ${err.message}`);
      failed++;
    }
  }

  try {
    // 1. Manifiesto
    await assertTest('GET /manifest.json', async () => {
      const res = await request(baseUrl, '/manifest.json');
      if (res.status !== 200) throw new Error(`Status esperado 200, obtenido ${res.status}`);
      if (!res.data || res.data.id !== 'com.veohentai.addon') {
        throw new Error('ID de manifiesto inválido');
      }
      if (!res.data.idPrefixes || !res.data.idPrefixes.includes('vht-')) {
        throw new Error('Prefijo vht- ausente en el manifiesto');
      }
      if (!Array.isArray(res.data.catalogs) || res.data.catalogs.length !== 5) {
        throw new Error(`Se esperaban 5 catálogos en manifest, obtenidos ${res.data.catalogs ? res.data.catalogs.length : 0}`);
      }
    });

    // 2. Catálogo: Episodios Recientes
    await assertTest('GET /catalog/anime/vh-episodios-recientes.json', async () => {
      const res = await request(baseUrl, '/catalog/anime/vh-episodios-recientes.json');
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!res.data || !Array.isArray(res.data.metas)) throw new Error('Respuesta metas no es un array');
      if (res.data.metas.length === 0) throw new Error('El catálogo retornó 0 elementos');
      const first = res.data.metas[0];
      if (!first.id || !first.id.startsWith('vht-')) throw new Error('ID no tiene prefijo vht-');
      if (!first.name || !first.poster) throw new Error('Meta incompleto (falta name o poster)');
    });

    // 3. Catálogo: Top 10 de la Semana
    await assertTest('GET /catalog/anime/vh-top-semana.json', async () => {
      const res = await request(baseUrl, '/catalog/anime/vh-top-semana.json');
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!res.data || !Array.isArray(res.data.metas) || res.data.metas.length === 0) {
        throw new Error('Catálogo top semana vacío o inválido');
      }
      if (!res.data.metas[0].id.startsWith('vht-')) throw new Error('ID sin prefijo vht-');
    });

    // 4. Catálogo: Más Vistos
    await assertTest('GET /catalog/anime/vh-mas-vistos.json', async () => {
      const res = await request(baseUrl, '/catalog/anime/vh-mas-vistos.json');
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!res.data || !Array.isArray(res.data.metas) || res.data.metas.length === 0) {
        throw new Error('Catálogo más vistos vacío o inválido');
      }
      if (!res.data.metas[0].id.startsWith('vht-')) throw new Error('ID sin prefijo vht-');
    });

    // 5. Catálogo: Hentai Sin Censura
    await assertTest('GET /catalog/anime/vh-sin-censura.json', async () => {
      const res = await request(baseUrl, '/catalog/anime/vh-sin-censura.json');
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!res.data || !Array.isArray(res.data.metas) || res.data.metas.length === 0) {
        throw new Error('Catálogo sin censura vacío o inválido');
      }
      if (!res.data.metas[0].id.startsWith('vht-')) throw new Error('ID sin prefijo vht-');
    });

    // 6. Catálogo: Todos los Episodios
    await assertTest('GET /catalog/anime/vh-todos-episodios.json', async () => {
      const res = await request(baseUrl, '/catalog/anime/vh-todos-episodios.json');
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!res.data || !Array.isArray(res.data.metas) || res.data.metas.length === 0) {
        throw new Error('Catálogo todos los episodios vacío o inválido');
      }
      if (!res.data.metas[0].id.startsWith('vht-')) throw new Error('ID sin prefijo vht-');
    });

    // 7. Búsqueda en Catálogo
    await assertTest('GET /catalog/anime/vh-todos-episodios/search=kanojo.json', async () => {
      const res = await request(baseUrl, '/catalog/anime/vh-todos-episodios/search=kanojo.json');
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!res.data || !Array.isArray(res.data.metas) || res.data.metas.length === 0) {
        throw new Error('Búsqueda no devolvió resultados para "kanojo"');
      }
      const match = res.data.metas.some((m) => m.name.toLowerCase().includes('kanojo') || m.id.includes('kanojo'));
      if (!match) throw new Error('Resultados de búsqueda no coinciden con la consulta');
    });

    // 8. Metadatos de Serie y Episodios
    await assertTest('GET /meta/anime/vht-seishidouin-no-oshigoto-the-animation.json', async () => {
      const res = await request(baseUrl, '/meta/anime/vht-seishidouin-no-oshigoto-the-animation.json');
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!res.data || !res.data.meta) throw new Error('Objeto meta ausente');
      const meta = res.data.meta;
      if (!meta.id || !meta.name || !meta.poster) throw new Error('Datos principales de meta incompletos');
      if (!Array.isArray(meta.videos) || meta.videos.length === 0) {
        throw new Error('Lista de videos/episodios vacía');
      }
      if (!meta.videos[0].id || !meta.videos[0].id.startsWith('vht-')) {
        throw new Error('ID de episodio en videos no tiene prefijo vht-');
      }
    });

    // 9. Streaming de Episodio
    await assertTest('GET /stream/anime/vht-seishidouin-no-oshigoto-the-animation-2.json', async () => {
      const res = await request(baseUrl, '/stream/anime/vht-seishidouin-no-oshigoto-the-animation-2.json');
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!res.data || !Array.isArray(res.data.streams) || res.data.streams.length === 0) {
        throw new Error('No se encontraron streams para el episodio');
      }
      const stream = res.data.streams[0];
      if (!stream.url) throw new Error('Stream sin URL');
      if (!stream.behaviorHints || !stream.behaviorHints.proxyHeaders || !stream.behaviorHints.proxyHeaders.request) {
        throw new Error('Stream no contiene behaviorHints.proxyHeaders.request');
      }
      const headers = stream.behaviorHints.proxyHeaders.request;
      if (!headers.Referer || !headers['User-Agent']) {
        throw new Error('proxyHeaders no contiene Referer o User-Agent requeridos');
      }
    });

    // 10. Fallback de rutas sin extensión .json
    await assertTest('GET /manifest y /catalog/anime/vh-episodios-recientes (sin .json)', async () => {
      const res1 = await request(baseUrl, '/manifest');
      if (res1.status !== 200 || !res1.data || res1.data.id !== 'com.veohentai.addon') {
        throw new Error('Ruta /manifest sin .json falló');
      }
      const res2 = await request(baseUrl, '/catalog/anime/vh-episodios-recientes');
      if (res2.status !== 200 || !res2.data || !Array.isArray(res2.data.metas)) {
        throw new Error('Ruta /catalog sin .json falló');
      }
    });
  } finally {
    server.close();
  }

  console.log('\n=======================================================');
  console.log(`📊 Resumen de Pruebas: ${passed} Pasadas, ${failed} Fallidas`);
  console.log('=======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ¡Todas las pruebas finalizaron exitosamente!\n');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
