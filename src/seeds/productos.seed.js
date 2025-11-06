const Producto = require('../models/Producto.model');

// Función para generar código único
const generarCodigo = (categoria, genero, index) => {
    const prefijo = categoria.substring(0, 3).toUpperCase();
    const gen = genero.charAt(0).toUpperCase();
    return `${prefijo}-${gen}-${String(index).padStart(3, '0')}`;
};

// Datos base de productos
const categoriasProductos = {
    'Mujer': [
        { categoria: 'CAMISAS', tallas: ['XXS', 'XS', 'S', 'M', 'L', 'XL'], colores: ['Blanco', 'Negro', 'Azul', 'Rosa', 'Beige'] },
        { categoria: 'PANTALONES', tallas: ['XXS', 'XS', 'S', 'M', 'L', 'XL'], colores: ['Negro', 'Azul', 'Gris', 'Café'] },
        { categoria: 'JEANS TERMINADOS', tallas: ['XS', 'S', 'M', 'L', 'XL'], colores: ['Azul Claro', 'Azul Oscuro', 'Negro'] },
        { categoria: 'VESTIDOS', tallas: ['S', 'M', 'L', 'XL'], colores: ['Rojo', 'Negro', 'Azul', 'Floral', 'Estampado'] },
        { categoria: 'FALDA', tallas: ['XS', 'S', 'M', 'L'], colores: ['Negro', 'Gris', 'Azul', 'Café'] },
        { categoria: 'TSHIRT', tallas: ['S', 'M', 'L', 'XL'], colores: ['Blanco', 'Negro', 'Gris', 'Rosa', 'Azul'] },
        { categoria: 'BUZOS', tallas: ['S', 'M', 'L', 'XL'], colores: ['Negro', 'Gris', 'Azul', 'Rosa'] }
    ],
    'Hombre': [
        { categoria: 'CAMISAS', tallas: ['S', 'M', 'L', 'XL'], colores: ['Blanco', 'Azul', 'Negro', 'Gris'] },
        { categoria: 'PANTALONES', tallas: ['S', 'M', 'L', 'XL'], colores: ['Negro', 'Gris', 'Café', 'Beige'] },
        { categoria: 'JEANS TERMINADOS', tallas: ['S', 'M', 'L', 'XL'], colores: ['Azul Claro', 'Azul Oscuro', 'Negro'] },
        { categoria: 'POLOS', tallas: ['S', 'M', 'L', 'XL'], colores: ['Blanco', 'Negro', 'Azul', 'Rojo'] },
        { categoria: 'BERMUDA', tallas: ['S', 'M', 'L', 'XL'], colores: ['Beige', 'Negro', 'Azul', 'Café'] },
        { categoria: 'BUZO', tallas: ['M', 'L', 'XL'], colores: ['Negro', 'Gris', 'Azul'] },
        { categoria: 'TSHIRT TERMINADA', tallas: ['S', 'M', 'L', 'XL'], colores: ['Blanco', 'Negro', 'Gris'] }
    ],
    'Niño': [
        { categoria: 'CAMISAS', tallas: ['6', '8', '10', '12', '14'], colores: ['Blanco', 'Azul', 'Rojo'] },
        { categoria: 'PANTALONES', tallas: ['6', '8', '10', '12', '14', '16'], colores: ['Negro', 'Azul', 'Gris'] },
        { categoria: 'BERMUDA', tallas: ['6', '8', '10', '12', '14'], colores: ['Beige', 'Azul', 'Negro'] },
        { categoria: 'POLOS', tallas: ['6', '8', '10', '12', '14'], colores: ['Blanco', 'Azul', 'Rojo'] },
        { categoria: 'JEANS TERMINADOS', tallas: ['8', '10', '12', '14', '16'], colores: ['Azul'] }
    ],
    'Niña': [
        { categoria: 'VESTIDOS', tallas: ['6', '8', '10', '12', '14'], colores: ['Rosa', 'Azul', 'Rojo', 'Floral'] },
        { categoria: 'CAMISAS', tallas: ['6', '8', '10', '12', '14'], colores: ['Blanco', 'Rosa', 'Azul'] },
        { categoria: 'PANTALONES', tallas: ['6', '8', '10', '12', '14'], colores: ['Negro', 'Azul', 'Rosa'] },
        { categoria: 'FALDA', tallas: ['6', '8', '10', '12'], colores: ['Rosa', 'Azul', 'Rojo'] },
        { categoria: 'JEANS TERMINADOS', tallas: ['8', '10', '12', '14'], colores: ['Azul'] }
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
            for (const { categoria, tallas, colores } of categorias) {
                // Crear productos con diferentes tallas y colores
                for (let i = 0; i < 3; i++) { // 3 variaciones por categoría
                    const talla = tallas[Math.floor(Math.random() * tallas.length)];
                    const color = colores[Math.floor(Math.random() * colores.length)];
                    
                    // Asignar sucursal usando ObjectId
                    const sucursal = sucursales[Math.floor(Math.random() * sucursales.length)];
                    const proveedor = proveedores[Math.floor(Math.random() * proveedores.length)];
                    
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