(async () => {
  const root = document.getElementById('root');
  const id = root.dataset.id; // tomamos el id del producto

  try {
    // Fetch desde la ruta pública
    const response = await fetch(`/api/productos/public/${id}`);
    if (!response.ok) throw new Error('No se encontró el producto');

    const p = (await response.json()).data;

    // QR generado previamente en /public/qrcodes
    const qrPath = `/qrcodes/${p.codigo || p._id}.png`;

    const card = document.getElementById('card');
    card.innerHTML = `
      <h1>${p.nombre}</h1>
      ${p.imagen ? '<img class="product-img" src="'+p.imagen+'" alt="imagen"/>' : ''}
      <p><span class="label">Código:</span> ${p.codigo}</p>
      <p><span class="label">Descripción:</span> ${p.descripcion || '-'}</p>
      <p><span class="label">Categoría:</span> ${p.categoria || '-'}</p>
      <p><span class="label">Género:</span> ${p.genero || '-'}</p>
      <p><span class="label">Talla:</span> ${p.talla || '-'}</p>
      <p><span class="label">Color:</span> ${p.color || '-'}</p>
      <p><span class="label">Precio venta:</span> ${p.precioVenta || '-'}</p>
      <p><span class="label">Stock actual:</span> ${p.stockActual || 0}</p>
      <img src="${qrPath}" alt="QR del producto" style="margin-top:15px; max-width:200px;"/>
    `;
  } catch (err) {
    document.getElementById('card').innerHTML = `<h2>Error cargando producto</h2><p>${err.message}</p>`;
  }
})();
