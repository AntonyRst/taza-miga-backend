import pool from '../db.js';
import { categoriaRepository } from '../repositories/categoriaRepository.js';
import { productoRepository } from '../repositories/productoRepository.js';
import { productoGruposRepository } from '../repositories/productoGruposRepository.js';
import { opcionRepository } from '../repositories/opcionRepository.js';
import { ErrorApp } from '../ErrorApp.js';

export const catalogoPublicoService = {
  /**
   * Normaliza el slug para admitir tanto 'taza-miga' como 'taza-y-miga'.
   * @param {string} slug
   * @returns {string}
   */
  normalizarSlug(slug) {
    const limpio = String(slug || '').trim().toLowerCase();
    if (limpio === 'taza-y-miga') return 'taza-miga';
    return limpio;
  },

  /**
   * Obtiene la información del negocio a partir de su slug público.
   * @param {string} slug
   * @returns {Promise<object>}
   */
  async obtenerNegocioPorSlug(slug) {
    const slugNormalizado = this.normalizarSlug(slug);
    const [filas] = await pool.query(
      'SELECT id, nombre, slug, logo_url AS logoUrl FROM negocios WHERE slug = ? LIMIT 1',
      [slugNormalizado]
    );

    if (filas.length === 0) {
      throw new ErrorApp(`Negocio no encontrado con slug: ${slug}`, 404);
    }

    return filas[0];
  },

  /**
   * Devuelve el catálogo público del negocio para el cliente (categorías y productos con opciones).
   * Solo incluye lo activo y no requiere token.
   * @param {string} slug
   * @returns {Promise<object>}
   */
  async obtenerMenu(slug) {
    const negocio = await this.obtenerNegocioPorSlug(slug);
    const categorias = await categoriaRepository.listar(negocio.id, true);
    const productos = await productoRepository.listar(negocio.id, { soloActivos: true });

    const productosConOpciones = await Promise.all(
      productos.map(async (prod) => {
        const grupos = await productoGruposRepository.obtenerGruposDeProducto(prod.id, negocio.id);
        const gruposFiltrados = await Promise.all(
          grupos
            .filter((g) => g.activo)
            .map(async (g) => {
              const opciones = await opcionRepository.listarPorGrupo(g.id, negocio.id, true);
              return {
                id: g.id,
                nombreEs: g.nombreEs,
                nombreEn: g.nombreEn,
                tipoSeleccion: g.tipoSeleccion,
                obligatorio: Boolean(g.obligatorio),
                opciones: opciones.map((op) => ({
                  id: op.id,
                  nombreEs: op.nombreEs,
                  nombreEn: op.nombreEn,
                  precioExtra: Number(op.precioExtra),
                  esPredeterminada: Boolean(op.esPredeterminada)
                }))
              };
            })
        );

        return {
          id: prod.id,
          categoriaId: prod.categoriaId,
          categoriaNombreEs: prod.categoriaNombreEs,
          categoriaNombreEn: prod.categoriaNombreEn,
          nombreEs: prod.nombreEs,
          nombreEn: prod.nombreEn,
          descripcionEs: prod.descripcionEs,
          descripcionEn: prod.descripcionEn,
          precio: Number(prod.precio),
          imagenUrl: prod.imagenUrl,
          disponible: Boolean(prod.disponible),
          grupos: gruposFiltrados
        };
      })
    );

    return {
      negocio: {
        id: negocio.id,
        nombre: negocio.nombre,
        slug: negocio.slug,
        logoUrl: negocio.logoUrl
      },
      categorias: categorias.map((c) => ({
        id: c.id,
        nombreEs: c.nombreEs,
        nombreEn: c.nombreEn,
        orden: c.orden
      })),
      productos: productosConOpciones
    };
  },

  /**
   * Devuelve las sucursales activas de un negocio para seleccionar dónde ordenar o recoger.
   * @param {string} slug
   * @returns {Promise<Array<object>>}
   */
  async obtenerSucursales(slug) {
    const negocio = await this.obtenerNegocioPorSlug(slug);

    const [sucursales] = await pool.query(
      `SELECT
        id,
        nombre,
        direccion,
        latitud,
        longitud,
        telefono,
        cantidad_mesas AS cantidadMesas
      FROM sucursales
      WHERE negocio_id = ? AND activa = TRUE
      ORDER BY id ASC`,
      [negocio.id]
    );

    return sucursales;
  }
};
