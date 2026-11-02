CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id INT NOT NULL,
  orden_id INT NOT NULL,
  contenido TEXT NOT NULL,
  generado_por INT NULL,
  reimpresiones INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tickets_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id),
  CONSTRAINT fk_tickets_orden FOREIGN KEY (orden_id) REFERENCES ordenes(id),
  CONSTRAINT fk_tickets_usuario FOREIGN KEY (generado_por) REFERENCES usuarios(id),
  CONSTRAINT uq_tickets_orden UNIQUE (orden_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
