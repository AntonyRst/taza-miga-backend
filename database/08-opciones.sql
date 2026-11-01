CREATE TABLE IF NOT EXISTS opciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id INT NOT NULL,
  grupo_id INT NOT NULL,
  nombre_es VARCHAR(80) NOT NULL,
  nombre_en VARCHAR(80) NOT NULL,
  precio_extra DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  es_predeterminada BOOLEAN NOT NULL DEFAULT FALSE,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_opciones_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id),
  CONSTRAINT fk_opciones_grupo FOREIGN KEY (grupo_id) REFERENCES grupos_opciones(id),
  CONSTRAINT chk_opciones_precio CHECK (precio_extra >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
