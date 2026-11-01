-- Semillas de datos para pruebas automatizadas (pruebas.http)
-- Reglas: RN-01, RN-02, RN-03, RN-07, RN-08 y RN-09

-- Segundo negocio para probar aislamiento multinegocio (RN-01)
INSERT INTO negocios (id, nombre, slug)
VALUES (2, 'Café París', 'cafe-paris')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Sucursal del segundo negocio (RN-01)
INSERT INTO sucursales (id, negocio_id, nombre, direccion, telefono, cantidad_mesas, activa)
VALUES (2, 2, 'Sucursal París Centro', 'Boulevard Francia #45', '2222-9999', 8, TRUE)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Contraseñas hasheadas con bcryptjs (cost factor 10):
-- 'PasswordSeguro123' -> $2b$10$NVrURZd4hMvcTusMHy0OPu9CoK0ZnxGYlYmM.MXU3XJ9qMv8Ry9EO
-- 'Barista123'        -> $2b$10$T/Ug11gTV7uDlLqC0fb4ru/o/ph9dgYSehUPoriVRJpzjUqtx9Z6u
-- 'Inactivo123'       -> $2b$10$3ZWH/Cq16HKxX0.wV.4Q8..M1oAmoa9ZvUl4qjAUCaH9mHH5PN0Eq
-- 'Temporal123'       -> $2b$10$EyzDWbKaFgLUDl3By.1O4eIEVM5n3MXgTyVcinWM4lVTbwCiaaSCK
-- 'ParisSeguro123'    -> $2b$10$MOXqSuQYvbVLhIZGeL7NbuuL5Jm7N5zfW.OU./gLli9ckzD9TFg7K

-- 1. Dueño de Taza & Miga (Negocio 1)
INSERT INTO usuarios (negocio_id, sucursal_id, nombre, cargo, telefono, acceso_sistema, correo, password_hash, rol, debe_cambiar_password, activo)
VALUES (1, NULL, 'Dueño Principal', 'Dueño', '7000-0001', TRUE, 'dueno@tazamiga.com', '$2b$10$NVrURZd4hMvcTusMHy0OPu9CoK0ZnxGYlYmM.MXU3XJ9qMv8Ry9EO', 'DUENO', FALSE, TRUE)
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), activo = TRUE, debe_cambiar_password = FALSE;

-- 2. Barista de Taza & Miga (Negocio 1, para RN-03)
INSERT INTO usuarios (negocio_id, sucursal_id, nombre, cargo, telefono, acceso_sistema, correo, password_hash, rol, debe_cambiar_password, activo)
VALUES (1, 1, 'Carlos Barista', 'Barista', '7000-0002', TRUE, 'barista@tazamiga.com', '$2b$10$T/Ug11gTV7uDlLqC0fb4ru/o/ph9dgYSehUPoriVRJpzjUqtx9Z6u', 'BARISTA', FALSE, TRUE)
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), rol = 'BARISTA', activo = TRUE, debe_cambiar_password = FALSE;

-- 3. Usuario inactivo (Negocio 1, para RN-08)
INSERT INTO usuarios (negocio_id, sucursal_id, nombre, cargo, telefono, acceso_sistema, correo, password_hash, rol, debe_cambiar_password, activo)
VALUES (1, 1, 'Usuario Inactivo', 'Barista', '7000-0003', TRUE, 'inactivo@tazamiga.com', '$2b$10$3ZWH/Cq16HKxX0.wV.4Q8..M1oAmoa9ZvUl4qjAUCaH9mHH5PN0Eq', 'BARISTA', FALSE, FALSE)
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), activo = FALSE;

-- 4. Usuario con contraseña temporal (Negocio 1, para RN-09)
INSERT INTO usuarios (negocio_id, sucursal_id, nombre, cargo, telefono, acceso_sistema, correo, password_hash, rol, debe_cambiar_password, activo)
VALUES (1, 1, 'Usuario Temporal', 'Barista', '7000-0004', TRUE, 'temporal@tazamiga.com', '$2b$10$EyzDWbKaFgLUDl3By.1O4eIEVM5n3MXgTyVcinWM4lVTbwCiaaSCK', 'BARISTA', TRUE, TRUE)
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), activo = TRUE, debe_cambiar_password = TRUE;

-- 5. Dueño de Café París (Negocio 2, para RN-01)
INSERT INTO usuarios (negocio_id, sucursal_id, nombre, cargo, telefono, acceso_sistema, correo, password_hash, rol, debe_cambiar_password, activo)
VALUES (2, NULL, 'Dueño Café París', 'Dueño', '7000-0005', TRUE, 'dueno@cafeparis.com', '$2b$10$MOXqSuQYvbVLhIZGeL7NbuuL5Jm7N5zfW.OU./gLli9ckzD9TFg7K', 'DUENO', FALSE, TRUE)
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), activo = TRUE;
