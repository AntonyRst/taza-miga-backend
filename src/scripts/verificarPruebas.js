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

  console.log('\n===============================================================');
  console.log(`  RESUMEN: ${pruebasPasadas} pasadas, ${pruebasFallidas} fallidas`);
  console.log('===============================================================\n');

  if (pruebasFallidas > 0) {
    process.exit(1);
  }
}

correrPruebas();
