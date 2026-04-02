const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Necesitarás: npm install axios

(async () => {
    const IMG_DIR = path.join(__dirname, 'img/instagram');
    
    // Crear carpeta de imágenes si no existe
    if (!fs.existsSync(IMG_DIR)) {
        fs.mkdirSync(IMG_DIR, { recursive: true });
    }

    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

    console.log('🚀 Iniciando scrap de @luisgrasso...');

    try {
        await page.goto('https://www.instagram.com/luisgrasso/', { waitUntil: 'networkidle2' });
        
        // Esperar y hacer un scroll mínimo para activar carga
        await page.waitForSelector('article img', { timeout: 10000 });
        await page.evaluate(() => window.scrollBy(0, 500));
        await new Promise(r => setTimeout(r, 2000)); // Espera de cortesía

        const postsData = await page.evaluate(() => {
            const items = document.querySelectorAll('article a[href*="/p/"]');
            const data = [];
            
            items.forEach((item, index) => {
                if (index < 12) {
                    const img = item.querySelector('img');
                    data.push({
                        url: item.href,
                        remoteImage: img ? img.src : '',
                        caption: img ? img.alt : 'Luis Grasso - Work'
                    });
                }
            });
            return data;
        });

        // --- PROCESAMIENTO Y DESCARGA ---
        const finalPosts = [];
        console.log(`📸 Procesando ${postsData.length} imágenes...`);

        for (let i = 0; i < postsData.length; i++) {
            const post = postsData[i];
            const fileName = `post-${i + 1}.jpg`;
            const filePath = path.join(IMG_DIR, fileName);

            try {
                // Descargamos la imagen para que sea permanente
                const response = await axios({
                    url: post.remoteImage,
                    responseType: 'stream',
                });
                
                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                finalPosts.push({
                    url: post.url,
                    image: `img/instagram/${fileName}`, // Ruta relativa para el HTML
                    caption: post.caption,
                    date: new Date().getFullYear().toString()
                });
            } catch (err) {
                console.error(`❌ Error descargando imagen ${i}:`, err.message);
            }
        }

        const output = {
            user: "luisgrasso",
            last_update: new Date().toISOString(),
            posts: finalPosts
        };

        fs.writeFileSync('feed.json', JSON.stringify(output, null, 2));
        console.log('✅ feed.json y galería local generados con éxito.');

    } catch (error) {
        console.error('🔴 Error crítico durante el scrap:', error);
    } finally {
        await browser.close();
    }
})();