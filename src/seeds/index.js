const mongoose = require('mongoose');
require('dotenv').config();
const conectarDB = require('../config/db');

// Importar todos los seeds
const { crearSucursales } = require('./sucursales.seed');
const { crearUsuarios } = require('./usuarios.seed');
const { crearProductos } = require('./productos.seed');
const { crearVentas } = require('./ventas.seed');
const { crearMovimientosInventario } = require('./movimientos.seed');

// Colores para la consola
const colores = {
    reset: '\x1b[0m',
    verde: '\x1b[32m',
    amarillo: '\x1b[33m',
    azul: '\x1b[36m',
    rojo: '\x1b[31m'
};

const log = (mensaje, color = 'reset') => {
    console.log(`${colores[color]}${mensaje}${colores.reset}`);
};

// Función principal para ejecutar todos los seeds
const ejecutarSeeds = async () => {
    try {
        log('\n🌱 Iniciando proceso de seeds...', 'azul');
        
        // Conectar a la base de datos
        await conectarDB();
        
        // Preguntar si desea limpiar la base de datos
        log('\n⚠️  ADVERTENCIA: Este proceso eliminará todos los datos existentes', 'amarillo');
        
        // Limpiar colecciones existentes
        log('\n🗑️  Limpiando base de datos...', 'amarillo');
        await mongoose.connection.db.dropDatabase();
        log('✅ Base de datos limpiada', 'verde');
        
        // 1. Crear sucursales PRIMERO (sin usuarios asignados)
        log('\n🏪 Creando sucursales...', 'azul');
        const sucursales = await crearSucursales([]);
        log(`✅ ${sucursales.length} sucursales creadas`, 'verde');
        
        // 2. Crear usuarios (asignándoles sucursales)
        log('\n👥 Creando usuarios...', 'azul');
        const usuarios = await crearUsuarios(sucursales);
        log(`✅ ${usuarios.length} usuarios creados`, 'verde');
        
        // 3. Actualizar sucursales con gerentes asignados
        log('\n👤 Asignando gerentes a sucursales...', 'azul');
        const gerentes = usuarios.filter(u => u.rol === 'gerente');
        if (gerentes.length >= 2) {
            await mongoose.model('Sucursal').findByIdAndUpdate(
                sucursales[0]._id,
                { 
                    gerente: gerentes[0]._id,
                    nombreGerente: gerentes[0].nombre
                }
            );
            
            await mongoose.model('Sucursal').findByIdAndUpdate(
                sucursales[1]._id,
                { 
                    gerente: gerentes[1]._id,
                    nombreGerente: gerentes[1].nombre
                }
            );
            log('✅ Gerentes asignados a sucursales', 'verde');
        }
        
        // 4. Crear productos (con sucursales asignadas)
        log('\n📦 Creando productos...', 'azul');
        const productos = await crearProductos(sucursales);
        log(`✅ ${productos.length} productos creados`, 'verde');
        
        // 5. Crear movimientos de inventario
        log('\n📊 Creando movimientos de inventario...', 'azul');
        const movimientos = await crearMovimientosInventario(usuarios, productos);
        log(`✅ ${movimientos.length} movimientos creados`, 'verde');
        
        // 6. Crear ventas
        log('\n💰 Creando ventas...', 'azul');
        const ventas = await crearVentas(usuarios, productos);
        log(`✅ ${ventas.length} ventas creadas`, 'verde');
        
        log('\n🎉 ¡Seeds ejecutados exitosamente!', 'verde');
        log('\n📋 Resumen:', 'azul');
        log(`   - Sucursales: ${sucursales.length}`);
        log(`   - Usuarios: ${usuarios.length}`);
        log(`   - Productos: ${productos.length}`);
        log(`   - Movimientos: ${movimientos.length}`);
        log(`   - Ventas: ${ventas.length}`);
        
        log('\n🏪 Sucursales creadas:', 'amarillo');
        sucursales.forEach(s => {
            log(`   - ${s.codigo}: ${s.nombre} (${s.direccion.ciudad})`);
        });
        
        log('\n🔐 Credenciales de acceso:', 'amarillo');
        log('   Admin:', 'verde');
        log('     Email: admin@retail.com');
        log('     Password: admin123');
        log('   Gerente:', 'verde');
        log('     Email: gerente@retail.com');
        log('     Password: gerente123');
        log('   Vendedor:', 'verde');
        log('     Email: vendedor@retail.com');
        log('     Password: vendedor123');
        
        process.exit(0);
        
    } catch (error) {
        log(`\n❌ Error al ejecutar seeds: ${error.message}`, 'rojo');
        console.error(error);
        process.exit(1);
    }
};

// Ejecutar seeds
ejecutarSeeds();