import { reportesRepository } from '../repositories/reportesRepository.js';

/**
 * Convierte un periodo simbólico a fechas de inicio y fin en UTC.
 */
function calcularRangoFechas(periodo, inicioManual, finManual) {
  const ahora = new Date();

  if (periodo === 'hoy') {
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
    const fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);
    return {
      fechaInicio: inicio.toISOString().slice(0, 19).replace('T', ' '),
      fechaFin: fin.toISOString().slice(0, 19).replace('T', ' ')
    };
  }

  if (periodo === '7dias') {
    const inicio = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      fechaInicio: inicio.toISOString().slice(0, 19).replace('T', ' '),
      fechaFin: ahora.toISOString().slice(0, 19).replace('T', ' ')
    };
  }

  if (periodo === 'mes') {
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0);
    return {
      fechaInicio: inicio.toISOString().slice(0, 19).replace('T', ' '),
      fechaFin: ahora.toISOString().slice(0, 19).replace('T', ' ')
    };
  }

  // Personalizado
  return {
    fechaInicio: inicioManual || null,
    fechaFin: finManual || null
  };
}

/**
 * Servicio de métricas de ventas, desgloses analíticos y registro histórico (HU-22, HU-23).
 * Cumple RN-04, RN-30 a RN-35.
 */
export const reportesService = {
  /**
   * Obtiene el dashboard completo de métricas y gráficos (HU-22).
   */
  async obtenerDashboard(usuario, { periodo = 'hoy', fechaInicio, fechaFin, sucursalId } = {}) {
    let sucursalFinal = sucursalId ? Number(sucursalId) : null;

    // RN-04: El gerente solo ve su sucursal; el dueño ve todas o la seleccionada (RN-35)
    if (usuario.rol === 'GERENTE') {
      sucursalFinal = usuario.sucursal_id;
    }

    const rango = calcularRangoFechas(periodo, fechaInicio, fechaFin);

    const [resumen, productosTop, desgloses] = await Promise.all([
      reportesRepository.obtenerCifrasResumen(usuario.negocio_id, {
        sucursalId: sucursalFinal,
        fechaInicio: rango.fechaInicio,
        fechaFin: rango.fechaFin
      }),
      reportesRepository.obtenerProductosMasVendidos(usuario.negocio_id, {
        sucursalId: sucursalFinal,
        fechaInicio: rango.fechaInicio,
        fechaFin: rango.fechaFin,
        limite: 6
      }),
      reportesRepository.obtenerDesgloses(usuario.negocio_id, {
        sucursalId: sucursalFinal,
        fechaInicio: rango.fechaInicio,
        fechaFin: rango.fechaFin
      })
    ]);

    return {
      periodo,
      sucursalId: sucursalFinal,
      rango,
      cifras: resumen,
      productosMasVendidos: productosTop,
      desgloses
    };
  },

  /**
   * Consulta el registro histórico de pedidos y tickets (HU-23).
   */
  async listarHistorialPedidos(usuario, filtros = {}) {
    let sucursalFinal = filtros.sucursalId ? Number(filtros.sucursalId) : null;

    // RN-04: El gerente solo ve pedidos de su sucursal
    if (usuario.rol === 'GERENTE') {
      sucursalFinal = usuario.sucursal_id;
    }

    return reportesRepository.listarHistorialPedidos(usuario.negocio_id, {
      ...filtros,
      sucursalId: sucursalFinal
    });
  }
};
