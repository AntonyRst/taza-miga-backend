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

  console.log('\n===============================================================');
  console.log(`  RESUMEN: ${pruebasPasadas} pasadas, ${pruebasFallidas} fallidas`);
  console.log('===============================================================\n');

  if (pruebasFallidas > 0) {
    process.exit(1);
  }
}

correrPruebas();
