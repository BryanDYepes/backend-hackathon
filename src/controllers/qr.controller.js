const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const Producto = require('../models/Producto.model');

const generarQRCodeProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findById(id);

    if (!producto) {
      return res.status(404).json({ error: true, mensaje: 'Producto no encontrado' });
    }

    // Carpeta donde guardar los QR
    const qrcodesDir = path.join(__dirname, '..', 'public', 'qrcodes');
    if (!fs.existsSync(qrcodesDir)) {
      fs.mkdirSync(qrcodesDir, { recursive: true });
    }

    // Nombre de archivo: usa codigo si existe, sino el id
    const filename = `${(producto.codigo || producto._id).toString().replace(/\s+/g, '_')}.png`;
    const filePath = path.join(qrcodesDir, filename);

    // URL que contendrá el QR: apunta al panel informativo que serviremos
    const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
    const panelUrl = `${baseUrl}/panel/producto/${producto._id}`;

    // Generar y guardar el PNG (errorCorrectionLevel 'H' => mejor corrección, más denso)
    await QRCode.toFile(filePath, panelUrl, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 400 // tamaño en px
    });

    // Devuelve info con la URL pública del QR y la URL que contiene
    res.json({
      success: true,
      mensaje: 'QR generado y guardado',
      qr: {
        archivo: `/qrcodes/${filename}`, // servido por express.static(public)
        pathEnServidor: filePath,
        urlEscaneable: panelUrl
      }
    });

  } catch (error) {
    console.error('Error generando QR:', error);
    res.status(500).json({ error: true, mensaje: 'Error generando QR', detalle: error.message });
  }
};

module.exports = { generarQRCodeProducto };
