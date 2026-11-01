import pool from '../db.js';
import { productoRepository } from '../repositories/productoRepository.js';
import { productoGruposRepository } from '../repositories/productoGruposRepository.js';
import { categoriaRepository } from '../repositories/categoriaRepository.js';
import { grupoOpcionesRepository } from '../repositories/grupoOpcionesRepository.js';
import { opcionRepository } from '../repositories/opcionRepository.js';
import { auditoriaRepository } from '../repositories/auditoriaRepository.js';
import { ErrorApp } from '../ErrorApp.js';

export const productoService = {
  /**
   * Lista productos de un negocio con sus grupos de opciones y filtros aplicados.
   * @param {number} negocioId
   * @param {object} [filtros={}]
   * @returns {Promise<Array<object>>}
   */
  async listar(negocioId, filtros = {}) {
    const productos = await productoRepository.listar(negocioId, filtros);

    const productosCompletos = await Promise.all(
      productos.map(async (prod) => {
        const grupos = await productoGruposRepository.obtenerGruposDeProducto(prod.id, negocioId);
        return {
          ...prod,
          precio: Number(prod.precio),
          disponible: Boolean(prod.disponible),
          activo: Boolean(prod.activo),
          grupos
        };
      })
    );

    return productosCompletos;
  },

  /**
   * Obtiene un producto por ID con todos sus grupos y opciones disponibles (RN-01).
   * @param {number} id
   * @param {number} negocioId
   * @returns {Promise<object>}
   */
  async obtenerPorId(id, negocioId) {
    const prod = await productoRepository.buscarPorId(id, negocioId);
    if (!prod) {
      throw new ErrorApp('Producto no encontrado', 404); // RN-01
    }

    const grupos = await productoGruposRepository.obtenerGruposDeProducto(id, negocioId);
    const gruposConOpciones = await Promise.all(
      grupos.map(async (g) => {
        const opciones = await opcionRepository.listarPorGrupo(g.id, negocioId, true);
        return { ...g, opciones };
      })
    );

    return {
      ...prod,
      precio: Number(prod.precio),
      disponible: Boolean(prod.disponible),
      activo: Boolean(prod.activo),
      grupos: gruposConOpciones
    };
  },

  /**
   * Crea un nuevo producto y asocia sus grupos de opciones en una transacción atómica.
   * Valida RN-12 (precio mayor que 0).
   * @param {object} datos
   * @param {number} negocioId
   * @returns {Promise<object>}
   */
  async crear(datos, negocioId) {
    // Validar categoría perteneciente al negocio
    const categoria = await categoriaRepository.buscarPorId(datos.categoria_id, negocioId);
    if (!categoria) {
      throw new ErrorApp('La categoría indicada no existe en tu negocio', 404); // RN-01
    }

    // RN-12: El precio del producto debe ser mayor que 0
    const precioNumerico = Number(datos.precio);
    if (isNaN(precioNumerico) || precioNumerico <= 0) {
      throw new ErrorApp('El precio del producto debe ser mayor que 0', 400); // RN-12
    }

    // Cálculo en centavos enteros para evitar imprecisiones de coma flotante
    const centavos = Math.round(precioNumerico * 100);
    const precioFinal = (centavos / 100).toFixed(2);

    const conexion = await pool.getConnection();

    try {
      await conexion.beginTransaction();

      const nuevoId = await productoRepository.crear(
        {
          negocioId,
          categoriaId: datos.categoria_id,
          nombreEs: datos.nombre_es,
          nombreEn: datos.nombre_en,
          descripcionEs: datos.descripcion_es,
          descripcionEn: datos.descripcion_en,
          precio: precioFinal,
          imagenUrl: datos.imagen_url,
          disponible: datos.disponible !== undefined ? datos.disponible : true,
          activo: datos.activo !== undefined ? datos.activo : true
        },
        conexion
      );

      // Sincronizar grupos de opciones asociados
      if (datos.grupos_ids && Array.isArray(datos.grupos_ids)) {
        await productoGruposRepository.sincronizarGrupos(
          nuevoId,
          negocioId,
          datos.grupos_ids,
          conexion
        );
      }

      await conexion.commit();
      return await this.obtenerPorId(nuevoId, negocioId);
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  },

  /**
   * Actualiza los datos de un producto y sus grupos de opciones.
   * Aplica RN-12 y registra en auditoría cambios críticos (RN-27).
   * @param {number} id
   * @param {number} negocioId
   * @param {object} datos
   * @param {number} usuarioId
   * @returns {Promise<object>}
   */
  async actualizar(id, negocioId, datos, usuarioId) {
    const prodActual = await this.obtenerPorId(id, negocioId);

    // Si se modifica categoría, validar que pertenezca al negocio
    if (datos.categoria_id) {
      const cat = await categoriaRepository.buscarPorId(datos.categoria_id, negocioId);
      if (!cat) {
        throw new ErrorApp('La categoría indicada no existe en tu negocio', 404);
      }
    }

    let precioFinal = undefined;
    if (datos.precio !== undefined) {
      const precioNumerico = Number(datos.precio);
      if (isNaN(precioNumerico) || precioNumerico <= 0) {
        throw new ErrorApp('El precio del producto debe ser mayor que 0', 400); // RN-12
      }
      const centavos = Math.round(precioNumerico * 100);
      precioFinal = (centavos / 100).toFixed(2);
    }

    const conexion = await pool.getConnection();

    try {
      await conexion.beginTransaction();

      await productoRepository.actualizar(
        id,
        negocioId,
        {
          categoriaId: datos.categoria_id,
          nombreEs: datos.nombre_es,
          nombreEn: datos.nombre_en,
          descripcionEs: datos.descripcion_es,
          descripcionEn: datos.descripcion_en,
          precio: precioFinal,
          imagenUrl: datos.imagen_url,
          disponible: datos.disponible,
          activo: datos.activo
        },
        conexion
      );

      if (datos.grupos_ids !== undefined && Array.isArray(datos.grupos_ids)) {
        await productoGruposRepository.sincronizarGrupos(
          id,
          negocioId,
          datos.grupos_ids,
          conexion
        );
      }

      await conexion.commit();
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }

    // RN-27: Registrar cambio de precio en auditoría
    if (precioFinal !== undefined && Number(precioFinal) !== Number(prodActual.precio)) {
      await auditoriaRepository.registrar({
        negocioId,
        usuarioId,
        accion: 'CAMBIO_PRECIO_PRODUCTO',
        descripcion: `Producto #${id} ('${prodActual.nombreEs}') cambió de precio de $${prodActual.precio} a $${precioFinal}`
      });
    }

    // RN-27: Registrar desactivación en auditoría
    if (datos.activo === false && prodActual.activo === 1) {
      await auditoriaRepository.registrar({
        negocioId,
        usuarioId,
        accion: 'DESACTIVACION_PRODUCTO',
        descripcion: `Producto #${id} ('${prodActual.nombreEs}') desactivado por el usuario`
      });
    }

    return await this.obtenerPorId(id, negocioId);
  },

  /**
   * Cambia la disponibilidad inmediata de un producto ("Agotado por hoy").
   * @param {number} id
   * @param {number} negocioId
   * @param {boolean} disponible
   * @returns {Promise<object>}
   */
  async cambiarDisponibilidad(id, negocioId, disponible) {
    await this.obtenerPorId(id, negocioId);
    await productoRepository.actualizar(id, negocioId, { disponible });
    return await this.obtenerPorId(id, negocioId);
  },

  /**
   * Elimina un producto si no está en pedidos anteriores (RN-10).
   * Si tiene historial, responde 409 para exigir desactivación.
   * @param {number} id
   * @param {number} negocioId
   */
  async eliminar(id, negocioId) {
    await this.obtenerPorId(id, negocioId);

    try {
      await productoRepository.eliminar(id, negocioId);
      return { mensaje: 'Producto eliminado exitosamente' };
    } catch (error) {
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        throw new ErrorApp('El producto tiene pedidos históricos asociados; desactívalo en su lugar', 409); // RN-10
      }
      throw error;
    }
  }
};
