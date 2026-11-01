-- Datos iniciales del menú (HU-09, HU-10)
-- Grupos de opciones requeridos: Tipo de leche, Nivel de dulzor y Extras

-- 1. Grupos de opciones
INSERT INTO grupos_opciones (id, negocio_id, nombre_es, nombre_en, tipo_seleccion, obligatorio, activo)
VALUES 
  (1, 1, 'Tipo de leche', 'Milk type', 'UNICA', TRUE, TRUE),
  (2, 1, 'Nivel de dulzor', 'Sweetness level', 'UNICA', FALSE, TRUE),
  (3, 1, 'Extras', 'Add-ons', 'MULTIPLE', FALSE, TRUE)
ON DUPLICATE KEY UPDATE nombre_es = VALUES(nombre_es);

-- 2. Opciones
INSERT INTO opciones (negocio_id, grupo_id, nombre_es, nombre_en, precio_extra, es_predeterminada, activa)
VALUES
  (1, 1, 'Entera', 'Whole milk', 0.00, TRUE, TRUE),
  (1, 1, 'Deslactosada', 'Lactose free', 0.00, FALSE, TRUE),
  (1, 1, 'Avena', 'Oat milk', 0.60, FALSE, TRUE),
  (1, 1, 'Almendra', 'Almond milk', 0.60, FALSE, TRUE),
  (1, 2, '0% (Sin azúcar)', '0% (No sugar)', 0.00, TRUE, TRUE),
  (1, 2, '25% (Poco dulce)', '25% (Light)', 0.00, FALSE, TRUE),
  (1, 2, '50% (Medio)', '50% (Medium)', 0.00, FALSE, TRUE),
  (1, 2, '100% (Normal)', '100% (Standard)', 0.00, FALSE, TRUE),
  (1, 3, 'Shot extra de espresso', 'Extra espresso shot', 0.80, FALSE, TRUE),
  (1, 3, 'Jarabe de vainilla artesanal', 'Artisanal vanilla syrup', 0.50, FALSE, TRUE),
  (1, 3, 'Crema batida', 'Whipped cream', 0.50, FALSE, TRUE);

-- 3. Categorías
INSERT INTO categorias (id, negocio_id, nombre_es, nombre_en, orden, activa)
VALUES
  (1, 1, 'Café de Especialidad', 'Specialty Coffee', 1, TRUE),
  (2, 1, 'Repostería Artesanal', 'Bakery & Pastry', 2, TRUE),
  (3, 1, 'Bebidas Frías', 'Cold Beverages', 3, TRUE)
ON DUPLICATE KEY UPDATE nombre_es = VALUES(nombre_es);

-- 4. Productos
INSERT INTO productos (id, negocio_id, categoria_id, nombre_es, nombre_en, descripcion_es, descripcion_en, precio, imagen_url, disponible, activo)
VALUES
  (1, 1, 1, 'Latte de la Casa', 'House Latte', 'Espresso doble con leche cremada al punto sedoso.', 'Double espresso with perfectly steamed textured milk.', 4.25, 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=600&q=80', TRUE, TRUE),
  (2, 1, 1, 'Capuchino Clásico', 'Classic Cappuccino', 'Equilibrio perfecto de espresso, leche vaporizada y abundante espuma densa.', 'Equal parts of rich espresso, steamed milk, and airy microfoam.', 3.75, 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80', TRUE, TRUE),
  (3, 1, 2, 'Croissant de Mantequilla', 'Butter Croissant', 'Hojaldre tradicional horneado cada mañana con pura mantequilla.', 'Traditional flaky laminated pastry freshly baked each morning with pure butter.', 2.50, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80', TRUE, TRUE),
  (4, 1, 3, 'Cold Brew Nitro', 'Nitro Cold Brew', 'Extracción en frío durante 18 horas infusionada con nitrógeno para cuerpo aterciopelado.', '18-hour cold steeped coffee infused with nitrogen for a creamy velvet body.', 4.50, 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80', TRUE, TRUE)
ON DUPLICATE KEY UPDATE nombre_es = VALUES(nombre_es);

-- 5. Asignación de grupos a productos
INSERT INTO producto_grupos (negocio_id, producto_id, grupo_id, orden)
VALUES
  (1, 1, 1, 1),
  (1, 1, 2, 2),
  (1, 1, 3, 3),
  (1, 2, 1, 1),
  (1, 2, 2, 2),
  (1, 4, 2, 1),
  (1, 4, 3, 2)
ON DUPLICATE KEY UPDATE orden = VALUES(orden);
