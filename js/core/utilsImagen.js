// ============================================================
// core/utilsImagen.js — Compresión de imágenes antes de subir
// ------------------------------------------------------------
// OBLIGATORIO para RRHH: las fotos de libreta sanitaria se sacan con el
// celular (4 MB o más). Sin comprimir se dispara el costo de Storage y la
// carga se vuelve inusable con datos móviles.
//
// Reglas:
//   • Límite duro: rechazar archivos > 10 MB antes de procesar.
//   • Imágenes: redimensionar con canvas al lado mayor 1200px y exportar
//     JPEG calidad 0.7.
//   • PDF (y cualquier no-imagen): se suben tal cual, sin tocar.
//
// Usa APIs de navegador (Image, canvas). No corre en Node.
// ============================================================

const LADO_MAX = 1200;
const CALIDAD = 0.7;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Formatea bytes a texto humano ("3,4 MB"). */
export function formatearTamano(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Procesa un File para subir. Devuelve { blob, nombre, tipo, tamano }.
 *   - Si es imagen: comprime a JPEG (1200px / 0.7) y renombra a .jpg.
 *   - Si no es imagen (PDF, etc.): devuelve el archivo tal cual.
 * Lanza Error si el archivo supera 10 MB.
 * @param {File} file
 */
export async function prepararArchivo(file) {
  if (!file) throw new Error("No hay archivo.");
  if (file.size > MAX_BYTES) {
    throw new Error(
      `El archivo pesa ${formatearTamano(file.size)}. El máximo es 10 MB.`
    );
  }

  const esImagen = (file.type || "").startsWith("image/");
  if (!esImagen) {
    // PDF u otro: sin procesar.
    return { blob: file, nombre: file.name, tipo: file.type || "application/octet-stream", tamano: file.size };
  }

  const blob = await comprimirImagen(file);
  const base = (file.name || "imagen").replace(/\.[^.]+$/, "");
  return { blob, nombre: `${base}.jpg`, tipo: "image/jpeg", tamano: blob.size };
}

/**
 * Comprime una imagen a JPEG usando canvas.
 * @param {File|Blob} file
 * @param {object} [opts] { ladoMax, calidad }
 * @returns {Promise<Blob>}
 */
export function comprimirImagen(file, opts = {}) {
  const ladoMax = opts.ladoMax || LADO_MAX;
  const calidad = opts.calidad || CALIDAD;

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width: w, height: h } = img;
      if (w > h && w > ladoMax) { h = Math.round((h * ladoMax) / w); w = ladoMax; }
      else if (h >= w && h > ladoMax) { w = Math.round((w * ladoMax) / h); h = ladoMax; }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      // Fondo blanco: los JPEG no tienen alfa; evita bordes negros en PNG con transparencia.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen."))),
        "image/jpeg",
        calidad
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    img.src = url;
  });
}
