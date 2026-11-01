CREATE TABLE IF NOT EXISTS producto_grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id INT NOT NULL,
  producto_id INT NOT NULL,
  grupo_id INT NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prodgrupos_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id),
  CONSTRAINT fk_prodgrupos_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  CONSTRAINT fk_prodgrupos_grupo FOREIGN KEY (grupo_id) REFERENCES grupos_opciones(id),
  CONSTRAINT uq_producto_grupo UNIQUE (producto_id, grupo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
