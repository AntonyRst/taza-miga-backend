CREATE TABLE IF NOT EXISTS detalle_orden_opciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id INT NOT NULL,
  detalle_id INT NOT NULL,
  opcion_id INT NOT NULL,
  nombre_grupo VARCHAR(80) NOT NULL,
  nombre_opcion VARCHAR(80) NOT NULL,
  precio_extra DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_detalle_opciones_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id),
  CONSTRAINT fk_detalle_opciones_detalle FOREIGN KEY (detalle_id) REFERENCES detalles_orden(id) ON DELETE CASCADE,
  CONSTRAINT fk_detalle_opciones_opcion FOREIGN KEY (opcion_id) REFERENCES opciones(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
