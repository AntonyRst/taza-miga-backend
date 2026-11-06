import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../db.js';

/**
 * Centra un texto dentro de un ancho determinado para el ticket térmico.
 */
function centrarTexto(texto, ancho = 40) {
  if (texto.length >= ancho) return texto;
  const margen = Math.floor((ancho - texto.length) / 2);
  return ' '.repeat(margen) + texto;
}

/**
 * Genera el contenido del ticket en texto monoespaciado (HU-17, RN-24).
 */
function generarTextoTicket(datos) {
  const separadorDoble = '='.repeat(40);
  const separadorSimple = '-'.repeat(40);
  const lineas = [];

  lineas.push(separadorDoble);
  lineas.push(centrarTexto(datos.negocioNombre.toUpperCase(), 40));
  lineas.push(centrarTexto(datos.sucursalNombre, 40));
  if (datos.sucursalDireccion) {
    lineas.push(centrarTexto(datos.sucursalDireccion, 40));
  }
  lineas.push(separadorDoble);

  lineas.push(`PEDIDO: #${datos.numeroOrden}`);
  lineas.push(`FECHA:  ${datos.fechaHora}`);
  lineas.push(`CLIENTE: ${datos.nombreCliente}`);

  const modalidad =
    datos.tipoEntrega === 'MESA'
      ? `MESA ${datos.numeroMesa}`
      : `PARA LLEVAR${datos.horaRecogida ? ` (${datos.horaRecogida})` : ''}`;
  lineas.push(`ENTREGA: ${modalidad}`);

  lineas.push(separadorSimple);
  lineas.push('CANT. DESCRIPCIÓN                 TOTAL');
  lineas.push(separadorSimple);

  for (const item of datos.detalles) {
    const precioBase = Number(item.precioUnitario);
    const extraOpciones = (item.opciones || []).reduce(
      (acc, op) => acc + Number(op.precioExtra || 0),
      0
    );
    const subtotalLinea = (precioBase + extraOpciones) * item.cantidad;

    const colCant = `${item.cantidad}x`.padEnd(5);
    const colTotal = `$${subtotalLinea.toFixed(2)}`.padStart(8);
    const nombreProd =
      item.nombreProducto.length > 27
        ? item.nombreProducto.slice(0, 24) + '...'
        : item.nombreProducto;
    lineas.push(`${colCant}${nombreProd.padEnd(27)}${colTotal}`);

    if (item.opciones && item.opciones.length > 0) {
      for (const op of item.opciones) {
        const extraStr =
          Number(op.precioExtra) > 0
            ? ` (+$${Number(op.precioExtra).toFixed(2)})`
            : '';
        lineas.push(`     + ${op.nombreOpcion}${extraStr}`);
      }
    }

    if (item.notasPersonalizacion) {
      lineas.push(`     Nota: ${item.notasPersonalizacion}`);
    }
  }

  lineas.push(separadorSimple);
  const totalFormateado = `$${Number(datos.total).toFixed(2)}`.padStart(8);
  lineas.push(`TOTAL A PAGAR:              ${totalFormateado}`);
  lineas.push(`MÉTODO DE PAGO: ${datos.metodoPago} (PAGADO)`);
  lineas.push(`DESPACHADO POR: ${datos.despachadoPor}`);
  lineas.push(separadorDoble);
  lineas.push(centrarTexto('¡Gracias por tu preferencia!', 40));
  lineas.push(separadorDoble);

  return lineas.join('\n');
}

/**
 * Script para sembrar datos de demostración realistas y completos.
 * Incluye: dos sucursales, personal diverso (con y sin acceso),
 * menú bilingüe coherente con opciones, historial de pedidos con tickets
 * y registros de auditoría.
 */
