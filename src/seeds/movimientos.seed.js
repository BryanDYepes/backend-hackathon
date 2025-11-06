const MovimientoInventario = require('../models/MovimientoInventario.model');
const Producto = require('../models/Producto.model');

const tiposMovimiento = [
    'ENTRADA',
    'INVENTARIO_INICIAL',
    'AJUSTE_POSITIVO',
    'AJUSTE_NEGATIVO',
    'MERMA'
];

const motivosEntrada = [
    'Compra a proveedor',
    'Devolución de cliente',
    'Ajuste por inventario físico',
    'Transferencia entre sucursales'
];

const motivosSalida = [
    'Producto dañado',
    'Ajuste por inventario físico',
    'Transferencia entre sucursales',
    'Muestra para cliente'
];

const motivosMerma = [
    'Producto dañado en bodega',
    'Daño por humedad',
    'Producto vencido',
    'Robo o pérdida'
];

// Función para generar fecha aleatoria en los últimos 90 días
const generarFechaAleatoria = (diasAtras = 90) => {
    const fecha = new Date();
    const diasAleatorios = Math.floor(Math.random() * diasAtras);
    fecha.setDate(fecha.getDate() - diasAleatorios);
    return fecha;
};

const crearMovimientosInventario = async (usuarios, productos) => {
    try {
        const movimientos = [];
        const adminUsuario = usuarios.find(u => u.rol === 'admin');
        const gerenteUsuario = usuarios.find(u => u.rol === 'gerente');
        
        // Crear movimiento inicial de inventario para cada producto
        for (const producto of productos) {
            // Solo crear movimiento inicial si hay stock
            if (producto.stockActual > 0) {
                movimientos.push({
                    producto: producto._id,
                    nombreProducto: producto.nombre,
                    codigoProducto: producto.codigo,
                    tipoMovimiento: 'INVENTARIO_INICIAL',
                    cantidad: producto.stockActual,
                    stockAnterior: 0,
                    stockNuevo: producto.stockActual,
                    sucursal: producto.sucursal,
                    usuario: adminUsuario._id,
                    nombreUsuario: adminUsuario.nombre,
                    motivo: 'Carga inicial de inventario',
                    observaciones: 'Inventario inicial del sistema',
                    costoUnitario: producto.precioCompra,
                    createdAt: generarFechaAleatoria(90)
                });
            }
        }
        
        // Crear movimientos adicionales aleatorios (entradas, salidas, ajustes)
        const productosAleatorios = productos
            .sort(() => 0.5 - Math.random())
            .slice(0, 50); // Seleccionar 50 productos aleatorios
        
        for (const producto of productosAleatorios) {
            const numMovimientos = 2 + Math.floor(Math.random() * 4); // 2-5 movimientos por producto
            
            for (let i = 0; i < numMovimientos; i++) {
                const tipoMovimiento = tiposMovimiento[Math.floor(Math.random() * tiposMovimiento.length)];
                const usuario = Math.random() > 0.5 ? adminUsuario : gerenteUsuario;
                
                let cantidad, stockAnterior, stockNuevo, motivo;
                
                switch (tipoMovimiento) {
                    case 'ENTRADA':
                        cantidad = 10 + Math.floor(Math.random() * 30);
                        stockAnterior = producto.stockActual;
                        stockNuevo = stockAnterior + cantidad;
                        motivo = motivosEntrada[Math.floor(Math.random() * motivosEntrada.length)];
                        break;
                        
                    case 'AJUSTE_POSITIVO':
                        cantidad = 1 + Math.floor(Math.random() * 5);
                        stockAnterior = producto.stockActual;
                        stockNuevo = stockAnterior + cantidad;
                        motivo = 'Ajuste por conteo físico';
                        break;
                        
                    case 'AJUSTE_NEGATIVO':
                        // Asegurar que la cantidad sea válida y no deje el stock en negativo
                        cantidad = 1 + Math.floor(Math.random() * Math.min(3, producto.stockActual));
                        if (cantidad <= 0 || producto.stockActual < cantidad) {
                            continue; // Saltar este movimiento si no es válido
                        }
                        stockAnterior = producto.stockActual;
                        stockNuevo = stockAnterior - cantidad;
                        motivo = 'Ajuste por conteo físico';
                        break;
                        
                    case 'MERMA':
                        // Asegurar que hay stock suficiente para la merma
                        if (producto.stockActual < 1) {
                            continue; // Saltar si no hay stock
                        }
                        cantidad = 1 + Math.floor(Math.random() * Math.min(3, producto.stockActual));
                        if (cantidad <= 0 || producto.stockActual < cantidad) {
                            continue; // Saltar este movimiento si no es válido
                        }
                        stockAnterior = producto.stockActual;
                        stockNuevo = stockAnterior - cantidad;
                        motivo = motivosMerma[Math.floor(Math.random() * motivosMerma.length)];
                        break;
                        
                    case 'INVENTARIO_INICIAL':
                        // Saltar, ya se creó al inicio
                        continue;
                        
                    default:
                        continue; // Saltar otros tipos
                }
                
                // Verificación final antes de agregar el movimiento
                if (!cantidad || cantidad <= 0) {
                    continue;
                }
                
                if (stockNuevo < 0) {
                    continue;
                }
                
                movimientos.push({
                    producto: producto._id,
                    nombreProducto: producto.nombre,
                    codigoProducto: producto.codigo,
                    tipoMovimiento,
                    cantidad,
                    stockAnterior,
                    stockNuevo,
                    sucursal: producto.sucursal,
                    usuario: usuario._id,
                    nombreUsuario: usuario.nombre,
                    motivo,
                    observaciones: `Movimiento de tipo ${tipoMovimiento}`,
                    costoUnitario: producto.precioCompra,
                    createdAt: generarFechaAleatoria(60)
                });
            }
        }
        
        const movimientosCreados = await MovimientoInventario.create(movimientos);
        return movimientosCreados;
        
    } catch (error) {
        throw new Error('Error al crear movimientos: ' + error.message);
    }
};

module.exports = { crearMovimientosInventario };