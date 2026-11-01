CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id INT NOT NULL,
  sucursal_id INT,
  nombre VARCHAR(100) NOT NULL,
  cargo VARCHAR(50) NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  acceso_sistema BOOLEAN NOT NULL DEFAULT FALSE,
  correo VARCHAR(120) UNIQUE,
  password_hash VARCHAR(255),
  rol VARCHAR(20) NOT NULL DEFAULT 'SIN_ACCESO',
  debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuarios_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id),
  CONSTRAINT fk_usuarios_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
  CONSTRAINT chk_usuarios_rol CHECK (rol IN ('DUENO', 'GERENTE', 'BARISTA', 'SIN_ACCESO'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
