// Secciones de la app y los datos que necesita cada una para mostrarse.
// Lo usan tanto el servidor (para filtrar) como la interfaz (para armar el menú).
const SECCIONES = [
  { id: "dashboard", label: "Panel" },
  { id: "clientes", label: "Clientes" },
  { id: "compras", label: "Compras" },
  { id: "stock", label: "Stock" },
  { id: "recetas", label: "Recetas base" },
  { id: "planificador", label: "Planificar producción" },
  { id: "productos", label: "Productos" },
  { id: "pedidos", label: "Pedidos" },
  { id: "ventas", label: "Ventas" },
];
const IDS = SECCIONES.map((s) => s.id);

const COLECCIONES = {
  dashboard: ["clientes", "ingredientes", "compras", "gastos", "articulos", "cierres", "cajaConfig", "recetasBase", "producciones", "productos", "ventas", "ajustesInventario"],
  clientes: ["clientes"],
  compras: ["ingredientes", "compras", "gastos", "articulos"],
  stock: ["clientes", "ingredientes", "compras", "gastos", "articulos", "recetasBase", "producciones", "productos", "ventas", "ajustesInventario"],
  recetas: ["ingredientes", "compras", "recetasBase", "producciones", "productos", "ventas", "ajustesInventario"],
  planificador: ["ingredientes", "compras", "recetasBase", "producciones", "ventas", "ajustesInventario"],
  productos: ["ingredientes", "compras", "recetasBase", "producciones", "productos"],
  pedidos: ["clientes", "productos", "pedidos"],
  ventas: ["clientes", "ingredientes", "compras", "recetasBase", "producciones", "productos", "ventas", "ajustesInventario"],
};

module.exports = { SECCIONES, IDS, COLECCIONES };
