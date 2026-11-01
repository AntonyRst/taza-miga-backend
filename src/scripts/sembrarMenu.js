import pool from '../db.js';

/**
 * Siembra datos iniciales de menú requeridos por HU-10 y catálogo base para HU-09.
 */
export async function sembrarMenu(negocioId = 1) {
  const conexion = await pool.getConnection();

  try {
    await conexion.beginTransaction();

    // 1. Grupos de opciones requeridos por HU-10
    // Tipo de leche (UNICA, obligatoria)
    const [resLeche] = await conexion.query(`
      INSERT INTO grupos_opciones (negocio_id, nombre_es, nombre_en, tipo_seleccion, obligatorio, activo)
      VALUES (?, 'Tipo de leche', 'Milk type', 'UNICA', TRUE, TRUE)
      ON DUPLICATE KEY UPDATE nombre_es = VALUES(nombre_es)
    `, [negocioId]);
    const grupoLecheId = resLeche.insertId || (await conexion.query('SELECT id FROM grupos_opciones WHERE negocio_id = ? AND nombre_es = ?', [negocioId, 'Tipo de leche']))[0][0].id;

    // Opciones de leche
    const opcionesLeche = [
      { es: 'Entera', en: 'Whole milk', extra: 0.00, pred: true },
      { es: 'Deslactosada', en: 'Lactose free', extra: 0.00, pred: false },
      { es: 'Avena', en: 'Oat milk', extra: 0.60, pred: false },
      { es: 'Almendra', en: 'Almond milk', extra: 0.60, pred: false }
    ];
    for (const op of opcionesLeche) {
      await conexion.query(`
        INSERT INTO opciones (negocio_id, grupo_id, nombre_es, nombre_en, precio_extra, es_predeterminada, activa)
        VALUES (?, ?, ?, ?, ?, ?, TRUE)
      `, [negocioId, grupoLecheId, op.es, op.en, op.extra, op.pred]);
    }

    // Nivel de dulzor (UNICA, no obligatoria)
    const [resDulzor] = await conexion.query(`
      INSERT INTO grupos_opciones (negocio_id, nombre_es, nombre_en, tipo_seleccion, obligatorio, activo)
      VALUES (?, 'Nivel de dulzor', 'Sweetness level', 'UNICA', FALSE, TRUE)
    `, [negocioId]);
    const grupoDulzorId = resDulzor.insertId;

    const opcionesDulzor = [
      { es: '0% (Sin azúcar)', en: '0% (No sugar)', extra: 0.00, pred: true },
      { es: '25% (Poco dulce)', en: '25% (Light)', extra: 0.00, pred: false },
      { es: '50% (Medio)', en: '50% (Medium)', extra: 0.00, pred: false },
      { es: '100% (Normal)', en: '100% (Standard)', extra: 0.00, pred: false }
    ];
    for (const op of opcionesDulzor) {
      await conexion.query(`
        INSERT INTO opciones (negocio_id, grupo_id, nombre_es, nombre_en, precio_extra, es_predeterminada, activa)
        VALUES (?, ?, ?, ?, ?, ?, TRUE)
      `, [negocioId, grupoDulzorId, op.es, op.en, op.extra, op.pred]);
    }

    // Extras (MULTIPLE, no obligatoria)
    const [resExtras] = await conexion.query(`
      INSERT INTO grupos_opciones (negocio_id, nombre_es, nombre_en, tipo_seleccion, obligatorio, activo)
      VALUES (?, 'Extras', 'Add-ons', 'MULTIPLE', FALSE, TRUE)
    `, [negocioId]);
    const grupoExtrasId = resExtras.insertId;

    const opcionesExtras = [
      { es: 'Shot extra de espresso', en: 'Extra espresso shot', extra: 0.80, pred: false },
      { es: 'Jarabe de vainilla artesanal', en: 'Artisanal vanilla syrup', extra: 0.50, pred: false },
      { es: 'Crema batida', en: 'Whipped cream', extra: 0.50, pred: false }
    ];
    for (const op of opcionesExtras) {
      await conexion.query(`
        INSERT INTO opciones (negocio_id, grupo_id, nombre_es, nombre_en, precio_extra, es_predeterminada, activa)
        VALUES (?, ?, ?, ?, ?, ?, TRUE)
      `, [negocioId, grupoExtrasId, op.es, op.en, op.extra, op.pred]);
    }

    // 2. Categorías
    const [resCatCafe] = await conexion.query(`
      INSERT INTO categorias (negocio_id, nombre_es, nombre_en, orden, activa)
      VALUES (?, 'Café de Especialidad', 'Specialty Coffee', 1, TRUE)
    `, [negocioId]);
    const catCafeId = resCatCafe.insertId;

    const [resCatPan] = await conexion.query(`
      INSERT INTO categorias (negocio_id, nombre_es, nombre_en, orden, activa)
      VALUES (?, 'Repostería Artesanal', 'Bakery & Pastry', 2, TRUE)
    `, [negocioId]);
    const catPanId = resCatPan.insertId;

    const [resCatFrias] = await conexion.query(`
      INSERT INTO categorias (negocio_id, nombre_es, nombre_en, orden, activa)
      VALUES (?, 'Bebidas Frías', 'Cold Beverages', 3, TRUE)
    `, [negocioId]);
    const catFriasId = resCatFrias.insertId;

    // 3. Productos
    // Producto 1: Latte de la Casa
    const [resProd1] = await conexion.query(`
      INSERT INTO productos (negocio_id, categoria_id, nombre_es, nombre_en, descripcion_es, descripcion_en, precio, imagen_url, disponible, activo)
      VALUES (?, ?, 'Latte de la Casa', 'House Latte', 'Espresso doble con leche cremada al punto sedoso.', 'Double espresso with perfectly steamed textured milk.', 4.25, 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=600&q=80', TRUE, TRUE)
    `, [negocioId, catCafeId]);
    const prod1Id = resProd1.insertId;

    // Asignar leche, dulzor y extras al Latte
    await conexion.query(`INSERT INTO producto_grupos (negocio_id, producto_id, grupo_id, orden) VALUES (?, ?, ?, 1)`, [negocioId, prod1Id, grupoLecheId]);
    await conexion.query(`INSERT INTO producto_grupos (negocio_id, producto_id, grupo_id, orden) VALUES (?, ?, ?, 2)`, [negocioId, prod1Id, grupoDulzorId]);
    await conexion.query(`INSERT INTO producto_grupos (negocio_id, producto_id, grupo_id, orden) VALUES (?, ?, ?, 3)`, [negocioId, prod1Id, grupoExtrasId]);

    // Producto 2: Capuchino
    const [resProd2] = await conexion.query(`
      INSERT INTO productos (negocio_id, categoria_id, nombre_es, nombre_en, descripcion_es, descripcion_en, precio, imagen_url, disponible, activo)
      VALUES (?, ?, 'Capuchino Clásico', 'Classic Cappuccino', 'Equilibrio perfecto de espresso, leche vaporizada y abundante espuma densa.', 'Equal parts of rich espresso, steamed milk, and airy microfoam.', 3.75, 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80', TRUE, TRUE)
    `, [negocioId, catCafeId]);
    const prod2Id = resProd2.insertId;
    await conexion.query(`INSERT INTO producto_grupos (negocio_id, producto_id, grupo_id, orden) VALUES (?, ?, ?, 1)`, [negocioId, prod2Id, grupoLecheId]);
    await conexion.query(`INSERT INTO producto_grupos (negocio_id, producto_id, grupo_id, orden) VALUES (?, ?, ?, 2)`, [negocioId, prod2Id, grupoDulzorId]);

    // Producto 3: Croissant (sin personalización)
    await conexion.query(`
      INSERT INTO productos (negocio_id, categoria_id, nombre_es, nombre_en, descripcion_es, descripcion_en, precio, imagen_url, disponible, activo)
      VALUES (?, ?, 'Croissant de Mantequilla', 'Butter Croissant', 'Hojaldre tradicional horneado cada mañana con pura mantequilla.', 'Traditional flaky laminated pastry freshly baked each morning with pure butter.', 2.50, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80', TRUE, TRUE)
    `, [negocioId, catPanId]);

    // Producto 4: Cold Brew Nitro
    const [resProd4] = await conexion.query(`
      INSERT INTO productos (negocio_id, categoria_id, nombre_es, nombre_en, descripcion_es, descripcion_en, precio, imagen_url, disponible, activo)
      VALUES (?, ?, 'Cold Brew Nitro', 'Nitro Cold Brew', 'Extracción en frío durante 18 horas infusionada con nitrógeno para cuerpo aterciopelado.', '18-hour cold steeped coffee infused with nitrogen for a creamy velvet body.', 4.50, 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80', TRUE, TRUE)
    `, [negocioId, catFriasId]);
    const prod4Id = resProd4.insertId;
    await conexion.query(`INSERT INTO producto_grupos (negocio_id, producto_id, grupo_id, orden) VALUES (?, ?, ?, 1)`, [negocioId, prod4Id, grupoDulzorId]);
    await conexion.query(`INSERT INTO producto_grupos (negocio_id, producto_id, grupo_id, orden) VALUES (?, ?, ?, 2)`, [negocioId, prod4Id, grupoExtrasId]);

    await conexion.commit();
    console.log('✅ Semillas de menú iniciales insertadas con éxito.');
  } catch (error) {
    await conexion.rollback();
    console.error('❌ Error al sembrar menú:', error);
    throw error;
  } finally {
    conexion.release();
  }
}

if (process.argv[1]?.endsWith('sembrarMenu.js')) {
  sembrarMenu(1)
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
