import pool from '../db.js';
import { reportesRepository } from '../repositories/reportesRepository.js';

/**
 * Script de certificación de las reglas de cálculo analíticas (RN-30 a RN-35).
 * Compara los resultados de reportesRepository con consultas directas de control en SQL.
 */
async function certificarCalculos() {
  console.log('===============================================================');
  console.log('  CERTIFICACIÓN DE REGLAS DE CÁLCULO (RN-30 A RN-35)');
  console.log('===============================================================\n');

  let fallos = 0;
  function assertCheck(descripcion, condicion) {
    if (condicion) {
      console.log(`  ✅ [PASS] ${descripcion}`);
    } else {
      console.error(`  ❌ [FAIL] ${descripcion}`);
      fallos++;
    }
  }

  try {
    const negocioId = 1;

    // 1. RN-30: Ventas del periodo = suma del total de pedidos ENTREGADO
    const resumen = await reportesRepository.obtenerCifrasResumen(negocioId);

    const [sqlVentas] = await pool.query(
      "SELECT COALESCE(SUM(total), 0) AS suma FROM ordenes WHERE negocio_id = ? AND estado = 'ENTREGADO'",
      [negocioId]
    );
    const sumaReal = Number(Number(sqlVentas[0].suma).toFixed(2));
    assertCheck(
      `RN-30: Ventas totales ($${resumen.totalVentas}) coinciden con la suma de pedidos ENTREGADO ($${sumaReal})`,
      resumen.totalVentas === sumaReal
    );

    // Comprobar que CANCELADO no suma a ventas
    const [sqlCancelados] = await pool.query(
      "SELECT COUNT(*) AS total, COALESCE(SUM(total), 0) AS suma FROM ordenes WHERE negocio_id = ? AND estado = 'CANCELADO'",
      [negocioId]
    );
    assertCheck(
      `RN-30: Existen ${sqlCancelados[0].total} pedidos CANCELADO ($${sqlCancelados[0].suma}) que NO forman parte de totalVentas`,
      sqlCancelados[0].total > 0 && resumen.totalVentas === sumaReal
    );

    // 2. RN-31: Ticket promedio = ventas / cantidad de pedidos entregados
    const [sqlEntregados] = await pool.query(
      "SELECT COUNT(*) AS cantidad FROM ordenes WHERE negocio_id = ? AND estado = 'ENTREGADO'",
      [negocioId]
    );
    const cantidadEntregados = sqlEntregados[0].cantidad;
    const ticketEsperado =
      cantidadEntregados > 0 ? Number((sumaReal / cantidadEntregados).toFixed(2)) : 0;
    assertCheck(
      `RN-31: Ticket promedio ($${resumen.ticketPromedio}) coincide con ventas ÷ pedidos (${sumaReal} ÷ ${cantidadEntregados} = $${ticketEsperado})`,
      Math.abs(resumen.ticketPromedio - ticketEsperado) <= 0.01
    );

    // Caso borde: 0 pedidos entregados en un rango futuro da $0.00 sin error
    const resumenCero = await reportesRepository.obtenerCifrasResumen(negocioId, {
      fechaInicio: '2099-01-01 00:00:00',
      fechaFin: '2099-01-02 23:59:59'
    });
    assertCheck(
      'RN-31 Caso borde: Periodo sin pedidos devuelve ticketPromedio = 0 y ventas = 0 sin NaN',
      resumenCero.totalVentas === 0 &&
      resumenCero.totalPedidosEntregados === 0 &&
      resumenCero.ticketPromedio === 0
    );

    // 3. RN-32: Ranking de productos más vendidos
    const top = await reportesRepository.obtenerProductosMasVendidos(negocioId, { limite: 5 });
    assertCheck(
      'RN-32: Devuelve ranking de productos ordenados descendentemente por unidades vendidas',
      top.length > 0 && top.every((p, idx) => idx === 0 || top[idx - 1].unidadesVendidas >= p.unidadesVendidas)
    );

    // 4. RN-33: Tiempos promedio de preparación y espera
    const [sqlTiempos] = await pool.query(
      `SELECT
         COALESCE(AVG(TIMESTAMPDIFF(MINUTE, iniciado_en, listo_en)), 0) AS prep,
         COALESCE(AVG(TIMESTAMPDIFF(MINUTE, creado_en, entregado_en)), 0) AS espera
       FROM ordenes
       WHERE negocio_id = ? AND estado = 'ENTREGADO'`,
      [negocioId]
    );
    const prepEsperada = Math.round(Number(sqlTiempos[0].prep));
    const esperaEsperada = Math.round(Number(sqlTiempos[0].espera));
    assertCheck(
      `RN-33: Tiempo preparación (${resumen.tiempoPromedioPreparacionMin}m) y espera (${resumen.tiempoPromedioEsperaMin}m) coinciden con TIMESTAMPDIFF (${prepEsperada}m, ${esperaEsperada}m)`,
      resumen.tiempoPromedioPreparacionMin === prepEsperada &&
      resumen.tiempoPromedioEsperaMin === esperaEsperada
    );

    // 5. RN-34: Tasa de cancelación y motivos agrupados
    const [sqlTotales] = await pool.query(
      'SELECT COUNT(*) AS total FROM ordenes WHERE negocio_id = ?',
      [negocioId]
    );
    const pedidosTotales = sqlTotales[0].total;
    const pedidosCancelados = sqlCancelados[0].total;
    const tasaEsperada = Number(((pedidosCancelados / pedidosTotales) * 100).toFixed(1));
    assertCheck(
      `RN-34: Tasa de cancelación (${resumen.tasaCancelacion}%) coincide con cancelados ÷ totales (${pedidosCancelados} ÷ ${pedidosTotales} = ${tasaEsperada}%)`,
      Math.abs(resumen.tasaCancelacion - tasaEsperada) <= 0.1
    );
    assertCheck(
      'RN-34: Motivos de cancelación agrupados con conteo correcto',
      Array.isArray(resumen.motivosCancelacion) &&
      resumen.motivosCancelacion.reduce((acc, m) => acc + m.cantidad, 0) === pedidosCancelados
    );

    // 6. RN-35: Desgloses analíticos coherentes
    const desgloses = await reportesRepository.obtenerDesgloses(negocioId);
    const sumaPorDia = Number(
      desgloses.ventasPorDia.reduce((acc, d) => acc + Number(d.totalVentas), 0).toFixed(2)
    );
    assertCheck(
      `RN-35: La suma de ventas por día ($${sumaPorDia}) coincide con el total de ventas del negocio ($${sumaReal})`,
      Math.abs(sumaPorDia - sumaReal) <= 0.05
    );

    // Desglose por sucursal para Dueño
    const resumenSuc1 = await reportesRepository.obtenerCifrasResumen(negocioId, { sucursalId: 1 });
    const resumenSuc2 = await reportesRepository.obtenerCifrasResumen(negocioId, { sucursalId: 2 });
    assertCheck(
      `RN-35: Filtrado por sucursal aísla métricas (Sucursal 1: $${resumenSuc1.totalVentas}, Sucursal 2: $${resumenSuc2.totalVentas})`,
      resumenSuc1.totalVentas > 0 &&
      resumenSuc2.totalVentas > 0 &&
      Math.abs((resumenSuc1.totalVentas + resumenSuc2.totalVentas) - sumaReal) <= 0.05
    );

    console.log('\n===============================================================');
    if (fallos === 0) {
      console.log('  RESULTADO: TODAS LAS REGLAS DE CÁLCULO CERTIFICADAS (100% OK)');
    } else {
      console.error(`  RESULTADO: ${fallos} FALLOS EN REGLAS DE CÁLCULO`);
    }
    console.log('===============================================================\n');

    if (fallos > 0) process.exit(1);
  } catch (error) {
    console.error('Error al certificar cálculos:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

certificarCalculos();
