CREATE TABLE IF NOT EXISTS grupos_opciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id INT NOT NULL,
  nombre_es VARCHAR(80) NOT NULL,
  nombre_en VARCHAR(80) NOT NULL,
  tipo_seleccion VARCHAR(10) NOT NULL,
  obligatorio BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_grupos_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id),
  CONSTRAINT chk_grupos_tipo CHECK (tipo_seleccion IN ('UNICA', 'MULTIPLE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
