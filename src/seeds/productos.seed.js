const Producto = require('../models/Producto.model');

// Función para generar código único
const generarCodigo = (categoria, genero, index) => {
    const prefijo = categoria.substring(0, 3).toUpperCase();
    const gen = genero.charAt(0).toUpperCase();
    return `${prefijo}-${gen}-${String(index).padStart(3, '0')}`;
};

// Datos base de productos
const categoriasProductos = {
    'Mujer': [{ categoria: 'CAMISAS', tallas: ['XXS', 'XS', 'S', 'M', 'L', 'XL'], colores: ['Blanco', 'Negro', 'Azul', 'Rosa', 'Beige'], imagenes: ['https://d1fufvy4xao6k9.cloudfront.net/feed/img/woman_shirt/367755/front_small.png', 'https://d1fufvy4xao6k9.cloudfront.net/feed/img/woman_shirt/367769/front_small.png', 'https://d1fufvy4xao6k9.cloudfront.net/feed/img/woman_shirt/11419/front_small.png'] },
    { categoria: 'PANTALONES', tallas: ['XXS', 'XS', 'S', 'M', 'L', 'XL'], colores: ['Negro', 'Azul', 'Gris', 'Café'], imagenes: ['https://uniformesyarutex.com/wp-content/uploads/2024/03/comprar-pantalon-stretch-mujer-ref-01-dril-caqui-dotacion-empresas-uniformes-yarutex.png.', 'https://d1fufvy4xao6k9.cloudfront.net/feed/img/woman_pants/23847/front_small.png', 'https://d1fufvy4xao6k9.cloudfront.net/feed/img/woman_pants/379387/front_small.png'] },
    { categoria: 'JEANS TERMINADOS', tallas: ['XS', 'S', 'M', 'L', 'XL'], colores: ['Azul Claro', 'Azul Oscuro', 'Negro'], imagenes: ['https://gentefashiongroup.com/wp-content/uploads/2023/09/jean_dama_ref_2004-removebg-preview.png', 'https://solco.com.ar/wp-content/uploads/2024/07/pantalon-jean-mujer-con-protecciones-para-moto-negro-11.png'] },
    { categoria: 'VESTIDOS', tallas: ['S', 'M', 'L', 'XL'], colores: ['Rojo', 'Negro', 'Azul', 'Floral', 'Estampado'], imagenes: ['https://cdn0.matrimonio.com.co/article-dress/4228/original/1280/jpg/m458224.jpeg', 'https://boral.com.co/cdn/shop/files/vestidocasualparamujer_1.jpg?v=1735225349', 'https://www.atributo.co/cdn/shop/files/1702284480bebafd6b3fc91fde69182b6c94e8651c_thumbnail_900x_bfec7d92-8c03-4fd9-8397-0f3e742069ea.jpg?crop=center&height=799&v=1708108513&width=600'] },
    { categoria: 'FALDA', tallas: ['XS', 'S', 'M', 'L'], colores: ['Negro', 'Gris', 'Azul', 'Café'], imagenes: ['https://www.oxap.com.co/wp-content/uploads/2024/06/FALDA-COFFE-B-1658-1.jpg', 'https://marketingpersonalco.vtexassets.com/arquivos/ids/17534583/p-723692-1.jpg?v=638923207967830000'] },
    { categoria: 'TSHIRT', tallas: ['S', 'M', 'L', 'XL'], colores: ['Blanco', 'Negro', 'Gris', 'Rosa', 'Azul'], imagenes: ['https://www.gef.co/cdn/shop/files/lafo-t-shirt-negro-799-742203_000799-1_75dfa2fe-a45f-4bcf-b578-a64f1d7442e4.jpg?v=1736438073', 'https://tottoco.vtexassets.com/arquivos/ids/551434/RA26819-2416-T2PL_1.jpg?v=638971968276300000', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTOD7PZeyRIm-PecLqNSFdUiqE0wUHaoR6G-w&s'] },
    { categoria: 'BUZOS', tallas: ['S', 'M', 'L', 'XL'], colores: ['Negro', 'Gris', 'Azul', 'Rosa'], imagenes: ['https://www.hurlintongnf.co/cdn/shop/collections/6090122.jpg?v=1754944573', 'https://estilofit.com.co/cdn/shop/files/image00028_9f76fe89-e625-4b51-90db-0b257a0817c4.jpg?v=1721959952'] }
    ],
    'Hombre': [
        { categoria: 'CAMISAS', tallas: ['S', 'M', 'L', 'XL'], colores: ['Blanco', 'Azul', 'Negro', 'Gris'], imagenes: ['https://www.sevenseven.com/dw/image/v2/BHFM_PRD/on/demandware.static/-/Sites-storefront_catalog_sevenseven/default/dw716270e2/images/hi-res/Blusas/Camisas-para-hombre-45011873-6063_1.jpg?sw=800&sh=960', 'https://tennis.vtexassets.com/arquivos/ids/2526916/camisas-para-hombre-tennis-cafe.jpg?v=638694762491570000', 'https://www.ostu.com/dw/image/v2/BHFM_PRD/on/demandware.static/-/Sites-storefront_catalog_ostu/default/dw8a1d5aac/images/hi-res/Todo/camisas-para-hombre-60010704-51_1.jpg?sw=800&sh=960'] },
        { categoria: 'PANTALONES', tallas: ['S', 'M', 'L', 'XL'], colores: ['Negro', 'Gris', 'Café', 'Beige'], imagenes: ['https://img.kwcdn.com/product/fancy/fcf6859c-05bd-4d1e-976c-5d4f81e14ece.jpg?imageMogr2/auto-orient%7CimageView2/2/w/800/q/70/format/webp', 'https://cdn.baguer.co/uploads/2025/04/pantalon-para-hombre-connor-typer-negro-831368NG.webp_yyLwLg6Q7c0ftlHFBFvU99hldEEQZt.webp', 'https://m.media-amazon.com/images/I/61SXc2EDoiL._AC_UY1000_.jpg'] },
        { categoria: 'JEANS TERMINADOS', tallas: ['S', 'M', 'L', 'XL'], colores: ['Azul Claro', 'Azul Oscuro', 'Negro'], imagenes: ['https://armatura.com.co/cdn/shop/files/pantalon-hombre-jean-slim-azul-oscuro-perfil.webp?v=1727450394', 'https://lukshop.vtexassets.com/arquivos/ids/916114-800-auto?v=638742061247230000&width=800&height=auto&aspect=true'] },
        { categoria: 'POLOS', tallas: ['S', 'M', 'L', 'XL'], colores: ['Blanco', 'Negro', 'Azul', 'Rojo'], imagenes: ['https://tennis.vtexassets.com/arquivos/ids/2409764/polos-para-hombre-tennis-azul.jpg?v=638482122416700000', 'https://calvincolombia.vtexassets.com/arquivos/ids/915314-1712-2256?v=638947770759770000&width=1712&height=2256&aspect=true'] },
        { categoria: 'BERMUDA', tallas: ['S', 'M', 'L', 'XL'], colores: ['Beige', 'Negro', 'Azul', 'Café'], imagenes: ['https://lukshop.vtexassets.com/arquivos/ids/873054-800-auto?v=638573676147600000&width=800&height=auto&aspect=true', 'https://www.apostolqc.com/cdn/shop/products/BEH-BLANCA-EXT2.jpg?v=1642093040', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSZNiUO3q_bvxiO3RPmwnWpX5pWyiClIL0dGQ&s'] },
        { categoria: 'BUZO', tallas: ['M', 'L', 'XL'], colores: ['Negro', 'Gris', 'Azul'], imagenes: ['https://superdrycolombia.vtexassets.com/arquivos/ids/295728/Buzo-Cerrado-Para-Hombre-Contrast-Stitch-Relaxed-1578.jpg?v=638500951385730000', 'https://chevignon.vtexassets.com/arquivos/ids/1943290/63_687F401_VER190230_0.jpg?v=638847561101470000'] },
        { categoria: 'TSHIRT TERMINADA', tallas: ['S', 'M', 'L', 'XL'], colores: ['Blanco', 'Negro', 'Gris'], imagenes: ['https://tennis.vtexassets.com/arquivos/ids/2460441/tshirt-para-hombre-tennis-negro.jpg?v=638629000451400000', 'https://veirdo.in/cdn/shop/files/54_1.jpg?v=1754546113'] }
    ],
    'Niño': [
        { categoria: 'CAMISAS', tallas: ['6', '8', '10', '12', '14'], colores: ['Blanco', 'Azul', 'Rojo'], imagenes: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRIpZr6wLstLxKM_dRZbN6OfUMS4y--tS0cXw&s', 'https://tottoco.vtexassets.com/arquivos/ids/578780/RJ46311-2420-9JV9Y_1.jpg?v=638654730240400000', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSEuL63SyJYVxurrkw2xYp3qvcB4eKSGNx05g&s'] },
        { categoria: 'PANTALONES', tallas: ['6', '8', '10', '12', '14', '16'], colores: ['Negro', 'Azul', 'Gris'], imagenes: ['https://kidsrepublic.com.co/cdn/shop/files/G00053_Z20_101_a4644ff6-2d6e-4754-84f7-17946414de48.jpg?v=1714576674&width=1500', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_SeZ2lcUGd3zy3doSjctZCQakGuAWpDy0tA&s', 'https://colorkids.com.co/8747/pantalon-nino-ref-3514-tapioca.jpg'] },
        { categoria: 'BERMUDA', tallas: ['6', '8', '10', '12', '14'], colores: ['Beige', 'Azul', 'Negro'], imagenes: ['https://www.gef.co/cdn/shop/files/lofra-kd-azul-5758-744480_005758-1_b9ebe309-1818-420a-9394-0fb82896fba1.jpg?v=1721260757', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRjV3-5tdRaYkKj4lUYpwXKeuXO346X5PFfew&s'] },
        { categoria: 'POLOS', tallas: ['6', '8', '10', '12', '14'], colores: ['Blanco', 'Azul', 'Rojo'], imagenes: ['https://chevignon.vtexassets.com/arquivos/ids/1561719/63_802F003_VER186320_0.jpg?v=638611066819400000', 'https://kidsrepublic.com.co/cdn/shop/files/322603252004A.jpg?v=1686843880', 'https://www.gef.co/cdn/shop/files/layed-kd-azul-jaspe-5068-746652_005068-1.jpg?v=1723597170'] },
        { categoria: 'JEANS TERMINADOS', tallas: ['8', '10', '12', '14', '16'], colores: ['Azul'], imagenes: ['URL_DE_IMAGEN_https://calvincolombia.vtexassets.com/arquivos/ids/905897-800-auto?v=638947760276400000&width=800&height=auto&aspect=true1', 'https://kidsrepublic.com.co/cdn/shop/files/322917223001-1_11135b50-cc04-4ec3-b3f1-6b11369038cf.png?v=1755197348&width=1100'] }
    ],
    'Niña': [
        { categoria: 'VESTIDOS', tallas: ['6', '8', '10', '12', '14'], colores: ['Rosa', 'Azul', 'Rojo', 'Floral'], imagenes: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRXzusjtcjyHTkY-Cbw-z0SeULrxoih-18-xw&s', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ68SPRr2qvTQUNxPSRSxOjbF3dQzaZuCWylA&s', 'https://tennis.vteximg.com.br/arquivos/ids/2427297-900-1373/vestidos-para-nina-tennis-amarillo.jpg?v=638521065071600000?1762214400011'] },
        { categoria: 'CAMISAS', tallas: ['6', '8', '10', '12', '14'], colores: ['Blanco', 'Rosa', 'Azul'], imagenes: ['https://tottoco.vtexassets.com/arquivos/ids/577972/RJ26431-2423-A465Y_1.jpg?v=638654702621970000', 'https://ae-pic-a1.aliexpress-media.com/kf/Scce1fe3c4df74aacaf09d093aef066dbs.jpg'] },
        { categoria: 'PANTALONES', tallas: ['6', '8', '10', '12', '14'], colores: ['Negro', 'Azul', 'Rosa'], imagenes: ['https://kidsrepublic.com.co/cdn/shop/files/J50643_269_101_5f02bd13-5b41-410b-bf43-b8666f7b24c0.jpg?v=1713274664&width=1500', 'https://i.pinimg.com/736x/91/ae/68/91ae68250402d99897eee7ed61bb90d2.jpg'] },
        { categoria: 'FALDA', tallas: ['6', '8', '10', '12'], colores: ['Rosa', 'Azul', 'Rojo'], imagenes: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRlHbEA0FJja_33Jrv-BrQvTiOe9Tv4RjzGqA&s', 'https://tennis.vtexassets.com/arquivos/ids/2500373-800-auto?v=638660224299130000&width=800&height=auto&aspect=true', 'https://daisagirls.com/wp-content/uploads/2025/07/falda-algodon-jaspe-maxi-largo-pretina-encauchada-pasadores-cortes-paneles-forro-curuba-camisa-jean-rigido-ropa-para-nina-daisa-girls-bogota-colombia-430x645.jpg'] },
        { categoria: 'JEANS TERMINADOS', tallas: ['8', '10', '12', '14'], colores: ['Azul'], imagenes: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSX216RgVO4jMM6LW3rW-h8SdwWL9IvdorWqw&s', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS8akETeHxntcdRlLPkUUNvZk0ooKsE8yXCBg&s', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR5Apu8nJpVLi0fTkJLNMNPqadsJBPubmLRIA&s'] }
    ]
};

const proveedores = ['Textiles SA', 'Moda Colombia', 'Confecciones del Valle', 'Distribuidora Fashion'];

// Función para generar precio de venta con margen realista
const calcularPrecioVenta = (precioCompra) => {
    const margen = 1.7 + (Math.random() * 0.5); // Margen entre 1.7 y 2.2
    return Math.round(precioCompra * margen / 1000) * 1000; // Redondear a miles
};

const crearProductos = async (sucursales) => {
    try {
        if (!sucursales || sucursales.length === 0) {
            throw new Error('No hay sucursales disponibles para asignar productos');
        }

        const productos = [];
        let index = 1;

        // Iterar por cada género
        for (const [genero, categorias] of Object.entries(categoriasProductos)) {
            // Iterar por cada categoría del género
            for (const { categoria, tallas, colores, imagenes } of categorias) {
                // Crear productos con diferentes tallas y colores
                for (let i = 0; i < 3; i++) { // 3 variaciones por categoría
                    const talla = tallas[Math.floor(Math.random() * tallas.length)];
                    const color = colores[Math.floor(Math.random() * colores.length)];

                    // Asignar sucursal usando ObjectId
                    const sucursal = sucursales[Math.floor(Math.random() * sucursales.length)];
                    const proveedor = proveedores[Math.floor(Math.random() * proveedores.length)];

                    const imagen = imagenes[Math.floor(Math.random() * imagenes.length)]; // Seleccionar imagen aleatoria

                    // Precios realistas según categoría
                    let precioCompra;
                    if (categoria.includes('JEANS')) {
                        precioCompra = 35000 + Math.floor(Math.random() * 20000);
                    } else if (categoria === 'VESTIDOS') {
                        precioCompra = 40000 + Math.floor(Math.random() * 25000);
                    } else if (categoria.includes('CAMISA')) {
                        precioCompra = 25000 + Math.floor(Math.random() * 15000);
                    } else if (categoria.includes('PANTALON')) {
                        precioCompra = 30000 + Math.floor(Math.random() * 20000);
                    } else {
                        precioCompra = 20000 + Math.floor(Math.random() * 15000);
                    }

                    const precioVenta = calcularPrecioVenta(precioCompra);

                    // Stock inicial aleatorio (entre 10 y 80)
                    const stockInicial = 10 + Math.floor(Math.random() * 70);

                    const codigo = generarCodigo(categoria, genero, index);

                    productos.push({
                        codigo,
                        nombre: `${categoria} ${color} - Talla ${talla}`,
                        descripcion: `${categoria.toLowerCase()} de ${genero.toLowerCase()} color ${color.toLowerCase()}, talla ${talla}. Producto de excelente calidad y diseño moderno.`,
                        categoria,
                        genero,
                        talla,
                        color,
                        precioCompra,
                        precioVenta,
                        stockActual: stockInicial,
                        stockMinimo: 5,
                        sucursal: sucursal._id, // Usar ObjectId de la sucursal
                        proveedor,
                        imagen, // Agregar la imagen al producto
                        activo: true
                    });

                    index++;
                }
            }
        }

        // Crear algunos productos con stock bajo para pruebas
        for (let i = 0; i < 10; i++) {
            const productoExistente = productos[Math.floor(Math.random() * productos.length)];
            const sucursal = sucursales[Math.floor(Math.random() * sucursales.length)];

            productos.push({
                ...productoExistente,
                codigo: generarCodigo(productoExistente.categoria, productoExistente.genero, index++),
                stockActual: Math.floor(Math.random() * 5), // Stock bajo
                color: 'Edición especial',
                sucursal: sucursal._id // Usar ObjectId de la sucursal
            });
        }

        const productosCreados = await Producto.create(productos);
        return productosCreados;

    } catch (error) {
        throw new Error('Error al crear productos: ' + error.message);
    }
};

module.exports = { crearProductos };