import { execSync } from 'child_process';

/**
 * Script de verificación automatizada para correr y validar todos los casos
 * de pruebas.http contra el servidor local (puerto 3001).
 */
const BASE_URL = 'http://localhost:3001';

async function peticion(ruta, opciones = {}) {
  const url = `${BASE_URL}${ruta}`;
  const { headers, ...restoOpciones } = opciones;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    ...restoOpciones
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

let pruebasPasadas = 0;
let pruebasFallidas = 0;

function asegurar(nombre, condicion, detalle = '') {
  if (condicion) {
    console.log(`  ✅ [PASS] ${nombre}`);
    pruebasPasadas++;
  } else {
    console.error(`  ❌ [FAIL] ${nombre} - ${detalle}`);
    pruebasFallidas++;
  }
}

async function correrPruebas() {
  // Asegurar que las semillas de prueba estén en su estado inicial
  try {
    execSync('node src/scripts/sembrarPruebas.js', { stdio: 'ignore' });
  } catch {}

  console.log('===============================================================');
  console.log('  VERIFICACIÓN COMPLETA DE PRUEBAS DE API (Entrega 1)');
  console.log('===============================================================\n');

  // 1. Salud
  console.log('--- 1. Salud ---');
  const salud = await peticion('/api/salud');
  asegurar('1.1 Salud API 200 OK', salud.status === 200 && salud.data.estado === 'ok');

  // 2. RN-07: Login y contraseñas
  console.log('\n--- 2. RN-07: Autenticación y contraseñas ---');
  const loginDueno = await peticion('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo: 'dueno@tazamiga.com', password: 'PasswordSeguro123' })
  });
  asegurar('2.1 Login Dueño 200 OK', loginDueno.status === 200 && Boolean(loginDueno.data.token));
  const tokenDueno = loginDueno.data?.token;

  const loginPasswordErronea = await peticion('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo: 'dueno@tazamiga.com', password: 'PasswordErronea' })
  });
  asegurar('2.2 Login contraseña errónea 401', loginPasswordErronea.status === 401);

  const loginCorreoInexistente = await peticion('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo: 'noexiste@tazamiga.com', password: 'Cualquiera123' })
  });
  asegurar('2.3 Login correo inexistente 401 y mensaje idéntico',
    loginCorreoInexistente.status === 401 &&
    loginCorreoInexistente.data.error === loginPasswordErronea.data.error
  );

  const loginInvalidoZod = await peticion('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo: 'invalido', password: '' })
  });
  asegurar('2.4 Validación Zod 400 Bad Request', loginInvalidoZod.status === 400);

  // 3. RN-08: Usuario inactivo
  console.log('\n--- 3. RN-08: Usuario inactivo ---');
  const loginInactivo = await peticion('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo: 'inactivo@tazamiga.com', password: 'Inactivo123' })
  });
  asegurar('3.1 Usuario inactivo 401 con mensaje genérico',
    loginInactivo.status === 401 &&
    loginInactivo.data.error === 'Correo o contraseña incorrectos'
  );

  // 4. RN-03: Roles y token
  console.log('\n--- 4. RN-03: Roles y token ---');
  const perfilDueno = await peticion('/api/auth/perfil', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar('4.1 Perfil propio con token 200 OK', perfilDueno.status === 200);

  const perfilSinToken = await peticion('/api/auth/perfil');
  asegurar('4.2 Perfil sin token 401', perfilSinToken.status === 401);

  const adminDueno = await peticion('/api/admin/prueba-acceso', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar('4.3 Admin con rol DUENO 200 OK', adminDueno.status === 200);

  const adminSinToken = await peticion('/api/admin/prueba-acceso');
  asegurar('4.4 Admin sin token 401', adminSinToken.status === 401);

  const loginBarista = await peticion('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo: 'barista@tazamiga.com', password: 'Barista123' })
  });
  asegurar('4.5 Login Barista 200 OK', loginBarista.status === 200);
  const tokenBarista = loginBarista.data?.token;

  const adminBarista = await peticion('/api/admin/prueba-acceso', {
    headers: { Authorization: `Bearer ${tokenBarista}` }
  });
  asegurar('4.6 Barista en admin responde 403 Forbidden', adminBarista.status === 403);

  // 5. RN-09: Contraseña temporal
  console.log('\n--- 5. RN-09: Contraseña temporal ---');
  const loginTemporal = await peticion('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo: 'temporal@tazamiga.com', password: 'Temporal123' })
  });
  asegurar('5.1 Login usuario temporal 200 OK', loginTemporal.status === 200);
  const tokenTemporal = loginTemporal.data?.token;

  const perfilTemporalBloqueado = await peticion('/api/auth/perfil', {
    headers: { Authorization: `Bearer ${tokenTemporal}` }
  });
  asegurar('5.2 Acceso bloqueado con token temporal 403', perfilTemporalBloqueado.status === 403);

  const cambioTemporal = await peticion('/api/auth/cambiar-password', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenTemporal}` },
    body: JSON.stringify({ passwordActual: 'Temporal123', passwordNueva: 'NuevaClaveTemporal456' })
  });
  asegurar('5.3 Cambio de contraseña temporal permitido 200 OK',
    cambioTemporal.status === 200 && Boolean(cambioTemporal.data.token)
  );
  const tokenRenovado = cambioTemporal.data?.token;

  const perfilTemporalDesbloqueado = await peticion('/api/auth/perfil', {
    headers: { Authorization: `Bearer ${tokenRenovado}` }
  });
  asegurar('5.4 Acceso permitido tras cambiar la clave 200 OK', perfilTemporalDesbloqueado.status === 200);

  // 6. HU-03: Validaciones al cambiar contraseña
  console.log('\n--- 6. HU-03: Validaciones de contraseña ---');
  const cambioPassActualErronea = await peticion('/api/auth/cambiar-password', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ passwordActual: 'Erronea123', passwordNueva: 'NuevaPass789' })
  });
  asegurar('6.1 Contraseña actual errónea 400', cambioPassActualErronea.status === 400);

  const cambioPassCorta = await peticion('/api/auth/cambiar-password', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ passwordActual: 'PasswordSeguro123', passwordNueva: 'corta' })
  });
  asegurar('6.2 Contraseña menor a 8 caracteres 400', cambioPassCorta.status === 400);

  const cambioSinToken = await peticion('/api/auth/cambiar-password', {
    method: 'PUT',
    body: JSON.stringify({ passwordActual: '123', passwordNueva: 'NuevaPass789' })
  });
  asegurar('6.3 Cambiar contraseña sin token 401', cambioSinToken.status === 401);

  // 7. RN-01: Aislamiento multinegocio
  console.log('\n--- 7. RN-01: Aislamiento multinegocio ---');
  const loginDuenoNegocio2 = await peticion('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo: 'dueno@cafeparis.com', password: 'ParisSeguro123' })
  });
  asegurar('7.1 Login Dueño Negocio 2 200 OK', loginDuenoNegocio2.status === 200);
  const tokenNegocio2 = loginDuenoNegocio2.data?.token;

  const sucursalAjena = await peticion('/api/admin/sucursales/1', {
    headers: { Authorization: `Bearer ${tokenNegocio2}` }
  });
  asegurar('7.2 Negocio 2 pide registro de Negocio 1 responde 404 Not Found', sucursalAjena.status === 404);

  const sucursalPropia = await peticion('/api/admin/sucursales/1', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar('7.3 Negocio 1 pide su propio registro responde 200 OK',
    sucursalPropia.status === 200 && sucursalPropia.data.id === 1
  );

  // 8. RN-02: Unicidad de correo
  console.log('\n--- 8. RN-02: Unicidad de correo ---');
  const correoDuplicado = await peticion('/api/admin/usuarios', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre: 'Duplicado',
      cargo: 'Barista',
      telefono: '7000-1111',
      correo: 'barista@tazamiga.com',
      password: 'PasswordValida123',
      rol: 'BARISTA',
      sucursalId: 1
    })
  });
  asegurar('8.1 Crear usuario con correo existente responde 409 Conflict', correoDuplicado.status === 409);

  const usuarioNuevo = await peticion('/api/admin/usuarios', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre: 'Barista Nuevo Turno',
      cargo: 'Barista',
      telefono: '7000-2222',
      correo: `nuevo_${Date.now()}@tazamiga.com`,
      password: 'PasswordValida123',
      rol: 'BARISTA',
      sucursalId: 1
    })
  });
  asegurar('8.2 Crear usuario con correo único responde 201 Created', usuarioNuevo.status === 201);

  // 9. HU-09: Categorías
  console.log('\n--- 9. HU-09: Administración de categorías ---');
  const catListar = await peticion('/api/categorias', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar('9.1 Listar categorías 200 OK', catListar.status === 200 && Array.isArray(catListar.data));

  const catCrear = await peticion('/api/categorias', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre_es: 'Tés e Infusiones',
      nombre_en: 'Teas & Herbal Infusions',
      orden: 4,
      activa: true
    })
  });
  asegurar('9.2 Crear categoría 201 Created', catCrear.status === 201 && Boolean(catCrear.data.id));
  const catId = catCrear.data?.id;

  const catEditar = await peticion(`/api/categorias/${catId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ nombre_es: 'Tés Finos', orden: 5 })
  });
  asegurar('9.3 Editar categoría 200 OK', catEditar.status === 200 && catEditar.data.nombreEs === 'Tés Finos');

  const catDesactivarConProd = await peticion('/api/categorias/1/activo', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ activa: false })
  });
  asegurar('9.4 Desactivar categoría con productos activos responde 409 (RN-10)', catDesactivarConProd.status === 409);

  const catDesactivarSinProd = await peticion(`/api/categorias/${catId}/activo`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ activa: false })
  });
  asegurar('9.5 Desactivar categoría sin productos activos 200 OK', catDesactivarSinProd.status === 200);

  // 10. HU-10: Grupos de opciones y opciones
  console.log('\n--- 10. HU-10: Grupos de opciones y opciones ---');
  const gruposListar = await peticion('/api/grupos-opciones', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar('10.1 Listar grupos de opciones 200 OK', gruposListar.status === 200 && Array.isArray(gruposListar.data));

  const grupoCrear = await peticion('/api/grupos-opciones', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre_es: 'Tipo de Tostado',
      nombre_en: 'Roast Profile',
      tipo_seleccion: 'UNICA',
      obligatorio: false
    })
  });
  asegurar('10.2 Crear grupo de opciones 201 Created', grupoCrear.status === 201);
  const grupoId = grupoCrear.data?.id;

  const opcionPrecioNegativo = await peticion(`/api/grupos-opciones/${grupoId}/opciones`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre_es: 'Tueste Medio',
      nombre_en: 'Medium Roast',
      precio_extra: -0.50
    })
  });
  asegurar('10.3 Opción con precio negativo responde 400 (RN-12)', opcionPrecioNegativo.status === 400);

  const opcionCrear = await peticion(`/api/grupos-opciones/${grupoId}/opciones`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre_es: 'Tueste Claro Floral',
      nombre_en: 'Light Floral Roast',
      precio_extra: 0.50,
      es_predeterminada: true
    })
  });
  asegurar('10.4 Crear opción válida 201 Created', opcionCrear.status === 201);
  const opcionId = opcionCrear.data?.id;

  const opcionDesactivar = await peticion(`/api/opciones/${opcionId}/activo`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ activa: false })
  });
  asegurar('10.5 Desactivar opción 200 OK', opcionDesactivar.status === 200);

  // 11. HU-09: Productos
  console.log('\n--- 11. HU-09: Productos ---');
  const prodListar = await peticion('/api/productos', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar('11.1 Listar productos 200 OK', prodListar.status === 200 && Array.isArray(prodListar.data));

  const prodPrecioCero = await peticion('/api/productos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      categoria_id: 1,
      nombre_es: 'Café Gratis',
      nombre_en: 'Free Coffee',
      precio: 0.00
    })
  });
  asegurar('11.2 Crear producto con precio 0 responde 400 (RN-12)', prodPrecioCero.status === 400);

  const prodCrear = await peticion('/api/productos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      categoria_id: 1,
      nombre_es: 'Flat White Especial',
      nombre_en: 'Special Flat White',
      descripcion_es: 'Doble ristretto con leche cremosa.',
      descripcion_en: 'Double ristretto with microtextured milk.',
      precio: 4.00,
      grupos_ids: [1, 2]
    })
  });
  asegurar('11.3 Crear producto con grupos 201 Created', prodCrear.status === 201);
  const prodId = prodCrear.data?.id;

  const prodCambiarPrecio = await peticion(`/api/productos/${prodId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ precio: 4.50 })
  });
  asegurar('11.4 Cambiar precio de producto 200 OK (auditoría RN-27)', prodCambiarPrecio.status === 200 && prodCambiarPrecio.data.precio === 4.5);

  const prodDisponibilidad = await peticion(`/api/productos/${prodId}/disponible`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ disponible: false })
  });
  asegurar('11.5 Marcar producto como agotado/no disponible 200 OK', prodDisponibilidad.status === 200 && prodDisponibilidad.data.disponible === false);

  const prodDesactivar = await peticion(`/api/productos/${prodId}/activo`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ activo: false })
  });
  asegurar('11.6 Desactivar producto 200 OK (RN-10, RN-27)', prodDesactivar.status === 200 && prodDesactivar.data.activo === false);

  // 12. Seguridad y roles (RN-11, RN-01)
  console.log('\n--- 12. Seguridad y permisos en menú ---');
  const baristaCreaCategoria = await peticion('/api/categorias', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenBarista}` },
    body: JSON.stringify({ nombre_es: 'No Permitido', nombre_en: 'Unauthorized' })
  });
  asegurar('12.1 Barista creando categoría responde 403 Forbidden (RN-11)', baristaCreaCategoria.status === 403);

  const baristaEditaProd = await peticion('/api/productos/1', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenBarista}` },
    body: JSON.stringify({ precio: 9.99 })
  });
  asegurar('12.2 Barista modificando producto responde 403 Forbidden (RN-11)', baristaEditaProd.status === 403);

  const negocio2ProdAjeno = await peticion('/api/productos/1', {
    headers: { Authorization: `Bearer ${tokenNegocio2}` }
  });
  asegurar('12.3 Negocio 2 pidiendo producto de Negocio 1 responde 404 Not Found (RN-01)', negocio2ProdAjeno.status === 404);

  // 13. Rutas públicas
  console.log('\n--- 13. Rutas públicas de catálogo ---');
  const menuPublico = await peticion('/api/publico/taza-miga/menu');
  asegurar('13.1 Catálogo público sin token 200 OK', menuPublico.status === 200 && menuPublico.data.productos.length > 0);

  const sucursalesPublicas = await peticion('/api/publico/taza-miga/sucursales');
  asegurar('13.2 Sucursales públicas sin token 200 OK', sucursalesPublicas.status === 200 && sucursalesPublicas.data.length > 0);

  const menuSlugInexistente = await peticion('/api/publico/negocio-falso/menu');
  asegurar('13.3 Catálogo con slug inexistente responde 404 Not Found', menuSlugInexistente.status === 404);

  // 14. Creación de pedidos (HU-11, RN-13 a RN-19, RN-23)
  console.log('\n--- 14. Creación de pedidos (HU-11, RN-13 a RN-19, RN-23) ---');
  const pedidoBarra = await peticion('/api/publico/taza-miga/ordenes', {
    method: 'POST',
    body: JSON.stringify({
      sucursalId: 1,
      nombreCliente: 'Ana Torres',
      tipoEntrega: 'MESA',
      numeroMesa: 2,
      metodoPago: 'BARRA',
      lineas: [
        {
          productoId: 1,
          cantidad: 2,
          notasPersonalizacion: 'Sin azúcar añadida',
          opcionesIds: [1]
        }
      ]
    })
  });
  asegurar(
    '14.1 Crear pedido en MESA con BARRA 201 Created (SIN_PAGAR, RECIBIDO)',
    pedidoBarra.status === 201 &&
    pedidoBarra.data.estado === 'RECIBIDO' &&
    pedidoBarra.data.estadoPago === 'SIN_PAGAR' &&
    Boolean(pedidoBarra.data.codigoSeguimiento)
  );
  const orden1 = pedidoBarra.data;

  const pedidoTarjeta = await peticion('/api/publico/taza-miga/ordenes', {
    method: 'POST',
    body: JSON.stringify({
      sucursalId: 1,
      nombreCliente: 'Roberto Méndez',
      tipoEntrega: 'LLEVAR',
      metodoPago: 'TARJETA_DEMO',
      lineas: [
        {
          productoId: 1,
          cantidad: 1,
          opcionesIds: [3, 5]
        }
      ]
    })
  });
  asegurar(
    '14.2 Crear pedido para LLEVAR con TARJETA_DEMO 201 Created (PAGADO, RN-23)',
    pedidoTarjeta.status === 201 &&
    pedidoTarjeta.data.estadoPago === 'PAGADO'
  );
  const orden2 = pedidoTarjeta.data;

  asegurar(
    '14.3 Números consecutivos por sucursal (#1 y #2) asignados por servidor (RN-19)',
    orden2.numeroOrden === orden1.numeroOrden + 1
  );

  const pedidoTotalManipulado = await peticion('/api/publico/taza-miga/ordenes', {
    method: 'POST',
    body: JSON.stringify({
      sucursalId: 1,
      nombreCliente: 'Cliente Tramposo',
      tipoEntrega: 'MESA',
      numeroMesa: 1,
      metodoPago: 'BARRA',
      total: 0.01,
      lineas: [
        {
          productoId: 1,
          cantidad: 1,
          precioUnitario: 0.01,
          opcionesIds: [1]
        }
      ]
    })
  });
  asegurar(
    '14.4 El servidor recalcula el total real ignorando montos manipulados (RN-15)',
    pedidoTotalManipulado.status === 201 &&
    pedidoTotalManipulado.data.total > 1.00
  );

  const pedidoMesaInvalida = await peticion('/api/publico/taza-miga/ordenes', {
    method: 'POST',
    body: JSON.stringify({
      sucursalId: 1,
      nombreCliente: 'Mesa 99',
      tipoEntrega: 'MESA',
      numeroMesa: 99,
      metodoPago: 'BARRA',
      lineas: [{ productoId: 1, cantidad: 1, opcionesIds: [1] }]
    })
  });
  asegurar('14.5 Mesa fuera de rango de sucursal responde 400 Bad Request (RN-17)', pedidoMesaInvalida.status === 400);

  const pedidoHoraPasada = await peticion('/api/publico/taza-miga/ordenes', {
    method: 'POST',
    body: JSON.stringify({
      sucursalId: 1,
      nombreCliente: 'Hora Pasada',
      tipoEntrega: 'LLEVAR',
      horaRecogida: '2020-01-01T10:00:00Z',
      metodoPago: 'BARRA',
      lineas: [{ productoId: 1, cantidad: 1, opcionesIds: [1] }]
    })
  });
  asegurar('14.6 Hora de recogida en el pasado responde 400 Bad Request (RN-17)', pedidoHoraPasada.status === 400);

  const pedidoSinLineas = await peticion('/api/publico/taza-miga/ordenes', {
    method: 'POST',
    body: JSON.stringify({
      sucursalId: 1,
      nombreCliente: 'Sin Líneas',
      tipoEntrega: 'MESA',
      numeroMesa: 1,
      metodoPago: 'BARRA',
      lineas: []
    })
  });
  asegurar('14.7 Pedido sin líneas responde 400 Bad Request (RN-18)', pedidoSinLineas.status === 400);

  const pedidoMuchosItems = await peticion('/api/publico/taza-miga/ordenes', {
    method: 'POST',
    body: JSON.stringify({
      sucursalId: 1,
      nombreCliente: 'Demasiadas Unidades',
      tipoEntrega: 'MESA',
      numeroMesa: 1,
      metodoPago: 'BARRA',
      lineas: [{ productoId: 1, cantidad: 21, opcionesIds: [1] }]
    })
  });
  asegurar('14.8 Línea con más de 20 unidades responde 400 Bad Request (RN-18)', pedidoMuchosItems.status === 400);

  const pedidoNombreCorto = await peticion('/api/publico/taza-miga/ordenes', {
    method: 'POST',
    body: JSON.stringify({
      sucursalId: 1,
      nombreCliente: 'A',
      tipoEntrega: 'MESA',
      numeroMesa: 1,
      metodoPago: 'BARRA',
      lineas: [{ productoId: 1, cantidad: 1, opcionesIds: [1] }]
    })
  });
  asegurar('14.9 Nombre cliente menor a 2 caracteres responde 400 Bad Request (RN-18)', pedidoNombreCorto.status === 400);

  const pedidoSinObligatorio = await peticion('/api/publico/taza-miga/ordenes', {
    method: 'POST',
    body: JSON.stringify({
      sucursalId: 1,
      nombreCliente: 'Sin Opción Obligatoria',
      tipoEntrega: 'MESA',
      numeroMesa: 1,
      metodoPago: 'BARRA',
      lineas: [{ productoId: 1, cantidad: 1, opcionesIds: [] }]
    })
  });
  asegurar('14.10 Falta de opción en grupo obligatorio responde 400 Bad Request (RN-13)', pedidoSinObligatorio.status === 400);

  // 15. Seguimiento y búsqueda (HU-12, RN-20)
  console.log('\n--- 15. Seguimiento y búsqueda de pedidos (HU-12, RN-20) ---');
  const seguimientoOk = await peticion(`/api/publico/ordenes/seguimiento/${orden1.codigoSeguimiento}`);
  asegurar(
    '15.1 Consulta de seguimiento con código válido 200 OK (copia de precios y opciones RN-16)',
    seguimientoOk.status === 200 &&
    seguimientoOk.data.numeroOrden === orden1.numeroOrden &&
    seguimientoOk.data.detalles.length > 0 &&
    Boolean(seguimientoOk.data.detalles[0].nombreProducto)
  );

  const seguimientoFalso = await peticion('/api/publico/ordenes/seguimiento/00000000-0000-0000-0000-000000000000');
  asegurar('15.2 Consulta con código inexistente responde 404 Not Found (RN-20)', seguimientoFalso.status === 404);

  const busquedaOk = await peticion('/api/publico/taza-miga/ordenes/buscar', {
    method: 'POST',
    body: JSON.stringify({
      numeroOrden: orden1.numeroOrden,
      nombreCliente: 'Ana Torres'
    })
  });
  asegurar(
    '15.3 Búsqueda manual con número y nombre correctos 200 OK (RN-20)',
    busquedaOk.status === 200 &&
    busquedaOk.data.codigoSeguimiento === orden1.codigoSeguimiento
  );

  const busquedaFallida = await peticion('/api/publico/taza-miga/ordenes/buscar', {
    method: 'POST',
    body: JSON.stringify({
      numeroOrden: orden1.numeroOrden,
      nombreCliente: 'Nombre Incorrecto'
    })
  });
  asegurar(
    '15.4 Búsqueda manual con nombre incorrecto responde 404 "No encontramos ese pedido" sin pistas (RN-20)',
    busquedaFallida.status === 404 &&
    busquedaFallida.data.error === 'No encontramos ese pedido'
  );

  // 16. KDS, estados, pagos, cancelaciones y tickets (HU-13 a HU-17)
  console.log('\n--- 16. Panel KDS, estados, pagos, cancelaciones y tickets (HU-13 a HU-17) ---');

  const loginBarista2 = await peticion('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo: 'barista2@cafeparis.com', password: 'Barista123' })
  });
  const tokenBarista2 = loginBarista2.data?.token;

  // 16.1 Listar pedidos activos KDS
  const kdsOk = await peticion('/api/kds/pedidos', {
    headers: { Authorization: `Bearer ${tokenBarista}` }
  });
  asegurar(
    '16.1 Barista lista pedidos activos de su sucursal 200 OK (HU-13)',
    kdsOk.status === 200 && Array.isArray(kdsOk.data.ordenes) && kdsOk.data.ordenes.length > 0
  );

  // 16.2 KDS sin token responde 401
  const kdsSinToken = await peticion('/api/kds/pedidos');
  asegurar('16.2 Acceso a KDS sin autenticación responde 401 (RN-03)', kdsSinToken.status === 401);

  // 16.3 Barista de Sucursal 2 no ve pedidos de Sucursal 1 (RN-04)
  const kdsSucursal2 = await peticion('/api/kds/pedidos', {
    headers: { Authorization: `Bearer ${tokenBarista2}` }
  });
  asegurar(
    '16.3 Barista de Sucursal 2 tiene aislamiento y no ve pedidos de Sucursal 1 (RN-04)',
    kdsSucursal2.status === 200 && kdsSucursal2.data.ordenes.length === 0
  );

  // 16.4 Avanzar estado RECIBIDO -> PREPARACION
  const avanzarPreparacion = await peticion(`/api/kds/pedidos/${orden1.id}/estado`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenBarista}` },
    body: JSON.stringify({ estado: 'PREPARACION' })
  });
  asegurar(
    '16.4 Avanzar de RECIBIDO a PREPARACION 200 OK (HU-14, RN-21)',
    avanzarPreparacion.status === 200 && avanzarPreparacion.data.nuevoEstado === 'PREPARACION'
  );

  // 16.5 Retroceso no permitido PREPARACION -> RECIBIDO
  const retrocesoInvalido = await peticion(`/api/kds/pedidos/${orden1.id}/estado`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenBarista}` },
    body: JSON.stringify({ estado: 'RECIBIDO' })
  });
  asegurar('16.5 Retroceder estado responde 409 Conflict (RN-21)', retrocesoInvalido.status === 409);

  // 16.6 Salto no permitido PREPARACION -> ENTREGADO
  const saltoInvalido = await peticion(`/api/kds/pedidos/${orden1.id}/estado`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenBarista}` },
    body: JSON.stringify({ estado: 'ENTREGADO' })
  });
  asegurar('16.6 Saltar estado sin pasar por LISTO responde 409 Conflict (RN-21)', saltoInvalido.status === 409);

  // 16.7 Avanzar PREPARACION -> LISTO
  const avanzarListo = await peticion(`/api/kds/pedidos/${orden1.id}/estado`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenBarista}` },
    body: JSON.stringify({ estado: 'LISTO' })
  });
  asegurar(
    '16.7 Avanzar de PREPARACION a LISTO 200 OK (RN-21)',
    avanzarListo.status === 200 && avanzarListo.data.nuevoEstado === 'LISTO'
  );

  // 16.8 Cancelar pedido en LISTO no permitido
  const cancelarListo = await peticion(`/api/kds/pedidos/${orden1.id}/cancelar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenBarista}` },
    body: JSON.stringify({ motivo: 'Intentando cancelar en LISTO' })
  });
  asegurar('16.8 Cancelar pedido en estado LISTO responde 409 Conflict (RN-22)', cancelarListo.status === 409);

  // 16.9 Entregar pedido SIN_PAGAR responde 409 (RN-23)
  const entregarSinPagar = await peticion(`/api/kds/pedidos/${orden1.id}/estado`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenBarista}` },
    body: JSON.stringify({ estado: 'ENTREGADO' })
  });
  asegurar('16.9 Entregar pedido sin haber registrado pago responde 409 Conflict (RN-23)', entregarSinPagar.status === 409);

  // 16.10 Registrar pago en barra
  const registrarPago = await peticion(`/api/kds/pedidos/${orden1.id}/pago`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenBarista}` }
  });
  asegurar(
    '16.10 Registrar pago en barra pasa a PAGADO 200 OK (HU-15, RN-23)',
    registrarPago.status === 200 && registrarPago.data.estadoPago === 'PAGADO'
  );

  // 16.11 Registrar pago ya pagado responde 409
  const reintentarPago = await peticion(`/api/kds/pedidos/${orden1.id}/pago`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenBarista}` }
  });
  asegurar('16.11 Intentar cobrar pedido ya pagado responde 409 Conflict (RN-23)', reintentarPago.status === 409);

  // 16.12 Entregar pedido LISTO y PAGADO: genera ticket atómico (RN-24)
  const entregaOk = await peticion(`/api/kds/pedidos/${orden1.id}/estado`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenBarista}` },
    body: JSON.stringify({ estado: 'ENTREGADO' })
  });
  asegurar(
    '16.12 Entregar pedido genera ticket en misma transacción 200 OK (HU-14, HU-17, RN-24)',
    entregaOk.status === 200 &&
    entregaOk.data.nuevoEstado === 'ENTREGADO' &&
    Boolean(entregaOk.data.ticket?.contenido)
  );

  // 16.13 Alterar estado de ENTREGADO responde 409
  const alterarEntregado = await peticion(`/api/kds/pedidos/${orden1.id}/estado`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenBarista}` },
    body: JSON.stringify({ estado: 'LISTO' })
  });
  asegurar('16.13 Cambiar estado de un pedido ya finalizado responde 409 Conflict (RN-21)', alterarEntregado.status === 409);

  // 16.14 Consultar ticket despachado
  const ticketConsulta = await peticion(`/api/kds/pedidos/${orden1.id}/ticket`, {
    headers: { Authorization: `Bearer ${tokenBarista}` }
  });
  asegurar(
    '16.14 Consultar ticket guardado del pedido 200 OK (HU-17)',
    ticketConsulta.status === 200 &&
    ticketConsulta.data.contenido.includes(`PEDIDO: #${orden1.numeroOrden}`) &&
    ticketConsulta.data.reimpresiones === 0
  );

  // 16.15 Reimprimir ticket incrementa reimpresiones
  const reimprimir = await peticion(`/api/kds/pedidos/${orden1.id}/ticket/reimprimir`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenBarista}` }
  });
  asegurar(
    '16.15 Reimprimir ticket suma 1 a contador de reimpresiones 200 OK (RN-24)',
    reimprimir.status === 200 && reimprimir.data.reimpresiones === 1
  );

  // 16.16 Cancelación: crear orden para probar
  const ordenCancelarRes = await peticion('/api/publico/taza-miga/ordenes', {
    method: 'POST',
    body: JSON.stringify({
      sucursalId: 1,
      nombreCliente: 'Cliente Para Cancelar',
      tipoEntrega: 'MESA',
      numeroMesa: 3,
      metodoPago: 'BARRA',
      lineas: [{ productoId: 1, cantidad: 1, opcionesIds: [1] }]
    })
  });
  const idOrdenCancelar = ordenCancelarRes.data?.id;

  // 16.17 Cancelar sin motivo responde 400
  const cancelarSinMotivo = await peticion(`/api/kds/pedidos/${idOrdenCancelar}/cancelar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenBarista}` },
    body: JSON.stringify({ motivo: '' })
  });
  asegurar('16.17 Cancelar pedido sin motivo responde 400 Bad Request (RN-22)', cancelarSinMotivo.status === 400);

  // 16.18 Cancelar con motivo válido desde RECIBIDO
  const cancelarConMotivo = await peticion(`/api/kds/pedidos/${idOrdenCancelar}/cancelar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenBarista}` },
    body: JSON.stringify({ motivo: 'Cliente tuvo que retirarse de urgencia' })
  });
  asegurar(
    '16.18 Cancelar pedido con motivo 200 OK y log en auditoría (HU-16, RN-22, RN-27)',
    cancelarConMotivo.status === 200 && cancelarConMotivo.data.estado === 'CANCELADO'
  );

  // 16.19 Barista de otra sucursal intentando operar pedido ajeno responde 404
  const ataqueSucursal = await peticion(`/api/kds/pedidos/${orden1.id}/cancelar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenBarista2}` },
    body: JSON.stringify({ motivo: 'Ataque entre sucursales' })
  });
  asegurar('16.19 Barista de otra sucursal no puede modificar pedido ajeno 404 (RN-04)', ataqueSucursal.status === 404);

  // 17. Administración del personal (HU-18, RN-02, RN-04, RN-06, RN-07, RN-08, RN-10, RN-26, RN-27)
  console.log('\n--- 17. Administración del personal (HU-18, RN-02, RN-04, RN-06, RN-07, RN-08, RN-10, RN-26, RN-27) ---');

  const loginGerente = await peticion('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo: 'gerente@tazamiga.com', password: 'Gerente123' })
  });
  const tokenGerente = loginGerente.data?.token;

  // 17.1 Listar todo el personal como Dueño
  const personalDueno = await peticion('/api/admin/personal', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar(
    '17.1 Listar todo el personal como Dueño 200 OK (HU-18)',
    personalDueno.status === 200 && Array.isArray(personalDueno.data) && personalDueno.data.length > 0
  );

  // 17.2 Listar personal filtrado por sucursal y cargo
  const personalFiltrado = await peticion('/api/admin/personal?sucursalId=1&cargo=Barista', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar(
    '17.2 Listar personal con filtros de sucursal y cargo 200 OK (HU-18)',
    personalFiltrado.status === 200 &&
    Array.isArray(personalFiltrado.data) &&
    personalFiltrado.data.every(p => p.sucursalId === 1 && p.cargo.toLowerCase() === 'barista')
  );

  // 17.3 Gerente consulta personal: solo ve los de su propia sucursal (RN-04)
  const personalGerente = await peticion('/api/admin/personal', {
    headers: { Authorization: `Bearer ${tokenGerente}` }
  });
  asegurar(
    '17.3 Gerente solo ve personal de su propia sucursal 200 OK (RN-04)',
    personalGerente.status === 200 &&
    Array.isArray(personalGerente.data) &&
    personalGerente.data.every(p => p.sucursalId === 1)
  );

  // 17.4 Crear personal sin acceso al sistema (Mesero) (201 Created)
  const timestampEmp = Date.now();
  const crearSinAcceso = await peticion('/api/admin/personal', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre: `Mario Mesero ${timestampEmp}`,
      cargo: 'Mesero',
      telefono: '7111-2222',
      sucursalId: 1,
      accesoSistema: false
    })
  });
  asegurar(
    '17.4 Crear personal sin acceso al sistema sin correo ni clave 201 Created (HU-18)',
    crearSinAcceso.status === 201 &&
    crearSinAcceso.data.accesoSistema === false &&
    crearSinAcceso.data.rol === 'SIN_ACCESO'
  );
  const idEmpleadoSinAcceso = crearSinAcceso.data?.id;

  // 17.5 Crear personal con acceso (Barista) con clave temporal (201 Created, RN-02, RN-07, RN-26)
  const crearConAcceso = await peticion('/api/admin/personal', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre: 'Ana Barista Mañana',
      cargo: 'Barista',
      telefono: '7333-4444',
      sucursalId: 1,
      accesoSistema: true,
      correo: `ana_${timestampEmp}@tazamiga.com`,
      password: 'TemporalPassword123',
      rol: 'BARISTA'
    })
  });
  asegurar(
    '17.5 Crear personal con acceso al sistema 201 Created con clave temporal (RN-02, RN-07, RN-26)',
    crearConAcceso.status === 201 &&
    crearConAcceso.data.accesoSistema === true &&
    crearConAcceso.data.debeCambiarPassword === true
  );

  // 17.6 Gerente intenta crear rol GERENTE o DUENO responde 403 Forbidden (RN-06)
  const gerenteCreandoGerente = await peticion('/api/admin/personal', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenGerente}` },
    body: JSON.stringify({
      nombre: 'Intruso Gerente',
      cargo: 'Gerente General',
      telefono: '7555-6666',
      sucursalId: 1,
      accesoSistema: true,
      correo: `intruso_${timestampEmp}@tazamiga.com`,
      password: 'Password123',
      rol: 'GERENTE'
    })
  });
  asegurar(
    '17.6 Gerente intentando crear rol GERENTE responde 403 Forbidden (RN-06)',
    gerenteCreandoGerente.status === 403
  );

  // 17.7 Crear Barista sin sucursal asignada responde 400 Bad Request (RN-26)
  const baristaSinSucursal = await peticion('/api/admin/personal', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre: 'Barista Sin Sede',
      cargo: 'Barista',
      telefono: '7777-8888',
      accesoSistema: true,
      correo: `sinsede_${timestampEmp}@tazamiga.com`,
      password: 'Password123',
      rol: 'BARISTA'
    })
  });
  asegurar(
    '17.7 Crear Barista sin sucursal asignada responde 400 Bad Request (RN-26)',
    baristaSinSucursal.status === 400
  );

  // 17.8 Intentar crear personal con correo duplicado responde 409 Conflict (RN-02)
  const correoPersonalDuplicado = await peticion('/api/admin/personal', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre: 'Duplicado Correo',
      cargo: 'Barista',
      telefono: '7999-0000',
      sucursalId: 1,
      accesoSistema: true,
      correo: 'dueno@tazamiga.com',
      password: 'Password123',
      rol: 'BARISTA'
    })
  });
  asegurar(
    '17.8 Registrar personal con correo existente responde 409 Conflict (RN-02)',
    correoPersonalDuplicado.status === 409
  );

  // 17.9 Editar datos de empleado (200 OK)
  const editarEmpleado = await peticion(`/api/admin/personal/${idEmpleadoSinAcceso}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre: 'Mario Mesero Principal',
      cargo: 'Capitán de Meseros',
      telefono: '7111-9999',
      sucursalId: 1,
      accesoSistema: false
    })
  });
  asegurar(
    '17.9 Editar datos de un empleado 200 OK (HU-18)',
    editarEmpleado.status === 200 &&
    editarEmpleado.data.cargo === 'Capitán de Meseros' &&
    editarEmpleado.data.telefono === '7111-9999'
  );

  // 17.10 Desactivar empleado (200 OK y log en auditoría RN-27)
  const desactivarEmpleado = await peticion(`/api/admin/personal/${idEmpleadoSinAcceso}/activo`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ activo: false })
  });
  asegurar(
    '17.10 Desactivar empleado 200 OK y log en auditoría (HU-18, RN-10, RN-27)',
    desactivarEmpleado.status === 200 && desactivarEmpleado.data.activo === false
  );

  // 17.11 Intentar desactivar al único dueño activo responde 409 Conflict (RN-08, RN-10)
  await peticion('/api/admin/personal/1/activo', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ activo: false })
  });
  const desactivarUltimoDueno = await peticion('/api/admin/personal/2/activo', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ activo: false })
  });
  asegurar(
    '17.11 Intentar desactivar al único dueño activo responde 409 Conflict (RN-08, RN-10)',
    desactivarUltimoDueno.status === 409
  );
  await peticion('/api/admin/personal/1/activo', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ activo: true })
  });

  // 17.12 Barista accediendo a gestión de personal responde 403 Forbidden (RN-03)
  const baristaAccediendoPersonal = await peticion('/api/admin/personal', {
    headers: { Authorization: `Bearer ${tokenBarista}` }
  });
  asegurar(
    '17.12 Barista intentando acceder a gestión de personal responde 403 Forbidden (RN-03)',
    baristaAccediendoPersonal.status === 403
  );

  // 18. Restablecer la contraseña de un compañero (HU-19, RN-07, RN-09, RN-27)
  console.log('\n--- 18. Restablecer la contraseña de un compañero (HU-19, RN-07, RN-09, RN-27) ---');

  // 18.1 Gerente asigna contraseña temporal a Barista de su sucursal (200 OK)
  const resetBaristaOk = await peticion('/api/admin/personal/3/reset-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenGerente}` },
    body: JSON.stringify({ passwordTemporal: 'NuevaClaveTemporal123' })
  });
  asegurar(
    '18.1 Gerente asigna contraseña temporal a Barista de su sucursal 200 OK (HU-19, RN-09)',
    resetBaristaOk.status === 200 && resetBaristaOk.data.debeCambiarPassword === true
  );

  // 18.2 Barista inicia sesión con clave temporal recibiendo debe_cambiar_password = true
  const loginBaristaTemporal = await peticion('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo: 'barista@tazamiga.com', password: 'NuevaClaveTemporal123' })
  });
  const tokenBaristaTemporal = loginBaristaTemporal.data?.token;
  asegurar(
    '18.2 Barista inicia sesión con contraseña temporal 200 OK y marca de cambio forzado (RN-09)',
    loginBaristaTemporal.status === 200 &&
    loginBaristaTemporal.data.usuario.debeCambiarPassword === true &&
    Boolean(tokenBaristaTemporal)
  );

  // 18.3 Token temporal tiene acceso bloqueado a KDS
  const kdsBloqueadoTemporal = await peticion('/api/kds/pedidos', {
    headers: { Authorization: `Bearer ${tokenBaristaTemporal}` }
  });
  asegurar(
    '18.3 Token temporal tiene acceso bloqueado a operaciones 403 Forbidden (RN-09)',
    kdsBloqueadoTemporal.status === 403
  );

  // 18.4 Gerente intenta restablecer a otro Gerente responde 403 Forbidden (RN-09)
  const gerenteResetGerente = await peticion(`/api/admin/personal/${loginGerente.data?.usuario?.id || 126}/reset-password`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenGerente}` },
    body: JSON.stringify({ passwordTemporal: 'OtraTemporal123' })
  });
  asegurar(
    '18.4 Gerente intentando restablecer a otro Gerente responde 403 Forbidden (RN-09)',
    gerenteResetGerente.status === 403
  );

  // 18.5 Nadie puede restablecer la contraseña de un Dueño responde 403 Forbidden (RN-09)
  const resetDuenoProhibido = await peticion('/api/admin/personal/2/reset-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ passwordTemporal: 'DuenoTemporal123' })
  });
  asegurar(
    '18.5 Nadie puede restablecer la contraseña de un Dueño responde 403 Forbidden (RN-09)',
    resetDuenoProhibido.status === 403
  );

  // 18.6 Contraseña temporal menor a 8 caracteres responde 400 Bad Request (RN-07)
  const claveTemporalCorta = await peticion('/api/admin/personal/3/reset-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenGerente}` },
    body: JSON.stringify({ passwordTemporal: '123' })
  });
  asegurar(
    '18.6 Contraseña temporal menor a 8 caracteres responde 400 Bad Request (RN-07)',
    claveTemporalCorta.status === 400
  );

  // 18.7 Restablecer contraseña a personal sin acceso al sistema responde 400 Bad Request
  const resetSinAcceso = await peticion(`/api/admin/personal/${idEmpleadoSinAcceso}/reset-password`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ passwordTemporal: 'SinAccesoClave123' })
  });
  asegurar(
    '18.7 Restablecer clave a personal sin acceso al sistema responde 400 Bad Request',
    resetSinAcceso.status === 400
  );

  // 18.8 Barista intentando restablecer contraseña responde 403 Forbidden (RN-03)
  const baristaResetAtaque = await peticion('/api/admin/personal/3/reset-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenBarista}` },
    body: JSON.stringify({ passwordTemporal: 'AtaqueBarista123' })
  });
  asegurar(
    '18.8 Barista intentando restablecer contraseña de compañero responde 403 Forbidden (RN-03)',
    baristaResetAtaque.status === 403
  );

  // 18.9 Barista cambia su contraseña temporal restaurando Barista123 (200 OK)
  const cambioExitoso = await peticion('/api/auth/cambiar-password', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenBaristaTemporal}` },
    body: JSON.stringify({
      passwordActual: 'NuevaClaveTemporal123',
      passwordNueva: 'Barista123'
    })
  });
  asegurar(
    '18.9 Barista completa cambio obligatorio restaurando su contraseña 200 OK (HU-03, RN-09)',
    cambioExitoso.status === 200 && Boolean(cambioExitoso.data.token)
  );

  // 19. Administración de sucursales (HU-20, RN-01, RN-05, RN-10, RN-25, RN-27)
  console.log('\n--- 19. Administración de sucursales (HU-20, RN-01, RN-05, RN-10, RN-25, RN-27) ---');

  // 19.1 Dueño lista sucursales con personal asignado
  const sucursalesDueno = await peticion('/api/admin/sucursales', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar(
    '19.1 Dueño lista todas las sucursales con contador de personal activo 200 OK (HU-20)',
    sucursalesDueno.status === 200 &&
    Array.isArray(sucursalesDueno.data) &&
    sucursalesDueno.data.length > 0 &&
    typeof sucursalesDueno.data[0].personalAsignado === 'number'
  );

  // 19.2 Dueño crea sucursal con coordenadas GPS
  const timestampSuc = Date.now();
  const crearSucursalGps = await peticion('/api/admin/sucursales', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre: `Sucursal San Benito ${timestampSuc}`,
      direccion: 'Boulevard del Hipódromo #340, San Salvador',
      telefono: '2222-7777',
      cantidadMesas: 15,
      latitud: 13.6892,
      longitud: -89.2435
    })
  });
  asegurar(
    '19.2 Dueño crea sucursal con coordenadas GPS del mapa 201 Created (HU-20, RN-25)',
    crearSucursalGps.status === 201 &&
    crearSucursalGps.data.latitud !== null &&
    crearSucursalGps.data.longitud !== null
  );
  const idSucursalGps = crearSucursalGps.data?.id;

  // 19.3 Dueño crea sucursal manual sin coordenadas GPS
  const crearSucursalManual = await peticion('/api/admin/sucursales', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre: `Sucursal Los Héroes ${timestampSuc}`,
      direccion: 'Paseo General Escalón #120',
      telefono: '2222-8888',
      cantidadMesas: 10
    })
  });
  asegurar(
    '19.3 Dueño crea sucursal manual sin coordenadas GPS 201 Created (HU-20, RN-25)',
    crearSucursalManual.status === 201 &&
    crearSucursalManual.data.latitud === null &&
    crearSucursalManual.data.longitud === null
  );
  const idSucursalManual = crearSucursalManual.data?.id;

  // 19.4 Enviar latitud sin longitud responde 400 Bad Request (RN-25)
  const latitudSinLongitud = await peticion('/api/admin/sucursales', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre: 'Sucursal Incompleta',
      direccion: 'Calle Principal #1',
      cantidadMesas: 5,
      latitud: 13.69
    })
  });
  asegurar(
    '19.4 Enviar latitud sin longitud responde 400 Bad Request (RN-25)',
    latitudSinLongitud.status === 400
  );

  // 19.5 Gerente intenta crear una sucursal responde 403 Forbidden (RN-05)
  const gerenteCreaSucursal = await peticion('/api/admin/sucursales', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenGerente}` },
    body: JSON.stringify({
      nombre: 'Sucursal Intruso',
      direccion: 'Calle Falsa 123',
      cantidadMesas: 8
    })
  });
  asegurar(
    '19.5 Gerente intenta crear sucursal responde 403 Forbidden (RN-05)',
    gerenteCreaSucursal.status === 403
  );

  // 19.6 Dueño edita datos de sucursal (200 OK)
  const editarSucursal = await peticion(`/api/admin/sucursales/${idSucursalGps}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre: `Sucursal San Benito Plaza ${timestampSuc}`,
      direccion: 'Boulevard del Hipódromo #340, Local 2B',
      telefono: '2222-7788',
      cantidadMesas: 18,
      latitud: 13.6895,
      longitud: -89.2438
    })
  });
  asegurar(
    '19.6 Dueño edita datos de sucursal 200 OK (HU-20)',
    editarSucursal.status === 200 &&
    editarSucursal.data.cantidadMesas === 18 &&
    editarSucursal.data.telefono === '2222-7788'
  );

  // 19.7 Gerente intenta editar sucursal responde 403 Forbidden (RN-05)
  const gerenteEditaSucursal = await peticion(`/api/admin/sucursales/${idSucursalGps}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenGerente}` },
    body: JSON.stringify({
      nombre: 'Hack Gerente',
      direccion: 'Avenida Hack',
      cantidadMesas: 20
    })
  });
  asegurar(
    '19.7 Gerente intenta editar sucursal responde 403 Forbidden (RN-05)',
    gerenteEditaSucursal.status === 403
  );

  // 19.8 Intentar desactivar sucursal con personal activo asignado responde 409 Conflict (RN-25)
  const desactivarConPersonal = await peticion('/api/admin/sucursales/1/activa', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ activa: false })
  });
  asegurar(
    '19.8 Intentar desactivar sucursal con personal activo asignado responde 409 Conflict (RN-25)',
    desactivarConPersonal.status === 409
  );

  // 19.9 Desactivar sucursal sin personal activo asignado 200 OK y log en auditoría (RN-25, RN-27)
  const desactivarSinPersonal = await peticion(`/api/admin/sucursales/${idSucursalManual}/activa`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ activa: false })
  });
  asegurar(
    '19.9 Desactivar sucursal sin personal activo asignado 200 OK y log en auditoría (RN-25, RN-27)',
    desactivarSinPersonal.status === 200 && desactivarSinPersonal.data.activa === false
  );

  // 19.10 Gerente intenta desactivar sucursal responde 403 Forbidden (RN-05)
  const gerenteDesactivaSucursal = await peticion(`/api/admin/sucursales/${idSucursalManual}/activa`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenGerente}` },
    body: JSON.stringify({ activa: true })
  });
  asegurar(
    '19.10 Gerente intenta desactivar sucursal responde 403 Forbidden (RN-05)',
    gerenteDesactivaSucursal.status === 403
  );

  // 19.11 Dueño intenta modificar sucursal inexistente responde 404 Not Found (RN-01)
  const sucursalInexistente = await peticion('/api/admin/sucursales/999999/activa', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ activa: false })
  });
  asegurar(
    '19.11 Modificar sucursal inexistente responde 404 Not Found (RN-01)',
    sucursalInexistente.status === 404
  );

  // 19.12 Dueño crea sucursal en /api/sucursales (201 Created)
  const crearEnSucursales = await peticion('/api/sucursales', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({
      nombre: 'Sucursal Vía Directa',
      direccion: 'Avenida Jerusalén #55, San Salvador',
      telefono: '2222-9999',
      cantidadMesas: 12,
      latitud: 13.7011,
      longitud: -89.2455
    })
  });
  asegurar(
    '19.12 Dueño crea sucursal en /api/sucursales 201 Created (HU-20, RN-25)',
    crearEnSucursales.status === 201 && crearEnSucursales.data.nombre === 'Sucursal Vía Directa'
  );

  // 19.13 Gerente intenta crear sucursal en /api/sucursales responde 403 Forbidden (RN-05)
  const gerenteCrearEnSucursales = await peticion('/api/sucursales', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenGerente}` },
    body: JSON.stringify({
      nombre: 'Sucursal Denegada',
      direccion: 'Calle Sin Permiso 403',
      cantidadMesas: 5
    })
  });
  asegurar(
    '19.13 Gerente intenta crear sucursal en /api/sucursales responde 403 Forbidden (RN-05)',
    gerenteCrearEnSucursales.status === 403
  );

  // 19.14 Ruta no mapeada responde 404 en formato JSON seguro
  const rutaNoMapeada = await peticion('/api/ruta-que-no-existe', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar(
    '19.14 Ruta no mapeada responde 404 en formato JSON seguro (no HTML)',
    rutaNoMapeada.status === 404 &&
      typeof rutaNoMapeada.data === 'object' &&
      Boolean(rutaNoMapeada.data.error || rutaNoMapeada.data.mensaje)
  );

  // 20. Trasladar personal entre sucursales (HU-21, RN-04, RN-05, RN-26, RN-27)
  console.log('\n--- 20. Trasladar personal entre sucursales (HU-21, RN-04, RN-05, RN-26, RN-27) ---');

  // 20.1 Consultar pedidos en curso de la sucursal de un empleado antes de trasladar
  const consultaPedidos = await peticion('/api/admin/personal/3/pedidos-en-curso', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar(
    '20.1 Consultar pedidos en curso de la sucursal del empleado 200 OK (HU-21)',
    consultaPedidos.status === 200 && typeof consultaPedidos.data.pedidosEnCurso === 'number'
  );

  // 20.2 Dueño traslada Barista a la nueva sucursal creada (200 OK y log en auditoría)
  const trasladoOk = await peticion('/api/admin/personal/3/trasladar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ nuevaSucursalId: idSucursalGps })
  });
  asegurar(
    '20.2 Dueño traslada Barista a nueva sucursal 200 OK y log en auditoría (HU-21, RN-05, RN-26, RN-27)',
    trasladoOk.status === 200 &&
    trasladoOk.data.nuevaSucursalId === idSucursalGps &&
    trasladoOk.data.sucursalAnteriorId === 1
  );

  // 20.3 Verificar que el barista ahora tiene asignada la nueva sucursal
  const baristaTrasladado = await peticion('/api/admin/personal?q=Carlos', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar(
    '20.3 Barista ahora pertenece efectivamente a la nueva sucursal 200 OK (RN-26)',
    baristaTrasladado.status === 200 &&
    baristaTrasladado.data.some(p => p.id === 3 && p.sucursalId === idSucursalGps)
  );

  // 20.4 Gerente intenta trasladar personal responde 403 Forbidden (RN-05)
  const gerenteTraslada = await peticion('/api/admin/personal/3/trasladar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenGerente}` },
    body: JSON.stringify({ nuevaSucursalId: 1 })
  });
  asegurar(
    '20.4 Gerente intentando trasladar personal responde 403 Forbidden (RN-05)',
    gerenteTraslada.status === 403
  );

  // 20.5 Trasladar a sucursal inactiva responde 400 Bad Request
  const trasladoInactiva = await peticion('/api/admin/personal/3/trasladar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ nuevaSucursalId: idSucursalManual })
  });
  asegurar(
    '20.5 Trasladar personal a sucursal inactiva responde 400 Bad Request',
    trasladoInactiva.status === 400
  );

  // 20.6 Trasladar a la misma sucursal actual responde 400 Bad Request
  const trasladoMisma = await peticion('/api/admin/personal/3/trasladar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ nuevaSucursalId: idSucursalGps })
  });
  asegurar(
    '20.6 Trasladar a la misma sucursal actual responde 400 Bad Request',
    trasladoMisma.status === 400
  );

  // 20.7 Intentar trasladar a un Dueño responde 400 Bad Request
  const trasladoDueno = await peticion('/api/admin/personal/2/trasladar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ nuevaSucursalId: 1 })
  });
  asegurar(
    '20.7 Intentar trasladar a un Dueño responde 400 Bad Request',
    trasladoDueno.status === 400
  );

  // 20.8 Restaurar Barista a su Sucursal 1 original para mantener estado limpio (200 OK)
  const restaurarSucursal = await peticion('/api/admin/personal/3/trasladar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDueno}` },
    body: JSON.stringify({ nuevaSucursalId: 1 })
  });
  asegurar(
    '20.8 Restaurar Barista a su Sucursal 1 original 200 OK',
    restaurarSucursal.status === 200 && restaurarSucursal.data.nuevaSucursalId === 1
  );

  // 21. Métricas y dashboard de ventas (HU-22, RN-04, RN-30 a RN-35)
  console.log('\n--- 21. Métricas y dashboard de ventas (HU-22, RN-04, RN-30 a RN-35) ---');

  // 21.1 Dueño consulta métricas globales del negocio
  const metricasGlobales = await peticion('/api/admin/metricas?periodo=mes', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar(
    '21.1 Dueño consulta métricas globales del negocio 200 OK (HU-22, RN-30 a RN-35)',
    metricasGlobales.status === 200 &&
      typeof metricasGlobales.data.cifras?.totalVentas === 'number' &&
      Array.isArray(metricasGlobales.data.productosMasVendidos) &&
      typeof metricasGlobales.data.desgloses === 'object'
  );

  // 21.2 Dueño consulta métricas filtradas por sucursal
  const metricasSucursal = await peticion('/api/admin/metricas?sucursalId=1&periodo=mes', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar(
    '21.2 Dueño consulta métricas filtrando por sucursal específica 200 OK (RN-35)',
    metricasSucursal.status === 200 && metricasSucursal.data.sucursalId === 1
  );

  // 21.3 Gerente consulta métricas y solo ve su propia sucursal (RN-04)
  const metricasGerente = await peticion('/api/admin/metricas?periodo=mes', {
    headers: { Authorization: `Bearer ${tokenGerente}` }
  });
  asegurar(
    '21.3 Gerente consulta métricas y solo ve su sucursal 200 OK (RN-04)',
    metricasGerente.status === 200 && metricasGerente.data.sucursalId === 1
  );

  // 21.4 Gerente intenta consultar métricas de otra sucursal y el servidor lo restringe a la suya (RN-04)
  const metricasGerenteIntruso = await peticion('/api/admin/metricas?sucursalId=999&periodo=mes', {
    headers: { Authorization: `Bearer ${tokenGerente}` }
  });
  asegurar(
    '21.4 Gerente intentando filtrar sucursal ajena es restringido a la suya 200 OK (RN-04)',
    metricasGerenteIntruso.status === 200 && metricasGerenteIntruso.data.sucursalId === 1
  );

  // 21.5 Barista intenta consultar métricas responde 403 Forbidden (RN-03)
  const metricasBarista = await peticion('/api/admin/metricas', {
    headers: { Authorization: `Bearer ${tokenBarista}` }
  });
  asegurar(
    '21.5 Barista intentando consultar métricas responde 403 Forbidden (RN-03)',
    metricasBarista.status === 403
  );

  // 21.6 Consulta sin token responde 401 Unauthorized
  const metricasSinToken = await peticion('/api/admin/metricas');
  asegurar(
    '21.6 Consulta de métricas sin token responde 401 Unauthorized',
    metricasSinToken.status === 401
  );

  // 21.7 Consulta con rango personalizado de fechas (200 OK)
  const metricasPersonalizadas = await peticion(
    '/api/admin/metricas?periodo=personalizado&fechaInicio=2026-01-01&fechaFin=2026-12-31',
    { headers: { Authorization: `Bearer ${tokenDueno}` } }
  );
  asegurar(
    '21.7 Consulta con rango personalizado de fechas 200 OK (HU-22)',
    metricasPersonalizadas.status === 200 && metricasPersonalizadas.data.periodo === 'personalizado'
  );

  // 21.8 Parámetro de periodo inválido responde 400 Bad Request
  const metricasPeriodoInvalido = await peticion('/api/admin/metricas?periodo=invalido', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar(
    '21.8 Periodo inválido responde 400 Bad Request',
    metricasPeriodoInvalido.status === 400
  );

  // 22. Historial de pedidos y tickets (HU-23, RN-04, RN-24)
  console.log('\n--- 22. Historial de pedidos y tickets (HU-23, RN-04, RN-24) ---');

  // 22.1 Dueño consulta historial completo de pedidos (200 OK)
  const historialGlobal = await peticion('/api/admin/pedidos-historial', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar(
    '22.1 Dueño consulta historial completo de pedidos 200 OK (HU-23)',
    historialGlobal.status === 200 && Array.isArray(historialGlobal.data) && historialGlobal.data.length > 0
  );

  // 22.2 Gerente consulta historial y solo ve su sucursal (RN-04)
  const historialGerente = await peticion('/api/admin/pedidos-historial', {
    headers: { Authorization: `Bearer ${tokenGerente}` }
  });
  asegurar(
    '22.2 Gerente consulta historial y solo ve su sucursal 200 OK (RN-04)',
    historialGerente.status === 200 &&
      Array.isArray(historialGerente.data) &&
      historialGerente.data.every((p) => p.sucursalId === 1)
  );

  // 22.3 Gerente intenta filtrar sucursal ajena y el servidor lo restringe a la suya (RN-04)
  const historialGerenteIntruso = await peticion('/api/admin/pedidos-historial?sucursalId=999', {
    headers: { Authorization: `Bearer ${tokenGerente}` }
  });
  asegurar(
    '22.3 Gerente intentando filtrar sucursal ajena es restringido a la suya 200 OK (RN-04)',
    historialGerenteIntruso.status === 200 &&
      historialGerenteIntruso.data.every((p) => p.sucursalId === 1)
  );

  // 22.4 Filtrar por estado ENTREGADO (200 OK)
  const historialEntregados = await peticion('/api/admin/pedidos-historial?estado=ENTREGADO', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar(
    '22.4 Filtrar por estado ENTREGADO 200 OK (HU-23)',
    historialEntregados.status === 200 &&
      historialEntregados.data.every((p) => p.estado === 'ENTREGADO')
  );

  // 22.5 Filtrar por método de pago BARRA (200 OK)
  const historialBarra = await peticion('/api/admin/pedidos-historial?metodoPago=BARRA', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar(
    '22.5 Filtrar por método de pago BARRA 200 OK (HU-23)',
    historialBarra.status === 200 &&
      historialBarra.data.every((p) => p.metodoPago === 'BARRA')
  );

  // 22.6 Filtrar por rango de fechas (200 OK)
  const historialFechas = await peticion(
    '/api/admin/pedidos-historial?fechaInicio=2026-01-01&fechaFin=2026-12-31',
    { headers: { Authorization: `Bearer ${tokenDueno}` } }
  );
  asegurar(
    '22.6 Filtrar por rango de fechas 200 OK (HU-23)',
    historialFechas.status === 200 && Array.isArray(historialFechas.data)
  );

  // 22.7 Búsqueda por texto (200 OK)
  const historialBusqueda = await peticion('/api/admin/pedidos-historial?q=1', {
    headers: { Authorization: `Bearer ${tokenDueno}` }
  });
  asegurar(
    '22.7 Búsqueda por texto o número de orden 200 OK (HU-23)',
    historialBusqueda.status === 200 && Array.isArray(historialBusqueda.data)
  );

  // 22.8 Barista intentando acceder a pedidos-historial responde 403 Forbidden (RN-03)
  const historialBarista = await peticion('/api/admin/pedidos-historial', {
    headers: { Authorization: `Bearer ${tokenBarista}` }
  });
  asegurar(
    '22.8 Barista intentando acceder a pedidos-historial responde 403 Forbidden (RN-03)',
    historialBarista.status === 403
  );

  console.log('\n===============================================================');
  console.log(`  RESUMEN: ${pruebasPasadas} pasadas, ${pruebasFallidas} fallidas`);
  console.log('===============================================================\n');

  if (pruebasFallidas > 0) {
    process.exit(1);
  }
}

correrPruebas();
