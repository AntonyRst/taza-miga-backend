import pool from '../db.js';

/**
 * Siembra el negocio base, las sucursales iniciales y el catálogo limpio
 * de 14 productos con sus 4 categorías, 4 grupos de opciones y modificadores
 * (HU-09, HU-10).
 */
export async function sembrarMenu(negocioId = 1) {
  const conexion = await pool.getConnection();

  try {
    await conexion.beginTransaction();

    // 1. Negocio base (Taza & Miga)
    await conexion.query(
      `INSERT INTO negocios (id, nombre, slug)
       VALUES (?, 'Taza & Miga', 'taza-miga')
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), slug = VALUES(slug)`,
      [negocioId]
    );

    // 2. Sucursales iniciales activas
    const sucursalesIniciales = [
      {
        id: 1,
        nombre: 'Casa Central',
        direccion: 'Av. Las Palmas #102, Col. San Benito, San Salvador',
        latitud: 13.6929403,
        longitud: -89.2385101,
        telefono: '2222-3333',
        cantidadMesas: 12
      },
      {
        id: 2,
        nombre: 'Sucursal Escalón',
        direccion: 'Paseo General Escalón #3500, San Salvador',
        latitud: 13.7025800,
        longitud: -89.2435000,
        telefono: '2222-5555',
        cantidadMesas: 8
      }
    ];

    for (const suc of sucursalesIniciales) {
      await conexion.query(
        `INSERT INTO sucursales (id, negocio_id, nombre, direccion, latitud, longitud, telefono, cantidad_mesas, activa)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
           nombre = VALUES(nombre),
           direccion = VALUES(direccion),
           latitud = VALUES(latitud),
           longitud = VALUES(longitud),
           telefono = VALUES(telefono),
           cantidad_mesas = VALUES(cantidad_mesas),
           activa = TRUE`,
        [suc.id, negocioId, suc.nombre, suc.direccion, suc.latitud, suc.longitud, suc.telefono, suc.cantidadMesas]
      );
    }

    // 3. Grupos de opciones (HU-10)
    const gruposDatos = [
      { id: 1, es: 'Tipo de leche', en: 'Milk type', tipo: 'UNICA', obligatorio: true },
      { id: 2, es: 'Nivel de dulzor', en: 'Sweetness level', tipo: 'UNICA', obligatorio: false },
      { id: 3, es: 'Extras', en: 'Add-ons', tipo: 'MULTIPLE', obligatorio: false },
      { id: 4, es: 'Temperatura', en: 'Temperature', tipo: 'UNICA', obligatorio: false }
    ];

    for (const g of gruposDatos) {
      await conexion.query(
        `INSERT INTO grupos_opciones (id, negocio_id, nombre_es, nombre_en, tipo_seleccion, obligatorio, activo)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
           nombre_es = VALUES(nombre_es),
           nombre_en = VALUES(nombre_en),
           tipo_seleccion = VALUES(tipo_seleccion),
           obligatorio = VALUES(obligatorio),
           activo = TRUE`,
        [g.id, negocioId, g.es, g.en, g.tipo, g.obligatorio]
      );
    }

    // 4. Opciones de cada grupo
    const opcionesDatos = [
      // Grupo 1: Tipo de leche
      { id: 1, grupoId: 1, es: 'Entera', en: 'Whole milk', extra: 0.00, pred: true },
      { id: 2, grupoId: 1, es: 'Deslactosada', en: 'Lactose free', extra: 0.00, pred: false },
      { id: 3, grupoId: 1, es: 'Avena', en: 'Oat milk', extra: 0.60, pred: false },
      { id: 4, grupoId: 1, es: 'Almendra', en: 'Almond milk', extra: 0.60, pred: false },
      // Grupo 2: Nivel de dulzor
      { id: 5, grupoId: 2, es: '0% (Sin azúcar)', en: '0% (No sugar)', extra: 0.00, pred: true },
      { id: 6, grupoId: 2, es: '25% (Poco dulce)', en: '25% (Light)', extra: 0.00, pred: false },
      { id: 7, grupoId: 2, es: '50% (Medio)', en: '50% (Medium)', extra: 0.00, pred: false },
      { id: 8, grupoId: 2, es: '100% (Normal)', en: '100% (Standard)', extra: 0.00, pred: false },
      // Grupo 3: Extras
      { id: 9, grupoId: 3, es: 'Shot extra de espresso', en: 'Extra espresso shot', extra: 0.80, pred: false },
      { id: 10, grupoId: 3, es: 'Jarabe de vainilla artesanal', en: 'Artisanal vanilla syrup', extra: 0.50, pred: false },
      { id: 11, grupoId: 3, es: 'Jarabe de caramelo', en: 'Caramel syrup', extra: 0.50, pred: false },
      { id: 12, grupoId: 3, es: 'Crema batida', en: 'Whipped cream', extra: 0.50, pred: false },
      // Grupo 4: Temperatura
      { id: 13, grupoId: 4, es: 'Caliente', en: 'Hot', extra: 0.00, pred: true },
      { id: 14, grupoId: 4, es: 'Con hielo (Iced)', en: 'Iced', extra: 0.25, pred: false }
    ];

    for (const op of opcionesDatos) {
      await conexion.query(
        `INSERT INTO opciones (id, negocio_id, grupo_id, nombre_es, nombre_en, precio_extra, es_predeterminada, activa)
         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
           nombre_es = VALUES(nombre_es),
           nombre_en = VALUES(nombre_en),
           precio_extra = VALUES(precio_extra),
           es_predeterminada = VALUES(es_predeterminada),
           activa = TRUE`,
        [op.id, negocioId, op.grupoId, op.es, op.en, op.extra, op.pred]
      );
    }

    // 5. Categorías (HU-09)
    const categoriasDatos = [
      { id: 1, es: 'Café de Especialidad', en: 'Specialty Coffee', orden: 1 },
      { id: 2, es: 'Bebidas Frías', en: 'Cold Beverages', orden: 2 },
      { id: 3, es: 'Repostería Artesanal', en: 'Bakery & Pastry', orden: 3 },
      { id: 4, es: 'Desayunos Ligeros', en: 'Light Breakfast', orden: 4 }
    ];

    for (const cat of categoriasDatos) {
      await conexion.query(
        `INSERT INTO categorias (id, negocio_id, nombre_es, nombre_en, orden, activa)
         VALUES (?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
           nombre_es = VALUES(nombre_es),
           nombre_en = VALUES(nombre_en),
           orden = VALUES(orden),
           activa = TRUE`,
        [cat.id, negocioId, cat.es, cat.en, cat.orden]
      );
    }

    // 6. Catálogo de 14 productos con sus modificadores (HU-09)
    const productosDatos = [
      {
        id: 1,
        categoriaId: 1,
        es: 'Latte de la Casa',
        en: 'House Latte',
        descEs: 'Espresso doble con leche cremada al punto sedoso.',
        descEn: 'Double espresso with perfectly textured steamed milk.',
        precio: 4.25,
        img: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=600&q=80',
        grupos: [1, 2, 3, 4]
      },
      {
        id: 2,
        categoriaId: 1,
        es: 'Capuchino Clásico',
        en: 'Classic Cappuccino',
        descEs: 'Equilibrio perfecto de espresso, leche vaporizada y abundante espuma densa.',
        descEn: 'Equal parts rich espresso, steamed milk, and velvety microfoam.',
        precio: 3.75,
        img: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80',
        grupos: [1, 2, 3]
      },
      {
        id: 3,
        categoriaId: 1,
        es: 'Americano Artesanal',
        en: 'Artisanal Americano',
        descEs: 'Extracción doble de espresso diluido en agua caliente a 92°C preservando sus notas aromáticas.',
        descEn: 'Double espresso shot combined with hot water preserving floral and nutty notes.',
        precio: 2.75,
        img: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
        grupos: [3, 4]
      },
      {
        id: 4,
        categoriaId: 1,
        es: 'Espresso Doble',
        en: 'Double Espresso',
        descEs: 'Concentrado intenso de 60 ml con crema avellana persistente y acidez balanceada.',
        descEn: 'Rich 60ml concentrated shot with persistent hazelnut crema and vibrant acidity.',
        precio: 3.00,
        img: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80',
        grupos: []
      },
      {
        id: 5,
        categoriaId: 1,
        es: 'Flat White Especial',
        en: 'Specialty Flat White',
        descEs: 'Doble ristretto con fina capa de microespuma aterciopelada.',
        descEn: 'Double ristretto shot finished with velvety, glossy microfoam.',
        precio: 4.50,
        img: 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80',
        grupos: [1, 2, 3]
      },
      {
        id: 6,
        categoriaId: 2,
        es: 'Cold Brew Nitro',
        en: 'Nitro Cold Brew',
        descEs: 'Café infusionado en frío durante 18 horas e inyectado con nitrógeno puro.',
        descEn: '18-hour slow cold steep infused with nitrogen for a velvety cascade and rich head.',
        precio: 4.50,
        img: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80',
        grupos: [2, 3]
      },
      {
        id: 7,
        categoriaId: 2,
        es: 'Iced Caramel Macchiato',
        en: 'Iced Caramel Macchiato',
        descEs: 'Leche fría con vainilla, hielo, espresso flotante y rejilla de caramelo artesanal.',
        descEn: 'Chilled milk vanilla blend topped with espresso float and artisan caramel drizzle.',
        precio: 4.75,
        img: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80',
        grupos: [1, 3]
      },
      {
        id: 8,
        categoriaId: 2,
        es: 'Té Matcha Japonés Frío',
        en: 'Iced Japanese Matcha Latte',
        descEs: 'Matcha ceremonial Uji batido con leche fría y un toque ligero de miel.',
        descEn: 'Ceremonial grade Uji matcha whisked with cold milk and subtle wildflower honey.',
        precio: 4.25,
        img: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80',
        grupos: [1, 2, 3]
      },
      {
        id: 9,
        categoriaId: 2,
        es: 'Limonada de Menta y Jengibre',
        en: 'Mint & Ginger Lemonade',
        descEs: 'Limón persa fresco, menta machacada, extracto de jengibre y agua con gas.',
        descEn: 'Fresh pressed lime, muddled garden mint, cold ginger extract, and sparkling soda.',
        precio: 3.25,
        img: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
        grupos: [2]
      },
      {
        id: 10,
        categoriaId: 3,
        es: 'Croissant de Mantequilla',
        en: 'Butter Croissant',
        descEs: 'Hojaldre artesanal con mantequilla francesa, horneado fresco cada mañana.',
        descEn: 'Hand-laminated flaky pastry made with cultured French butter, baked fresh daily.',
        precio: 2.50,
        img: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
        grupos: []
      },
      {
        id: 11,
        categoriaId: 3,
        es: 'Muffin de Arándanos Silvestres',
        en: 'Wild Blueberry Muffin',
        descEs: 'Bizcocho húmedo con arándanos frescos enteros y cubierta crujiente de azúcar morena.',
        descEn: 'Tender crumb muffin bursting with wild blueberries and brown sugar streusel top.',
        precio: 2.25,
        img: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=600&q=80',
        grupos: []
      },
      {
        id: 12,
        categoriaId: 3,
        es: 'Rol de Canela Glaseado',
        en: 'Glazed Cinnamon Roll',
        descEs: 'Masa suave enrollada con canela de Ceilán y cubierta con glaseado cremoso de queso.',
        descEn: 'Soft swirled dough filled with aromatic Ceylon cinnamon and creamy cream-cheese glaze.',
        precio: 2.85,
        img: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?auto=format&fit=crop&w=600&q=80',
        grupos: []
      },
      {
        id: 13,
        categoriaId: 4,
        es: 'Tostada de Aguacate y Huevo Poché',
        en: 'Avocado Toast with Poached Egg',
        descEs: 'Pan rústico de masa madre con aguacate hass machacado, huevo poché y semillas tostadas.',
        descEn: 'Sourdough toast with smashed Hass avocado, farm poached egg, and toasted seeds.',
        precio: 5.50,
        img: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
        grupos: []
      },
      {
        id: 14,
        categoriaId: 4,
        es: 'Panini de Jamón Serrano y Gouda',
        en: 'Prosciutto & Gouda Panini',
        descEs: 'Pan ciabatta a la plancha con jamón curado, queso gouda fundido, arúgula y alioli.',
        descEn: 'Pressed ciabatta with cured prosciutto, melted gouda, fresh arugula, and light aioli.',
        precio: 5.75,
        img: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
        grupos: []
      }
    ];

    for (const prod of productosDatos) {
      await conexion.query(
        `INSERT INTO productos (id, negocio_id, categoria_id, nombre_es, nombre_en, descripcion_es, descripcion_en, precio, imagen_url, disponible, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE)
         ON DUPLICATE KEY UPDATE
           categoria_id = VALUES(categoria_id),
           nombre_es = VALUES(nombre_es),
           nombre_en = VALUES(nombre_en),
           descripcion_es = VALUES(descripcion_es),
           descripcion_en = VALUES(descripcion_en),
           precio = VALUES(precio),
           imagen_url = VALUES(imagen_url),
           disponible = TRUE,
           activo = TRUE`,
        [prod.id, negocioId, prod.categoriaId, prod.es, prod.en, prod.descEs, prod.descEn, prod.precio, prod.img]
      );

      let ordenGrupo = 1;
      for (const grupoId of prod.grupos) {
        await conexion.query(
          `INSERT INTO producto_grupos (negocio_id, producto_id, grupo_id, orden)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE orden = VALUES(orden)`,
          [negocioId, prod.id, grupoId, ordenGrupo++]
        );
      }
    }

    await conexion.commit();
    console.log('✅ Semillas de menú iniciales insertadas con éxito:');
    console.log('   - 1 Negocio base: Taza & Miga (slug: taza-miga)');
    console.log('   - 2 Sucursales iniciales: Casa Central y Sucursal Escalón');
    console.log('   - 4 Categorías, 4 Grupos de opciones y 14 Opciones');
    console.log('   - 14 Productos con sus modificadores asignados');
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
