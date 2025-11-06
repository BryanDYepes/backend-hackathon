const Venta = require('../models/Venta.model');
const Producto = require('../models/Producto.model');

const metodosPago = ['Efectivo', 'Tarjeta', 'Transferencia', 'Mixto'];

const nombresClientes = [
    'María García', 'Juan Pérez', 'Ana Martínez', 'Carlos López',
    'Laura Rodríguez', 'Pedro Sánchez', 'Carmen Díaz', 'Luis González',
    'Isabel Fernández', 'Miguel Torres', 'Rosa Ramírez', 'Jorge Castro',
    'Patricia Moreno', 'Francisco Jiménez', 'Elena Ruiz'
];

const generarTelefono = () => {
    return `300${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
};

const generarEmail = (nombre) => {
    const nombreLimpio = nombre.toLowerCase().replace(/ /g, '.');
    return `${nombreLimpio}@email.com`;
};

// Generar fecha aleatoria en los últimos 60 días
const generarFechaAleatoria = (diasAtras = 60) => {
    const fecha = new Date();
    const diasAleatorios = Math.floor(Math.random() * diasAtras);
    fecha.setDate(fecha.getDate() - diasAleatorios);
    
    // Añadir hora aleatoria (entre 9 AM y 8 PM)
    const hora = 9 + Math.floor(Math.random() * 11);
    const minuto = Math.floor(Math.random() * 60);
    fecha.setHours(hora, minuto, 0, 0);
    
    return fecha;
};

// Generar número de venta único
const generarNumeroVenta = (fecha, consecutivo) => {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `VTA-${año}${mes}${dia}-${String(consecutivo).padStart(4, '0')}`;
};

const crearVentas = async (usuarios, productos) => {
    try {
        const vendedores = usuarios.filter(u => u.rol === 'vendedor' || u.rol === 'gerente');
        
        // Obtener productos con stock suficiente
        const productosDisponibles = productos.filter(p => p.stockActual > 5);
        
        if (productosDisponibles.length === 0) {
            console.log('⚠️  No hay productos con stock suficiente para crear ventas');
            return [];
        }
        
        // Crear entre 80 y 120 ventas
        const numVentas = 80 + Math.floor(Math.random() * 40);
        
        // Generar todas las fechas primero y ordenarlas
        const fechasVentas = [];
        for (let i = 0; i < numVentas; i++) {
            fechasVentas.push(generarFechaAleatoria(60));
        }
        fechasVentas.sort((a, b) => a - b);
        
        // Objeto para llevar consecutivos por día
        const consecutivosPorDia = {};
        const ventasParaCrear = [];
        
        for (let i = 0; i < fechasVentas.length; i++) {
            const fecha = fechasVentas[i];
            const fechaKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
            
            // Incrementar consecutivo para este día
            if (!consecutivosPorDia[fechaKey]) {
                consecutivosPorDia[fechaKey] = 1;
            } else {
                consecutivosPorDia[fechaKey]++;
            }
            
            const numeroVenta = generarNumeroVenta(fecha, consecutivosPorDia[fechaKey]);
            const vendedor = vendedores[Math.floor(Math.random() * vendedores.length)];
            
            // Determinar cantidad de items en la venta (1-4 productos)
            const numItems = 1 + Math.floor(Math.random() * 4);
            const items = [];
            const productosVendidos = [];
            
            // Seleccionar productos aleatorios para la venta
            const productosParaVenta = [...productosDisponibles]
                .filter(p => p.stockActual > 0)
                .sort(() => 0.5 - Math.random())
                .slice(0, numItems);
            
            for (const producto of productosParaVenta) {
                // Cantidad a vender (1-3 unidades por producto)
                const cantidadMaxima = Math.min(3, producto.stockActual);
                if (cantidadMaxima < 1) continue;
                
                const cantidad = 1 + Math.floor(Math.random() * cantidadMaxima);
                
                const subtotal = producto.precioVenta * cantidad;
                
                items.push({
                    producto: producto._id,
                    nombreProducto: producto.nombre,
                    codigoProducto: producto.codigo,
                    categoria: producto.categoria,
                    genero: producto.genero,
                    talla: producto.talla,
                    cantidad,
                    precioUnitario: producto.precioVenta,
                    subtotal
                });
                
                productosVendidos.push({ productoId: producto._id, cantidad });
            }
            
            // Si no hay items, saltar esta venta
            if (items.length === 0) continue;
            
            // Calcular subtotal
            const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
            
            // Aplicar descuento aleatorio (0-15%)
            const descuentoPorcentaje = Math.random() > 0.7 ? Math.floor(Math.random() * 15) : 0;
            const descuento = Math.round(subtotal * (descuentoPorcentaje / 100));
            
            // Total
            const total = subtotal - descuento;
            
            // Método de pago
            const metodoPago = metodosPago[Math.floor(Math.random() * metodosPago.length)];
            
            // Cliente (70% de las ventas tienen datos de cliente)
            let cliente = null;
            if (Math.random() > 0.3) {
                const nombreCliente = nombresClientes[Math.floor(Math.random() * nombresClientes.length)];
                cliente = {
                    nombre: nombreCliente,
                    telefono: generarTelefono(),
                    email: Math.random() > 0.5 ? generarEmail(nombreCliente) : undefined
                };
            }
            
            // Observaciones aleatorias
            const observacionesOpciones = [
                'Cliente frecuente',
                'Primera compra',
                'Solicita factura',
                'Cliente satisfecho',
                null
            ];
            const observaciones = Math.random() > 0.7 
                ? observacionesOpciones[Math.floor(Math.random() * observacionesOpciones.length)]
                : null;
            
            // Obtener sucursal del primer producto
            const sucursal = productosParaVenta[0].sucursal;
            
            ventasParaCrear.push({
                venta: {
                    numeroVenta,
                    fecha,
                    sucursal,
                    vendedor: vendedor._id,
                    nombreVendedor: vendedor.nombre,
                    items,
                    subtotal,
                    descuento,
                    total,
                    metodoPago,
                    estadoVenta: 'Completada',
                    observaciones,
                    cliente,
                    createdAt: fecha,
                    updatedAt: fecha
                },
                productosVendidos
            });
        }
        
        // Crear las ventas y actualizar stock
        const ventasCreadas = [];
        
        for (const { venta, productosVendidos } of ventasParaCrear) {
            try {
                // Crear la venta
                const ventaCreada = await Venta.create(venta);
                ventasCreadas.push(ventaCreada);
                
                // Actualizar stock de productos vendidos
                for (const { productoId, cantidad } of productosVendidos) {
                    await Producto.findByIdAndUpdate(
                        productoId,
                        { $inc: { stockActual: -cantidad } }
                    );
                }
            } catch (error) {
                // Si hay error de duplicado, continuar con la siguiente venta
                if (error.code === 11000) {
                    console.log(`⚠️  Venta duplicada omitida: ${venta.numeroVenta}`);
                    continue;
                }
                throw error;
            }
        }
        
        // Crear algunas ventas canceladas (5%)
        const numCanceladas = Math.floor(ventasCreadas.length * 0.05);
        if (numCanceladas > 0) {
            const ventasCanceladas = [...ventasCreadas]
                .sort(() => 0.5 - Math.random())
                .slice(0, numCanceladas);
            
            for (const venta of ventasCanceladas) {
                venta.estadoVenta = 'Cancelada';
                venta.observaciones = `${venta.observaciones || ''}\nCANCELADA: Solicitud del cliente - ${new Date().toLocaleString('es-CO')}`;
                await venta.save();
                
                // Devolver stock
                for (const item of venta.items) {
                    await Producto.findByIdAndUpdate(
                        item.producto,
                        { $inc: { stockActual: item.cantidad } }
                    );
                }
            }
        }
        
        return ventasCreadas;
        
    } catch (error) {
        throw new Error('Error al crear ventas: ' + error.message);
    }
};

module.exports = { crearVentas };