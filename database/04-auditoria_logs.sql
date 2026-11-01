CREATE TABLE IF NOT EXISTS auditoria_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id INT NOT NULL,
  usuario_id INT NOT NULL,
  accion VARCHAR(50) NOT NULL,
  descripcion VARCHAR(255),
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_auditoria_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
