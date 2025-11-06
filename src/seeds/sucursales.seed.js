const Sucursal = require('../models/Sucursal.model');

const sucursalesData = [
    {
        codigo: 'POP-CTR',
        nombre: 'Popayán Centro',
        direccion: {
            calle: 'Carrera 6 # 4-25',
            ciudad: 'Popayán',
            departamento: 'Cauca',
            codigoPostal: '190001'
        },
        contacto: {
            telefono: '3001234567',
            email: 'popayan.centro@retail.com',
            whatsapp: '3001234567'
        },
        nombreGerente: 'Carlos Gerente',
        horario: {
            apertura: '08:00',
            cierre: '20:00',
            diasLaborales: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        },
        capacidad: {
            metrosCuadrados: 150,
            capacidadAlmacenamiento: 2000
        },
        estado: 'Activa',
        fechaApertura: new Date('2020-01-15'),
        observaciones: 'Sucursal principal en el centro histórico de Popayán'
    },
    {
        codigo: 'POP-NOR',
        nombre: 'Popayán Norte',
        direccion: {
            calle: 'Calle 5N # 9-45',
            ciudad: 'Popayán',
            departamento: 'Cauca',
            codigoPostal: '190002'
        },
        contacto: {
            telefono: '3009876543',
            email: 'popayan.norte@retail.com',
            whatsapp: '3009876543'
        },
        nombreGerente: 'Laura Rodríguez',
        horario: {
            apertura: '09:00',
            cierre: '21:00',
            diasLaborales: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        },
        capacidad: {
            metrosCuadrados: 200,
            capacidadAlmacenamiento: 2500
        },
        estado: 'Activa',
        fechaApertura: new Date('2021-06-10'),
        observaciones: 'Sucursal ubicada en zona comercial del norte'
    },
    {
        codigo: 'CAL-CTR',
        nombre: 'Cali Centro',
        direccion: {
            calle: 'Carrera 10 # 12-30',
            ciudad: 'Cali',
            departamento: 'Valle del Cauca',
            codigoPostal: '760001'
        },
        contacto: {
            telefono: '3105556789',
            email: 'cali.centro@retail.com',
            whatsapp: '3105556789'
        },
        horario: {
            apertura: '08:30',
            cierre: '19:30',
            diasLaborales: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        },
        capacidad: {
            metrosCuadrados: 180,
            capacidadAlmacenamiento: 2200
        },
        estado: 'Activa',
        fechaApertura: new Date('2019-03-20'),
        observaciones: 'Primera sucursal en Cali, ubicada en el centro comercial'
    },
    {
        codigo: 'CAL-SUR',
        nombre: 'Cali Sur',
        direccion: {
            calle: 'Avenida 6 # 45-12',
            ciudad: 'Cali',
            departamento: 'Valle del Cauca',
            codigoPostal: '760045'
        },
        contacto: {
            telefono: '3157778899',
            email: 'cali.sur@retail.com',
            whatsapp: '3157778899'
        },
        horario: {
            apertura: '10:00',
            cierre: '22:00',
            diasLaborales: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        },
        capacidad: {
            metrosCuadrados: 250,
            capacidadAlmacenamiento: 3000
        },
        estado: 'Activa',
        fechaApertura: new Date('2022-08-05'),
        observaciones: 'Sucursal más grande, ubicada en centro comercial del sur'
    }
];

const crearSucursales = async (usuarios) => {
    try {
        // Asignar gerentes a las sucursales
        const gerentes = usuarios.filter(u => u.rol === 'gerente');
        
        if (gerentes.length >= 2) {
            sucursalesData[0].gerente = gerentes[0]._id;
            sucursalesData[0].nombreGerente = gerentes[0].nombre;
            
            sucursalesData[1].gerente = gerentes[1]._id;
            sucursalesData[1].nombreGerente = gerentes[1].nombre;
        }
        
        const sucursales = await Sucursal.create(sucursalesData);
        return sucursales;
    } catch (error) {
        throw new Error('Error al crear sucursales: ' + error.message);
    }
};

module.exports = { crearSucursales };