export async function sembrarDemo() {
  console.log('☕ Sembrando datos de demostración para Taza & Miga...');
  const conexion = await pool.getConnection();

  try {
    await conexion.beginTransaction();

    // 1. NEGOCIO PRINCIPAL
    const [negocios] = await conexion.query('SELECT id FROM negocios WHERE id = 1');
    let negocioId = 1;
    if (negocios.length === 0) {
      const [resN] = await conexion.query(`
        INSERT INTO negocios (id, nombre, slug, logo_url)
        VALUES (1, 'Taza & Miga', 'taza-miga', 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=300&q=80')
      `);
      negocioId = resN.insertId;
    }

    // 2. DOS SUCURSALES ACTIVAS
    await conexion.query(`
      INSERT INTO sucursales (id, negocio_id, nombre, direccion, latitud, longitud, telefono, cantidad_mesas, activa)
      VALUES (1, ?, 'Casa Central', 'Av. Las Palmas #102, Col. San Benito, San Salvador', 13.6929403, -89.2385101, '2222-3333', 12, TRUE)
      ON DUPLICATE KEY UPDATE
        nombre = VALUES(nombre),
        direccion = VALUES(direccion),
        latitud = VALUES(latitud),
        longitud = VALUES(longitud),
        telefono = VALUES(telefono),
        cantidad_mesas = VALUES(cantidad_mesas),
        activa = TRUE
    `, [negocioId]);

    await conexion.query(`
      INSERT INTO sucursales (id, negocio_id, nombre, direccion, latitud, longitud, telefono, cantidad_mesas, activa)
      VALUES (2, ?, 'Sucursal Escalón', 'Paseo General Escalón #3500, San Salvador', 13.7025800, -89.2435000, '2222-5555', 8, TRUE)
      ON DUPLICATE KEY UPDATE
        nombre = VALUES(nombre),
        direccion = VALUES(direccion),
        latitud = VALUES(latitud),
        longitud = VALUES(longitud),
        telefono = VALUES(telefono),
        cantidad_mesas = VALUES(cantidad_mesas),
        activa = TRUE
    `, [negocioId]);

    // 3. PERSONAL
    async function upsertUsuario({ nombre, cargo, telefono, correo, password, rol, sucursalId, accesoSistema = true }) {
      const hash = password ? await bcrypt.hash(password, 10) : null;
      if (correo) {
        await conexion.query(`
          INSERT INTO usuarios (negocio_id, sucursal_id, nombre, cargo, telefono, acceso_sistema, correo, password_hash, rol, debe_cambiar_password, activo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, TRUE)
          ON DUPLICATE KEY UPDATE
            nombre = VALUES(nombre),
            cargo = VALUES(cargo),
            telefono = VALUES(telefono),
            password_hash = COALESCE(VALUES(password_hash), password_hash),
            rol = VALUES(rol),
            sucursal_id = VALUES(sucursal_id),
            activo = TRUE,
            debe_cambiar_password = FALSE
        `, [negocioId, sucursalId, nombre, cargo, telefono, accesoSistema, correo, hash, rol]);
        const [u] = await conexion.query('SELECT id FROM usuarios WHERE correo = ?', [correo]);
        return u[0].id;
      } else {
        const [existente] = await conexion.query('SELECT id FROM usuarios WHERE telefono = ? AND negocio_id = ?', [telefono, negocioId]);
        if (existente.length > 0) {
          await conexion.query(`
            UPDATE usuarios SET nombre = ?, cargo = ?, sucursal_id = ?, activo = TRUE WHERE id = ?
          `, [nombre, cargo, sucursalId, existente[0].id]);
          return existente[0].id;
        } else {
          const [ins] = await conexion.query(`
            INSERT INTO usuarios (negocio_id, sucursal_id, nombre, cargo, telefono, acceso_sistema, correo, password_hash, rol, activo)
            VALUES (?, ?, ?, ?, ?, FALSE, NULL, NULL, 'SIN_ACCESO', TRUE)
          `, [negocioId, sucursalId, nombre, cargo, telefono]);
          return ins.insertId;
        }
      }
    }

    const duenoId = await upsertUsuario({
      nombre: 'Dueño Principal', cargo: 'Dueño', telefono: '7000-0001',
      correo: 'dueno@tazamiga.com', password: 'PasswordSeguro123',
      rol: 'DUENO', sucursalId: null
    });

    const gerente1Id = await upsertUsuario({
      nombre: 'Laura Martínez', cargo: 'Gerente de Sucursal', telefono: '7000-0010',
      correo: 'gerente@tazamiga.com', password: 'Gerente123',
      rol: 'GERENTE', sucursalId: 1
    });

    const gerente2Id = await upsertUsuario({
      nombre: 'Roberto Mendoza', cargo: 'Gerente de Sucursal', telefono: '7000-0020',
      correo: 'gerente.escalon@tazamiga.com', password: 'Gerente123',
      rol: 'GERENTE', sucursalId: 2
    });

    const barista1Id = await upsertUsuario({
      nombre: 'Carlos Barista', cargo: 'Barista Principal', telefono: '7000-0002',
      correo: 'barista@tazamiga.com', password: 'Barista123',
      rol: 'BARISTA', sucursalId: 1
    });

    const barista2Id = await upsertUsuario({
      nombre: 'Sofía Rivas', cargo: 'Barista', telefono: '7000-0011',
      correo: 'sofia.barista@tazamiga.com', password: 'Barista123',
      rol: 'BARISTA', sucursalId: 1
    });

    const barista3Id = await upsertUsuario({
      nombre: 'Mateo Gómez', cargo: 'Barista', telefono: '7000-0012',
      correo: 'mateo.barista@tazamiga.com', password: 'Barista123',
      rol: 'BARISTA', sucursalId: 2
    });

    await upsertUsuario({
      nombre: 'Elena Vásquez', cargo: 'Mesera', telefono: '7890-1122',
      sucursalId: 1, accesoSistema: false
    });

    await upsertUsuario({
      nombre: 'Jorge Ramos', cargo: 'Auxiliar de Limpieza', telefono: '7890-3344',
      sucursalId: 1, accesoSistema: false
    });

    await upsertUsuario({
      nombre: 'Carmen Salazar', cargo: 'Mesera', telefono: '7890-5566',
      sucursalId: 2, accesoSistema: false
    });

    // 4. GRUPOS DE OPCIONES Y OPCIONES
    const mapaOpciones = {};

    // Tipo de leche (UNICA, obligatoria)
    const [resLeche] = await conexion.query(`
      INSERT INTO grupos_opciones (negocio_id, nombre_es, nombre_en, tipo_seleccion, obligatorio, activo)
      VALUES (?, 'Tipo de leche', 'Milk type', 'UNICA', TRUE, TRUE)
      ON DUPLICATE KEY UPDATE activo = TRUE
    `, [negocioId]);
    const grupoLecheId = resLeche.insertId || (await conexion.query('SELECT id FROM grupos_opciones WHERE negocio_id = ? AND nombre_es = ?', [negocioId, 'Tipo de leche']))[0][0].id;

    const opcionesLeche = [
      { es: 'Entera', en: 'Whole milk', extra: 0.00, pred: true },
      { es: 'Deslactosada', en: 'Lactose free', extra: 0.00, pred: false },
      { es: 'Avena', en: 'Oat milk', extra: 0.60, pred: false },
      { es: 'Almendra', en: 'Almond milk', extra: 0.60, pred: false }
    ];
    for (const op of opcionesLeche) {
      const [resO] = await conexion.query(`
        INSERT INTO opciones (negocio_id, grupo_id, nombre_es, nombre_en, precio_extra, es_predeterminada, activa)
        VALUES (?, ?, ?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE precio_extra = VALUES(precio_extra), activa = TRUE
      `, [negocioId, grupoLecheId, op.es, op.en, op.extra, op.pred]);
      const opId = resO.insertId || (await conexion.query('SELECT id FROM opciones WHERE grupo_id = ? AND nombre_es = ?', [grupoLecheId, op.es]))[0][0].id;
      mapaOpciones[op.es] = opId;
    }

    // Nivel de dulzor (UNICA, no obligatoria)
    const [resDulzor] = await conexion.query(`
      INSERT INTO grupos_opciones (negocio_id, nombre_es, nombre_en, tipo_seleccion, obligatorio, activo)
      VALUES (?, 'Nivel de dulzor', 'Sweetness level', 'UNICA', FALSE, TRUE)
      ON DUPLICATE KEY UPDATE activo = TRUE
    `, [negocioId]);
    const grupoDulzorId = resDulzor.insertId || (await conexion.query('SELECT id FROM grupos_opciones WHERE negocio_id = ? AND nombre_es = ?', [negocioId, 'Nivel de dulzor']))[0][0].id;

    const opcionesDulzor = [
      { es: '0% (Sin azúcar)', en: '0% (No sugar)', extra: 0.00, pred: true },
      { es: '25% (Poco dulce)', en: '25% (Light)', extra: 0.00, pred: false },
      { es: '50% (Medio)', en: '50% (Medium)', extra: 0.00, pred: false },
      { es: '100% (Normal)', en: '100% (Standard)', extra: 0.00, pred: false }
    ];
    for (const op of opcionesDulzor) {
      const [resO] = await conexion.query(`
        INSERT INTO opciones (negocio_id, grupo_id, nombre_es, nombre_en, precio_extra, es_predeterminada, activa)
        VALUES (?, ?, ?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE precio_extra = VALUES(precio_extra), activa = TRUE
      `, [negocioId, grupoDulzorId, op.es, op.en, op.extra, op.pred]);
      const opId = resO.insertId || (await conexion.query('SELECT id FROM opciones WHERE grupo_id = ? AND nombre_es = ?', [grupoDulzorId, op.es]))[0][0].id;
      mapaOpciones[op.es] = opId;
    }

    // Extras (MULTIPLE, no obligatoria)
    const [resExtras] = await conexion.query(`
      INSERT INTO grupos_opciones (negocio_id, nombre_es, nombre_en, tipo_seleccion, obligatorio, activo)
      VALUES (?, 'Extras', 'Add-ons', 'MULTIPLE', FALSE, TRUE)
      ON DUPLICATE KEY UPDATE activo = TRUE
    `, [negocioId]);
    const grupoExtrasId = resExtras.insertId || (await conexion.query('SELECT id FROM grupos_opciones WHERE negocio_id = ? AND nombre_es = ?', [negocioId, 'Extras']))[0][0].id;

    const opcionesExtras = [
      { es: 'Shot extra de espresso', en: 'Extra espresso shot', extra: 0.80, pred: false },
      { es: 'Jarabe de vainilla artesanal', en: 'Artisanal vanilla syrup', extra: 0.50, pred: false },
      { es: 'Jarabe de caramelo', en: 'Caramel syrup', extra: 0.50, pred: false },
      { es: 'Crema batida', en: 'Whipped cream', extra: 0.50, pred: false }
    ];
    for (const op of opcionesExtras) {
      const [resO] = await conexion.query(`
        INSERT INTO opciones (negocio_id, grupo_id, nombre_es, nombre_en, precio_extra, es_predeterminada, activa)
        VALUES (?, ?, ?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE precio_extra = VALUES(precio_extra), activa = TRUE
      `, [negocioId, grupoExtrasId, op.es, op.en, op.extra, op.pred]);
      const opId = resO.insertId || (await conexion.query('SELECT id FROM opciones WHERE grupo_id = ? AND nombre_es = ?', [grupoExtrasId, op.es]))[0][0].id;
      mapaOpciones[op.es] = opId;
    }

    // Temperatura (UNICA, no obligatoria)
    const [resTemp] = await conexion.query(`
      INSERT INTO grupos_opciones (negocio_id, nombre_es, nombre_en, tipo_seleccion, obligatorio, activo)
      VALUES (?, 'Temperatura', 'Temperature', 'UNICA', FALSE, TRUE)
      ON DUPLICATE KEY UPDATE activo = TRUE
    `, [negocioId]);
    const grupoTempId = resTemp.insertId || (await conexion.query('SELECT id FROM grupos_opciones WHERE negocio_id = ? AND nombre_es = ?', [negocioId, 'Temperatura']))[0][0].id;

    const opcionesTemp = [
      { es: 'Caliente', en: 'Hot', extra: 0.00, pred: true },
      { es: 'Con hielo (Iced)', en: 'Iced', extra: 0.25, pred: false }
    ];
    for (const op of opcionesTemp) {
      const [resO] = await conexion.query(`
        INSERT INTO opciones (negocio_id, grupo_id, nombre_es, nombre_en, precio_extra, es_predeterminada, activa)
        VALUES (?, ?, ?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE precio_extra = VALUES(precio_extra), activa = TRUE
      `, [negocioId, grupoTempId, op.es, op.en, op.extra, op.pred]);
      const opId = resO.insertId || (await conexion.query('SELECT id FROM opciones WHERE grupo_id = ? AND nombre_es = ?', [grupoTempId, op.es]))[0][0].id;
      mapaOpciones[op.es] = opId;
    }

    // 5. CATEGORÍAS
    const categoriasDatos = [
      { es: 'Café de Especialidad', en: 'Specialty Coffee', orden: 1 },
      { es: 'Bebidas Frías', en: 'Cold Beverages', orden: 2 },
      { es: 'Repostería Artesanal', en: 'Bakery & Pastry', orden: 3 },
      { es: 'Desayunos Ligeros', en: 'Light Breakfast', orden: 4 }
    ];

    const mapaCategorias = {};
    for (const cat of categoriasDatos) {
      const [resC] = await conexion.query(`
        INSERT INTO categorias (negocio_id, nombre_es, nombre_en, orden, activa)
        VALUES (?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE orden = VALUES(orden), activa = TRUE
      `, [negocioId, cat.es, cat.en, cat.orden]);
      const catId = resC.insertId || (await conexion.query('SELECT id FROM categorias WHERE negocio_id = ? AND nombre_es = ?', [negocioId, cat.es]))[0][0].id;
      mapaCategorias[cat.es] = catId;
    }

    // 6. PRODUCTOS
    const productosDatos = [
      // Café
      {
        cat: 'Café de Especialidad',
        es: 'Latte de la Casa',
        en: 'House Latte',
        descEs: 'Espresso doble con leche cremada al punto sedoso.',
        descEn: 'Double espresso with perfectly textured steamed milk.',
        precio: 4.25,
        img: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=600&q=80',
        grupos: [grupoLecheId, grupoDulzorId, grupoExtrasId, grupoTempId]
      },
      {
        cat: 'Café de Especialidad',
        es: 'Capuchino Clásico',
        en: 'Classic Cappuccino',
        descEs: 'Equilibrio perfecto de espresso, leche vaporizada y abundante espuma densa.',
        descEn: 'Equal parts rich espresso, steamed milk, and velvety microfoam.',
        precio: 3.75,
        img: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80',
        grupos: [grupoLecheId, grupoDulzorId, grupoExtrasId]
      },
      {
        cat: 'Café de Especialidad',
        es: 'Americano Artesanal',
        en: 'Artisanal Americano',
        descEs: 'Extracción doble de espresso diluido en agua caliente a 92°C preservando sus notas aromáticas.',
        descEn: 'Double espresso shot combined with hot water preserving floral and nutty notes.',
        precio: 2.75,
        img: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
        grupos: [grupoExtrasId, grupoTempId]
      },
      {
        cat: 'Café de Especialidad',
        es: 'Espresso Doble',
        en: 'Double Espresso',
        descEs: 'Concentrado intenso de 60 ml con crema avellana persistente y acidez balanceada.',
        descEn: 'Rich 60ml concentrated shot with persistent hazelnut crema and vibrant acidity.',
        precio: 3.00,
        img: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80',
        grupos: [grupoExtrasId]
      },
      // Bebidas Frías
      {
        cat: 'Bebidas Frías',
        es: 'Cold Brew Nitro',
        en: 'Nitro Cold Brew',
        descEs: 'Café macerado en frío 18 horas e infusionado con nitrógeno para textura sedosa tipo stout.',
        descEn: '18-hour cold steeped coffee infused with nitrogen for a silky stout-like microfoam.',
        precio: 4.50,
        img: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80',
        grupos: [grupoDulzorId, grupoExtrasId]
      },
      {
        cat: 'Bebidas Frías',
        es: 'Iced Caramel Macchiato',
        en: 'Iced Caramel Macchiato',
        descEs: 'Leche fresca con hielo, vainilla de Madagascar y espresso coronado con sirope de caramelo.',
        descEn: 'Fresh milk over ice, hint of vanilla, topped with espresso and buttery caramel drizzle.',
        precio: 4.75,
        img: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80',
        grupos: [grupoLecheId, grupoDulzorId, grupoExtrasId]
      },
      {
        cat: 'Bebidas Frías',
        es: 'Té Matcha Japonés Frío',
        en: 'Iced Japanese Matcha Latte',
        descEs: 'Matcha ceremonial Uji batido al momento con leche vegetal o entera sobre cubos de hielo.',
        descEn: 'Ceremonial grade Uji matcha whisked fresh with your choice of chilled milk.',
        precio: 4.25,
        img: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80',
        grupos: [grupoLecheId, grupoDulzorId]
      },
      {
        cat: 'Bebidas Frías',
        es: 'Limonada de Menta y Jengibre',
        en: 'Mint & Ginger Lemonade',
        descEs: 'Jugo natural de limón criollo infusionado con menta fresca y un toque sutil de jengibre.',
        descEn: 'Freshly squeezed local lime juice crushed with garden mint and a hint of ginger.',
        precio: 3.25,
        img: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
        grupos: [grupoDulzorId]
      },
      // Repostería
      {
        cat: 'Repostería Artesanal',
        es: 'Croissant de Mantequilla',
        en: 'Butter Croissant',
        descEs: 'Hojaldre tradicional francés horneado cada mañana con 100% pura mantequilla.',
        descEn: 'Traditional French laminated pastry freshly baked each morning with pure butter.',
        precio: 2.50,
        img: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
        grupos: []
      },
      {
        cat: 'Repostería Artesanal',
        es: 'Muffin de Arándanos Silvestres',
        en: 'Wild Blueberry Muffin',
        descEs: 'Bizcocho esponjoso relleno de arándanos enteros con crumble crujiente de azúcar morena.',
        descEn: 'Moist fluffy muffin packed with whole blueberries and crunchy brown sugar crumble.',
        precio: 2.25,
        img: 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80',
        grupos: []
      },
      {
        cat: 'Repostería Artesanal',
        es: 'Rol de Canela Glaseado',
        en: 'Glazed Cinnamon Roll',
        descEs: 'Masa suave enrollada con canela de Ceilán y cubierta con glaseado cremoso de queso.',
        descEn: 'Soft swirled dough filled with aromatic Ceylon cinnamon and creamy cream-cheese glaze.',
        precio: 2.85,
        img: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?auto=format&fit=crop&w=600&q=80',
        grupos: []
      },
      // Desayunos Ligeros
      {
        cat: 'Desayunos Ligeros',
        es: 'Tostada de Aguacate y Huevo Poché',
        en: 'Avocado Toast with Poached Egg',
        descEs: 'Pan rústico de masa madre con aguacate hass machacado, huevo poché y semillas tostadas.',
        descEn: 'Sourdough toast with smashed Hass avocado, farm poached egg, and toasted seeds.',
        precio: 5.50,
        img: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
        grupos: []
      },
      {
        cat: 'Desayunos Ligeros',
        es: 'Panini de Jamón Serrano y Gouda',
        en: 'Prosciutto & Gouda Panini',
        descEs: 'Pan ciabatta a la plancha con jamón curado, queso gouda fundido, arúgula y alioli.',
        descEn: 'Pressed ciabatta with cured prosciutto, melted gouda, fresh arugula, and light aioli.',
        precio: 5.75,
        img: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
        grupos: []
      }
    ];

    const mapaProductos = {};
    for (const prod of productosDatos) {
      const catId = mapaCategorias[prod.cat];
      const [resP] = await conexion.query(`
        INSERT INTO productos (negocio_id, categoria_id, nombre_es, nombre_en, descripcion_es, descripcion_en, precio, imagen_url, disponible, activo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE)
        ON DUPLICATE KEY UPDATE precio = VALUES(precio), disponible = TRUE, activo = TRUE
      `, [negocioId, catId, prod.es, prod.en, prod.descEs, prod.descEn, prod.precio, prod.img]);
      const prodId = resP.insertId || (await conexion.query('SELECT id FROM productos WHERE negocio_id = ? AND nombre_es = ?', [negocioId, prod.es]))[0][0].id;
      mapaProductos[prod.es] = { id: prodId, precio: prod.precio, nombre: prod.es };

      // Asignar grupos
      let ordenG = 1;
      for (const gId of prod.grupos) {
        await conexion.query(`
          INSERT IGNORE INTO producto_grupos (negocio_id, producto_id, grupo_id, orden)
          VALUES (?, ?, ?, ?)
        `, [negocioId, prodId, gId, ordenG++]);
      }
    }

    // 7. HISTORIAL DE PEDIDOS Y TICKETS
    console.log('📦 Generando pedidos históricos y tickets de ejemplo...');

    // Limpiar pedidos de demo anteriores para evitar colisión de consecutivos en prueba
    // O consultar el consecutivo máximo por sucursal
    const [maxSuc1] = await conexion.query('SELECT COALESCE(MAX(numero_orden), 0) AS maxNum FROM ordenes WHERE sucursal_id = 1');
    const [maxSuc2] = await conexion.query('SELECT COALESCE(MAX(numero_orden), 0) AS maxNum FROM ordenes WHERE sucursal_id = 2');
    let consecutivoSuc1 = maxSuc1[0].maxNum;
    let consecutivoSuc2 = maxSuc2[0].maxNum;

    // Helper para crear un pedido completo con detalles y ticket opcional
    async function insertarPedidoDemo({
      sucursalId,
      nombreCliente,
      tipoEntrega,
      numeroMesa,
      metodoPago,
      estadoPago,
      estado,
      motivoCancelacion = null,
      horasAtras,
      minutosPreparacion = 8,
      despachadoPorId = barista1Id,
      lineas
    }) {
      const esSuc1 = sucursalId === 1;
      const numeroOrden = esSuc1 ? ++consecutivoSuc1 : ++consecutivoSuc2;
      const codigoSeguimiento = crypto.randomUUID();

      // Calcular fechas
      const ahora = new Date();
      const fechaCreacion = new Date(ahora.getTime() - horasAtras * 3600 * 1000);
      let fechaIniciado = null;
      let fechaListo = null;
      let fechaEntregado = null;

      if (['PREPARACION', 'LISTO', 'ENTREGADO'].includes(estado)) {
        fechaIniciado = new Date(fechaCreacion.getTime() + 2 * 60 * 1000); // 2 min después
      }
      if (['LISTO', 'ENTREGADO'].includes(estado)) {
        fechaListo = new Date(fechaIniciado.getTime() + minutosPreparacion * 60 * 1000);
      }
      if (estado === 'ENTREGADO') {
        fechaEntregado = new Date(fechaListo.getTime() + 3 * 60 * 1000); // 3 min después
      }

      // Calcular total en centavos
      let totalCentavos = 0;
      for (const lin of lineas) {
        let precioBaseCents = Math.round(lin.precioUnitario * 100);
        let extrasCents = (lin.opciones || []).reduce(
          (acc, op) => acc + Math.round(Number(op.precioExtra || 0) * 100),
          0
        );
        totalCentavos += (precioBaseCents + extrasCents) * lin.cantidad;
      }
      const totalDecimal = (totalCentavos / 100).toFixed(2);

      const [resOrden] = await conexion.query(`
        INSERT INTO ordenes (
          negocio_id, sucursal_id, numero_orden, codigo_seguimiento,
          nombre_cliente, tipo_entrega, numero_mesa, metodo_pago,
          estado_pago, estado, total, motivo_cancelacion,
          iniciado_en, listo_en, entregado_en, creado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        negocioId, sucursalId, numeroOrden, codigoSeguimiento,
        nombreCliente, tipoEntrega, numeroMesa, metodoPago,
        estadoPago, estado, totalDecimal, motivoCancelacion,
        fechaIniciado, fechaListo, fechaEntregado, fechaCreacion
      ]);
      const ordenId = resOrden.insertId;

      // Insertar detalles de orden y opciones
      for (const lin of lineas) {
        const [resDet] = await conexion.query(`
          INSERT INTO detalles_orden (negocio_id, orden_id, producto_id, nombre_producto, cantidad, precio_unitario, notas_personalizacion)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          negocioId, ordenId, lin.productoId, lin.nombreProducto, lin.cantidad, lin.precioUnitario, lin.notas || null
        ]);
        const detalleId = resDet.insertId;

        if (lin.opciones && lin.opciones.length > 0) {
          for (const op of lin.opciones) {
            let finalOpcionId = op.opcionId || mapaOpciones[op.nombreOpcion];
            if (!finalOpcionId) {
              const [opFilas] = await conexion.query(
                'SELECT id FROM opciones WHERE nombre_es = ? LIMIT 1',
                [op.nombreOpcion]
              );
              finalOpcionId = opFilas[0]?.id || 1;
            }
            await conexion.query(`
              INSERT INTO detalle_orden_opciones (negocio_id, detalle_id, opcion_id, nombre_grupo, nombre_opcion, precio_extra)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              negocioId, detalleId, finalOpcionId, op.nombreGrupo, op.nombreOpcion, op.precioExtra
            ]);
          }
        }
      }

      // Generar ticket si está ENTREGADO
      if (estado === 'ENTREGADO') {
        const sucursalNombre = esSuc1 ? 'Casa Central' : 'Sucursal Escalón';
        const sucursalDir = esSuc1 ? 'Av. Las Palmas #102, Col. San Benito' : 'Paseo General Escalón #3500';
        let despachadorNombre = 'Personal de Turno';
        if (despachadoPorId === barista1Id) despachadorNombre = 'Carlos Barista';
        else if (despachadoPorId === barista2Id) despachadorNombre = 'Sofía Rivas';
        else if (despachadoPorId === barista3Id) despachadorNombre = 'Mateo Gómez';

        const textoTicket = generarTextoTicket({
          negocioNombre: 'Taza & Miga',
          sucursalNombre,
          sucursalDireccion: sucursalDir,
          numeroOrden,
          fechaHora: fechaEntregado.toLocaleString('es-SV'),
          nombreCliente,
          tipoEntrega,
          numeroMesa,
          total: totalDecimal,
          metodoPago,
          despachadoPor: despachadorNombre,
          detalles: lineas
        });

        await conexion.query(`
          INSERT INTO tickets (negocio_id, orden_id, contenido, generado_por, reimpresiones, creado_en)
          VALUES (?, ?, ?, ?, 0, ?)
        `, [negocioId, ordenId, textoTicket, despachadoPorId, fechaEntregado]);
      }

      return ordenId;
    }

    // LISTA DE PEDIDOS VARIADOS
    // 1. Pedidos activos de hoy (para probar el panel KDS y seguimiento)
    await insertarPedidoDemo({
      sucursalId: 1,
      nombreCliente: 'Andrea Silva',
      tipoEntrega: 'MESA',
      numeroMesa: 3,
      metodoPago: 'BARRA',
      estadoPago: 'SIN_PAGAR',
      estado: 'RECIBIDO',
      horasAtras: 0.1, // Hace 6 minutos
      lineas: [
        {
          productoId: mapaProductos['Latte de la Casa'].id,
          nombreProducto: 'Latte de la Casa',
          cantidad: 1,
          precioUnitario: 4.25,
          opciones: [
            { nombreGrupo: 'Tipo de leche', nombreOpcion: 'Avena', precioExtra: 0.60 },
            { nombreGrupo: 'Nivel de dulzor', nombreOpcion: '25% (Poco dulce)', precioExtra: 0.00 }
          ]
        },
        {
          productoId: mapaProductos['Croissant de Mantequilla'].id,
          nombreProducto: 'Croissant de Mantequilla',
          cantidad: 1,
          precioUnitario: 2.50
        }
      ]
    });

    await insertarPedidoDemo({
      sucursalId: 1,
      nombreCliente: 'Mauricio Flores',
      tipoEntrega: 'MESA',
      numeroMesa: 5,
      metodoPago: 'TARJETA_DEMO',
      estadoPago: 'PAGADO',
      estado: 'PREPARACION',
      horasAtras: 0.25, // Hace 15 minutos
      lineas: [
        {
          productoId: mapaProductos['Capuchino Clásico'].id,
          nombreProducto: 'Capuchino Clásico',
          cantidad: 2,
          precioUnitario: 3.75,
          opciones: [
            { nombreGrupo: 'Tipo de leche', nombreOpcion: 'Entera', precioExtra: 0.00 }
          ]
        }
      ]
    });

    await insertarPedidoDemo({
      sucursalId: 1,
      nombreCliente: 'Patricia Rivera',
      tipoEntrega: 'LLEVAR',
      numeroMesa: null,
      metodoPago: 'TARJETA_DEMO',
      estadoPago: 'PAGADO',
      estado: 'LISTO',
      horasAtras: 0.5, // Hace 30 minutos
      minutosPreparacion: 7,
      lineas: [
        {
          productoId: mapaProductos['Cold Brew Nitro'].id,
          nombreProducto: 'Cold Brew Nitro',
          cantidad: 1,
          precioUnitario: 4.50,
          opciones: [
            { nombreGrupo: 'Extras', nombreOpcion: 'Crema batida', precioExtra: 0.50 }
          ]
        },
        {
          productoId: mapaProductos['Muffin de Arándanos Silvestres'].id,
          nombreProducto: 'Muffin de Arándanos Silvestres',
          cantidad: 1,
          precioUnitario: 2.25
        }
      ]
    });

    // 2. Pedidos entregados de hoy
    await insertarPedidoDemo({
      sucursalId: 1,
      nombreCliente: 'Rodrigo Fuentes',
      tipoEntrega: 'MESA',
      numeroMesa: 2,
      metodoPago: 'BARRA',
      estadoPago: 'PAGADO',
      estado: 'ENTREGADO',
      horasAtras: 2,
      minutosPreparacion: 6,
      despachadoPorId: barista1Id,
      lineas: [
        {
          productoId: mapaProductos['Panini de Jamón Serrano y Gouda'].id,
          nombreProducto: 'Panini de Jamón Serrano y Gouda',
          cantidad: 1,
          precioUnitario: 5.75
        },
        {
          productoId: mapaProductos['Americano Artesanal'].id,
          nombreProducto: 'Americano Artesanal',
          cantidad: 1,
          precioUnitario: 2.75,
          opciones: [
            { nombreGrupo: 'Extras', nombreOpcion: 'Shot extra de espresso', precioExtra: 0.80 }
          ]
        }
      ]
    });

    await insertarPedidoDemo({
      sucursalId: 2,
      nombreCliente: 'Valeria Cruz',
      tipoEntrega: 'MESA',
      numeroMesa: 4,
      metodoPago: 'TARJETA_DEMO',
      estadoPago: 'PAGADO',
      estado: 'ENTREGADO',
      horasAtras: 3,
      minutosPreparacion: 8,
      despachadoPorId: barista3Id,
      lineas: [
        {
          productoId: mapaProductos['Iced Caramel Macchiato'].id,
          nombreProducto: 'Iced Caramel Macchiato',
          cantidad: 2,
          precioUnitario: 4.75,
          opciones: [
            { nombreGrupo: 'Tipo de leche', nombreOpcion: 'Almendra', precioExtra: 0.60 }
          ]
        },
        {
          productoId: mapaProductos['Rol de Canela Glaseado'].id,
          nombreProducto: 'Rol de Canela Glaseado',
          cantidad: 2,
          precioUnitario: 2.85
        }
      ]
    });

    // 3. Pedido cancelado hoy
    await insertarPedidoDemo({
      sucursalId: 1,
      nombreCliente: 'Ignacio Portillo',
      tipoEntrega: 'LLEVAR',
      numeroMesa: null,
      metodoPago: 'BARRA',
      estadoPago: 'SIN_PAGAR',
      estado: 'CANCELADO',
      motivoCancelacion: 'Cliente debía retirarse de emergencia por reunión laboral (RN-22)',
      horasAtras: 4,
      lineas: [
        {
          productoId: mapaProductos['Espresso Doble'].id,
          nombreProducto: 'Espresso Doble',
          cantidad: 1,
          precioUnitario: 3.00
        }
      ]
    });

    // 4. Pedidos entregados en los últimos 7 días
    const nombresClientes = [
      'Beatriz Calderón', 'Fernando Solís', 'Gabriela Henríquez',
      'Daniel Morales', 'Claudia Pineda', 'Alejandro Melgar',
      'Lucía Serrano', 'Javier Peña'
    ];

    const productosSeleccion = [
      mapaProductos['Latte de la Casa'],
      mapaProductos['Capuchino Clásico'],
      mapaProductos['Tostada de Aguacate y Huevo Poché'],
      mapaProductos['Té Matcha Japonés Frío'],
      mapaProductos['Limonada de Menta y Jengibre'],
      mapaProductos['Panini de Jamón Serrano y Gouda'],
      mapaProductos['Croissant de Mantequilla'],
      mapaProductos['Cold Brew Nitro']
    ];

    let diasAtras = 1;
    for (let i = 0; i < nombresClientes.length; i++) {
      const p1 = productosSeleccion[i % productosSeleccion.length];
      const p2 = productosSeleccion[(i + 3) % productosSeleccion.length];
      const sucId = (i % 2 === 0) ? 1 : 2;
      const baristaId = sucId === 1 ? (i % 4 === 0 ? barista2Id : barista1Id) : barista3Id;

      await insertarPedidoDemo({
        sucursalId: sucId,
        nombreCliente: nombresClientes[i],
        tipoEntrega: i % 3 === 0 ? 'LLEVAR' : 'MESA',
        numeroMesa: i % 3 === 0 ? null : (i % 6) + 1,
        metodoPago: i % 2 === 0 ? 'TARJETA_DEMO' : 'BARRA',
        estadoPago: 'PAGADO',
        estado: 'ENTREGADO',
        horasAtras: diasAtras * 24 + (i * 2),
        minutosPreparacion: 5 + (i % 5),
        despachadoPorId: baristaId,
        lineas: [
          {
            productoId: p1.id,
            nombreProducto: p1.nombre,
            cantidad: (i % 2) + 1,
            precioUnitario: p1.precio
          },
          {
            productoId: p2.id,
            nombreProducto: p2.nombre,
            cantidad: 1,
            precioUnitario: p2.precio
          }
        ]
      });

      if (i % 2 === 1) diasAtras++;
    }

    // 8. BITÁCORA DE AUDITORÍA (HU-24, RN-27)
    console.log('🛡️ Sembrando registros en auditoria_logs...');
    const logsAuditoria = [
      {
        usuarioId: duenoId,
        accion: 'CAMBIO_PRECIO',
        descripcion: 'Actualización de precio base para Latte de la Casa de $4.00 a $4.25 por ajuste de costos (RN-27)'
      },
      {
        usuarioId: duenoId,
        accion: 'TRASLADO_PERSONAL',
        descripcion: 'Traslado de personal: Barista Sofía Rivas reasignada a Sucursal Casa Central para cubrir hora pico (RN-26)'
      },
      {
        usuarioId: gerente1Id,
        accion: 'RESET_PASSWORD',
        descripcion: 'Restablecimiento de contraseña temporal para barista Carlos Barista tras verificación telefónica (RN-09)'
      },
      {
        usuarioId: barista1Id,
        accion: 'CANCELAR_PEDIDO',
        descripcion: 'Cancelación de comanda comanda: Cliente debía retirarse de emergencia por reunión laboral (RN-22)'
      },
      {
        usuarioId: duenoId,
        accion: 'DESACTIVAR_PRODUCTO',
        descripcion: 'Desactivación preventiva de insumo estacional de temporada fría (RN-10)'
      },
      {
        usuarioId: duenoId,
        accion: 'DESACTIVAR_SUCURSAL',
        descripcion: 'Prueba de validación de cierre de sucursal inactiva sin empleados asignados (RN-25)'
      }
    ];

    for (const log of logsAuditoria) {
      await conexion.query(`
        INSERT INTO auditoria_logs (negocio_id, usuario_id, accion, descripcion)
        VALUES (?, ?, ?, ?)
      `, [negocioId, log.usuarioId, log.accion, log.descripcion]);
    }

    await conexion.commit();
    console.log('✅ ¡Datos de demostración sembrados con éxito!');
    console.log('   - 2 Sucursales activas con mapas GPS');
    console.log('   - Personal configurado (Dueño, Gerentes, Baristas y apoyo sin acceso)');
    console.log('   - Menú bilingüe con 4 categorías y 13 productos');
    console.log('   - 14 pedidos variados con historial de tickets');
    console.log('   - Registros enriquecidos de auditoría');
  } catch (error) {
    await conexion.rollback();
    console.error('❌ Error al sembrar datos de demo:', error);
    throw error;
  } finally {
    conexion.release();
  }
}

if (process.argv[1]?.endsWith('sembrarDemo.js')) {
  sembrarDemo()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
