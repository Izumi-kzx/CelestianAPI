import axios from 'axios';  
import * as cheerio from 'cheerio';  
import FormData from 'form-data';  
  
const baseUrl = 'https://ssstik.io';  
const regexTiktok = /https:\/\/(?:m|www|vm|vt|lite)?\.?tiktok\.com\/((?:.*\b(?:(?:usr|v|embed|user|video|photo)\/|\?shareId=|\&item_id=)(\d+))|\w+)/;  
const regexToken = /s_tt\s*=\s*'([^']+)'/;  
const regexOverlayUrl = /#mainpicture \.result_overlay\s*{\s*background-image:\s*url["']?([^"']+)["']?;\s*}/;  
  
async function getToken() {  
  const { data: html } = await axios.get(baseUrl);  
  const match = html.match(regexToken);  
  if (!match || !match[1]) {  
    throw new Error('No se pudo extraer el token de SSSTik.io');  
  }  
  return match[1];  
}  
  
export default function registerTiktokDownloaderRoute(app) {  
  /**  
   * GET /download/tiktok?url=<URL_TIKTOK>  
   * Parámetros:  
   *   - url: URL completa del vídeo de TikTok (requerido)  
   */  
  app.get('/download/tiktok', async (req, res) => {  
    const { url } = req.query;  
    if (!url) {  
      return res.status(400).json({ status: false, error: 'Parámetro "url" es requerido.' });  
    }  
    if (!regexTiktok.test(url)) {  
      return res.status(400).json({ status: false, error: 'URL de TikTok no válida.' });  
    }  
  
    try {  
      const token = await getToken();  
      const form = new FormData();  
      form.append('id', url);  
      form.append('locale', 'en');  
      form.append('tt', token);  
  
      const { data: html } = await axios.post(  
        `${baseUrl}/abc?url=dl`,  
        form,  
        {  
          headers: {  
            ...form.getHeaders(),  
            origin: baseUrl,  
            referer: `${baseUrl}/en`,  
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'  
          }  
        }  
      );  
  
      const $ = cheerio.load(html);  
      const username     = $('h2').text().trim();  
      const description  = $('.maintext').text().trim();  
      const likeCount    = $('div.trending-actions > div.justify-content-start').eq(0).text().trim();  
      const commentCount = $('div.trending-actions > div.justify-content-center > div').text().trim();  
      const shareCount   = $('div.trending-actions > div.justify-content-end > div').text().trim();  
      const avatarUrl    = $('img.result_author').attr('src');  
      const videoUrl     = $('a.without_watermark').attr('href');  
      const musicUrl     = $('a.music').attr('href');  
      const css          = $('style').html() || '';  
      const overlayMatch = css.match(regexOverlayUrl);  
      const overlayUrl   = overlayMatch ? overlayMatch[1] : null;  
  
      return res.status(200).json({  
        status: true,  
        data: {  
          username,  
          description,  
          stats: { likeCount, commentCount, shareCount },  
          downloads: { avatarUrl, overlayUrl, videoUrl, musicUrl }  
        }  
      });  
    } catch (err) {  
      console.error('Error en /download/tiktok:', err);  
      return res.status(500).json({ status: false, error: err.message });  
    }  
  });  
}