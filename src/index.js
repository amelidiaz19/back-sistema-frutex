const express = require('express');
const cors = require('cors');
const path = require('path'); 

const app = express();

const empleadoRoutes = require('./routes/empleados.routes');
const productosSystemRoutes = require('./routes/productos.routes');
const cotizacionRoutes = require('./routes/cotizacion.routes');
const tipocambioRoutes = require('./routes/tipocambio.routes');
const almacenRoutes = require('./routes/almacen.routes');
const cajaRoutes = require('./routes/caja.routes');
const clientesRoutes = require('./routes/clientes.routes');
const bannerRoutes = require('./routes/banner.routes');
const imagenRoutes = require('./routes/productos_imagen.routes');
const clienteWbRoutes = require('./routes/clientewb.routes.js');
const pedidosRoutes = require('./routes/pedido.routes.js');
const productosRoutes = require('./routes/producto_ec.routes');
const ventasRoutes = require('./routes/ventas.routes');

const corsOptions = {
  origin: function (origin, callback) {

    const allowedOrigins = [
      'http://localhost:4200',
      'http://localhost:4000',
      'http://localhost:64565'
    ];

    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH','DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Access-Control-Allow-Methods', 
    'Access-Control-Allow-Origin'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.options('*', cors(corsOptions));


app.use('/api/empleados', empleadoRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/system', productosSystemRoutes);  
app.use('/api/cotizaciones', cotizacionRoutes);
app.use('/api/tipocambio', tipocambioRoutes);
app.use('/api/almacen', almacenRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/imagen', imagenRoutes);
app.use('/api/clientewb', clienteWbRoutes);
app.use('/api/pedido', pedidosRoutes);
app.use('/api/productos', productosRoutes); 

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).send('Algo salió mal!');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});