CREATE TABLE IF NOT EXISTS sucursales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  direccion VARCHAR(255) NOT NULL,
  latitud DECIMAL(10,7),
  longitud DECIMAL(10,7),
  telefono VARCHAR(20),
  cantidad_mesas INT NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sucursales_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id),
  CONSTRAINT chk_sucursales_cantidad_mesas CHECK (cantidad_mesas > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
