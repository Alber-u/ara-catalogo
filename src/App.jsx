import React, { useState, useMemo, useId, useEffect, useRef } from "react";
import {
  Search, ShoppingCart, Plus, Minus, X, Package, Wrench, Hammer,
  Boxes, Construction, Check, Trophy,
  User, LogOut, AlertCircle
} from "lucide-react";

// =========================================================
//  Conexión con el backend (araujo-bot/api/catalogo)
// =========================================================
const BACKEND_URL = "https://araujo-bot.onrender.com/api/catalogo";

// Estos arrays los rellena el backend al cargar.
const PROVEEDORES_SEED = [
  { id: "aqua", nombre: "Aquatubo SL",         formaPago: "60 días · Recibo domiciliado", email: "", activo: true, color: "emerald" },
  { id: "aram", nombre: "Aramburu Guzmán SLU", formaPago: "Contado",                     email: "", activo: true, color: "amber"   },
];

// Si el backend tarda o falla, se usan los datos semilla (declarados más abajo).
let OBRAS = [];
let OPERARIOS = [];
let CATALOGO = [];
let PROVEEDORES = [];

// Bandera global del estado de carga (la lee App() para mostrar loading)
let datosCargados = false;
let errorBackend = null;

async function cargarDatosBackend() {
  try {
    const r = await fetch(BACKEND_URL + "/public");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    CATALOGO = Array.isArray(data.productos) ? data.productos : CATALOGO_SEED;
    OBRAS = Array.isArray(data.obras) ? data.obras : OBRAS_SEED;
    PROVEEDORES = Array.isArray(data.proveedores) ? data.proveedores : PROVEEDORES_SEED;
    // Guardamos objetos completos {id, nombre, pin, activo} para poder validar PIN en login
    OPERARIOS = Array.isArray(data.operarios) ? data.operarios : OPERARIOS_SEED;
    // Asegurar que la opción "Otro" esté al final (como objeto especial)
    if (!OPERARIOS.find(o => (o.nombre || o) === "Otro (escribir nombre)")) {
      OPERARIOS = [...OPERARIOS, { id: "otro", nombre: "Otro (escribir nombre)", pin: null }];
    }
    datosCargados = true;
    errorBackend = null;
    console.log("[ARA] Datos cargados desde backend:", CATALOGO.length, "productos,", OBRAS.length, "obras,", OPERARIOS.length, "operarios");
  } catch (e) {
    console.warn("[ARA] No se pudo cargar del backend, usando datos locales:", e.message);
    CATALOGO = CATALOGO_SEED;
    OBRAS = OBRAS_SEED;
    OPERARIOS = OPERARIOS_SEED;
    PROVEEDORES = PROVEEDORES_SEED;
    datosCargados = true;
    errorBackend = e.message;
  }
}

// =========================================================
//  ARA CORPORATE — App de pedidos de obra
//  Catálogo unificado con comparativa de proveedores:
//    🟢 AQUATUBO SL  vs  🟡 ARAMBURU GUZMÁN SLU
//
//  Datos extraídos de:
//   · 41 facturas de Aquatubo (oct/2025 – abr/2026)
//   · 50 facturas de Aramburu Guzmán (dic/2025 – abr/2026)
//
//  Precio NETO = bruto × (1 − dto/100), tal como aparece en factura
// =========================================================

// --- Obras activas detectadas en facturas -----------------
const OBRAS_SEED = [
  { id: "JP17",   nombre: "Juan Pablos Edif. 17",          dir: "Calle Juan Pablos 17, Sevilla" },
  { id: "DF20",   nombre: "Doña Francisquita 20",          dir: "Calle Doña Francisquita 20, Sevilla" },
  { id: "OL67",   nombre: "Ntra. Sra. Oliva 67",           dir: "Bda. Nuestra Señora de la Oliva 67, Sevilla" },
  { id: "OLE2",   nombre: "Ntra. Sra. Oliva Edif. 2",      dir: "Bda. Nuestra Señora de la Oliva Edif. 2, Sevilla" },
  { id: "OL94",   nombre: "C/ Virgen de la Oliva 94",      dir: "C/ Virgen de la Oliva 94, Sevilla" },
  { id: "RT9",    nombre: "Rodrigo de Triana 9",           dir: "Rodrigo de Triana 9, Sevilla" },
  { id: "GO21",   nombre: "Calle Goya 21",                 dir: "Calle Goya 21, Sevilla" },
  { id: "DF39",   nombre: "Doctor Fedriani 39",            dir: "Doctor Fedriani 39, Sevilla" },
  { id: "PD1",    nombre: "Plaza Duendes 1",               dir: "Plaza Duendes 1, Sevilla" },
  { id: "PG13",   nombre: "Plaza Generalife 13",           dir: "Plaza Generalife 13, Sevilla" },
  { id: "RS9",    nombre: "Regimiento de Soria 9",         dir: "Regimiento de Soria 9, Sevilla" },
  { id: "AT1",    nombre: "Astronomía Torre 1",            dir: "Calle Astronomía Torre 1, Sevilla" },
  { id: "AG7",    nombre: "C/ Ágata Edif. 7",              dir: "C/ Ágata Edif. 7, Sevilla" },
  { id: "VV18",   nombre: "Virgen del Valle 18",           dir: "Calle Virgen del Valle 18, Sevilla" },
  { id: "BT20",   nombre: "Calle Betis 20",                dir: "Calle Betis 20, Sevilla" },
];

// --- Operarios (lista demo, en producción vendría de BBDD) ---
const OPERARIOS_SEED = [
  { id: "op1", nombre: "Antonio Ramírez Romero",      pin: null, activo: true },
  { id: "op2", nombre: "Miguel Ángel Espada Pérez",   pin: null, activo: true },
  { id: "op3", nombre: "Miguel Ángel Espada Rebollo", pin: null, activo: true },
  { id: "op4", nombre: "Juan García",                 pin: null, activo: true },
  { id: "op5", nombre: "Pedro Fernández",             pin: null, activo: true },
  { id: "op6", nombre: "Manuel López",                pin: null, activo: true },
  { id: "otro", nombre: "Otro (escribir nombre)",     pin: null, activo: true },
];

// --- CATÁLOGO UNIFICADO -----------------------------------
// Cada producto puede tener precio en uno o ambos proveedores.
// proveedores: { aqua: {bruto, dto, ref}, aram: {bruto, dto, ref} }
const CATALOGO_SEED = [
  // === MULTICAPA — alta coincidencia ===
  {
    id: "mc-tubo-25", desc: "Tubería multicapa PEX/AL/PE Ø25×2.5mm", familia: "Multicapa",
    unidad: "m", img: "tubo-pex",
    proveedores: {
      aqua: { ref: "25442", bruto: 4.98,  dto: 78.5, marca: "MT" },
      aram: { ref: "MCTBPERT25R", bruto: 3.02, dto: 55, marca: "FE" },
    }
  },
  {
    id: "mc-codo-25", desc: "Codo multicapa 25", familia: "Multicapa",
    unidad: "uni", img: "mcap",
    proveedores: {
      aqua: { ref: "25742", bruto: 10.82, dto: 73, marca: "MT" },
      aram: { ref: "MCCDO25", bruto: 7.45, dto: 50, marca: "FE" },
    }
  },
  {
    id: "mc-codoH-25-34", desc: "Codo multicapa H 25-¾\"", familia: "Multicapa",
    unidad: "uni", img: "mcap",
    proveedores: {
      aqua: { ref: "25750", bruto: 10.13, dto: 74, marca: "MT" },
      aram: { ref: "MCCOT2534", bruto: 7.02, dto: 55, marca: "FE" },
    }
  },
  {
    id: "mc-racor-25-34", desc: "Racor multicapa H 25-¾\"", familia: "Multicapa",
    unidad: "uni", img: "mcap",
    proveedores: {
      aqua: { ref: "25714", bruto: 7.38, dto: 72, marca: "FTSTD" },
      aram: { ref: "MCRFM2534", bruto: 5.06, dto: 50, marca: "FE" },
    }
  },
  {
    id: "mc-te-25", desc: "Te multicapa 25", familia: "Multicapa",
    unidad: "uni", img: "te",
    proveedores: {
      aram: { ref: "MCTEE25255", bruto: 10.91, dto: 50, marca: "FE" },
    }
  },
  {
    id: "mc-manguito-25", desc: "Manguito multicapa 25", familia: "Multicapa",
    unidad: "uni", img: "mcap",
    proveedores: {
      aram: { ref: "MCMAU25", bruto: 5.98, dto: 50, marca: "FE" },
    }
  },
  {
    id: "mc-val-bola-25", desc: "Válvula bola multicapa M/L 25", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "39072", bruto: 22.86, dto: 69, marca: "MT" },
      aram: { ref: "VEMC25", bruto: 15.84, dto: 50, marca: "FE" },
    }
  },
  {
    id: "mc-val-empotrar", desc: "Válvula esfera empotrar 25", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "25798", bruto: 29.79, dto: 72, marca: "FTSTD" },
    }
  },

  // === VÁLVULAS — alta coincidencia ===
  {
    id: "val-bola-34", desc: "Válvula latón bola M/L acero CRM H-H ¾\" PN25", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "17567", bruto: 9.10, dto: 57, marca: "MT" },
      aram: { ref: "3059-05", bruto: 7.66, dto: 50, marca: "—" },
    }
  },
  {
    id: "val-bola-2", desc: "Válvula latón bola M/L acero CRM H-H 2\" PN25", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "17575", bruto: 49.56, dto: 61, marca: "MT" },
      aram: { ref: "3028-09", bruto: 33.66, dto: 50, marca: "—" },
    }
  },
  {
    id: "val-bola-25", desc: "Válvula latón bola M/L acero CRM H-H 2½\" PN25", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "18773", bruto: 108.41, dto: 61, marca: "MT" },
    }
  },
  {
    id: "val-york-2", desc: "Válvula latón retención York 2\"", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "18346", bruto: 44.88, dto: 61, marca: "MT" },
      aram: { ref: "3121-09-2", bruto: 30.63, dto: 50, marca: "—" },
    }
  },
  {
    id: "val-york-25-pn8", desc: "Válvula latón retención York 2½\" PN8", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "18347", bruto: 100.76, dto: 57, marca: "MT" },
    }
  },
  {
    id: "val-york-25-pn10", desc: "Válvula latón retención York 2½\" PN10", familia: "Válvulas",
    unidad: "uni", img: "valvula",
    proveedores: {
      aqua: { ref: "22070", bruto: 143.30, dto: 61, marca: "MT" },
      aram: { ref: "3121-10", bruto: 66.65, dto: 50, marca: "—" },
    }
  },
  {
    id: "filtro-2", desc: "Filtro latón inclinado malla H-H 2\"", familia: "Filtros",
    unidad: "uni", img: "filtro",
    proveedores: {
      aqua: { ref: "15038", bruto: 67.39, dto: 61, marca: "MT" },
      aram: { ref: "3302-09", bruto: 47.14, dto: 50, marca: "—" },
    }
  },
  {
    id: "filtro-25", desc: "Filtro latón inclinado malla H-H 2½\"", familia: "Filtros",
    unidad: "uni", img: "filtro",
    proveedores: {
      aqua: { ref: "25173", bruto: 109.89, dto: 61, marca: "GENEB" },
    }
  },

  // === FITTINGS LATÓN ===
  {
    id: "ft-rm-50-15", desc: "Fitting latón enlace rosca macho 50×1½\" r/ext", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aqua: { ref: "46673", bruto: 23.64, dto: 67, marca: "MT" },
    }
  },
  {
    id: "ft-rm-63-2", desc: "Fitting latón enlace rosca macho 63×2\" r/ext", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aqua: { ref: "46674", bruto: 40.58, dto: 67, marca: "MT" },
      aram: { ref: "5317", bruto: 24.45, dto: 50, marca: "—" },
    }
  },
  {
    id: "ft-codo-50", desc: "Fitting latón codo 90° igual 50 r/ext", familia: "Fittings Latón",
    unidad: "uni", img: "codo",
    proveedores: {
      aqua: { ref: "46652", bruto: 48.64, dto: 67, marca: "MT" },
    }
  },
  {
    id: "ft-codo-63", desc: "Fitting latón codo 90° igual 63 r/ext", familia: "Fittings Latón",
    unidad: "uni", img: "codo",
    proveedores: {
      aqua: { ref: "46653", bruto: 86.43, dto: 67, marca: "MT" },
    }
  },
  {
    id: "ft-rh-50-15", desc: "Fitting latón enlace rosca hembra 50×1½\" r/ext", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aram: { ref: "5310", bruto: 17.03, dto: 50, marca: "—" },
    }
  },
  {
    id: "ft-rh-63-2", desc: "Fitting latón enlace rosca hembra 63×2\" r/ext", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aqua: { ref: "12183", bruto: 42.08, dto: 57, marca: "MT" },
      aram: { ref: "5311", bruto: 28.87, dto: 50, marca: "—" },
    }
  },
  {
    id: "ft-rh-40-125", desc: "Fitting latón enlace rosca hembra 40×1¼\"", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aqua: { ref: "12190", bruto: 17.61, dto: 57, marca: "MT" },
      aram: { ref: "5309", bruto: 10.86, dto: 50, marca: "—" },
    }
  },
  {
    id: "ft-rm-75-25", desc: "Fitting latón enlace rosca macho 75×2½\"", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aqua: { ref: "12184", bruto: 101.10, dto: 61, marca: "MT" },
      aram: { ref: "5356", bruto: 47.14, dto: 50, marca: "—" },
    }
  },
  {
    id: "ft-rh-75-25", desc: "Fitting latón enlace rosca hembra 75×2½\"", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aqua: { ref: "12194", bruto: 102.45, dto: 61, marca: "MT" },
    }
  },
  {
    id: "ft-mang-63", desc: "Fitting manguito latón 63 r/ext", familia: "Fittings Latón",
    unidad: "uni", img: "fitting",
    proveedores: {
      aram: { ref: "5323", bruto: 21.95, dto: 50, marca: "—" },
    }
  },

  // === ACCESORIOS LATÓN (Te, codo, machón, tapón, reducción) ===
  {
    id: "lt-te-2", desc: "Te latón H 90° 2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "te",
    proveedores: {
      aqua: { ref: "11674", bruto: 33.96, dto: 61, marca: "MT" },
      aram: { ref: "3508", bruto: 27.01, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-te-25", desc: "Te latón H 90° 2½\"", familia: "Accesorios Latón",
    unidad: "uni", img: "te",
    proveedores: {
      aqua: { ref: "11675", bruto: 90.97, dto: 61, marca: "MT" },
    }
  },
  {
    id: "lt-codo-2", desc: "Codo latón H 90° 2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "codo",
    proveedores: {
      aqua: { ref: "11656", bruto: 26.74, dto: 61, marca: "MT" },
      aram: { ref: "3548", bruto: 16.46, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-codo-25", desc: "Codo latón H 90° 2½\"", familia: "Accesorios Latón",
    unidad: "uni", img: "codo",
    proveedores: {
      aqua: { ref: "11657", bruto: 64.78, dto: 61, marca: "MT" },
      aram: { ref: "3524", bruto: 39.79, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-mac-2", desc: "Machón latón 2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aqua: { ref: "11699", bruto: 12.22, dto: 61, marca: "MT" },
      aram: { ref: "3009", bruto: 8.67, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-mac-25", desc: "Machón latón 2½\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aqua: { ref: "11700", bruto: 36.86, dto: 61, marca: "MT" },
      aram: { ref: "3010", bruto: 12.76, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-mac-3", desc: "Machón latón 3\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3011", bruto: 21.95, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-mac-1", desc: "Machón latón 1\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3006", bruto: 2.52, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-mac-red-25-2", desc: "Machón latón reducido 2½\"×2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3037", bruto: 13.17, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-mac-red-2-15", desc: "Machón latón reducido 2\"×1½\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3036", bruto: 8.57, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-mac-red-15-125", desc: "Machón latón reducido 1½\"×1¼\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3034", bruto: 7.41, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-tap-2", desc: "Tapón latón M 2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "tapon",
    proveedores: {
      aqua: { ref: "11708", bruto: 12.19, dto: 61, marca: "MT" },
      aram: { ref: "3408", bruto: 6.80, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-tap-25", desc: "Tapón latón M 2½\"", familia: "Accesorios Latón",
    unidad: "uni", img: "tapon",
    proveedores: {
      aqua: { ref: "11709", bruto: 31.12, dto: 61, marca: "MT" },
    }
  },
  {
    id: "lt-red-3-2", desc: "Reducción latón Hex 3\"×2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "reduccion",
    proveedores: {
      aqua: { ref: "11749", bruto: 52.09, dto: 57, marca: "MT" },
      aram: { ref: "3242", bruto: 16.96, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-red-3-25", desc: "Reducción latón Hex 3\"×2½\"", familia: "Accesorios Latón",
    unidad: "uni", img: "reduccion",
    proveedores: {
      aqua: { ref: "11750", bruto: 33.88, dto: 61, marca: "MT" },
    }
  },
  {
    id: "lt-red-25-2", desc: "Reducción latón M/H 2½\"×2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "reduccion",
    proveedores: {
      aram: { ref: "3240", bruto: 15.37, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-red-2-15", desc: "Reducción latón M/H 2\"×1½\"", familia: "Accesorios Latón",
    unidad: "uni", img: "reduccion",
    proveedores: {
      aram: { ref: "3239", bruto: 5.49, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-red-15-1", desc: "Reducción latón M/H 1½\"×1\"", familia: "Accesorios Latón",
    unidad: "uni", img: "reduccion",
    proveedores: {
      aram: { ref: "3233", bruto: 5.43, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-red-2-1", desc: "Reducción latón M/H 2\"×1\"", familia: "Accesorios Latón",
    unidad: "uni", img: "reduccion",
    proveedores: {
      aram: { ref: "3237", bruto: 5.49, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-red-1-34", desc: "Reducción latón H 1\"–M ¾\"", familia: "Accesorios Latón",
    unidad: "uni", img: "reduccion",
    proveedores: {
      aqua: { ref: "11781", bruto: 4.23, dto: 57, marca: "MT" },
    }
  },
  {
    id: "lt-alarg-15-2", desc: "Alargadera latón M/H reducida 1½\"×2\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3212", bruto: 20.72, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-alarg-34-1", desc: "Alargadera latón M/H reducida ¾\"×1\"", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3206", bruto: 2.60, dto: 50, marca: "—" },
    }
  },
  {
    id: "lt-alarg-12-34", desc: "Alargadera metal M/H reducida ½\"×¾\" cromo", familia: "Accesorios Latón",
    unidad: "uni", img: "machon",
    proveedores: {
      aram: { ref: "3204C", bruto: 2.40, dto: 50, marca: "—" },
    }
  },

  // === RACORES CONTADOR (exclusivos Aramburu) ===
  {
    id: "rc-50-25", desc: "Racor contador 50 T/loca H 2½\"-M 2\"", familia: "Racores Contador",
    unidad: "uni", img: "fitting",
    proveedores: {
      aram: { ref: "5075", bruto: 50.16, dto: 50, marca: "—" },
    }
  },
  {
    id: "rc-30-15", desc: "Racor contador 30 T/loca H 1½\"-M 1¼\"", familia: "Racores Contador",
    unidad: "uni", img: "fitting",
    proveedores: {
      aram: { ref: "5073", bruto: 18.01, dto: 50, marca: "—" },
    }
  },
  {
    id: "rc-20-1", desc: "Racor contador 20 T/loca H 1\"-M ¾\"", familia: "Racores Contador",
    unidad: "uni", img: "fitting",
    proveedores: {
      aram: { ref: "5071", bruto: 6.11, dto: 50, marca: "—" },
    }
  },

  // === TUBERÍAS PVC EVACUACIÓN ===
  {
    id: "pvc-110", desc: "Tubería PVC evacuación B AENOR 110×3m", familia: "Tuberías",
    unidad: "m", img: "tubo-pvc",
    proveedores: {
      aqua: { ref: "16999", bruto: 8.29, dto: 68.5, marca: "HIDRA" },
    }
  },
  {
    id: "pvc-125", desc: "Tubería PVC evacuación B AENOR 125×3m", familia: "Tuberías",
    unidad: "m", img: "tubo-pvc",
    proveedores: {
      aqua: { ref: "17000", bruto: 8.54, dto: 68.5, marca: "HIDRA" },
    }
  },

  // === PVC accesorios ===
  {
    id: "pvc-te-125", desc: "Te 87° M-H PVC evacuación 125", familia: "PVC Evacuación",
    unidad: "uni", img: "te-pvc",
    proveedores: {
      aqua: { ref: "13286", bruto: 4.26, dto: 50, marca: "MLC" },
    }
  },
  {
    id: "pvc-tedoble-110", desc: "Te 87° doble plana M-H PVC evacuación 110", familia: "PVC Evacuación",
    unidad: "uni", img: "te-pvc",
    proveedores: {
      aqua: { ref: "13302", bruto: 6.48, dto: 48, marca: "CREAR" },
    }
  },
  {
    id: "pvc-codo45-125", desc: "Codo 45° M-H PVC evacuación 125", familia: "PVC Evacuación",
    unidad: "uni", img: "codo-pvc",
    proveedores: {
      aqua: { ref: "13230", bruto: 2.46, dto: 48, marca: "MLC" },
    }
  },
  {
    id: "pvc-codo87-125", desc: "Codo 87° M-H PVC evacuación 125", familia: "PVC Evacuación",
    unidad: "uni", img: "codo-pvc",
    proveedores: {
      aqua: { ref: "13217", bruto: 2.70, dto: 50, marca: "MLC" },
    }
  },
  {
    id: "pvc-red-125-110", desc: "Reducción excéntrica PVC evac 125×110", familia: "PVC Evacuación",
    unidad: "uni", img: "reduc-pvc",
    proveedores: {
      aqua: { ref: "13313", bruto: 3.09, dto: 48, marca: "MLC" },
    }
  },
  {
    id: "pvc-red-125-90", desc: "Reducción excéntrica PVC evac 125×90", familia: "PVC Evacuación",
    unidad: "uni", img: "reduc-pvc",
    proveedores: {
      aqua: { ref: "13312", bruto: 3.16, dto: 48, marca: "CREAR" },
    }
  },
  {
    id: "pvc-deriv-125", desc: "Derivación 45° simple PVC evacuación 125", familia: "PVC Evacuación",
    unidad: "uni", img: "te-pvc",
    proveedores: {
      aram: { ref: "52046", bruto: 4.78, dto: 50, marca: "—" },
    }
  },
  {
    id: "pvc-deriv-doble-125", desc: "Derivación doble 45° PVC 125", familia: "PVC Evacuación",
    unidad: "uni", img: "te-pvc",
    proveedores: {
      aram: { ref: "52231", bruto: 12.38, dto: 50, marca: "—" },
    }
  },
  {
    id: "pvc-red-esp-125-125", desc: "Reducción PVC especial 125-125 larga", familia: "PVC Evacuación",
    unidad: "uni", img: "reduc-pvc",
    proveedores: {
      aram: { ref: "7125125", bruto: 11.96, dto: 50, marca: "—" },
    }
  },
  {
    id: "pvc-red-esp-160-125", desc: "Reducción PVC especial 160-125 larga", familia: "PVC Evacuación",
    unidad: "uni", img: "reduc-pvc",
    proveedores: {
      aram: { ref: "7125160", bruto: 13.77, dto: 50, marca: "—" },
    }
  },
  {
    id: "pvc-red-esp-90-90", desc: "Reducción PVC especial 90-90 larga", familia: "PVC Evacuación",
    unidad: "uni", img: "reduc-pvc",
    proveedores: {
      aram: { ref: "79090", bruto: 8.78, dto: 50, marca: "—" },
    }
  },
  {
    id: "pvc-red-esp-90-85", desc: "Reducción PVC especial 90-85 larga", familia: "PVC Evacuación",
    unidad: "uni", img: "reduc-pvc",
    proveedores: {
      aram: { ref: "79085", bruto: 9.64, dto: 50, marca: "—" },
    }
  },
  {
    id: "caldereta-2020", desc: "Caldereta sifónica 20×20 s/vert 110-90 T-86V", familia: "PVC Evacuación",
    unidad: "uni", img: "filtro",
    proveedores: {
      aqua: { ref: "39508", bruto: 19.06, dto: 37, marca: "TECNO" },
    }
  },

  // === FITTINGS PE100 ===
  {
    id: "pe-fit-rh-40", desc: "Fitting PE enlace rosca hembra 40×1¼\"", familia: "Fittings PE",
    unidad: "uni", img: "fitting-pe",
    proveedores: {
      aqua: { ref: "12099", bruto: 4.04, dto: 57, marca: "HID" },
    }
  },
  {
    id: "pe-fit-rh-50", desc: "Fitting PE enlace rosca hembra 50×1½\"", familia: "Fittings PE",
    unidad: "uni", img: "fitting-pe",
    proveedores: {
      aqua: { ref: "12100", bruto: 4.66, dto: 57, marca: "HID" },
    }
  },
  {
    id: "pe-fit-rh-63", desc: "Fitting PE enlace rosca hembra 63×2\"", familia: "Fittings PE",
    unidad: "uni", img: "fitting-pe",
    proveedores: {
      aqua: { ref: "12101", bruto: 8.09, dto: 57, marca: "HID" },
    }
  },
  {
    id: "pe-fit-codo-40", desc: "Fitting PE codo 90° igual 40", familia: "Fittings PE",
    unidad: "uni", img: "fitting-pe",
    proveedores: {
      aqua: { ref: "11996", bruto: 6.19, dto: 57, marca: "HID" },
    }
  },
  {
    id: "pe-fit-codo-50", desc: "Fitting PE codo 90° igual 50", familia: "Fittings PE",
    unidad: "uni", img: "fitting-pe",
    proveedores: {
      aqua: { ref: "11997", bruto: 8.32, dto: 57, marca: "HID" },
    }
  },
  {
    id: "pe-fit-codo-63", desc: "Fitting PE codo 90° igual 63", familia: "Fittings PE",
    unidad: "uni", img: "fitting-pe",
    proveedores: {
      aqua: { ref: "11998", bruto: 13.31, dto: 57, marca: "HID" },
    }
  },

  // === ELECTROFUSIÓN PE100 ===
  {
    id: "ef-codo-50", desc: "Codo 90° PE100 electrofusión 50 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "490504050", bruto: 12.35, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-codo-63", desc: "Codo 90° PE100 electrofusión 63 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aqua: { ref: "11891", bruto: 24.41, dto: 59, marca: "AGRU" },
    }
  },
  {
    id: "ef-codo-75", desc: "Codo 90° PE100 electrofusión 75 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aqua: { ref: "11892", bruto: 31.51, dto: 59, marca: "AGRU" },
      aram: { ref: "490504075", bruto: 22.14, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-codo-90", desc: "Codo 90° PE100 electrofusión 90 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "490504090", bruto: 29.35, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-codo-iny-63", desc: "Codo 90° PE100 inyectado 63 SDR11", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aqua: { ref: "12361", bruto: 15.29, dto: 59, marca: "AGRU" },
    }
  },
  {
    id: "ef-codo-iny-75", desc: "Codo 90° PE100 inyectado 75 SDR11", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aqua: { ref: "12362", bruto: 18.66, dto: 59, marca: "AGRU" },
    }
  },
  {
    id: "ef-red-75-63", desc: "Reducción PE electrofusión 75×63 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "491104075063", bruto: 14.81, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-red-63-50", desc: "Reducción PE electrofusión 63×50 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "491104063050", bruto: 11.10, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-red-63-40", desc: "Reducción PE electrofusión 63×40 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "491104063040", bruto: 11.10, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-red-50-40", desc: "Reducción PE electrofusión 50×40 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "491104050040", bruto: 10.02, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-mang-90", desc: "Manguito PE electrofusión 90 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "490104090", bruto: 8.37, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-te-90", desc: "Te 90° PE electrofusión 90 PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "490404090", bruto: 24.38, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-trans-50", desc: "Transición PE/latón R/H 50×1½\" PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "493107050015B", bruto: 37.14, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-trans-90-rm", desc: "Transición PE/latón R/M 90×3\" PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "492107090030B", bruto: 150.57, dto: 50, marca: "—" },
    }
  },
  {
    id: "ef-trans-90-rh", desc: "Transición PE/latón R/H 90×3\" PN16", familia: "Electrofusión",
    unidad: "uni", img: "electro",
    proveedores: {
      aram: { ref: "493107090030B", bruto: 150.00, dto: 50, marca: "—" },
    }
  },

  // === TUBOS PE100 ===
  {
    id: "tubo-pe-40", desc: "Tubería PE100 AENOR 40-10 atm B6m", familia: "Tuberías",
    unidad: "m", img: "tubo-pe",
    proveedores: {
      aqua: { ref: "27707", bruto: 1.94, dto: 55, marca: "PFERR" },
    }
  },
  {
    id: "tubo-pe-50", desc: "Tubería PE100 AENOR 50-10 atm B6m", familia: "Tuberías",
    unidad: "m", img: "tubo-pe",
    proveedores: {
      aqua: { ref: "16660", bruto: 3.32, dto: 65, marca: "PFERR" },
    }
  },
  {
    id: "tubo-pe-63", desc: "Tubería PE100 63-10 atm B6m", familia: "Tuberías",
    unidad: "m", img: "tubo-pe",
    proveedores: {
      aram: { ref: "63-10AD100B6", bruto: 3.25, dto: 50, marca: "—" },
    }
  },
  {
    id: "tubo-pe-75", desc: "Tubería PE100 AENOR 75-10 atm B6m", familia: "Tuberías",
    unidad: "m", img: "tubo-pe",
    proveedores: {
      aqua: { ref: "16670", bruto: 7.49, dto: 65, marca: "HIDRA" },
    }
  },
  {
    id: "tubo-pe-75-16", desc: "Tubería PE100 AENOR 75-16 atm B6m", familia: "Tuberías",
    unidad: "m", img: "tubo-pe",
    proveedores: {
      aqua: { ref: "16673", bruto: 9.74, dto: 55, marca: "HIDRA" },
    }
  },
  {
    id: "tubo-pe-140", desc: "Tubería PE100 AENOR 140-10 atm B6m", familia: "Tuberías",
    unidad: "m", img: "tubo-pe",
    proveedores: {
      aqua: { ref: "16694", bruto: 23.05, dto: 55, marca: "HIDRA" },
    }
  },

  // === COBRE ===
  {
    id: "cu-mang-22", desc: "Cobre manguito H 22 (270)", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aqua: { ref: "10690", bruto: 0.76, dto: 55, marca: "TRADE" },
      aram: { ref: "4049", bruto: 1.98, dto: 50, marca: "—" },
    }
  },
  {
    id: "cu-codo-22", desc: "Cobre codo H 90° 22 (90)", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aqua: { ref: "10647", bruto: 1.36, dto: 55, marca: "TRADE" },
      aram: { ref: "4109", bruto: 2.15, dto: 50, marca: "—" },
    }
  },
  {
    id: "cu-codo-22-12", desc: "Cobre codo 90° 22×½\" (GCU)", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aram: { ref: "4110", bruto: 4.20, dto: 50, marca: "—" },
    }
  },
  {
    id: "cu-codo-22-34", desc: "Cobre codo 92° 22×¾\" (GCU)", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aram: { ref: "4220", bruto: 5.07, dto: 50, marca: "—" },
    }
  },
  {
    id: "cu-mang-243", desc: "Cobre manguito 243 GCU 22×¾\"", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aram: { ref: "4014", bruto: 1.89, dto: 50, marca: "—" },
    }
  },
  {
    id: "cu-mang-18-34", desc: "Cobre manguito 270 GCU 18×¾\"", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aram: { ref: "4049-18", bruto: 1.98, dto: 50, marca: "—" },
    }
  },
  {
    id: "cu-codo-18-12", desc: "Cobre codo 90° 18×½\"", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aram: { ref: "4109-18", bruto: 2.15, dto: 50, marca: "—" },
    }
  },
  {
    id: "cu-tap-35", desc: "Cobre tapón H 35 (301)", familia: "Cobre",
    unidad: "uni", img: "tapon",
    proveedores: {
      aqua: { ref: "10700", bruto: 9.93, dto: 58, marca: "IBP" },
    }
  },
  {
    id: "cu-tap-42", desc: "Cobre tapón H 42 (301)", familia: "Cobre",
    unidad: "uni", img: "tapon",
    proveedores: {
      aqua: { ref: "10701", bruto: 17.53, dto: 55, marca: "IBP" },
    }
  },
  {
    id: "cu-tubo-18", desc: "Tubería cobre duro 18×1mm (B5m)", familia: "Cobre",
    unidad: "m", img: "tubo-pe",
    proveedores: {
      aram: { ref: "2100001200", bruto: 5.24, dto: 0, marca: "—" },
    }
  },
  {
    id: "ent-22-34", desc: "LT-CU entronque M 22×¾\"", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aqua: { ref: "25528", bruto: 1.90, dto: 55, marca: "MT" },
    }
  },
  {
    id: "manguito-cu-274-3-4", desc: "Manguito 270 GCU 42×1½\"", familia: "Cobre",
    unidad: "uni", img: "cobre",
    proveedores: {
      aram: { ref: "4056", bruto: 14.68, dto: 50, marca: "—" },
    }
  },

  // === BATERÍAS DE CONTADORES ===
  {
    id: "bat-kit-20", desc: "Kit válvula entrada+salida DN20 batería VH c/manguito", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "58793", bruto: 38.35, dto: 38, marca: "GTL" },
    }
  },
  {
    id: "bat-kit-kovh", desc: "Kit válvula bat. contador entrada+salida ref. KOVHDN20", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "27774", bruto: 21.58, dto: 0, marca: "G" },
    }
  },
  {
    id: "bat-emas-ent", desc: "Llave entrada batería bola Emasesa DN20 c/mang 1\"", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aram: { ref: "08K102BT20", bruto: 25.20, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-emas-sal", desc: "Llave salida batería bola Emasesa DN20 c/purga c/mang 1\"", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aram: { ref: "08K201BT20", bruto: 23.90, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-6c", desc: "Batería contadores PPR 6C-2F 2½\"", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "40253", bruto: 233.29, dto: 38, marca: "GTL" },
    }
  },
  {
    id: "bat-10c", desc: "Batería contadores PPR 10C-2F 2½\" BH", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "26113", bruto: 243.57, dto: 60, marca: "BH" },
    }
  },
  {
    id: "bat-12c", desc: "Batería contadores PPR 12C-2F 2½\" Ø75", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "26114", bruto: 259.23, dto: 59.26, marca: "GTL" },
      aram: { ref: "03BPRM122212ST", bruto: 223.35, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-18c", desc: "Batería contadores PPR 18C-3F 2½\" BH", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "26120", bruto: 388.20, dto: 61.94, marca: "GTL" },
    }
  },
  {
    id: "bat-20c", desc: "Batería contadores PPR 20C-2F 2½\"", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "26121", bruto: 327.43, dto: 60.11, marca: "BH" },
    }
  },
  {
    id: "bat-22c", desc: "Batería contadores PPR 22C-2F 2½\" BH", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "26123", bruto: 339.86, dto: 59.46, marca: "BTS" },
    }
  },
  {
    id: "bat-24c", desc: "Batería contadores PPR 24C-3F 2½\" BH", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aqua: { ref: "26125", bruto: 442.88, dto: 62.64, marca: "GTL" },
      aram: { ref: "03BPRM243212ST", bruto: 362.57, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-puente", desc: "Puente contador 1\" – 115mm", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aram: { ref: "04CL100100", bruto: 12.17, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-conex-1x50", desc: "Conexión blindada M-H 1×50", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aram: { ref: "6-M1H1-50", bruto: 17.87, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-conex-34x40", desc: "Conexión batería M-H ¾×3/4×40", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aram: { ref: "6-M34H3-40", bruto: 10.38, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-brida-ciega", desc: "Brida ciega contador", familia: "Baterías",
    unidad: "uni", img: "bateria",
    proveedores: {
      aram: { ref: "04CIEGA", bruto: 5.60, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-junta-ancha-1", desc: "Junta goma EPDM ancha 1\"", familia: "Baterías",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "02414", bruto: 0.106, dto: 50, marca: "—" },
    }
  },
  {
    id: "bat-junta-ancha-34", desc: "Junta goma EPDM ancha bat. exc. ¾\"", familia: "Baterías",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "02413", bruto: 0.053, dto: 50, marca: "—" },
    }
  },
  {
    id: "lat-inox-batt", desc: "Latiguillo inox batería M-H ¾-¾×40cm", familia: "Latiguillos",
    unidad: "uni", img: "latiguillo",
    proveedores: {
      aqua: { ref: "24738", bruto: 8.77, dto: 40, marca: "FLEXI" },
    }
  },

  // === AISLAMIENTOS ===
  {
    id: "ais-pe-22", desc: "Aislamiento coquilla PE 9mm Ø22 (2m)", familia: "Aislamientos",
    unidad: "m", img: "aislamiento",
    proveedores: {
      aqua: { ref: "29147", bruto: 0.7452, dto: 58, marca: "ITFLE" },
      aram: { ref: "060222155PE0N0", bruto: 0.571, dto: 50, marca: "—" },
    }
  },
  {
    id: "ais-pe-28", desc: "Aislamiento coquilla PE 9mm Ø28 (2m)", familia: "Aislamientos",
    unidad: "m", img: "aislamiento",
    proveedores: {
      aqua: { ref: "29148", bruto: 0.9936, dto: 58, marca: "ITFLE" },
    }
  },
  {
    id: "ais-elast-25", desc: "Aislamiento coquilla elastomérico 25mm Ø25 (2m)", familia: "Aislamientos",
    unidad: "m", img: "aislamiento",
    proveedores: {
      aqua: { ref: "35221", bruto: 6.20, dto: 58, marca: "ITFLE" },
    }
  },
  {
    id: "ais-elast-6mm", desc: "Aislamiento coquilla elastomérico 6mm Ø25 (2m)", familia: "Aislamientos",
    unidad: "m", img: "aislamiento",
    proveedores: {
      aqua: { ref: "39063", bruto: 1.27, dto: 58, marca: "ITFLE" },
    }
  },

  // === FIJACIONES Y ABRAZADERAS ===
  {
    id: "abz-iso-125", desc: "Abrazadera fijación cincada Ø125 M-8 isofónica", familia: "Fijaciones",
    unidad: "uni", img: "abrazadera",
    proveedores: {
      aqua: { ref: "24327", bruto: 2.72, dto: 57, marca: "MARTI" },
    }
  },
  {
    id: "abz-iso-75", desc: "Abrazadera isofónica M-8/10 75 (75-81)", familia: "Fijaciones",
    unidad: "uni", img: "abrazadera",
    proveedores: {
      aram: { ref: "33435081", bruto: 1.58, dto: 50, marca: "—" },
    }
  },
  {
    id: "abz-nylon-22-25", desc: "Abrazadera nylon gris 22-25", familia: "Fijaciones",
    unidad: "uni", img: "abrazadera",
    proveedores: {
      aram: { ref: "0853622", bruto: 0.215, dto: 50, marca: "—" },
    }
  },
  {
    id: "abz-nylon-26-28", desc: "Abrazadera nylon gris 26-28", familia: "Fijaciones",
    unidad: "uni", img: "abrazadera",
    proveedores: {
      aram: { ref: "0853626", bruto: 0.24, dto: 50, marca: "—" },
    }
  },
  {
    id: "tirafondo-m6-30", desc: "Tirafondo M-6×30", familia: "Fijaciones",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "6356630", bruto: 0.053, dto: 50, marca: "—" },
    }
  },
  {
    id: "tirafondo-m8", desc: "Tirafondo M-8", familia: "Fijaciones",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "6356840", bruto: 0.107, dto: 50, marca: "—" },
    }
  },
  {
    id: "varilla-m6", desc: "Varilla roscada M-6 (L1m)", familia: "Fijaciones",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "6303006", bruto: 1.08, dto: 50, marca: "—" },
    }
  },
  {
    id: "taco-duopower", desc: "Taco Duopower 6×30 (caja 100uds)", familia: "Fijaciones",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "535453", bruto: 0.098, dto: 50, marca: "—" },
    }
  },
  {
    id: "tornigrap-30", desc: "Tornigrap 30", familia: "Fijaciones",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "6174431", bruto: 0.06, dto: 50, marca: "—" },
    }
  },
  {
    id: "perfil-abra-20", desc: "Perfil abrazadera 20mm nylon B2m", familia: "Fijaciones",
    unidad: "m", img: "abrazadera",
    proveedores: {
      aram: { ref: "1333GM2", bruto: 1.96, dto: 50, marca: "—" },
    }
  },
  {
    id: "rapidstrut-2m", desc: "Rapidstrut 2m 41×41/2.5", familia: "Fijaciones",
    unidad: "uni", img: "abrazadera",
    proveedores: {
      aram: { ref: "6505245", bruto: 15.49, dto: 50, marca: "—" },
    }
  },
  {
    id: "mang-separador", desc: "Manguito separador 6×20", familia: "Fijaciones",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "6459620", bruto: 0.20, dto: 50, marca: "—" },
    }
  },
  {
    id: "brida-nylon", desc: "Brida nylon 3,6×290mm negra", familia: "Fijaciones",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "0903290", bruto: 0.075, dto: 50, marca: "—" },
    }
  },

  // === HERRAMIENTAS Y CONSUMIBLES ===
  {
    id: "estano-35", desc: "Estaño tipo plata 3,5% 250g", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aqua: { ref: "10794", bruto: 13.18, dto: 57, marca: "G" },
      aram: { ref: "AG05509", bruto: 21.62, dto: 50, marca: "—" },
    }
  },
  {
    id: "estano-6", desc: "Estaño plata 6% 250g", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "B02MAC07200N034", bruto: 40.95, dto: 50, marca: "—" },
    }
  },
  {
    id: "decapante", desc: "Decapante pasta c/pincel 125g", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aqua: { ref: "10797", bruto: 9.99, dto: 57, marca: "COLLK" },
      aram: { ref: "22137", bruto: 16.17, dto: 50, marca: "—" },
    }
  },
  {
    id: "castolin-gas", desc: "Castolin botella gas 1450 ONU 2037", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "73024-0GM", bruto: 9.86, dto: 50, marca: "—" },
    }
  },
  {
    id: "ceys-totaltech", desc: "CEYS Total Tech gris cartucho 290ml", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "507220", bruto: 11.88, dto: 50, marca: "—" },
    }
  },
  {
    id: "tangit-unilock", desc: "Hilo sellador Tangit Unilock 160m", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "2959378", bruto: 19.64, dto: 50, marca: "—" },
    }
  },
  {
    id: "lija-150", desc: "Lija metal 230×280 (0GR) - 150", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "48007", bruto: 1.88, dto: 50, marca: "—" },
    }
  },
  {
    id: "lija-100", desc: "Lija metal 230×280 (1GR) - 100", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "48009", bruto: 1.80, dto: 50, marca: "—" },
    }
  },
  {
    id: "disco-corte", desc: "Disco corte acero inox 115mm", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "45110", bruto: 1.21, dto: 50, marca: "—" },
    }
  },
  {
    id: "guante-t9", desc: "Guante poliuretano/nylon SIFER T9 negro", familia: "Consumibles",
    unidad: "par", img: "tapon",
    proveedores: {
      aram: { ref: "36498", bruto: 1.56, dto: 50, marca: "—" },
    }
  },
  {
    id: "guante-t10", desc: "Guante poliuretano/nylon SIFER T10 negro", familia: "Consumibles",
    unidad: "par", img: "tapon",
    proveedores: {
      aram: { ref: "36499", bruto: 1.34, dto: 50, marca: "—" },
    }
  },
  {
    id: "paletina", desc: "Paletina pintor triple estándar N27", familia: "Consumibles",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "49906", bruto: 3.06, dto: 50, marca: "—" },
    }
  },
  {
    id: "cinta-perforada", desc: "Cinta perforada 17×0,8mm (10m)", familia: "Consumibles",
    unidad: "rollo", img: "tapon",
    proveedores: {
      aram: { ref: "0835017", bruto: 9.08, dto: 50, marca: "—" },
    }
  },

  // === HERRAMIENTAS ===
  {
    id: "tijera-pvc", desc: "Tijera PVC Rothenberger 42", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "52000", bruto: 73.95, dto: 18, marca: "—" },
    }
  },
  {
    id: "calibrador", desc: "Calibrador plástico 20-25-32mm", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "CAL2032", bruto: 17.27, dto: 52, marca: "FE" },
    }
  },
  {
    id: "llave-inglesa", desc: "Llave inglesa gran apertura 6\"", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "1500001509", bruto: 31.05, dto: 18, marca: "—" },
    }
  },
  {
    id: "tenaza-12", desc: "Tenaza canal 12\"", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "70523", bruto: 1.80, dto: 50, marca: "—" },
    }
  },
  {
    id: "tenaza-10", desc: "Tenaza canal 10\"", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "70522", bruto: 20.95, dto: 18, marca: "—" },
    }
  },
  {
    id: "cutter-eco", desc: "Cutter eco hoja larga 100×18mm", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "95627", bruto: 3.67, dto: 50, marca: "—" },
    }
  },
  {
    id: "flexometro", desc: "Flexómetro forro caucho SIFER 5m", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "90800", bruto: 5.68, dto: 50, marca: "—" },
    }
  },
  {
    id: "pistola-silicona", desc: "Pistola silicona profesional", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "27219", bruto: 17.23, dto: 50, marca: "—" },
    }
  },
  {
    id: "broca-hormi", desc: "Broca hormigón SDS IMCO-Plus Ø6×110mm", familia: "Herramientas",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "01090611", bruto: 3.82, dto: 50, marca: "—" },
    }
  },

  // === ALQUILER MAQUINARIA ===
  {
    id: "alq-elec-2285", desc: "Alquiler máquina electrofusión Nº2285 (€/día)", familia: "Alquiler Maquinaria",
    unidad: "día", img: "electro",
    proveedores: {
      aqua: { ref: "21707", bruto: 30.05, dto: 0, marca: "G" },
    }
  },
  {
    id: "alq-elec-5182", desc: "Alquiler máquina electrofusión Nº5182 (€/día)", familia: "Alquiler Maquinaria",
    unidad: "día", img: "electro",
    proveedores: {
      aqua: { ref: "36252", bruto: 55.00, dto: 0, marca: "AGRU" },
    }
  },

  // === GRIFERÍA / VARIOS ===
  {
    id: "grifo-bola-34-1", desc: "Grifo bola ¾\"×1\"", familia: "Griferías",
    unidad: "uni", img: "valvula",
    proveedores: {
      aram: { ref: "3059-05-2", bruto: 7.66, dto: 50, marca: "—" },
    }
  },
  {
    id: "cerradura-emas", desc: "Cerradura Ezcurra Emasesa", familia: "Varios",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "AG37362", bruto: 35.00, dto: 0, marca: "—" },
    }
  },
  {
    id: "tornillo-lavabo", desc: "Juego tornillo lavabo 8×100", familia: "Varios",
    unidad: "uni", img: "tapon",
    proveedores: {
      aram: { ref: "2500A08", bruto: 1.35, dto: 50, marca: "—" },
    }
  },
];

// =========================================================
//  Helpers de cálculo
// =========================================================
const precioNeto = (prov) => prov ? +(prov.bruto * (1 - prov.dto / 100)).toFixed(4) : null;

// Devuelve el id del proveedor más barato (dinámico)
const proveedorMasBarato = (producto) => {
  const entries = Object.entries(producto.proveedores || {}).filter(([,v]) => v);
  if (entries.length === 0) return null;
  return entries.reduce((best, [id, v]) => {
    return (best === null || precioNeto(v) < precioNeto(producto.proveedores[best])) ? id : best;
  }, null);
};

const FAMILIAS = [
  { nombre: "Todo", icon: Boxes },
  { nombre: "Multicapa", icon: Package },
  { nombre: "Válvulas", icon: Wrench },
  { nombre: "Filtros", icon: Wrench },
  { nombre: "Fittings Latón", icon: Hammer },
  { nombre: "Accesorios Latón", icon: Hammer },
  { nombre: "Tuberías", icon: Package },
  { nombre: "PVC Evacuación", icon: Package },
  { nombre: "Fittings PE", icon: Hammer },
  { nombre: "Electrofusión", icon: Wrench },
  { nombre: "Cobre", icon: Wrench },
  { nombre: "Baterías", icon: Boxes },
  { nombre: "Latiguillos", icon: Wrench },
  { nombre: "Aislamientos", icon: Package },
  { nombre: "Fijaciones", icon: Hammer },
  { nombre: "Racores Contador", icon: Hammer },
  { nombre: "Consumibles", icon: Boxes },
  { nombre: "Herramientas", icon: Wrench },
  { nombre: "Alquiler Maquinaria", icon: Wrench },
  { nombre: "Griferías", icon: Wrench },
  { nombre: "Varios", icon: Boxes },
];

// =========================================================
//  SVG productos (mismos del catálogo anterior)
// =========================================================
const ProductSVG = ({ type }) => {
  const id = useId();
  const w = 200, h = 200;
  const baseProps = { width: "100%", height: "100%", viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "xMidYMid meet" };
  switch (type) {
    case "valvula":
      return (
        <svg {...baseProps}>
          <defs>
            <linearGradient id={`${id}-laton`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fde68a" /><stop offset="50%" stopColor="#d97706" /><stop offset="100%" stopColor="#92400e" />
            </linearGradient>
          </defs>
          <rect x="20" y="80" width="160" height="40" fill={`url(#${id}-laton)`} stroke="#451a03" strokeWidth="2" />
          <rect x="80" y="40" width="40" height="50" fill={`url(#${id}-laton)`} stroke="#451a03" strokeWidth="2" />
          <rect x="60" y="30" width="80" height="14" fill="#dc2626" stroke="#451a03" strokeWidth="2" />
          <circle cx="100" cy="100" r="16" fill="#451a03" />
        </svg>
      );
    case "fitting": case "fitting-pe":
      return (
        <svg {...baseProps}>
          <defs>
            <linearGradient id={`${id}-fit`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fde68a" /><stop offset="100%" stopColor="#92400e" />
            </linearGradient>
          </defs>
          <rect x="30" y="70" width="140" height="60" fill={`url(#${id}-fit)`} stroke="#451a03" strokeWidth="2" />
          <rect x="20" y="80" width="20" height="40" fill="#451a03" />
          <rect x="160" y="80" width="20" height="40" fill="#451a03" />
        </svg>
      );
    case "te":
      return (
        <svg {...baseProps}>
          <rect x="20" y="80" width="160" height="40" fill="#d97706" stroke="#451a03" strokeWidth="2" />
          <rect x="80" y="20" width="40" height="80" fill="#d97706" stroke="#451a03" strokeWidth="2" />
        </svg>
      );
    case "codo":
      return (
        <svg {...baseProps}>
          <path d="M 20 100 L 100 100 Q 120 100 120 80 L 120 20" stroke="#d97706" strokeWidth="40" fill="none" strokeLinecap="square" />
          <path d="M 20 100 L 100 100 Q 120 100 120 80 L 120 20" stroke="#451a03" strokeWidth="2" fill="none" />
        </svg>
      );
    case "machon":
      return (
        <svg {...baseProps}>
          <rect x="20" y="80" width="160" height="40" fill="#d97706" stroke="#451a03" strokeWidth="2" />
          <pattern id={`${id}-rosca`} x="0" y="0" width="6" height="40" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="40" stroke="#451a03" strokeWidth="1" />
          </pattern>
          <rect x="20" y="80" width="160" height="40" fill={`url(#${id}-rosca)`} opacity="0.4" />
        </svg>
      );
    case "tapon":
      return (
        <svg {...baseProps}>
          <rect x="60" y="50" width="80" height="100" fill="#d97706" stroke="#451a03" strokeWidth="2" />
          <rect x="50" y="60" width="100" height="20" fill="#92400e" stroke="#451a03" strokeWidth="2" />
        </svg>
      );
    case "reduccion":
      return (
        <svg {...baseProps}>
          <polygon points="20,70 90,70 110,90 110,110 90,130 20,130" fill="#d97706" stroke="#451a03" strokeWidth="2" />
          <rect x="110" y="85" width="70" height="30" fill="#d97706" stroke="#451a03" strokeWidth="2" />
        </svg>
      );
    case "filtro":
      return (
        <svg {...baseProps}>
          <rect x="20" y="80" width="50" height="40" fill="#d97706" stroke="#451a03" strokeWidth="2" />
          <rect x="130" y="80" width="50" height="40" fill="#d97706" stroke="#451a03" strokeWidth="2" />
          <polygon points="70,80 130,80 130,120 70,120 90,140 90,60" fill="#fbbf24" stroke="#451a03" strokeWidth="2" />
          <rect x="85" y="40" width="30" height="20" fill="#451a03" />
        </svg>
      );
    case "tubo-pex":
      return (
        <svg {...baseProps}>
          <ellipse cx="100" cy="100" rx="70" ry="60" fill="none" stroke="#fb923c" strokeWidth="14" />
          <ellipse cx="100" cy="100" rx="70" ry="60" fill="none" stroke="#fdba74" strokeWidth="2" />
        </svg>
      );
    case "tubo-pe":
      return (
        <svg {...baseProps}>
          <rect x="20" y="80" width="160" height="40" fill="#1e293b" stroke="#000" strokeWidth="2" />
          <rect x="20" y="92" width="160" height="14" fill="#3b82f6" />
          <text x="100" y="103" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold" fontFamily="monospace">PE100 AENOR</text>
        </svg>
      );
    case "tubo-pvc":
      return (
        <svg {...baseProps}>
          <rect x="20" y="60" width="160" height="80" rx="3" fill="#f3f4f6" stroke="#374151" strokeWidth="2" />
          <text x="100" y="105" textAnchor="middle" fill="#374151" fontSize="11" fontWeight="bold" fontFamily="monospace">PVC AENOR</text>
        </svg>
      );
    case "te-pvc":
      return (
        <svg {...baseProps}>
          <rect x="20" y="80" width="160" height="40" fill="#f3f4f6" stroke="#374151" strokeWidth="2" />
          <rect x="80" y="20" width="40" height="80" fill="#f3f4f6" stroke="#374151" strokeWidth="2" />
        </svg>
      );
    case "codo-pvc":
      return (
        <svg {...baseProps}>
          <path d="M 20 100 L 100 100 Q 120 100 120 80 L 120 20" stroke="#f3f4f6" strokeWidth="40" fill="none" strokeLinecap="square" />
          <path d="M 20 100 L 100 100 Q 120 100 120 80 L 120 20" stroke="#374151" strokeWidth="2" fill="none" />
        </svg>
      );
    case "reduc-pvc":
      return (
        <svg {...baseProps}>
          <polygon points="20,60 90,60 130,90 130,110 90,140 20,140" fill="#f3f4f6" stroke="#374151" strokeWidth="2" />
          <rect x="130" y="85" width="50" height="30" fill="#f3f4f6" stroke="#374151" strokeWidth="2" />
        </svg>
      );
    case "electro":
      return (
        <svg {...baseProps}>
          <rect x="50" y="60" width="100" height="80" fill="#1e293b" stroke="#000" strokeWidth="2" />
          <circle cx="80" cy="100" r="6" fill="#f97316" />
          <circle cx="120" cy="100" r="6" fill="#f97316" />
          <rect x="55" y="120" width="90" height="3" fill="#fbbf24" />
        </svg>
      );
    case "cobre":
      return (
        <svg {...baseProps}>
          <rect x="20" y="85" width="160" height="30" fill="#fb923c" stroke="#7c2d12" strokeWidth="2" />
          <rect x="20" y="92" width="160" height="2" fill="#fdba74" />
          <text x="100" y="105" textAnchor="middle" fill="#7c2d12" fontSize="7" fontWeight="bold" fontFamily="monospace">CU</text>
        </svg>
      );
    case "mcap":
      return (
        <svg {...baseProps}>
          <rect x="20" y="80" width="160" height="40" fill="#fb923c" stroke="#7c2d12" strokeWidth="2" rx="2" />
          <rect x="20" y="86" width="160" height="2" fill="#fbbf24" />
          <rect x="20" y="112" width="160" height="2" fill="#fbbf24" />
        </svg>
      );
    case "bateria":
      return (
        <svg {...baseProps}>
          <rect x="40" y="40" width="120" height="120" fill="#475569" stroke="#0f172a" strokeWidth="2" />
          {[0,1,2,3].map(i => (
            <g key={i}>
              <circle cx={60 + i*30} cy="80" r="8" fill="#fbbf24" stroke="#0f172a" strokeWidth="1" />
              <circle cx={60 + i*30} cy="120" r="8" fill="#fbbf24" stroke="#0f172a" strokeWidth="1" />
            </g>
          ))}
        </svg>
      );
    case "latiguillo":
      return (
        <svg {...baseProps}>
          <pattern id={`${id}-trenza`} x="0" y="0" width="8" height="40" patternUnits="userSpaceOnUse">
            <rect width="8" height="40" fill="#9ca3af" />
            <line x1="0" y1="0" x2="8" y2="40" stroke="#6b7280" strokeWidth="1" />
            <line x1="8" y1="0" x2="0" y2="40" stroke="#6b7280" strokeWidth="1" />
          </pattern>
          <path d="M 30 60 Q 100 30 170 60 Q 100 130 30 160" stroke={`url(#${id}-trenza)`} strokeWidth="20" fill="none" />
          <circle cx="30" cy="60" r="14" fill="#fbbf24" stroke="#451a03" strokeWidth="2" />
          <circle cx="170" cy="60" r="14" fill="#fbbf24" stroke="#451a03" strokeWidth="2" />
        </svg>
      );
    case "aislamiento":
      return (
        <svg {...baseProps}>
          <ellipse cx="100" cy="100" rx="70" ry="50" fill="#1f2937" stroke="#000" strokeWidth="2" />
          <ellipse cx="100" cy="100" rx="50" ry="35" fill="#fb923c" />
          <text x="100" y="105" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="monospace">AISL</text>
        </svg>
      );
    case "abrazadera":
      return (
        <svg {...baseProps}>
          <circle cx="100" cy="100" r="50" fill="none" stroke="#374151" strokeWidth="14" />
          <circle cx="100" cy="100" r="50" fill="none" stroke="#9ca3af" strokeWidth="2" />
          <rect x="80" y="40" width="40" height="20" fill="#374151" />
        </svg>
      );
    default:
      return (
        <svg {...baseProps}>
          <rect x="50" y="50" width="100" height="100" fill="#9ca3af" stroke="#374151" strokeWidth="2" />
        </svg>
      );
  }
};

// Componente "logo" mini de proveedor
// Color helpers for dynamic providers
const COLOR_BG    = { emerald:"bg-emerald-50",   amber:"bg-amber-50",   blue:"bg-blue-50",   violet:"bg-violet-50",  rose:"bg-rose-50",   teal:"bg-teal-50"   };
const COLOR_ACTIVE= { emerald:"bg-emerald-700",  amber:"bg-amber-700",  blue:"bg-blue-700",  violet:"bg-violet-700", rose:"bg-rose-700",  teal:"bg-teal-700"  };
const COLOR_TAG_BG= { emerald:"bg-emerald-100",  amber:"bg-amber-100",  blue:"bg-blue-100",  violet:"bg-violet-100", rose:"bg-rose-100",  teal:"bg-teal-100"  };
const COLOR_TEXT  = { emerald:"text-emerald-900",amber:"text-amber-900",blue:"text-blue-900",violet:"text-violet-900",rose:"text-rose-900",teal:"text-teal-900"};
const COLOR_BORDER= { emerald:"border-emerald-900",amber:"border-amber-900",blue:"border-blue-900",violet:"border-violet-900",rose:"border-rose-900",teal:"border-teal-900"};
const COLOR_DOT   = { emerald:"bg-emerald-600",  amber:"bg-amber-600",  blue:"bg-blue-600",  violet:"bg-violet-600", rose:"bg-rose-600",  teal:"bg-teal-600"  };
const COLOR_TROPHY= { emerald:"text-emerald-700",amber:"text-amber-700",blue:"text-blue-700",violet:"text-violet-700",rose:"text-rose-700",teal:"text-teal-700"};

const getProvColor = (provId) => (PROVEEDORES.find(p => p.id === provId) || {}).color || "blue";
const getProvNombre = (provId) => { const p = PROVEEDORES.find(p => p.id === provId); return p ? p.nombre.toUpperCase() : provId.toUpperCase(); };

const TagProveedor = ({ tipo, size = "md" }) => {
  const col = getProvColor(tipo);
  const cls = size === "sm" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5";
  return (
    <span className={`inline-flex items-center gap-1 font-mono font-bold tracking-wider border ${cls} ${COLOR_TAG_BG[col]||"bg-blue-100"} ${COLOR_TEXT[col]||"text-blue-900"} ${COLOR_BORDER[col]||"border-blue-900"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${COLOR_DOT[col]||"bg-blue-600"}`} />
      {getProvNombre(tipo)}
    </span>
  );
};

// =========================================================
//  PANTALLA DE LOGIN
// =========================================================
function PantallaLogin({ onLogin, onAdminClick }) {
  const [operarioId, setOperarioId] = useState("");
  const [obraId, setObraId] = useState("");
  const [nombrePersonalizado, setNombrePersonalizado] = useState("");
  const [pin, setPin] = useState("");
  const [errorPin, setErrorPin] = useState("");
  const [crearObraAbierto, setCrearObraAbierto] = useState(false);
  const [nuevaObraNombre, setNuevaObraNombre] = useState("");
  const [nuevaObraDir, setNuevaObraDir] = useState("");
  const [creandoObra, setCreandoObra] = useState(false);
  const [errorCreaObra, setErrorCreaObra] = useState("");

  const operarioObj = OPERARIOS.find(o => (o.id || o) === operarioId);
  const esOtro = operarioObj?.nombre === "Otro (escribir nombre)";
  const nombreEfectivo = esOtro ? nombrePersonalizado : (operarioObj?.nombre || "");
  const tienePinAsignado = operarioObj && operarioObj.tienePin;
  const puedeEntrar = nombreEfectivo.trim().length > 1 && obraId &&
    (!tienePinAsignado || pin.length >= 4);
  const puedeCrearObra = nuevaObraNombre.trim().length > 2 && !creandoObra;

  const [validando, setValidando] = useState(false);

  const handleSubmit = async () => {
    if (!puedeEntrar || validando) return;
    if (tienePinAsignado) {
      setValidando(true);
      try {
        const r = await fetch(BACKEND_URL + "/operario/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operarioId: operarioObj.id, pin })
        });
        const data = await r.json();
        if (!data.ok) {
          setErrorPin("PIN incorrecto");
          setPin("");
          return;
        }
      } catch (e) {
        setErrorPin("Error de conexión. Inténtalo de nuevo.");
        return;
      } finally {
        setValidando(false);
      }
    }
    setErrorPin("");
    const obra = OBRAS.find(o => o.id === obraId);
    onLogin({ nombre: nombreEfectivo, obra });
  };

  const handleCrearObra = async () => {
    if (!puedeCrearObra) return;
    setCreandoObra(true);
    setErrorCreaObra("");
    try {
      const r = await fetch(BACKEND_URL + "/obra-nueva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nuevaObraNombre.trim(),
          dir: nuevaObraDir.trim(),
          creadaPor: nombreEfectivo || "anónimo"
        })
      });
      if (!r.ok) throw new Error("Error " + r.status);
      const obra = await r.json();
      // Añadirla a la lista en memoria para poder seleccionarla
      OBRAS = [...OBRAS, obra];
      setObraId(obra.id);
      setCrearObraAbierto(false);
      setNuevaObraNombre("");
      setNuevaObraDir("");
    } catch (e) {
      setErrorCreaObra("No se pudo crear la obra. Inténtalo de nuevo.");
    } finally {
      setCreandoObra(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-mono"
         style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(0,0,0,0.02) 30px, rgba(0,0,0,0.02) 31px)" }}>
      <div className="w-full max-w-md">
        <div className="bg-amber-500 border-4 border-stone-900 p-6 mb-3 shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
          <div className="text-[10px] tracking-[0.3em] mb-2">ARA CORPORATE</div>
          <h1 className="font-black text-4xl leading-none mb-1" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            PEDIDOS DE OBRA
          </h1>
          <div className="text-xs">Plataforma interna · Aquatubo · Aramburu</div>
        </div>

        <div className="bg-white border-4 border-stone-900 p-6 shadow-[8px_8px_0_0_rgba(0,0,0,1)] space-y-5">
          <div>
            <label className="font-bold text-xs tracking-widest text-stone-600 flex items-center gap-2 mb-2">
              <User className="w-3 h-3" /> NOMBRE DEL OPERARIO
            </label>
            <select
              value={operarioId}
              onChange={(e) => { setOperarioId(e.target.value); setPin(""); setErrorPin(""); }}
              className="w-full border-2 border-stone-900 bg-white p-3 text-sm focus:outline-none focus:bg-amber-50 font-mono"
            >
              <option value="">— Selecciona quién eres —</option>
              {OPERARIOS.filter(op => op.activo !== false).map(op => (
                <option key={op.id || op.nombre} value={op.id || op.nombre}>{op.nombre || op}</option>
              ))}
            </select>
            {esOtro && (
              <input
                type="text"
                placeholder="Tu nombre y apellido"
                value={nombrePersonalizado}
                onChange={(e) => setNombrePersonalizado(e.target.value)}
                className="w-full border-2 border-stone-900 bg-amber-50 p-3 mt-2 text-sm focus:outline-none font-mono"
              />
            )}
            {operarioId && tienePinAsignado && (
              <div className="mt-2">
                <label className="font-bold text-[10px] tracking-widest text-stone-600 mb-1 block">
                  🔑 TU PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value.replace(/\D/g,"")); setErrorPin(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className={`w-full border-2 p-3 text-sm focus:outline-none font-mono tracking-widest text-center text-xl ${
                    errorPin ? "border-red-600 bg-red-50" : "border-stone-900 bg-amber-50"
                  }`}
                  autoFocus
                />
                {errorPin && (
                  <div className="text-[11px] text-red-700 font-bold mt-1">{errorPin}</div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="font-bold text-xs tracking-widest text-stone-600 flex items-center gap-2 mb-2">
              <Construction className="w-3 h-3" /> OBRA EN LA QUE TRABAJAS HOY
            </label>
            <select
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
              className="w-full border-2 border-stone-900 bg-white p-3 text-sm focus:outline-none focus:bg-amber-50 font-mono"
            >
              <option value="">— Selecciona la obra —</option>
              {OBRAS.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>

            {/* Botón "+ Nueva obra" o formulario de creación */}
            {!crearObraAbierto ? (
              <button
                onClick={() => setCrearObraAbierto(true)}
                className="mt-2 w-full text-xs font-bold text-stone-700 border-2 border-dashed border-stone-400 p-2 hover:bg-amber-50 hover:border-stone-900 transition-all"
              >
                + ¿NO ESTÁ TU OBRA? AÑADE UNA NUEVA
              </button>
            ) : (
              <div className="mt-2 border-2 border-stone-900 bg-amber-50 p-3 space-y-2">
                <div className="text-[10px] tracking-widest font-bold text-stone-700">NUEVA OBRA</div>
                <input
                  type="text"
                  placeholder="Nombre de la obra (ej: Calle Real 5)"
                  value={nuevaObraNombre}
                  onChange={(e) => setNuevaObraNombre(e.target.value)}
                  className="w-full border-2 border-stone-900 bg-white p-2 text-xs focus:outline-none font-mono"
                />
                <input
                  type="text"
                  placeholder="Dirección completa (opcional)"
                  value={nuevaObraDir}
                  onChange={(e) => setNuevaObraDir(e.target.value)}
                  className="w-full border-2 border-stone-900 bg-white p-2 text-xs focus:outline-none font-mono"
                />
                {errorCreaObra && (
                  <div className="text-[10px] text-red-700 font-bold">{errorCreaObra}</div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCrearObraAbierto(false); setNuevaObraNombre(""); setNuevaObraDir(""); setErrorCreaObra(""); }}
                    className="flex-1 text-[10px] font-bold tracking-widest p-2 border-2 border-stone-900 bg-white hover:bg-stone-100"
                  >
                    CANCELAR
                  </button>
                  <button
                    onClick={handleCrearObra}
                    disabled={!puedeCrearObra}
                    className={`flex-1 text-[10px] font-bold tracking-widest p-2 border-2 border-stone-900 ${
                      puedeCrearObra ? "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900" : "bg-stone-200 text-stone-400 cursor-not-allowed"
                    }`}
                  >
                    {creandoObra ? "CREANDO…" : "✓ CREAR OBRA"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!puedeEntrar}
            className={`w-full p-4 font-black text-sm tracking-widest border-2 border-stone-900 transition-all ${
              puedeEntrar
                ? "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900 shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                : "bg-stone-200 text-stone-400 cursor-not-allowed"
            }`}
            style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}
          >
            {validando ? "VERIFICANDO…" : "ENTRAR AL CATÁLOGO →"}
          </button>

          <div className="text-[10px] text-stone-500 leading-relaxed border-t-2 border-stone-200 pt-3">
            Verás los precios de Aquatubo y Aramburu uno al lado del otro y podrás elegir el más barato para cada producto. Tu pedido quedará asignado a la obra seleccionada.
          </div>
        </div>

        <div className="text-center text-[10px] text-stone-500 mt-4 tracking-widest">
          ARA CORPORATE · SISTEMA INTERNO DE PEDIDOS
        </div>

        {onAdminClick && (
          <button onClick={onAdminClick}
                  className="mt-2 mx-auto block text-[10px] text-stone-400 hover:text-stone-700 tracking-widest">
            🔐 ACCESO ADMIN
          </button>
        )}
      </div>
    </div>
  );
}

// =========================================================
//  CARD DE PRODUCTO — comparativa dinámica de proveedores
// =========================================================
function CardProducto({ producto, cantidades, cantidadesM, addProv, removeProv, setExacta, setExactaM, onClick }) {
  const ganador = proveedorMasBarato(producto);
  const provIds = Object.keys(producto.proveedores || {}).filter(k => producto.proveedores[k]);
  const tieneVarios = provIds.length > 1;
  const cols = Math.max(provIds.length, 1);
  const esRolloBarra = !!(producto.cantidadPorUnidad && (producto.unidad === "rollo" || producto.unidad === "barra"));

  return (
    <div className="bg-white border-2 border-stone-900 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all">
      <button onClick={onClick} className="block w-full text-left">
        <div className="border-b-2 border-stone-900 bg-stone-50 aspect-square overflow-hidden">
          <ProductSVG type={producto.img} />
        </div>
        <div className="px-3 pt-3 pb-2">
          <div className="font-mono text-[9px] text-stone-500 tracking-widest mb-1">{producto.familia.toUpperCase()}</div>
          <div className="font-bold text-sm text-stone-900 leading-tight min-h-[2.5em]">{producto.desc}</div>
        </div>
      </button>

      <div className="grid border-t-2 border-stone-900" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {provIds.length === 0 ? (
          <div className="p-3 text-stone-400 text-[10px] italic">Sin precio</div>
        ) : provIds.map((provId, idx) => {
          const provData = producto.proveedores[provId];
          const neto = precioNeto(provData);
          const cant = cantidades[provId] || 0;
          const cantM = cantidadesM[provId] || 0;
          const col = getProvColor(provId);
          const esGanador = ganador === provId && tieneVarios;

          return (
            <div key={provId} className={`p-2 ${idx < provIds.length - 1 ? "border-r-2 border-stone-900" : ""} ${esGanador ? (COLOR_BG[col]||"bg-blue-50") : "bg-stone-50"}`}>
              <div className="flex items-center justify-between mb-1">
                <TagProveedor tipo={provId} size="sm" />
                {esGanador && <Trophy className={`w-3.5 h-3.5 ${COLOR_TROPHY[col]||"text-blue-700"}`} strokeWidth={2.5} />}
              </div>
              {provData ? (
                <>
                  <div className="font-black text-lg text-stone-900 leading-none mt-1" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                    €{neto.toFixed(2)}
                  </div>
                  {esRolloBarra ? (
                    <div className="font-mono text-[9px] text-stone-500 mb-1">€/m · 1 {producto.unidad} = €{(neto * producto.cantidadPorUnidad).toFixed(2)}</div>
                  ) : (
                    <div className="font-mono text-[9px] text-stone-500 mb-1">/{producto.unidad}</div>
                  )}

                  {/* LÍNEA 1: por rollos/barras o unidades normales */}
                  <div className="space-y-1">
                    {esRolloBarra && (
                      <div className="text-[9px] font-bold text-stone-600 tracking-widest">{producto.unidad.toUpperCase()}S</div>
                    )}
                    {cant === 0 ? (
                      <button onClick={(e) => { e.stopPropagation(); addProv(provId); }}
                              className="w-full bg-stone-900 text-white text-[10px] py-1.5 font-bold tracking-wider hover:opacity-80">
                        + AÑADIR
                      </button>
                    ) : (
                      <div className={`flex flex-col gap-0.5`}>
                        <div className={`flex items-center w-full justify-between ${COLOR_ACTIVE[col]||"bg-blue-700"} text-white px-1 py-1 gap-1`}>
                          <button onClick={(e) => { e.stopPropagation(); removeProv(provId); }} className="p-0.5"><Minus className="w-3 h-3" /></button>
                          <input type="number" min="0" value={cant}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) setExacta(provId, v); }}
                            className="w-10 text-center font-mono text-xs font-bold bg-stone-800 text-white border border-stone-500 focus:outline-none rounded-none" />
                          <button onClick={(e) => { e.stopPropagation(); addProv(provId); }} className="p-0.5"><Plus className="w-3 h-3" /></button>
                        </div>
                        {esRolloBarra && <div className="text-[9px] text-center text-stone-500">{cant * producto.cantidadPorUnidad}m</div>}
                      </div>
                    )}

                    {/* LÍNEA 2: metros sueltos (solo para rollo/barra) */}
                    {esRolloBarra && (
                      <>
                        <div className="text-[9px] font-bold text-stone-600 tracking-widest mt-1">METROS SUELTOS</div>
                        {cantM === 0 ? (
                          <button onClick={(e) => { e.stopPropagation(); setExactaM(provId, 1); }}
                                  className="w-full bg-stone-200 text-stone-900 text-[10px] py-1 font-bold tracking-wider hover:bg-stone-300 border border-stone-400">
                            + AÑADIR METROS
                          </button>
                        ) : (
                          <div className={`flex items-center w-full justify-between ${COLOR_ACTIVE[col]||"bg-blue-700"} text-white px-1 py-1 gap-1`}>
                            <button onClick={(e) => { e.stopPropagation(); setExactaM(provId, Math.max(0, cantM - 1)); }} className="p-0.5"><Minus className="w-3 h-3" /></button>
                            <input type="number" min="0" value={cantM}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setExactaM(provId, v); }}
                              className="w-10 text-center font-mono text-xs font-bold bg-stone-800 text-white border border-stone-500 focus:outline-none rounded-none" />
                            <button onClick={(e) => { e.stopPropagation(); setExactaM(provId, cantM + 1); }} className="p-0.5"><Plus className="w-3 h-3" /></button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="font-mono text-[10px] text-stone-400 italic mt-2">No disponible</div>
              )}
            </div>
          );
        })}
      </div>

      {tieneVarios && (() => {
        const precios = provIds.map(id => precioNeto(producto.proveedores[id])).filter(Boolean);
        if (precios.length < 2) return null;
        const min = Math.min(...precios); const max = Math.max(...precios);
        const pct = max > 0 ? Math.round(((max - min) / max) * 100) : 0;
        if (pct <= 0) return null;
        const col = getProvColor(ganador);
        return (
          <div className={`px-3 py-1.5 text-[10px] font-bold tracking-wider border-t-2 border-stone-900 ${COLOR_BG[col]||"bg-blue-50"} ${COLOR_TEXT[col]||"text-blue-900"}`}>
            AHORRO {pct}% · €{(max - min).toFixed(2)}/m con {getProvNombre(ganador)}
          </div>
        );
      })()}
    </div>
  );
}


function CatalogoApp({ usuario, onLogout }) {
  const [familia, setFamilia] = useState("Todo");
  const [busqueda, setBusqueda] = useState("");
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [productoSel, setProductoSel] = useState(null);
  const [pedidoEnviado, setPedidoEnviado] = useState(false);
  const [datosPedidoEnviado, setDatosPedidoEnviado] = useState(null);
  const [notasPedido, setNotasPedido] = useState("");
  const [enviandoPedido, setEnviandoPedido] = useState(false);

  // Productos no listados (pedidos manualmente por el operario)
  const [lineasNoListadas, setLineasNoListadas] = useState([]);
  const [modalNoListadoAbierto, setModalNoListadoAbierto] = useState(false);

  // Carrito: { "<id>:aqua": cantidad, "<id>:aram": cantidad }
  const [carrito, setCarrito] = useState({});

  const productos = useMemo(() => {
    return CATALOGO.filter(p => {
      const matchFam = familia === "Todo" || p.familia === familia;
      const matchSearch = busqueda === "" ||
        p.desc.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.proveedores.aqua?.ref || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.proveedores.aram?.ref || "").toLowerCase().includes(busqueda.toLowerCase());
      return matchFam && matchSearch;
    });
  }, [familia, busqueda]);

  const getCant = (id, prov) => carrito[`${id}:${prov}`] || 0;
  const setCant = (id, prov, fn) => setCarrito(c => {
    const k = `${id}:${prov}`;
    const nuevo = fn(c[k] || 0);
    if (nuevo <= 0) { const r = {...c}; delete r[k]; return r; }
    return { ...c, [k]: nuevo };
  });
  const addProv = (id, prov) => setCant(id, prov, n => n + 1);
  const removeProv = (id, prov) => setCant(id, prov, n => Math.max(0, n - 1));
  const setExacta = (id, prov, n) => setCant(id, prov, () => n);

  // Metros sueltos — clave separada "id:prov:m"
  const [carritoM, setCarritoM] = useState({});
  const getCantM = (id, prov) => carritoM[`${id}:${prov}`] || 0;
  const setExactaM = (id, prov, n) => setCarritoM(c => {
    const k = `${id}:${prov}`;
    if (!n || n <= 0) { const r = {...c}; delete r[k]; return r; }
    return { ...c, [k]: n };
  });

  // Cálculos del carrito
  const lineasCarrito = useMemo(() => {
    const lines = [];
    // Rollos/barras y unidades normales
    Object.entries(carrito).forEach(([k, cant]) => {
      const [id, prov] = k.split(":");
      const p = CATALOGO.find(x => x.id === id);
      if (!p || !p.proveedores[prov]) return;
      const proveedor = p.proveedores[prov];
      const neto = precioNeto(proveedor);
      const esRolloBarra = p.cantidadPorUnidad && (p.unidad === "rollo" || p.unidad === "barra");
      const mPorUnidad = esRolloBarra ? p.cantidadPorUnidad : 1;
      lines.push({
        id, prov, producto: p, proveedor, cantidad: cant, neto, mPorUnidad,
        subtotal: +(neto * mPorUnidad * cant).toFixed(2),
        esMetrosSueltos: false,
        metros: esRolloBarra ? +(cant * mPorUnidad).toFixed(1) : null
      });
    });
    // Metros sueltos
    Object.entries(carritoM).forEach(([k, cantM]) => {
      const [id, prov] = k.split(":");
      const p = CATALOGO.find(x => x.id === id);
      if (!p || !p.proveedores[prov] || !cantM) return;
      const proveedor = p.proveedores[prov];
      const neto = precioNeto(proveedor);
      lines.push({
        id, prov, producto: p, proveedor, cantidad: cantM, neto, mPorUnidad: 1,
        subtotal: +(neto * cantM).toFixed(2),
        esMetrosSueltos: true, metros: null
      });
    });
    return lines;
  }, [carrito, carritoM]);

  const totalAqua = lineasCarrito.filter(l => l.prov === "aqua").reduce((s, l) => s + l.subtotal, 0);
  const totalAram = lineasCarrito.filter(l => l.prov === "aram").reduce((s, l) => s + l.subtotal, 0);
  const totalGeneral = totalAqua + totalAram;
  const ivaAqua = totalAqua * 0.21;
  const ivaAram = totalAram * 0.21;
  const itemsCarrito = lineasCarrito.reduce((s, l) => s + l.cantidad, 0);

  // ¿hay productos donde no se eligió el más barato?
  const oportunidades = useMemo(() => {
    return lineasCarrito.filter(l => {
      const otroProv = l.prov === "aqua" ? "aram" : "aqua";
      const otro = l.producto.proveedores[otroProv];
      if (!otro) return false;
      return precioNeto(otro) < l.neto;
    });
  }, [lineasCarrito]);

  // === FUNCIONES DE ENVÍO/GUARDADO DE PEDIDO ===

  // Envía el pedido al backend (lo guarda en histórico)
  async function registrarPedidoEnBackend() {
    setEnviandoPedido(true);
    try {
      // Adaptar líneas al formato que espera el backend
      const linAqua = lineasCarrito.filter(l => l.prov === "aqua").map(l => ({
        ref: l.proveedor.ref,
        desc: l.producto.desc,
        cantidad: l.cantidad,
        unidad: l.producto.unidad,
        precioUnit: l.neto,
        importe: l.subtotal
      }));
      const linAram = lineasCarrito.filter(l => l.prov === "aram").map(l => ({
        ref: l.proveedor.ref,
        desc: l.producto.desc,
        cantidad: l.cantidad,
        unidad: l.producto.unidad,
        precioUnit: l.neto,
        importe: l.subtotal
      }));

      const r = await fetch(BACKEND_URL + "/enviar-pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operario: usuario.nombre,
          obra: usuario.obra,
          lineasAqua: linAqua,
          lineasAram: linAram,
          lineasNoListado: lineasNoListadas,
          notas: notasPedido
        })
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      setDatosPedidoEnviado({
        pedidoId: data.pedidoId,
        fechaIso: new Date().toISOString(),
        operario: usuario.nombre,
        obra: usuario.obra,
        lineasAqua: linAqua,
        lineasAram: linAram,
        lineasNoListado: lineasNoListadas,
        notas: notasPedido,
        totalAqua, totalAram, totalGeneral,
        ivaAqua, ivaAram
      });
      setPedidoEnviado(true);
    } catch (e) {
      // Aun si el backend falla, dejamos que el operario tenga su PDF
      console.warn("[ARA] Error guardando pedido:", e.message);
      setDatosPedidoEnviado({
        pedidoId: "local-" + Date.now(),
        fechaIso: new Date().toISOString(),
        operario: usuario.nombre,
        obra: usuario.obra,
        lineasAqua: lineasCarrito.filter(l => l.prov === "aqua").map(l => ({
          ref: l.proveedor.ref,
          desc: l.esMetrosSueltos ? `${l.producto.desc} (metros sueltos)` : l.producto.desc,
          cantidad: l.cantidad,
          unidad: l.esMetrosSueltos ? "m" : l.producto.unidad,
          precioUnit: l.neto, importe: l.subtotal,
          mPorUnidad: l.mPorUnidad,
          metros: l.metros,
          esMetrosSueltos: !!l.esMetrosSueltos
        })),
        lineasAram: lineasCarrito.filter(l => l.prov === "aram").map(l => ({
          ref: l.proveedor.ref,
          desc: l.esMetrosSueltos ? `${l.producto.desc} (metros sueltos)` : l.producto.desc,
          cantidad: l.cantidad,
          unidad: l.esMetrosSueltos ? "m" : l.producto.unidad,
          precioUnit: l.neto, importe: l.subtotal,
          mPorUnidad: l.mPorUnidad,
          metros: l.metros,
          esMetrosSueltos: !!l.esMetrosSueltos
        })),
        lineasNoListado: lineasNoListadas,
        notas: notasPedido,
        totalAqua, totalAram, totalGeneral, ivaAqua, ivaAram,
        errorBackend: e.message
      });
      setPedidoEnviado(true);
    } finally {
      setEnviandoPedido(false);
    }
  }

  // Genera mensaje de WhatsApp para un proveedor
  function generarMensajeWhatsApp(prov) {
    const d = datosPedidoEnviado;
    if (!d) return "";
    const fecha = new Date(d.fechaIso).toLocaleDateString("es-ES");

    // COMPLETO
    if (prov === "completo") {
      let txt = `*PEDIDO COMPLETO · ARA CORPORATE*\n`;
      txt += `Obra: ${d.obra.nombre}\nFecha: ${fecha}\nSolicita: ${d.operario}\nID: ${d.pedidoId}\n\n`;
      if ((d.lineasAqua || []).length > 0) {
        txt += `*── AQUATUBO SL (60 días) ──*\n`;
        d.lineasAqua.forEach(l => { const mu = l.metros ? ` (${l.metros}m)` : ""; txt += `• ${l.cantidad} ${l.unidad}${mu} · ${l.desc} (ref ${l.ref}) — €${l.importe.toFixed(2)}\n`; });
        txt += `Subtotal: €${d.totalAqua.toFixed(2)} + IVA\n\n`;
      }
      if ((d.lineasAram || []).length > 0) {
        txt += `*── ARAMBURU GUZMÁN SLU (Contado) ──*\n`;
        d.lineasAram.forEach(l => { const mu = l.metros ? ` (${l.metros}m)` : ""; txt += `• ${l.cantidad} ${l.unidad}${mu} · ${l.desc} (ref ${l.ref}) — €${l.importe.toFixed(2)}\n`; });
        txt += `Subtotal: €${d.totalAram.toFixed(2)} + IVA\n\n`;
      }
      const todosNoList = d.lineasNoListado || [];
      if (todosNoList.length > 0) {
        txt += `*── NO LISTADOS (confirmar precio) ──*\n`;
        todosNoList.forEach(l => {
          const pl = l.proveedor === "aqua" ? "Aquatubo" : l.proveedor === "aram" ? "Aramburu" : l.proveedor === "indistinto" ? "Cualquiera" : l.proveedor;
          txt += `• ${l.cantidad} ${l.unidad}: ${l.desc} (${pl})\n`;
        });
        txt += `\n`;
      }
      txt += `*TOTAL GENERAL: €${(d.totalGeneral * 1.21).toFixed(2)} IVA inc.*\n`;
      if (d.notas) txt += `\n*Notas:*\n${d.notas}\n`;
      txt += `\n— ARA Corporate, CIF B90488222`;
      return txt;
    }

    // Proveedor específico
    const esAqua = prov === "aqua";
    const esAram = prov === "aram";
    const lineas = esAqua ? (d.lineasAqua || []) : esAram ? (d.lineasAram || []) : [];
    const noList = (d.lineasNoListado || []).filter(l => l.proveedor === prov);
    const subtotal = lineas.reduce((s, l) => s + (l.importe || 0), 0);
    const iva = subtotal * 0.21;
    const total = subtotal + iva;
    const nombreProv = esAqua ? "AQUATUBO SL" : esAram ? "ARAMBURU GUZMÁN SLU" : prov === "indistinto" ? "SIN PROVEEDOR" : prov.toUpperCase();
    const formaPago = esAqua ? "60 días" : esAram ? "Contado" : "Pendiente";

    let txt = `*PEDIDO ARA CORPORATE → ${nombreProv}*\n`;
    txt += `Obra: ${d.obra.nombre}\nFecha: ${fecha}\nSolicita: ${d.operario}\n\n`;
    if (lineas.length > 0) {
      txt += `*LÍNEAS:*\n`;
      lineas.forEach(l => { const mu = l.metros ? ` (${l.metros}m)` : ""; txt += `• ${l.cantidad} ${l.unidad}${mu} · ${l.desc} (ref ${l.ref}) — €${l.importe.toFixed(2)}\n`; });
    }
    if (noList.length > 0) {
      txt += `\n*PRODUCTOS NO LISTADOS (confirmar precio):*\n`;
      noList.forEach(l => { txt += `• ${l.cantidad} ${l.unidad}: ${l.desc}\n`; });
    }
    if (lineas.length > 0) {
      txt += `\nBase: €${subtotal.toFixed(2)}\nIVA 21%: €${iva.toFixed(2)}\n*TOTAL: €${total.toFixed(2)}*\n`;
      txt += `Forma de pago: ${formaPago}\n`;
    }
    if (d.notas) txt += `\n*Notas:*\n${d.notas}\n`;
    txt += `\n— ARA Corporate, CIF B90488222`;
    return txt;
  }

  // Genera y descarga PDF — proveedor: "aqua" | "aram" | "indistinto" | "completo" | nombre libre
  async function descargarPDF(proveedor) {
    const d = datosPedidoEnviado;
    if (!d) return;

    // COMPLETO: genera un PDF con todos los proveedores
    if (proveedor === "completo") {
      let jsPDFmod;
      try { jsPDFmod = await import("jspdf"); }
      catch (e) { alert("No se pudo cargar el generador de PDF."); return; }
      const { jsPDF } = jsPDFmod;
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      let y = 15;

      doc.setFont("helvetica", "bold"); doc.setFontSize(16);
      doc.text("PEDIDO COMPLETO · ARA CORPORATE", 105, y, { align: "center" }); y += 6;
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text("ARA Corporate Sociedad de Inversiones, SL · CIF B90488222", 105, y, { align: "center" }); y += 4;
      doc.text("Avd San Francisco Javier 9 P6 M9, 41018 Sevilla · Tel 640527426", 105, y, { align: "center" }); y += 8;
      doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(15, y, 195, y); y += 6;

      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text("DATOS DEL PEDIDO", 15, y); y += 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text(`Fecha:     ${new Date(d.fechaIso).toLocaleDateString("es-ES", { dateStyle: "long" })}`, 15, y); y += 4;
      doc.text(`Obra:      ${d.obra.nombre}`, 15, y); y += 4;
      doc.text(`Dirección: ${d.obra.dir || "-"}`, 15, y); y += 4;
      doc.text(`Solicita:  ${d.operario}`, 15, y); y += 4;
      doc.text(`Pedido ID: ${d.pedidoId}`, 15, y); y += 8;

      const pintarSeccion = (titulo, lineas, total, iva, formaPago) => {
        if (!lineas || lineas.length === 0) return;
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.text(titulo, 15, y); y += 5;
        doc.setFillColor(230); doc.rect(15, y - 4, 180, 6, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(8);
        doc.text("Cant", 17, y); doc.text("Ref", 32, y); doc.text("Descripción", 60, y);
        doc.text("P.unit", 152, y, { align: "right" }); doc.text("Importe", 192, y, { align: "right" }); y += 4;
        doc.setFont("helvetica", "normal");
        lineas.forEach(l => {
          if (y > 270) { doc.addPage(); y = 20; }
          const desc = l.desc.length > 55 ? l.desc.substring(0, 53) + ".." : l.desc;
          doc.text(String(l.cantidad), 17, y); doc.text(String(l.ref || "—"), 32, y);
          doc.text(desc, 60, y);
          doc.text("€" + l.precioUnit.toFixed(2), 152, y, { align: "right" });
          doc.text("€" + l.importe.toFixed(2), 192, y, { align: "right" }); y += 3.5;
          // Segunda línea: info rollos o metros sueltos
          if (l.metros || l.esMetrosSueltos) {
            const nota = l.esMetrosSueltos ? ">> metros sueltos" : `>> ${l.cantidad} ${l.unidad} (${l.metros}m)`;
            doc.setFont("helvetica", "italic"); doc.setFontSize(7);
            doc.setTextColor(100);
            doc.text(nota, 62, y); y += 3.5;
            doc.setFont("helvetica", "normal"); doc.setFontSize(8);
            doc.setTextColor(0);
          }
        });
        y += 2; doc.line(120, y, 195, y); y += 4;
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        doc.text(`Subtotal: €${total.toFixed(2)}`, 192, y, { align: "right" }); y += 4;
        doc.text(`IVA 21%:  €${iva.toFixed(2)}`, 192, y, { align: "right" }); y += 4;
        doc.setFont("helvetica", "bold");
        doc.text(`TOTAL:    €${(total + iva).toFixed(2)}`, 192, y, { align: "right" }); y += 4;
        doc.setFont("helvetica", "italic"); doc.setFontSize(7);
        doc.text(`Forma de pago: ${formaPago}`, 192, y, { align: "right" }); y += 6;
      };

      pintarSeccion("AQUATUBO SL", d.lineasAqua, d.totalAqua, d.ivaAqua, "60 días · Recibo domiciliado");
      pintarSeccion("ARAMBURU GUZMÁN SLU", d.lineasAram, d.totalAram, d.ivaAram, "Contado");

      // No listados agrupados por proveedor
      const todosNoList = d.lineasNoListado || [];
      if (todosNoList.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.text("PRODUCTOS NO LISTADOS — CONFIRMAR PRECIO", 15, y); y += 5;
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        todosNoList.forEach(l => {
          const provLabel = l.proveedor === "aqua" ? "Aquatubo"
            : l.proveedor === "aram" ? "Aramburu"
            : l.proveedor === "indistinto" ? "Cualquiera"
            : l.proveedor;
          doc.text(`· ${l.cantidad} ${l.unidad}: ${l.desc} (${provLabel})`, 15, y); y += 4;
        });
        y += 4;
      }

      if (d.notas) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.text("NOTAS DEL OPERARIO", 15, y); y += 5;
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        const ln = doc.splitTextToSize(d.notas, 175);
        doc.text(ln, 15, y); y += ln.length * 4 + 4;
      }

      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFillColor(255, 200, 0); doc.rect(15, y, 180, 12, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(14);
      doc.text(`TOTAL GENERAL: €${(d.totalGeneral * 1.21).toFixed(2)} IVA inc.`, 105, y + 8, { align: "center" });
      y += 18;
      doc.setFont("helvetica", "italic"); doc.setFontSize(8);
      doc.text("Documento generado automáticamente desde el sistema interno de pedidos ARA.", 15, y);

      const fname = `Pedido_ARA_COMPLETO_${d.obra.nombre.replace(/[^a-z0-9]/gi, "_")}_${new Date(d.fechaIso).toISOString().slice(0,10)}.pdf`;
      doc.save(fname);
      return;
    }

    const esAqua = proveedor === "aqua";
    const esAram = proveedor === "aram";
    const esIndistinto = proveedor === "indistinto";

    const nombreProv = esAqua ? "AQUATUBO SL"
      : esAram ? "ARAMBURU GUZMÁN SLU"
      : esIndistinto ? "SIN PROVEEDOR ASIGNADO"
      : proveedor.toUpperCase();

    const formaPago = esAqua ? "60 días · Recibo domiciliado"
      : esAram ? "Contado"
      : "Pendiente de confirmar";

    // Líneas del catálogo (solo para aqua/aram)
    const lineasCatalogo = esAqua ? (d.lineasAqua || [])
      : esAram ? (d.lineasAram || [])
      : [];

    const total = esAqua ? d.totalAqua : esAram ? d.totalAram : 0;
    const iva   = esAqua ? d.ivaAqua   : esAram ? d.ivaAram   : 0;

    // Productos no listados de este proveedor
    const noListadosProv = (d.lineasNoListado || []).filter(
      l => l.proveedor === proveedor
    );

    if (lineasCatalogo.length === 0 && noListadosProv.length === 0) {
      alert(`No hay productos para ${nombreProv} en este pedido.`);
      return;
    }

    // Importación dinámica de jsPDF
    let jsPDFmod;
    try {
      jsPDFmod = await import("jspdf");
    } catch (e) {
      alert("No se pudo cargar el generador de PDF. Recarga la página y prueba de nuevo.");
      return;
    }
    const { jsPDF } = jsPDFmod;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = 15;

    // Cabecera
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`PEDIDO · ARA CORPORATE → ${nombreProv}`, 105, y, { align: "center" }); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("ARA Corporate Sociedad de Inversiones, SL · CIF B90488222", 105, y, { align: "center" }); y += 4;
    doc.text("Avd San Francisco Javier 9 P6 M9, 41018 Sevilla · Tel 640527426", 105, y, { align: "center" }); y += 8;

    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(15, y, 195, y); y += 6;

    // Datos pedido
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("DATOS DEL PEDIDO", 15, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Fecha:        ${new Date(d.fechaIso).toLocaleDateString("es-ES", { dateStyle: "long" })}`, 15, y); y += 4;
    doc.text(`Obra:         ${d.obra.nombre}`, 15, y); y += 4;
    doc.text(`Dirección:    ${d.obra.dir || "-"}`, 15, y); y += 4;
    doc.text(`Solicita:     ${d.operario}`, 15, y); y += 4;
    doc.text(`Pedido ID:    ${d.pedidoId}`, 15, y); y += 4;
    doc.text(`Proveedor:    ${nombreProv}`, 15, y); y += 8;

    // Tabla de líneas del catálogo (solo aqua/aram)
    if (lineasCatalogo.length > 0) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text(`LÍNEAS — ${nombreProv}`, 15, y); y += 5;

      // Cabecera tabla
      doc.setFillColor(230); doc.rect(15, y - 4, 180, 6, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text("Cant", 17, y);
      doc.text("Ref", 32, y);
      doc.text("Descripción", 60, y);
      doc.text("P.unit", 152, y, { align: "right" });
      doc.text("Importe", 192, y, { align: "right" }); y += 4;
      doc.setFont("helvetica", "normal");

      lineasCatalogo.forEach(l => {
        if (y > 270) { doc.addPage(); y = 20; }
        const desc = l.desc.length > 55 ? l.desc.substring(0, 53) + ".." : l.desc;
        doc.text(String(l.cantidad), 17, y);
        doc.text(String(l.ref || "—"), 32, y);
        doc.text(desc, 60, y);
        doc.text("€" + l.precioUnit.toFixed(2), 152, y, { align: "right" });
        doc.text("€" + l.importe.toFixed(2), 192, y, { align: "right" });
        y += 3.5;
        if (l.metros || l.esMetrosSueltos) {
          const nota = l.esMetrosSueltos ? ">> metros sueltos" : `>> ${l.cantidad} ${l.unidad} (${l.metros}m)`;
          doc.setFont("helvetica", "italic"); doc.setFontSize(7);
          doc.setTextColor(100);
          doc.text(nota, 62, y); y += 3.5;
          doc.setFont("helvetica", "normal"); doc.setFontSize(8);
          doc.setTextColor(0);
        }
      });
      y += 2;
      doc.line(120, y, 195, y); y += 4;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text(`Subtotal: €${total.toFixed(2)}`, 192, y, { align: "right" }); y += 4;
      doc.text(`IVA 21%:  €${iva.toFixed(2)}`, 192, y, { align: "right" }); y += 4;
      doc.setFont("helvetica", "bold");
      doc.text(`TOTAL:    €${(total + iva).toFixed(2)}`, 192, y, { align: "right" }); y += 8;
    }

    // Productos no listados de este proveedor
    if (noListadosProv.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text("PRODUCTOS NO LISTADOS — CONFIRMAR PRECIO", 15, y); y += 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      noListadosProv.forEach(l => {
        doc.text(`· ${l.cantidad} ${l.unidad}: ${l.desc}`, 15, y);
        y += 4;
      });
      y += 4;
    }

    // Notas
    if (d.notas) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text("NOTAS DEL OPERARIO", 15, y); y += 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      const lineasNotas = doc.splitTextToSize(d.notas, 175);
      doc.text(lineasNotas, 15, y); y += lineasNotas.length * 4 + 4;
    }

    // Total del pedido a este proveedor
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFillColor(255, 200, 0);
    doc.rect(15, y, 180, 12, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(`TOTAL ${nombreProv}: €${(total + iva).toFixed(2)} IVA inc.`, 105, y + 8, { align: "center" });
    y += 18;

    // Pie
    doc.setFont("helvetica", "italic"); doc.setFontSize(8);
    doc.text(`Forma de pago: ${formaPago}`, 15, y); y += 4;
    doc.text("Documento generado automáticamente desde el sistema interno de pedidos ARA.", 15, y);

    const sufijoProv = esAqua ? "AQUATUBO" : esAram ? "ARAMBURU" : proveedor.replace(/[^a-z0-9]/gi, "_").toUpperCase();
    const fname = `Pedido_ARA_${sufijoProv}_${d.obra.nombre.replace(/[^a-z0-9]/gi, "_")}_${new Date(d.fechaIso).toISOString().slice(0,10)}.pdf`;
    doc.save(fname);
  }

  // === FUNCIONES DE PRODUCTO NO LISTADO ===
  function añadirNoListado({ desc, cantidad, unidad, proveedor }) {
    const item = {
      id: "nl-" + Date.now(),
      desc: desc.trim(),
      cantidad: parseFloat(cantidad) || 1,
      unidad: unidad || "uni",
      proveedor: proveedor || "indistinto"
    };
    setLineasNoListadas(prev => [...prev, item]);
    // También lo registramos en el backend para que el admin lo valide
    fetch(BACKEND_URL + "/producto-no-listado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...item,
        pedidoPor: usuario.nombre,
        obra: usuario.obra
      })
    }).catch(() => { /* fallo silencioso, no bloquea al operario */ });
  }
  function quitarNoListado(id) {
    setLineasNoListadas(prev => prev.filter(l => l.id !== id));
  }

  if (pedidoEnviado) {
    const tieneAqua = (datosPedidoEnviado?.lineasAqua || []).length > 0;
    const tieneAram = (datosPedidoEnviado?.lineasAram || []).length > 0;
    // Proveedores custom: únicos nombres que no sean aqua/aram/indistinto
    const proveedoresCustom = [...new Set(
      (datosPedidoEnviado?.lineasNoListado || [])
        .map(l => l.proveedor)
        .filter(p => p && p !== "aqua" && p !== "aram" && p !== "indistinto")
    )];
    const tieneIndistinto = (datosPedidoEnviado?.lineasNoListado || [])
      .some(l => l.proveedor === "indistinto");
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-mono">
        <div className="w-full max-w-md">
          <div className="bg-emerald-500 border-4 border-stone-900 p-6 shadow-[8px_8px_0_0_rgba(0,0,0,1)] text-center">
            <Check className="w-14 h-14 mx-auto mb-2 text-stone-900" strokeWidth={3} />
            <h2 className="font-black text-2xl mb-1" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>PEDIDO REGISTRADO</h2>
            <div className="text-[10px] tracking-widest opacity-80">ID: {datosPedidoEnviado?.pedidoId || "-"}</div>
          </div>

          <div className="bg-white border-4 border-t-0 border-stone-900 p-4 shadow-[8px_8px_0_0_rgba(0,0,0,1)] space-y-3">
            <div className="text-xs space-y-1 bg-stone-50 border-2 border-stone-900 p-3">
              <div><strong>Operario:</strong> {usuario.nombre}</div>
              <div><strong>Obra:</strong> {usuario.obra.nombre}</div>
              <div><strong>Total:</strong> €{((datosPedidoEnviado?.totalGeneral || 0) * 1.21).toFixed(2)} IVA inc.</div>
              {datosPedidoEnviado?.lineasNoListado?.length > 0 && (
                <div className="text-amber-700"><strong>{datosPedidoEnviado.lineasNoListado.length}</strong> producto(s) NO listado(s) — pendientes de validar precio</div>
              )}
            </div>

            <div className="text-[11px] text-stone-600 leading-relaxed">
              Comparte el pedido con tus proveedores:
            </div>

            {/* ── PDFs ── */}
            <div className="text-[10px] font-bold tracking-widest text-stone-500 pt-1">📄 DESCARGAR PDF</div>

            {tieneAqua && (
              <button onClick={() => descargarPDF("aqua")}
                      className="w-full bg-stone-900 text-amber-400 p-3 font-black text-xs tracking-widest border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900 transition-all flex items-center justify-center gap-2"
                      style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                📄 AQUATUBO
              </button>
            )}
            {tieneAram && (
              <button onClick={() => descargarPDF("aram")}
                      className="w-full bg-stone-700 text-amber-400 p-3 font-black text-xs tracking-widest border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900 transition-all flex items-center justify-center gap-2"
                      style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                📄 ARAMBURU
              </button>
            )}
            {proveedoresCustom.map(prov => (
              <button key={prov} onClick={() => descargarPDF(prov)}
                      className="w-full bg-blue-700 text-white p-3 font-black text-xs tracking-widest border-2 border-stone-900 hover:bg-blue-800 transition-all flex items-center justify-center gap-2"
                      style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                {`📄 ${prov.toUpperCase()}`}
              </button>
            ))}
            {tieneIndistinto && (
              <button onClick={() => descargarPDF("indistinto")}
                      className="w-full bg-stone-500 text-white p-3 font-black text-xs tracking-widest border-2 border-stone-900 hover:bg-stone-600 transition-all flex items-center justify-center gap-2"
                      style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                📄 SIN PROVEEDOR
              </button>
            )}
            <button onClick={() => descargarPDF("completo")}
                    className="w-full bg-amber-500 text-stone-900 p-3 font-black text-xs tracking-widest border-2 border-stone-900 hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
                    style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              📄 COMPLETO (TODOS LOS PROVEEDORES)
            </button>

            {/* ── WhatsApp ── */}
            <div className="text-[10px] font-bold tracking-widest text-stone-500 pt-1">💬 ENVIAR POR WHATSAPP</div>

            {tieneAqua && (
              <a href={`https://wa.me/?text=${encodeURIComponent(generarMensajeWhatsApp("aqua"))}`}
                 target="_blank" rel="noopener noreferrer"
                 className="w-full bg-emerald-700 text-white p-3 font-black text-xs tracking-widest border-2 border-stone-900 hover:bg-emerald-800 transition-all flex items-center justify-center gap-2"
                 style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                💬 AQUATUBO
              </a>
            )}
            {tieneAram && (
              <a href={`https://wa.me/?text=${encodeURIComponent(generarMensajeWhatsApp("aram"))}`}
                 target="_blank" rel="noopener noreferrer"
                 className="w-full bg-amber-700 text-white p-3 font-black text-xs tracking-widest border-2 border-stone-900 hover:bg-amber-800 transition-all flex items-center justify-center gap-2"
                 style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                💬 ARAMBURU
              </a>
            )}
            {proveedoresCustom.map(prov => (
              <a key={prov} href={`https://wa.me/?text=${encodeURIComponent(generarMensajeWhatsApp(prov))}`}
                 target="_blank" rel="noopener noreferrer"
                 className="w-full bg-blue-600 text-white p-3 font-black text-xs tracking-widest border-2 border-stone-900 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                 style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                {`💬 ${prov.toUpperCase()}`}
              </a>
            ))}
            {tieneIndistinto && (
              <a href={`https://wa.me/?text=${encodeURIComponent(generarMensajeWhatsApp("indistinto"))}`}
                 target="_blank" rel="noopener noreferrer"
                 className="w-full bg-stone-500 text-white p-3 font-black text-xs tracking-widest border-2 border-stone-900 hover:bg-stone-600 transition-all flex items-center justify-center gap-2"
                 style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                💬 SIN PROVEEDOR
              </a>
            )}
            <a href={`https://wa.me/?text=${encodeURIComponent(generarMensajeWhatsApp("completo"))}`}
               target="_blank" rel="noopener noreferrer"
               className="w-full bg-amber-500 text-stone-900 p-3 font-black text-xs tracking-widest border-2 border-stone-900 hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
               style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              💬 COMPLETO (TODOS LOS PROVEEDORES)
            </a>

            {datosPedidoEnviado?.errorBackend && (
              <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-700 p-2">
                ⚠ El pedido no se guardó en el sistema central, pero puedes descargarlo en PDF y compartirlo manualmente.
              </div>
            )}

            <div className="border-t-2 border-stone-200 pt-3 space-y-2">
              <button onClick={() => {
                        setCarrito({});
                        setLineasNoListadas([]);
                        setNotasPedido("");
                        setPedidoEnviado(false);
                        setDatosPedidoEnviado(null);
                        setCarritoAbierto(false);
                      }}
                      className="w-full bg-stone-900 text-amber-400 p-3 font-black tracking-widest text-xs border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900 transition-all"
                      style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                ↻ HACER OTRO PEDIDO
              </button>
              <button onClick={onLogout}
                      className="w-full bg-stone-200 text-stone-900 p-3 font-bold tracking-widest text-[10px] border-2 border-stone-900 hover:bg-stone-300 transition-all">
                CERRAR SESIÓN
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 font-mono"
         style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(0,0,0,0.02) 30px, rgba(0,0,0,0.02) 31px)" }}>

      {/* HEADER */}
      <header className="bg-amber-500 border-b-4 border-stone-900 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[9px] tracking-widest opacity-70">ARA CORPORATE</div>
            <h1 className="font-black text-xl leading-none" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              CATÁLOGO DE OBRA
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <div className="text-[9px] tracking-widest opacity-70">{usuario.nombre.toUpperCase()}</div>
              <div className="text-xs font-bold flex items-center gap-1 justify-end">
                <Construction className="w-3 h-3" /> {usuario.obra.nombre}
              </div>
            </div>
            <button onClick={() => setCarritoAbierto(true)}
                    className="relative bg-stone-900 text-amber-400 px-4 py-2 font-black border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900 transition-colors">
              <ShoppingCart className="w-4 h-4 inline mr-1" />
              <span className="text-sm">{itemsCarrito}</span>
              {itemsCarrito > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-stone-900">
                  •
                </span>
              )}
            </button>
            <button onClick={onLogout}
                    className="bg-stone-900 text-amber-400 p-2 border-2 border-stone-900 hover:bg-stone-700 transition-colors"
                    title="Cerrar sesión">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Banda info móvil */}
        <div className="sm:hidden border-t-2 border-stone-900 bg-amber-400 px-4 py-1.5 text-[10px] flex items-center justify-between">
          <span className="font-bold truncate">{usuario.nombre}</span>
          <span className="flex items-center gap-1"><Construction className="w-3 h-3" /> <span className="font-bold">{usuario.obra.nombre}</span></span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Buscador */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar producto, código, referencia…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-3 py-3 border-2 border-stone-900 bg-white text-sm focus:outline-none focus:bg-amber-50 font-mono"
          />
        </div>

        {/* Familias scroll horizontal */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
          {FAMILIAS.map(f => {
            const Icon = f.icon;
            const activo = familia === f.nombre;
            return (
              <button key={f.nombre} onClick={() => setFamilia(f.nombre)}
                      className={`shrink-0 px-3 py-2 border-2 border-stone-900 text-xs font-bold tracking-wider flex items-center gap-1.5 transition-all ${
                        activo ? "bg-stone-900 text-amber-400" : "bg-white text-stone-900 hover:bg-amber-100"
                      }`}>
                <Icon className="w-3 h-3" />
                {f.nombre.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Stats banner */}
        <div className="bg-white border-2 border-stone-900 mb-4 p-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-[9px] tracking-widest text-stone-500">PRODUCTOS</div>
            <div className="font-black text-lg text-stone-900" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              {productos.length}
            </div>
          </div>
          <div className="border-x-2 border-stone-200 px-3">
            <div className="text-[9px] tracking-widest text-stone-500">CON COMPARATIVA</div>
            <div className="font-black text-lg text-stone-900" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              {productos.filter(p => p.proveedores.aqua && p.proveedores.aram).length}
            </div>
          </div>
          <div>
            <div className="text-[9px] tracking-widest text-stone-500">FAMILIAS</div>
            <div className="font-black text-lg text-stone-900" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              {FAMILIAS.length - 1}
            </div>
          </div>
        </div>

        {/* Grid productos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {productos.map(p => (
            <CardProducto
              key={p.id}
              producto={p}
              cantidades={Object.fromEntries(PROVEEDORES.map(pv => [pv.id, getCant(p.id, pv.id)]))}
              cantidadesM={Object.fromEntries(PROVEEDORES.map(pv => [pv.id, getCantM(p.id, pv.id)]))}
              addProv={(provId) => addProv(p.id, provId)}
              removeProv={(provId) => removeProv(p.id, provId)}
              setExacta={(provId, n) => setExacta(p.id, provId, n)}
              setExactaM={(provId, n) => setExactaM(p.id, provId, n)}
              onClick={() => setProductoSel(p)}
            />
          ))}
        </div>

        {productos.length === 0 && (
          <div className="text-center py-12 text-stone-500 font-mono text-sm">
            No hay productos que coincidan con tu búsqueda
          </div>
        )}
      </div>

      {/* DRAWER CARRITO */}
      {carritoAbierto && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-stone-900/40" onClick={() => setCarritoAbierto(false)} />
          <div className="ml-auto w-full max-w-2xl bg-stone-100 border-l-4 border-stone-900 relative overflow-y-auto">
            {/* Header drawer */}
            <div className="sticky top-0 bg-amber-500 border-b-4 border-stone-900 p-4 flex items-center justify-between z-10">
              <div>
                <div className="text-[10px] tracking-widest opacity-70">PEDIDO PARA</div>
                <h2 className="font-black text-xl" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                  {usuario.obra.nombre.toUpperCase()}
                </h2>
                <div className="text-[10px] tracking-widest opacity-70 mt-0.5">SOLICITA: {usuario.nombre.toUpperCase()}</div>
              </div>
              <button onClick={() => setCarritoAbierto(false)} className="bg-stone-900 text-amber-400 p-2 border-2 border-stone-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {lineasCarrito.length === 0 && lineasNoListadas.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-sm space-y-4">
                  <div>
                    Aún no has añadido productos.<br />
                    Vuelve al catálogo y añade lo que necesites.
                  </div>
                  <button onClick={() => setModalNoListadoAbierto(true)}
                          className="text-xs font-bold text-stone-700 border-2 border-dashed border-stone-400 px-4 py-2 hover:bg-amber-50 hover:border-stone-900 transition-all">
                    + AÑADIR UN PRODUCTO QUE NO ESTÁ EN EL CATÁLOGO
                  </button>
                </div>
              ) : (
                <>
                  {/* AVISO oportunidades */}
                  {oportunidades.length > 0 && (
                    <div className="bg-amber-100 border-2 border-amber-700 p-3">
                      <div className="flex gap-2 items-start">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <div className="font-bold mb-1">Hay {oportunidades.length} producto{oportunidades.length>1?"s":""} que puedes pedir más barato:</div>
                          <ul className="space-y-1 font-mono text-[11px]">
                            {oportunidades.slice(0, 3).map((l, i) => {
                              const otroProv = l.prov === "aqua" ? "aram" : "aqua";
                              const otro = l.producto.proveedores[otroProv];
                              const ahorro = (precioNeto(l.proveedor) - precioNeto(otro)) * l.cantidad;
                              return (
                                <li key={i}>
                                  · {l.producto.desc}: ahorrarías <strong>€{ahorro.toFixed(2)}</strong> con {otroProv === "aqua" ? "Aquatubo" : "Aramburu"}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sub-pedido AQUATUBO */}
                  {lineasCarrito.some(l => l.prov === "aqua") && (
                    <div className="bg-white border-2 border-stone-900">
                      <div className="bg-emerald-700 text-white px-3 py-2 flex items-center justify-between border-b-2 border-stone-900">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-300" />
                          <span className="font-black tracking-wider text-sm" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>SUB-PEDIDO AQUATUBO</span>
                        </div>
                        <span className="text-xs">60 días</span>
                      </div>
                      <div className="divide-y-2 divide-stone-200">
                        {lineasCarrito.filter(l => l.prov === "aqua").map(l => (
                          <div key={l.id + l.prov} className="p-3 flex gap-3">
                            <div className="w-14 h-14 border-2 border-stone-900 bg-stone-50 shrink-0">
                              <ProductSVG type={l.producto.img} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[9px] font-mono text-stone-500">{l.proveedor.ref}</div>
                              <div className="text-xs font-bold leading-tight mb-1">{l.producto.desc}</div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 border-2 border-stone-900">
                                  <button onClick={() => removeProv(l.id, l.prov)} className="px-2"><Minus className="w-3 h-3" /></button>
                                  <input type="number" min="0" value={l.cantidad}
                                         onChange={(e) => setExacta(l.id, l.prov, parseInt(e.target.value) || 0)}
                                         className="w-12 text-center font-mono text-xs py-1 bg-amber-50 focus:outline-none" />
                                  <button onClick={() => addProv(l.id, l.prov)} className="px-2"><Plus className="w-3 h-3" /></button>
                                </div>
                                <div className="text-right">
                                  <div className="font-black text-sm" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>€{l.subtotal.toFixed(2)}</div>
                                  <div className="text-[9px] text-stone-500 font-mono">€{l.neto.toFixed(2)}/{l.producto.unidad}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="px-3 py-2 bg-emerald-50 border-t-2 border-stone-900 flex justify-between text-xs">
                        <span>Subtotal Aquatubo</span>
                        <span className="font-bold">€{totalAqua.toFixed(2)}</span>
                      </div>
                      <div className="px-3 py-2 bg-emerald-50 flex justify-between text-xs border-t border-emerald-200">
                        <span>IVA 21%</span>
                        <span className="font-bold">€{ivaAqua.toFixed(2)}</span>
                      </div>
                      <div className="px-3 py-2 bg-emerald-700 text-white flex justify-between border-t-2 border-stone-900">
                        <span className="font-black tracking-wider text-sm" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>TOTAL AQUATUBO</span>
                        <span className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>€{(totalAqua + ivaAqua).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Sub-pedido ARAMBURU */}
                  {lineasCarrito.some(l => l.prov === "aram") && (
                    <div className="bg-white border-2 border-stone-900">
                      <div className="bg-amber-700 text-white px-3 py-2 flex items-center justify-between border-b-2 border-stone-900">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-300" />
                          <span className="font-black tracking-wider text-sm" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>SUB-PEDIDO ARAMBURU</span>
                        </div>
                        <span className="text-xs">Contado</span>
                      </div>
                      <div className="divide-y-2 divide-stone-200">
                        {lineasCarrito.filter(l => l.prov === "aram").map(l => (
                          <div key={l.id + l.prov} className="p-3 flex gap-3">
                            <div className="w-14 h-14 border-2 border-stone-900 bg-stone-50 shrink-0">
                              <ProductSVG type={l.producto.img} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[9px] font-mono text-stone-500">{l.proveedor.ref}</div>
                              <div className="text-xs font-bold leading-tight mb-1">{l.producto.desc}</div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 border-2 border-stone-900">
                                  <button onClick={() => removeProv(l.id, l.prov)} className="px-2"><Minus className="w-3 h-3" /></button>
                                  <input type="number" min="0" value={l.cantidad}
                                         onChange={(e) => setExacta(l.id, l.prov, parseInt(e.target.value) || 0)}
                                         className="w-12 text-center font-mono text-xs py-1 bg-amber-50 focus:outline-none" />
                                  <button onClick={() => addProv(l.id, l.prov)} className="px-2"><Plus className="w-3 h-3" /></button>
                                </div>
                                <div className="text-right">
                                  <div className="font-black text-sm" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>€{l.subtotal.toFixed(2)}</div>
                                  <div className="text-[9px] text-stone-500 font-mono">€{l.neto.toFixed(2)}/{l.producto.unidad}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="px-3 py-2 bg-amber-50 border-t-2 border-stone-900 flex justify-between text-xs">
                        <span>Subtotal Aramburu</span>
                        <span className="font-bold">€{totalAram.toFixed(2)}</span>
                      </div>
                      <div className="px-3 py-2 bg-amber-50 flex justify-between text-xs border-t border-amber-200">
                        <span>IVA 21%</span>
                        <span className="font-bold">€{ivaAram.toFixed(2)}</span>
                      </div>
                      <div className="px-3 py-2 bg-amber-700 text-white flex justify-between border-t-2 border-stone-900">
                        <span className="font-black tracking-wider text-sm" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>TOTAL ARAMBURU</span>
                        <span className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>€{(totalAram + ivaAram).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Productos no listados añadidos */}
                  {lineasNoListadas.length > 0 && (
                    <div className="bg-white border-2 border-stone-900">
                      <div className="bg-stone-700 text-white px-3 py-2 flex items-center justify-between border-b-2 border-stone-900">
                        <span className="font-black tracking-wider text-sm" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>PRODUCTOS NO LISTADOS</span>
                        <span className="text-[9px] bg-amber-400 text-stone-900 px-2 py-0.5 font-bold">PENDIENTE PRECIO</span>
                      </div>
                      <div className="divide-y-2 divide-stone-200">
                        {lineasNoListadas.map(l => (
                          <div key={l.id} className="p-3 flex justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold leading-tight">{l.desc}</div>
                              <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                                {l.cantidad} {l.unidad}
                                {l.proveedor !== "indistinto" && (
                                  <> · prov: <strong>{l.proveedor === "aqua" ? "Aquatubo" : "Aramburu"}</strong></>
                                )}
                              </div>
                            </div>
                            <button onClick={() => quitarNoListado(l.id)}
                                    className="text-stone-500 hover:text-red-700 p-1">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Botón añadir producto no listado */}
                  <button onClick={() => setModalNoListadoAbierto(true)}
                          className="w-full text-xs font-bold text-stone-700 border-2 border-dashed border-stone-400 p-3 hover:bg-amber-50 hover:border-stone-900 transition-all">
                    + AÑADIR PRODUCTO QUE NO ESTÁ EN EL CATÁLOGO
                  </button>

                  {/* Campo de notas */}
                  <div>
                    <label className="font-bold text-[10px] tracking-widest text-stone-600 mb-1 block">
                      📝 NOTAS PARA EL PEDIDO (opcional)
                    </label>
                    <textarea
                      value={notasPedido}
                      onChange={(e) => setNotasPedido(e.target.value)}
                      placeholder="Ej: Urgente, llevar antes del jueves · Recoger en obra, no en oficina · Entregar en planta 2..."
                      rows={3}
                      className="w-full border-2 border-stone-900 bg-white p-2 text-xs focus:outline-none focus:bg-amber-50 font-mono resize-none"
                    />
                  </div>

                  {/* TOTAL GENERAL */}
                  <div className="bg-stone-900 text-amber-400 p-4 border-2 border-stone-900">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs tracking-widest opacity-80">TOTAL GENERAL (IVA INC.)</span>
                    </div>
                    <div className="font-black text-3xl" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                      €{(totalGeneral * 1.21).toFixed(2)}
                    </div>
                    <div className="text-xs opacity-80 mt-1">
                      Base €{totalGeneral.toFixed(2)} · IVA €{(totalGeneral * 0.21).toFixed(2)}
                    </div>
                    {lineasNoListadas.length > 0 && (
                      <div className="text-[10px] mt-2 bg-amber-400 text-stone-900 px-2 py-1 inline-block font-bold">
                        + {lineasNoListadas.length} producto(s) no listado(s) sin precio
                      </div>
                    )}
                  </div>

                  <button
                    onClick={registrarPedidoEnBackend}
                    disabled={enviandoPedido}
                    className={`w-full border-2 border-stone-900 p-4 font-black tracking-widest transition-all ${
                      enviandoPedido
                        ? "bg-stone-300 text-stone-600 cursor-wait"
                        : "bg-amber-500 text-stone-900 hover:bg-stone-900 hover:text-amber-400 shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                    }`}
                    style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}
                  >
                    {enviandoPedido ? "REGISTRANDO…" : "REGISTRAR PEDIDO →"}
                  </button>

                  <div className="text-[10px] text-stone-500 text-center leading-relaxed pt-2">
                    Al confirmar, el pedido se guarda y podrás descargarlo en PDF o enviarlo por WhatsApp a tus proveedores.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL FICHA PRODUCTO */}
      {productoSel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-stone-900/50" onClick={() => setProductoSel(null)} />
          <div className="relative bg-white border-4 border-stone-900 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
            <button onClick={() => setProductoSel(null)} className="absolute top-3 right-3 z-10 bg-stone-900 text-amber-400 p-1.5 border-2 border-stone-900">
              <X className="w-4 h-4" />
            </button>
            <div className="aspect-square bg-stone-50 border-b-2 border-stone-900">
              <ProductSVG type={productoSel.img} />
            </div>
            <div className="p-5">
              <div className="font-mono text-[10px] tracking-widest text-stone-500 mb-1">
                {productoSel.familia.toUpperCase()}
              </div>
              <h3 className="font-black text-xl mb-3 leading-tight" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                {productoSel.desc}
              </h3>

              {/* Detalle por proveedor */}
              <div className="grid grid-cols-1 gap-3">
                {["aqua", "aram"].map(provKey => {
                  const prov = productoSel.proveedores[provKey];
                  if (!prov) {
                    return (
                      <div key={provKey} className="border-2 border-dashed border-stone-300 p-3 text-center text-[10px] text-stone-400 italic">
                        <TagProveedor tipo={provKey} size="sm" />
                        <div className="mt-1">No disponible en este proveedor</div>
                      </div>
                    );
                  }
                  const neto = precioNeto(prov);
                  const ganador = proveedorMasBarato(productoSel) === provKey;
                  return (
                    <div key={provKey} className={`border-2 border-stone-900 p-3 ${ganador && productoSel.proveedores.aqua && productoSel.proveedores.aram ? (provKey === "aqua" ? "bg-emerald-50" : "bg-amber-50") : "bg-white"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <TagProveedor tipo={provKey} />
                        {ganador && productoSel.proveedores.aqua && productoSel.proveedores.aram && (
                          <span className="bg-stone-900 text-amber-400 text-[9px] px-2 py-0.5 font-bold tracking-wider flex items-center gap-1">
                            <Trophy className="w-2.5 h-2.5" /> MÁS BARATO
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                        <div><span className="text-stone-500">REF:</span> <strong>{prov.ref}</strong></div>
                        <div><span className="text-stone-500">MARCA:</span> <strong>{prov.marca}</strong></div>
                        <div><span className="text-stone-500">PVP TARIFA:</span> <strong className="line-through">€{prov.bruto.toFixed(2)}</strong></div>
                        <div><span className="text-stone-500">DTO:</span> <strong className="text-emerald-700">−{prov.dto}%</strong></div>
                      </div>
                      <div className="mt-3 pt-3 border-t-2 border-stone-200 flex items-baseline justify-between">
                        <div>
                          <div className="text-[10px] tracking-widest text-stone-500">PRECIO NETO</div>
                          <div className="font-black text-2xl" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>€{neto.toFixed(2)}</div>
                          <div className="text-[10px] text-stone-500">/{productoSel.unidad}</div>
                        </div>
                        <button onClick={() => addProv(productoSel.id, provKey)}
                                className={`px-4 py-2 font-bold text-xs tracking-wider border-2 border-stone-900 ${
                                  provKey === "aqua" ? "bg-emerald-700 text-white hover:bg-emerald-900" : "bg-amber-700 text-white hover:bg-amber-900"
                                }`}>
                          + AÑADIR
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRODUCTO NO LISTADO */}
      {modalNoListadoAbierto && (
        <ModalProductoNoListado
          onCancelar={() => setModalNoListadoAbierto(false)}
          onAñadir={(item) => {
            añadirNoListado(item);
            setModalNoListadoAbierto(false);
            // Abrir el carrito tras añadirlo
            setTimeout(() => setCarritoAbierto(true), 100);
          }}
        />
      )}

      {/* BOTÓN FLOTANTE "+ Producto no listado" — solo si NO está abierto el carrito ni el modal */}
      {!carritoAbierto && !productoSel && !modalNoListadoAbierto && (
        <button
          onClick={() => setModalNoListadoAbierto(true)}
          className="fixed bottom-4 left-4 z-20 bg-stone-900 text-amber-400 border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:bg-amber-400 hover:text-stone-900 transition-all px-3 py-2 text-[10px] font-black tracking-widest"
          style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}
        >
          + PEDIR PRODUCTO NO LISTADO
        </button>
      )}
    </div>
  );
}

// =========================================================
//  Modal: pedir un producto que no está en el catálogo
// =========================================================
function ModalProductoNoListado({ onCancelar, onAñadir }) {
  const [desc, setDesc] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [unidad, setUnidad] = useState("uni");
  const [proveedor, setProveedor] = useState("indistinto");
  const [proveedorCustom, setProveedorCustom] = useState("");

  const proveedorFinal = proveedor === "otro"
    ? (proveedorCustom.trim() || "otro")
    : proveedor;

  const puedeAñadir = desc.trim().length > 2 && cantidad > 0 &&
    (proveedor !== "otro" || proveedorCustom.trim().length > 1);

  const handleAñadir = () => {
    if (!puedeAñadir) return;
    onAñadir({ desc, cantidad, unidad, proveedor: proveedorFinal });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/50" onClick={onCancelar} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-md shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        <div className="bg-amber-500 border-b-4 border-stone-900 p-4 flex items-center justify-between">
          <h3 className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            PEDIR PRODUCTO NO LISTADO
          </h3>
          <button onClick={onCancelar} className="bg-stone-900 text-amber-400 p-1.5 border-2 border-stone-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-[11px] text-stone-600">
            Indica qué producto necesitas. Lo añadirás al pedido sin precio y el administrador lo confirmará con el proveedor.
          </div>

          <div>
            <label className="font-bold text-[10px] tracking-widest text-stone-700 mb-1 block">
              DESCRIPCIÓN DEL PRODUCTO
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Ej: Codo PVC evacuación 200mm, color blanco..."
              rows={3}
              className="w-full border-2 border-stone-900 bg-white p-2 text-xs focus:outline-none focus:bg-amber-50 font-mono resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-[10px] tracking-widest text-stone-700 mb-1 block">
                CANTIDAD
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={cantidad}
                onChange={(e) => setCantidad(parseFloat(e.target.value) || 0)}
                className="w-full border-2 border-stone-900 bg-white p-2 text-xs focus:outline-none focus:bg-amber-50 font-mono"
              />
            </div>
            <div>
              <label className="font-bold text-[10px] tracking-widest text-stone-700 mb-1 block">
                UNIDAD
              </label>
              <select
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                className="w-full border-2 border-stone-900 bg-white p-2 text-xs focus:outline-none focus:bg-amber-50 font-mono"
              >
                <option value="uni">unidades</option>
                <option value="m">metros</option>
                <option value="kg">kilos</option>
                <option value="L">litros</option>
                <option value="caja">cajas</option>
                <option value="rollo">rollos</option>
                <option value="par">pares</option>
                <option value="día">días</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-[10px] tracking-widest text-stone-700 mb-1 block">
              PROVEEDOR PREFERIDO
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "indistinto", t: "Cualquiera" },
                { v: "aqua",       t: "Aquatubo" },
                { v: "aram",       t: "Aramburu" },
                { v: "otro",       t: "Otro..." },
              ].map(opt => (
                <button key={opt.v} onClick={() => setProveedor(opt.v)}
                        className={`p-2 text-[10px] font-bold tracking-widest border-2 border-stone-900 transition-all ${
                          proveedor === opt.v
                            ? (opt.v === "aqua" ? "bg-emerald-700 text-white"
                               : opt.v === "aram" ? "bg-amber-700 text-white"
                               : opt.v === "otro" ? "bg-blue-700 text-white"
                               : "bg-stone-900 text-amber-400")
                            : "bg-white text-stone-900 hover:bg-stone-100"
                        }`}>
                  {opt.t}
                </button>
              ))}
            </div>
            {proveedor === "otro" && (
              <input
                type="text"
                value={proveedorCustom}
                onChange={(e) => setProveedorCustom(e.target.value)}
                placeholder="Nombre del proveedor..."
                className="mt-2 w-full border-2 border-stone-900 bg-white p-2 text-xs focus:outline-none focus:bg-amber-50 font-mono"
                autoFocus
              />
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t-2 border-stone-200">
            <button onClick={onCancelar}
                    className="flex-1 text-[10px] font-bold tracking-widest p-3 border-2 border-stone-900 bg-white hover:bg-stone-100">
              CANCELAR
            </button>
            <button onClick={handleAñadir}
                    disabled={!puedeAñadir}
                    className={`flex-[2] text-xs font-black tracking-widest p-3 border-2 border-stone-900 transition-all ${
                      puedeAñadir
                        ? "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900"
                        : "bg-stone-200 text-stone-400 cursor-not-allowed"
                    }`}
                    style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              ✓ AÑADIR AL PEDIDO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
//  PANEL ADMIN — acceso con PIN, gestión completa
// =========================================================

// Hook simple para llamar a la API admin con PIN
function useAdminApi(pin) {
  return {
    async get(path) {
      const r = await fetch(BACKEND_URL + path, { headers: { "X-Admin-Pin": pin } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    },
    async post(path, body) {
      const r = await fetch(BACKEND_URL + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Pin": pin },
        body: JSON.stringify(body || {})
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    },
    async put(path, body) {
      const r = await fetch(BACKEND_URL + path, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Admin-Pin": pin },
        body: JSON.stringify(body || {})
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    },
    async del(path) {
      const r = await fetch(BACKEND_URL + path, {
        method: "DELETE",
        headers: { "X-Admin-Pin": pin }
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }
  };
}

// =========================================================
//  PANTALLA LOGIN ADMIN — pide PIN
// =========================================================
function PantallaLoginAdmin({ onLogin, onSalir }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [comprobando, setComprobando] = useState(false);

  const handleEntrar = async () => {
    if (pin.length < 4) return;
    setComprobando(true);
    setError("");
    try {
      const r = await fetch(BACKEND_URL + "/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });
      if (!r.ok) {
        setError("PIN incorrecto");
        setPin("");
      } else {
        onLogin(pin);
      }
    } catch (e) {
      setError("Error de conexión");
    } finally {
      setComprobando(false);
    }
  };

  const teclaNumero = (n) => {
    if (pin.length < 8) setPin(pin + n);
  };
  const borrarUlt = () => setPin(pin.slice(0, -1));

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 font-mono"
         style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(255,255,255,0.02) 30px, rgba(255,255,255,0.02) 31px)" }}>
      <div className="w-full max-w-sm">
        <div className="bg-red-600 border-4 border-stone-900 p-4 mb-3 shadow-[8px_8px_0_0_rgba(0,0,0,1)] text-white">
          <div className="text-[10px] tracking-[0.3em] mb-2">ARA CORPORATE</div>
          <h1 className="font-black text-3xl leading-none" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            ACCESO ADMIN 🔐
          </h1>
        </div>

        <div className="bg-stone-800 border-4 border-stone-900 p-5 shadow-[8px_8px_0_0_rgba(0,0,0,1)] space-y-4">
          <div className="text-amber-400 text-xs tracking-widest font-bold">INTRODUCE PIN</div>

          {/* Display PIN */}
          <div className="bg-stone-900 border-2 border-amber-500 p-4 flex justify-center gap-3">
            {[0,1,2,3,4,5,6,7].slice(0, Math.max(4, pin.length)).map(i => (
              <div key={i} className={`w-3 h-3 rounded-full transition-all ${i < pin.length ? "bg-amber-400" : "bg-stone-700"}`} />
            ))}
          </div>

          {error && <div className="text-red-400 text-xs font-bold text-center">{error}</div>}

          {/* Teclado numérico */}
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} onClick={() => teclaNumero(String(n))}
                      className="bg-stone-700 hover:bg-amber-500 hover:text-stone-900 text-amber-400 text-2xl font-black p-4 border-2 border-stone-900 transition-all"
                      style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                {n}
              </button>
            ))}
            <button onClick={borrarUlt}
                    className="bg-stone-700 hover:bg-red-600 text-amber-400 text-sm font-bold p-4 border-2 border-stone-900 transition-all">
              ←
            </button>
            <button onClick={() => teclaNumero("0")}
                    className="bg-stone-700 hover:bg-amber-500 hover:text-stone-900 text-amber-400 text-2xl font-black p-4 border-2 border-stone-900 transition-all"
                    style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              0
            </button>
            <button onClick={handleEntrar}
                    disabled={pin.length < 4 || comprobando}
                    className={`text-xs font-black tracking-widest p-4 border-2 border-stone-900 transition-all ${
                      pin.length >= 4 && !comprobando
                        ? "bg-amber-500 text-stone-900 hover:bg-amber-400"
                        : "bg-stone-700 text-stone-500 cursor-not-allowed"
                    }`}
                    style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              {comprobando ? "..." : "OK"}
            </button>
          </div>

          <button onClick={onSalir}
                  className="w-full text-stone-400 text-[10px] tracking-widest p-2 hover:text-amber-400">
            ← VOLVER A APP OPERARIO
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================
//  PANEL ADMIN PRINCIPAL — todas las pestañas
// =========================================================
function PanelAdmin({ pin, onSalir }) {
  const api = useAdminApi(pin);
  const [data, setData] = useState(null);
  const [pestaña, setPestaña] = useState("resumen");
  const [recargando, setRecargando] = useState(false);

  // Carga TODA la BBDD admin + refresca el CATALOGO global
  const recargarTodo = async () => {
    setRecargando(true);
    try {
      const all = await api.get("/admin/all");
      setData(all);
      // Refrescar también la variable CATALOGO global (la usa el resto de la app:
      // modal de creación, detector de duplicados, modal de fusión, etc.)
      // Usamos los productos del admin que acabamos de cargar.
      if (Array.isArray(all?.productos)) {
        CATALOGO = all.productos;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRecargando(false);
    }
  };

  useEffect(() => { recargarTodo(); }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center font-mono">
        <div className="text-stone-500 text-sm">Cargando datos del sistema…</div>
      </div>
    );
  }

  const pestañas = [
    { id: "resumen",   nombre: "RESUMEN",  icon: "📊" },
    { id: "productos", nombre: "PRODUCTOS", icon: "📦" },
    { id: "obras",     nombre: "OBRAS",    icon: "🏗" },
    { id: "operarios",  nombre: "OPERARIOS",  icon: "👷" },
    { id: "proveedores",nombre: "PROVEEDORES", icon: "🏢" },
    { id: "pedidos",   nombre: "PEDIDOS",  icon: "📋" },
    { id: "facturas",  nombre: "FACTURAS", icon: "🧾" },
    { id: "config",    nombre: "CONFIG",   icon: "⚙️" },
  ];

  return (
    <div className="min-h-screen bg-stone-100 font-mono"
         style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(0,0,0,0.02) 30px, rgba(0,0,0,0.02) 31px)" }}>

      {/* Header */}
      <header className="bg-stone-900 border-b-4 border-amber-500 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-amber-400">
            <div className="text-[9px] tracking-widest opacity-70">ARA CORPORATE</div>
            <h1 className="font-black text-lg leading-none" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              PANEL ADMIN 🔐
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={recargarTodo}
                    disabled={recargando}
                    className="bg-amber-500 text-stone-900 px-3 py-2 text-xs font-bold tracking-widest border-2 border-amber-500 hover:bg-amber-400 transition-all">
              {recargando ? "…" : "↻ RECARGAR"}
            </button>
            <button onClick={onSalir}
                    className="bg-red-600 text-white px-3 py-2 text-xs font-bold tracking-widest border-2 border-red-600 hover:bg-red-700 transition-all">
              SALIR
            </button>
          </div>
        </div>
        {/* Pestañas */}
        <div className="bg-stone-800 border-t-2 border-stone-700">
          <div className="max-w-7xl mx-auto px-4 flex gap-0 overflow-x-auto">
            {pestañas.map(p => (
              <button key={p.id} onClick={() => setPestaña(p.id)}
                      className={`shrink-0 px-4 py-3 text-xs font-bold tracking-widest transition-all border-r-2 border-stone-700 ${
                        pestaña === p.id
                          ? "bg-amber-500 text-stone-900"
                          : "text-amber-400 hover:bg-stone-700"
                      }`}>
                <span className="mr-1">{p.icon}</span>{p.nombre}
                {p.id === "resumen" && (data.productosPendientes?.filter(x => x.estado === "pendiente").length > 0 || data.obrasPendientes?.length > 0) && (
                  <span className="ml-1 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">!</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        {pestaña === "resumen"   && <PestañaResumen data={data} api={api} reload={recargarTodo} setPestaña={setPestaña} />}
        {pestaña === "productos" && <PestañaProductos data={data} api={api} reload={recargarTodo} />}
        {pestaña === "obras"     && <PestañaObras data={data} api={api} reload={recargarTodo} />}
        {pestaña === "operarios" && <PestañaOperarios data={data} api={api} reload={recargarTodo} />}
        {pestaña === "proveedores" && <PestañaProveedores data={data} api={api} reload={recargarTodo} />}
        {pestaña === "pedidos"   && <PestañaPedidos data={data} />}
        {pestaña === "facturas"  && <PestañaFacturas api={api} pin={pin} />}
        {pestaña === "config"    && <PestañaConfig data={data} api={api} reload={recargarTodo} pin={pin} onSalir={onSalir} />}
      </div>
    </div>
  );
}

// =========================================================
//  PESTAÑA RESUMEN
// =========================================================
function PestañaResumen({ data, api, reload, setPestaña }) {
  const pendientes = (data.productosPendientes || []).filter(p => p.estado === "pendiente");
  const obrasPend = data.obrasPendientes || [];
  const pedidos = data.pedidos || [];

  // Calcular pedidos esta semana
  const ahora = new Date();
  const haceSiete = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const pedidosSemana = pedidos.filter(p => new Date(p.fecha) >= haceSiete);
  const totalSemAqua = pedidosSemana.reduce((s, p) => s + (p.lineasAqua || []).reduce((a, l) => a + (l.importe || 0), 0), 0);
  const totalSemAram = pedidosSemana.reduce((s, p) => s + (p.lineasAram || []).reduce((a, l) => a + (l.importe || 0), 0), 0);

  // Productos más pedidos (top 5)
  const contador = {};
  pedidos.forEach(p => {
    [...(p.lineasAqua || []), ...(p.lineasAram || [])].forEach(l => {
      const k = l.desc;
      contador[k] = (contador[k] || 0) + l.cantidad;
    });
  });
  const topProductos = Object.entries(contador).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Pendientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
          <div className="bg-amber-500 border-b-2 border-stone-900 p-3 flex items-center justify-between">
            <div className="font-black tracking-wider" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              🆕 PRODUCTOS NO LISTADOS
            </div>
            <span className="bg-stone-900 text-amber-400 text-xs px-2 py-0.5 font-bold">{pendientes.length}</span>
          </div>
          <div className="p-3 max-h-64 overflow-y-auto">
            {pendientes.length === 0 ? (
              <div className="text-xs text-stone-500 italic text-center py-4">Sin solicitudes pendientes</div>
            ) : (
              <div className="space-y-2">
                {pendientes.slice(0, 5).map(p => (
                  <div key={p.id} className="border-2 border-stone-200 p-2 text-xs">
                    <div className="font-bold">{p.desc}</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      {p.cantidad} {p.unidad} · {p.pedidoPor} · {p.obra?.nombre || "—"}
                    </div>
                  </div>
                ))}
                {pendientes.length > 5 && (
                  <button onClick={() => setPestaña("productos")} className="w-full text-xs font-bold text-stone-700 underline">
                    Ver todos ({pendientes.length}) →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
          <div className="bg-amber-500 border-b-2 border-stone-900 p-3 flex items-center justify-between">
            <div className="font-black tracking-wider" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              🏗 OBRAS NUEVAS
            </div>
            <span className="bg-stone-900 text-amber-400 text-xs px-2 py-0.5 font-bold">{obrasPend.length}</span>
          </div>
          <div className="p-3 max-h-64 overflow-y-auto">
            {obrasPend.length === 0 ? (
              <div className="text-xs text-stone-500 italic text-center py-4">Sin obras nuevas pendientes</div>
            ) : (
              <div className="space-y-2">
                {obrasPend.slice(0, 5).map(o => (
                  <div key={o.id} className="border-2 border-stone-200 p-2 text-xs">
                    <div className="font-bold">{o.nombre}</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      {o.dir || "Sin dirección"} · creada por {o.creadaPor}
                    </div>
                  </div>
                ))}
                {obrasPend.length > 5 && (
                  <button onClick={() => setPestaña("obras")} className="w-full text-xs font-bold text-stone-700 underline">
                    Ver todas ({obrasPend.length}) →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats semana */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard titulo="PEDIDOS 7D" valor={pedidosSemana.length} sub="esta semana" />
        <StatCard titulo="GASTO 7D AQUA" valor={"€" + totalSemAqua.toFixed(0)} sub={`base imp. (€${(totalSemAqua * 1.21).toFixed(0)} c/IVA)`} color="emerald" />
        <StatCard titulo="GASTO 7D ARAM" valor={"€" + totalSemAram.toFixed(0)} sub={`base imp. (€${(totalSemAram * 1.21).toFixed(0)} c/IVA)`} color="amber" />
        <StatCard titulo="TOTAL PEDIDOS" valor={pedidos.length} sub="histórico" />
      </div>

      {/* Top productos */}
      {topProductos.length > 0 && (
        <div className="bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
          <div className="bg-stone-900 text-amber-400 border-b-2 border-stone-900 p-3 font-black tracking-wider"
               style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            🏆 PRODUCTOS MÁS PEDIDOS
          </div>
          <div className="divide-y-2 divide-stone-100">
            {topProductos.map(([desc, cant], i) => (
              <div key={desc} className="p-3 flex items-center gap-3">
                <div className="w-8 text-xl font-black text-amber-500">#{i + 1}</div>
                <div className="flex-1 text-xs font-bold">{desc}</div>
                <div className="text-sm font-mono">{cant}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ titulo, valor, sub, color }) {
  const bg = color === "emerald" ? "bg-emerald-50 border-emerald-700" :
             color === "amber" ? "bg-amber-50 border-amber-700" :
             "bg-white border-stone-900";
  return (
    <div className={`border-2 ${bg} p-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)]`}>
      <div className="text-[10px] tracking-widest text-stone-500 mb-1">{titulo}</div>
      <div className="font-black text-2xl text-stone-900" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>{valor}</div>
      <div className="text-[10px] text-stone-500 mt-1">{sub}</div>
    </div>
  );
}

// =========================================================
//  PESTAÑA PRODUCTOS — gestión catálogo + validar pendientes
// =========================================================
function PestañaProductos({ data, api, reload }) {
  const [editando, setEditando] = useState(null); // producto que se está editando
  const [añadiendo, setAñadiendo] = useState(false);
  const [busq, setBusq] = useState("");
  const [validando, setValidando] = useState(null); // pendiente que se valida
  const [modalImportar, setModalImportar] = useState(false);
  // Filtros nuevos
  const [filtroFamilia, setFiltroFamilia] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState(""); // id del proveedor
  const [filtroProveedorModo, setFiltroProveedorModo] = useState("con"); // "con" | "sin"
  const [orden, setOrden] = useState("desc"); // desc | familia | precioAsc | precioDesc | recientes
  const [verDuplicados, setVerDuplicados] = useState(false);
  const [umbralDuplicados, setUmbralDuplicados] = useState("estricto"); // estricto (80%) | normal (60%) | permisivo (40%)
  const [parFusion, setParFusion] = useState(null); // {a, b, score} cuando se está fusionando un par

  // Pares de duplicados descartados manualmente (persistente en localStorage)
  // Formato: Set de strings "idA__idB" (ordenado alfabéticamente para que sea consistente)
  const [paresDescartados, setParesDescartados] = useState(() => {
    try {
      const raw = window.localStorage.getItem("ara-duplicados-descartados");
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  const guardarDescartes = (nuevos) => {
    setParesDescartados(nuevos);
    try {
      window.localStorage.setItem("ara-duplicados-descartados", JSON.stringify(Array.from(nuevos)));
    } catch (e) { console.warn("No se pudo guardar descartes:", e); }
  };

  const claveDescartado = (idA, idB) => {
    return [idA, idB].sort().join("__");
  };

  // Lista de proveedores (para el selector)
  const proveedoresLista = data.proveedores || [];

  // Familias únicas extraídas del catálogo
  const familiasUnicas = useMemo(() => {
    const set = new Set();
    (data.productos || []).forEach(p => { if (p.familia) set.add(p.familia); });
    return Array.from(set).sort();
  }, [data.productos]);

  // Helper: tokeniza una descripción en palabras significativas (≥3 letras)
  const tokenizar = (s) => {
    if (!s) return new Set();
    return new Set(
      s.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // sin acentos
        .replace(/[^\w\s\d]/g, " ")
        .split(/\s+/)
        .filter(t => t.length >= 3)
    );
  };

  // Helper: extrae números/medidas (incluye decimales y fracciones tipo "3/4")
  const extraerNumeros = (s) => {
    if (!s) return new Set();
    return new Set((s.match(/\d+(?:[.,]\d+)?(?:\/\d+)?/g) || []));
  };

  // Score de similitud (0..1): combina Jaccard de tokens + similitud de números/medidas
  // Los números pesan más porque distinguen tamaños (3/4" vs 1/2", 50×40 vs 63×40)
  const calcularSimilitud = (a, b) => {
    if (!a || !b || a === b) return a === b ? 1 : 0;
    const tA = tokenizar(a), tB = tokenizar(b);
    if (tA.size === 0 || tB.size === 0) return 0;

    // Jaccard: intersección / unión
    let comunesT = 0;
    for (const t of tA) if (tB.has(t)) comunesT++;
    const unionT = tA.size + tB.size - comunesT;
    const scoreTokens = unionT > 0 ? comunesT / unionT : 0;

    // Números: si comparten medidas exactas, sube el score; si difieren, baja
    const nA = extraerNumeros(a), nB = extraerNumeros(b);
    let scoreNumeros = 1; // por defecto neutro
    if (nA.size > 0 || nB.size > 0) {
      let comunesN = 0;
      for (const n of nA) if (nB.has(n)) comunesN++;
      const unionN = nA.size + nB.size - comunesN;
      scoreNumeros = unionN > 0 ? comunesN / unionN : 0;
      // Si tienen números pero NINGUNO coincide, son productos distintos casi seguro
      // (ej. "Reducción 125-110" vs "Reducción 145-110" → distintos tamaños)
      if (nA.size > 0 && nB.size > 0 && comunesN === 0) return 0;
    }

    // Score combinado: 70% tokens + 30% números (los números actúan más como filtro)
    return scoreTokens * 0.7 + scoreNumeros * 0.3;
  };

  // Calcular pares de duplicados con su score
  const paresDuplicados = useMemo(() => {
    if (!verDuplicados) return [];
    const umbrales = { estricto: 0.8, normal: 0.6, permisivo: 0.4 };
    const umbral = umbrales[umbralDuplicados] || 0.8;
    const pares = [];
    const lista = data.productos || [];

    // Helper: ¿comparten al menos un proveedor?
    const compartenProveedor = (a, b) => {
      const provsA = Object.keys(a.proveedores || {});
      const provsB = Object.keys(b.proveedores || {});
      return provsA.some(p => provsB.includes(p));
    };

    // Helper: ¿tienen la misma ref para el mismo proveedor? (duplicado seguro al 100%)
    const compartenRef = (a, b) => {
      const provsA = Object.entries(a.proveedores || {});
      for (const [pid, pvA] of provsA) {
        const pvB = b.proveedores?.[pid];
        if (pvB && pvA.ref && pvB.ref && pvA.ref === pvB.ref) return pid;
      }
      return null;
    };

    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i], b = lista[j];

        // Filtrar pares descartados manualmente
        if (paresDescartados.has(claveDescartado(a.id, b.id))) continue;

        // CASO 1: Misma ref + mismo proveedor = duplicado seguro al 100% (sin importar desc)
        const provCompartido = compartenRef(a, b);
        if (provCompartido) {
          pares.push({
            a, b,
            score: 1.0,
            motivo: `misma ref "${a.proveedores[provCompartido].ref}" en ${provCompartido}`
          });
          continue;
        }

        // CASO 2: Descripciones similares Y comparten algún proveedor
        // (sin proveedor compartido NO son duplicados — pueden ser productos distintos cubiertos por proveedores distintos)
        if (!compartenProveedor(a, b)) continue;

        const score = calcularSimilitud(a.desc, b.desc);
        if (score >= umbral) {
          pares.push({ a, b, score, motivo: "descripciones similares" });
        }
      }
    }
    return pares.sort((x, y) => y.score - x.score);
  }, [data.productos, verDuplicados, umbralDuplicados, paresDescartados]);

  // Set de IDs implicados (para resaltar filas)
  const productosConDuplicados = useMemo(() => {
    const set = new Set();
    paresDuplicados.forEach(({ a, b }) => { set.add(a.id); set.add(b.id); });
    return set;
  }, [paresDuplicados]);

  // Aplicar filtros
  const productos = useMemo(() => {
    let lista = data.productos || [];

    // Filtro búsqueda libre
    if (busq.trim()) {
      const q = busq.toLowerCase();
      lista = lista.filter(p =>
        p.desc?.toLowerCase().includes(q) ||
        Object.values(p.proveedores || {}).some(pv => pv.ref?.toLowerCase().includes(q))
      );
    }

    // Filtro por familia
    if (filtroFamilia) {
      lista = lista.filter(p => p.familia === filtroFamilia);
    }

    // Filtro por proveedor (con / sin)
    if (filtroProveedor) {
      lista = lista.filter(p => {
        const tieneProv = !!(p.proveedores && p.proveedores[filtroProveedor]);
        return filtroProveedorModo === "con" ? tieneProv : !tieneProv;
      });
    }

    // Filtro de duplicados
    if (verDuplicados) {
      lista = lista.filter(p => productosConDuplicados.has(p.id));
    }

    // Ordenación
    const sorted = [...lista];
    if (orden === "desc") sorted.sort((a, b) => (a.desc || "").localeCompare(b.desc || ""));
    else if (orden === "familia") sorted.sort((a, b) => (a.familia || "").localeCompare(b.familia || "") || (a.desc || "").localeCompare(b.desc || ""));
    else if (orden === "precioAsc" || orden === "precioDesc") {
      const precioMin = (p) => {
        const precios = Object.values(p.proveedores || {})
          .map(pv => (pv.bruto || 0) * (1 - (pv.dto || 0) / 100))
          .filter(x => x > 0);
        return precios.length > 0 ? Math.min(...precios) : 999999;
      };
      sorted.sort((a, b) => orden === "precioAsc" ? precioMin(a) - precioMin(b) : precioMin(b) - precioMin(a));
    } else if (orden === "recientes") {
      // Asumimos que los más recientes son los últimos en el array (los IDs nuevos llevan timestamp aleatorio pero el orden de inserción se preserva)
      sorted.reverse();
    }

    return sorted;
  }, [data.productos, busq, filtroFamilia, filtroProveedor, filtroProveedorModo, verDuplicados, productosConDuplicados, orden]);

  const pendientes = (data.productosPendientes || []).filter(p => p.estado === "pendiente");

  // ¿Hay algún filtro activo? (para mostrar el botón "limpiar filtros")
  const hayFiltrosActivos = busq || filtroFamilia || filtroProveedor || verDuplicados || orden !== "desc";

  // Handler para descartar un par como "no es duplicado"
  const handleDescartarPar = (idA, idB) => {
    const nuevos = new Set(paresDescartados);
    nuevos.add(claveDescartado(idA, idB));
    guardarDescartes(nuevos);
  };

  const handleResetearDescartes = () => {
    if (!confirm(`¿Resetear los ${paresDescartados.size} descartes manuales? Volverán a aparecer los pares marcados como "no duplicado".`)) return;
    guardarDescartes(new Set());
  };

  const handleBorrar = async (id) => {
    if (!confirm("¿Borrar este producto del catálogo? No afecta a pedidos ya hechos.")) return;
    await api.del("/admin/producto/" + id);
    reload();
  };

  return (
    <div className="space-y-4">
      {/* Productos pendientes de validar */}
      {pendientes.length > 0 && (
        <div className="bg-amber-100 border-2 border-amber-700 p-3">
          <div className="font-bold text-sm text-amber-900 mb-2">
            🆕 {pendientes.length} producto{pendientes.length>1?"s":""} no listado{pendientes.length>1?"s":""} pedido{pendientes.length>1?"s":""} por operarios
          </div>
          <div className="space-y-2">
            {pendientes.map(p => (
              <div key={p.id} className="bg-white border border-amber-700 p-2 flex items-start justify-between gap-2 text-xs">
                <div className="flex-1">
                  <div className="font-bold">{p.desc}</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">
                    {p.cantidad} {p.unidad} · pedido por {p.pedidoPor} · obra: {p.obra?.nombre || "—"}
                    {p.proveedor !== "indistinto" && <> · prefiere <strong>{p.proveedor === "aqua" ? "Aquatubo" : "Aramburu"}</strong></>}
                  </div>
                </div>
                <button onClick={() => setValidando(p)}
                        className="text-[10px] font-bold bg-emerald-700 text-white px-2 py-1 border border-stone-900 hover:bg-emerald-800">
                  ✓ AÑADIR AL CATÁLOGO
                </button>
                <button onClick={async () => {
                          if (!confirm("¿Descartar esta solicitud sin añadirla al catálogo?")) return;
                          await api.post("/admin/pendiente/" + p.id + "/descartar");
                          reload();
                        }}
                        className="text-[10px] font-bold bg-stone-200 text-stone-900 px-2 py-1 border border-stone-900 hover:bg-stone-300">
                  ✗
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buscador + botones */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input type="text" placeholder="Buscar por descripción o referencia…"
                   value={busq} onChange={(e) => setBusq(e.target.value)}
                   className="w-full pl-10 pr-3 py-2 border-2 border-stone-900 bg-white text-sm focus:outline-none focus:bg-amber-50 font-mono" />
          </div>
          <button onClick={() => setAñadiendo(true)}
                  className="bg-stone-900 text-amber-400 px-4 py-2 text-xs font-black tracking-widest border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900"
                  style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            + NUEVO
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-stone-50 border-2 border-stone-900 p-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] font-bold tracking-widest text-stone-700">FAMILIA:</label>
            <select
              value={filtroFamilia}
              onChange={(e) => setFiltroFamilia(e.target.value)}
              className="border border-stone-900 px-2 py-1 text-[11px] bg-white focus:outline-none focus:bg-amber-50">
              <option value="">Todas ({familiasUnicas.length})</option>
              {familiasUnicas.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[9px] font-bold tracking-widest text-stone-700">PROVEEDOR:</label>
            <select
              value={filtroProveedorModo}
              onChange={(e) => setFiltroProveedorModo(e.target.value)}
              disabled={!filtroProveedor}
              className="border border-stone-900 px-2 py-1 text-[11px] bg-white focus:outline-none focus:bg-amber-50 disabled:opacity-40">
              <option value="con">Con</option>
              <option value="sin">Sin</option>
            </select>
            <select
              value={filtroProveedor}
              onChange={(e) => setFiltroProveedor(e.target.value)}
              className="border border-stone-900 px-2 py-1 text-[11px] bg-white focus:outline-none focus:bg-amber-50">
              <option value="">— elige proveedor —</option>
              {proveedoresLista.map(p => <option key={p.id} value={p.id}>{p.nombre || p.id}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[9px] font-bold tracking-widest text-stone-700">ORDEN:</label>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
              className="border border-stone-900 px-2 py-1 text-[11px] bg-white focus:outline-none focus:bg-amber-50">
              <option value="desc">Descripción A-Z</option>
              <option value="familia">Por familia</option>
              <option value="precioAsc">Precio: barato → caro</option>
              <option value="precioDesc">Precio: caro → barato</option>
              <option value="recientes">Recién creados primero</option>
            </select>
          </div>

          <button
            onClick={() => setVerDuplicados(!verDuplicados)}
            title="Encuentra productos con descripciones muy similares (potenciales duplicados a fusionar)"
            className={`px-2 py-1 text-[10px] font-bold border ${verDuplicados ? "bg-rose-700 text-white border-rose-900" : "bg-rose-50 text-rose-800 border-rose-400 hover:bg-rose-100"}`}>
            {verDuplicados ? "🔍 Solo duplicados" : "🔍 Buscar duplicados"}
          </button>

          {verDuplicados && (
            <select
              value={umbralDuplicados}
              onChange={(e) => setUmbralDuplicados(e.target.value)}
              title="Umbral de similitud: estricto = menos resultados pero más fiables; permisivo = más resultados, más falsos positivos"
              className="border border-rose-400 px-2 py-1 text-[10px] bg-rose-50 focus:outline-none focus:bg-amber-50">
              <option value="estricto">Umbral: estricto (≥80%)</option>
              <option value="normal">Umbral: normal (≥60%)</option>
              <option value="permisivo">Umbral: permisivo (≥40%)</option>
            </select>
          )}

          {paresDescartados.size > 0 && verDuplicados && (
            <button
              onClick={handleResetearDescartes}
              title={`${paresDescartados.size} pares marcados como "no duplicado". Pulsa para reiniciar.`}
              className="px-2 py-1 text-[10px] font-bold border border-stone-400 bg-stone-100 hover:bg-stone-200 text-stone-700">
              ↻ Resetear descartes ({paresDescartados.size})
            </button>
          )}

          {hayFiltrosActivos && (
            <button
              onClick={() => { setBusq(""); setFiltroFamilia(""); setFiltroProveedor(""); setFiltroProveedorModo("con"); setVerDuplicados(false); setOrden("desc"); }}
              className="px-2 py-1 text-[10px] font-bold border-2 border-stone-900 bg-stone-100 hover:bg-stone-200 ml-auto">
              ✕ LIMPIAR FILTROS
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setModalImportar(true)}
                  className="text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-stone-900 bg-emerald-100 hover:bg-emerald-200 text-stone-900">
            📥 IMPORTAR
          </button>
          <button onClick={() => exportarCSV(data.productos)}
                  className="text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-stone-900 bg-amber-100 hover:bg-amber-200 text-stone-900">
            📤 EXPORTAR CSV
          </button>
          <button onClick={() => exportarJSON(data.productos)}
                  className="text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-stone-900 bg-amber-100 hover:bg-amber-200 text-stone-900">
            📤 EXPORTAR JSON
          </button>
          <button onClick={() => descargarPlantillaCSV()}
                  className="text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-stone-900 bg-stone-100 hover:bg-stone-200 text-stone-900">
            📋 PLANTILLA CSV
          </button>
        </div>
      </div>

      <div className="text-[10px] text-stone-500 tracking-widest">
        {productos.length} de {data.productos.length} productos
        {verDuplicados && paresDuplicados.length > 0 && ` · ⚠️ ${paresDuplicados.length} par${paresDuplicados.length === 1 ? "" : "es"} sospechoso${paresDuplicados.length === 1 ? "" : "s"}`}
      </div>

      {/* Aviso si no hay duplicados detectados */}
      {verDuplicados && paresDuplicados.length === 0 && (
        <div className="bg-emerald-50 border-2 border-emerald-400 p-3 text-xs text-emerald-900">
          <b>✅ No se han detectado duplicados</b> con el umbral actual ({umbralDuplicados}). Si crees que sí los hay, prueba un umbral más permisivo o resetea los descartes.
        </div>
      )}

      {/* Tabla productos */}
      <div className="bg-white border-2 border-stone-900 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-stone-900 text-amber-400">
            <tr>
              <th className="p-2 text-left">FAMILIA</th>
              <th className="p-2 text-left">DESCRIPCIÓN</th>
              <th className="p-2 text-left">REF AQUA</th>
              <th className="p-2 text-right">€ AQUA</th>
              <th className="p-2 text-left">REF ARAM</th>
              <th className="p-2 text-right">€ ARAM</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {/* Helper: render de una fila de producto reutilizable */}
            {(() => {
              // Función helper local que devuelve el JSX de UNA fila de producto
              const renderFila = (p, opts = {}) => {
                const aq = p.proveedores?.aqua;
                const ar = p.proveedores?.aram;
                const netoA = aq ? +(aq.bruto * (1 - aq.dto / 100)).toFixed(2) : null;
                const netoR = ar ? +(ar.bruto * (1 - ar.dto / 100)).toFixed(2) : null;
                const otrosProvs = Object.entries(p.proveedores || {}).filter(([k]) => k !== "aqua" && k !== "aram");
                return (
                  <tr key={p.id} className={`hover:bg-amber-50 ${opts.bg || ""}`}>
                    <td className="p-2 text-[10px] text-stone-500">{p.familia}</td>
                    <td className="p-2 font-bold">
                      {p.desc}
                      {otrosProvs.length > 0 && (
                        <span className="ml-2 inline-flex gap-1 align-middle">
                          {otrosProvs.map(([pid, pv]) => {
                            const provNombre = proveedoresLista.find(x => x.id === pid)?.nombre || pid;
                            const precio = pv.bruto ? +(pv.bruto * (1 - (pv.dto || 0) / 100)).toFixed(2) : null;
                            return (
                              <span key={pid}
                                title={`${provNombre} · ref ${pv.ref || "—"}${precio !== null ? " · €" + precio : ""}`}
                                className="text-[9px] font-bold px-1 py-0.5 bg-violet-100 text-violet-800 border border-violet-300 rounded-sm font-mono">
                                {pid.toUpperCase().substring(0, 4)}
                              </span>
                            );
                          })}
                        </span>
                      )}
                    </td>
                    <td className="p-2 font-mono text-[10px]">{aq?.ref || "—"}</td>
                    <td className="p-2 text-right font-mono">{netoA ? "€" + netoA : "—"}</td>
                    <td className="p-2 font-mono text-[10px]">{ar?.ref || "—"}</td>
                    <td className="p-2 text-right font-mono">{netoR ? "€" + netoR : "—"}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button onClick={() => setEditando(p)}
                              className="text-[10px] font-bold bg-amber-500 text-stone-900 px-2 py-1 border border-stone-900 hover:bg-amber-400 mr-1">
                        ✏ EDITAR
                      </button>
                      <button onClick={() => handleBorrar(p.id)}
                              className="text-[10px] font-bold bg-red-600 text-white px-2 py-1 border border-stone-900 hover:bg-red-700">
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              };

              // ── MODO DUPLICADOS: render por pares con cabecera ──
              if (verDuplicados && paresDuplicados.length > 0) {
                return paresDuplicados.slice(0, 50).flatMap(({ a, b, score, motivo }, idx) => {
                  const pctScore = Math.round(score * 100);
                  // Si comparten ref, es duplicado seguro: badge negro destacado
                  const esRefIdentica = motivo && motivo.startsWith("misma ref");
                  const colorScore = esRefIdentica ? "bg-stone-900" : pctScore >= 90 ? "bg-red-700" : pctScore >= 75 ? "bg-orange-600" : "bg-amber-600";
                  const labelScore = esRefIdentica ? "DUPLICADO SEGURO" : `${pctScore}% similar`;
                  const claveK = a.id + "__" + b.id;
                  // FIX clave: como un producto puede estar en múltiples pares (3+ duplicados),
                  // las keys de las filas tienen que ser únicas POR PAR, no solo por producto.
                  // Sin esto React colapsa las filas duplicadas y desaparecen cabeceras.
                  const filaA = renderFila(a, { bg: "bg-rose-50" });
                  const filaB = renderFila(b, { bg: "bg-rose-50" });
                  return [
                    // Cabecera del par
                    <tr key={claveK + "-h"} className="bg-rose-100 border-t-4 border-rose-700">
                      <td colSpan={7} className="p-1.5">
                        <div className="flex items-center gap-2 text-[10px] flex-wrap">
                          <span className={`${colorScore} text-white font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap`}>
                            {labelScore}
                          </span>
                          <span className="font-bold text-rose-900 tracking-widest">PAR #{idx + 1}</span>
                          {motivo && (
                            <span className="text-rose-800 italic">— {motivo}</span>
                          )}
                          <button onClick={() => setParFusion({ a, b, score, motivo })}
                            title="Fusionar estos dos productos en uno"
                            className="ml-auto text-[9px] font-bold bg-emerald-600 text-white px-2 py-1 border border-emerald-800 hover:bg-emerald-700">
                            🔀 FUSIONAR
                          </button>
                          <button onClick={() => handleDescartarPar(a.id, b.id)}
                            title="Marcar este par como NO duplicado para que no vuelva a aparecer"
                            className="text-[9px] font-bold bg-white text-stone-700 px-2 py-1 border border-stone-400 hover:bg-stone-100">
                            ✕ no es duplicado
                          </button>
                        </div>
                      </td>
                    </tr>,
                    // Producto A — clonamos con key única por par
                    React.cloneElement(filaA, { key: claveK + "-a" }),
                    // Producto B — clonamos con key única por par
                    React.cloneElement(filaB, { key: claveK + "-b" }),
                  ];
                });
              }

              // ── MODO NORMAL: render lineal ──
              return productos.slice(0, 100).map(p => renderFila(p));
            })()}
          </tbody>
        </table>
        {verDuplicados && paresDuplicados.length > 50 && (
          <div className="p-3 text-xs text-rose-700 text-center bg-rose-50 italic">
            Mostrando los primeros 50 pares de {paresDuplicados.length}. Sube el umbral para ver menos.
          </div>
        )}
        {!verDuplicados && productos.length > 100 && (
          <div className="p-3 text-xs text-stone-500 text-center bg-stone-50">
            Mostrando los primeros 100 de {productos.length}. Usa el buscador para filtrar.
          </div>
        )}
      </div>

      {/* Modales */}
      {editando && (
        <ModalEditarProducto producto={editando} api={api} reload={reload} onCerrar={() => setEditando(null)} />
      )}
      {añadiendo && (
        <ModalEditarProducto producto={null} api={api} reload={reload} onCerrar={() => setAñadiendo(false)} />
      )}
      {validando && (
        <ModalEditarProducto
          producto={null}
          api={api}
          reload={reload}
          onCerrar={() => setValidando(null)}
          plantillaInicial={{
            desc: validando.desc,
            familia: "Varios",
            unidad: validando.unidad,
            img: "tapon"
          }}
          esValidacion={validando}
        />
      )}
      {modalImportar && (
        <ModalImportarProductos
          productosActuales={data.productos || []}
          api={api}
          reload={reload}
          onCerrar={() => setModalImportar(false)}
        />
      )}
      {parFusion && (
        <ModalFusionarProductos
          par={parFusion}
          proveedoresLista={proveedoresLista}
          onCerrar={() => setParFusion(null)}
          onFusionado={() => { setParFusion(null); reload(); }}
        />
      )}
    </div>
  );
}

// =========================================================
//  MODAL: Fusionar dos productos duplicados
// =========================================================
function ModalFusionarProductos({ par, proveedoresLista, onCerrar, onFusionado }) {
  const { a, b, motivo } = par;
  const [ganadorId, setGanadorId] = useState(a.id); // por defecto A es el ganador
  const [conflictosResueltos, setConflictosResueltos] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const FAC_URL = "https://araujo-bot.onrender.com/api/facturas";

  const ganador = ganadorId === a.id ? a : b;
  const perdedor = ganadorId === a.id ? b : a;

  // Detectar conflictos: proveedores que están en AMBOS productos con datos distintos
  const conflictos = useMemo(() => {
    const provsGanador = ganador.proveedores || {};
    const provsPerdedor = perdedor.proveedores || {};
    const conflictos = [];
    for (const [pid, datosPerdedor] of Object.entries(provsPerdedor)) {
      if (provsGanador[pid]) {
        const datosG = provsGanador[pid];
        // Solo es conflicto si los datos son distintos
        // Comparación tolerante: precios se consideran iguales si difieren en menos de 0.001 €
        // (evita falsos conflictos por errores de redondeo de punto flotante)
        const refDistinta = (datosG.ref || "") !== (datosPerdedor.ref || "");
        const precioDistinto = Math.abs((datosG.bruto || 0) - (datosPerdedor.bruto || 0)) > 0.001;
        if (refDistinta || precioDistinto) {
          conflictos.push({ proveedorId: pid, ganador: datosG, perdedor: datosPerdedor });
        }
      }
    }
    return conflictos;
  }, [ganadorId, a.proveedores, b.proveedores]);

  // Proveedores que se moverán (sin conflicto)
  const proveedoresMovidos = useMemo(() => {
    const provsGanador = ganador.proveedores || {};
    const provsPerdedor = perdedor.proveedores || {};
    return Object.keys(provsPerdedor).filter(pid => !provsGanador[pid]);
  }, [ganadorId, a.proveedores, b.proveedores]);

  // Falta resolver algún conflicto?
  const conflictosPendientes = conflictos.filter(c => !conflictosResueltos[c.proveedorId]);

  const nombreProv = (pid) => proveedoresLista.find(p => p.id === pid)?.nombre || pid;
  const formatPrecio = (pv) => pv.bruto ? +(pv.bruto * (1 - (pv.dto || 0) / 100)).toFixed(4) : null;

  const handleFusionar = async () => {
    if (conflictosPendientes.length > 0) {
      alert(`Resuelve los ${conflictosPendientes.length} conflicto${conflictosPendientes.length === 1 ? "" : "s"} antes de fusionar`);
      return;
    }
    if (!confirm(`¿Fusionar "${perdedor.desc}" en "${ganador.desc}"?\n\nEl producto perdedor se BORRARÁ. Sus proveedores y referencias se moverán al ganador. Las equivalencias y líneas de factura se redirigirán.\n\nEsta acción no se puede deshacer.`)) return;

    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(FAC_URL + "/fusionar-productos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": "1234" },
        body: JSON.stringify({
          ganadorId: ganador.id,
          perdedorId: perdedor.id,
          conflictosResueltos
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error en la fusión");
      alert("✅ " + data.mensaje);
      onFusionado();
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  };

  // Renderiza un producto con sus proveedores (compacto)
  const renderProducto = (p, esGanador) => (
    <div className={`border-2 p-3 ${esGanador ? "border-emerald-700 bg-emerald-50" : "border-stone-400 bg-stone-50 opacity-70"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-bold tracking-widest text-stone-500">{p.familia || "Sin familia"}</div>
          <div className="font-bold text-sm">{p.desc}</div>
          <div className="text-[9px] text-stone-500 font-mono">id: {p.id}</div>
        </div>
        {esGanador ? (
          <span className="text-[9px] font-bold bg-emerald-700 text-white px-2 py-0.5 whitespace-nowrap">✓ GANADOR</span>
        ) : (
          <span className="text-[9px] font-bold bg-stone-500 text-white px-2 py-0.5 whitespace-nowrap">✕ SE BORRA</span>
        )}
      </div>
      <div className="space-y-0.5">
        {Object.entries(p.proveedores || {}).map(([pid, pv]) => {
          const precio = formatPrecio(pv);
          return (
            <div key={pid} className="text-[10px] font-mono bg-white border border-stone-300 px-2 py-1 flex items-center gap-2">
              <span className="font-bold text-violet-700">{nombreProv(pid)}</span>
              <span className="text-stone-500">ref</span>
              <span>{pv.ref || "—"}</span>
              {precio && <span className="ml-auto font-bold">€{precio}</span>}
            </div>
          );
        })}
        {Object.keys(p.proveedores || {}).length === 0 && (
          <div className="text-[10px] italic text-stone-400">Sin proveedores</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/70" onClick={onCerrar} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="bg-emerald-700 text-white border-b-4 border-stone-900 p-3 flex items-center justify-between sticky top-0 z-10">
          <h3 className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            🔀 FUSIONAR PRODUCTOS DUPLICADOS
          </h3>
          <button onClick={onCerrar} disabled={guardando}
            className="bg-white text-emerald-700 font-black px-3 py-1 border-2 border-white hover:bg-emerald-100 disabled:opacity-50">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Aviso */}
          <div className="bg-amber-50 border-2 border-amber-400 p-3 text-[11px] text-amber-900">
            <b>⚠️ Acción irreversible:</b> el producto perdedor se borrará del catálogo. Sus proveedores se moverán al ganador. Las equivalencias aprendidas y las líneas de facturas que apuntaban al perdedor se redirigirán al ganador automáticamente.
            {motivo && <div className="mt-1"><b>Motivo de detección:</b> {motivo}</div>}
          </div>

          {/* Selector de ganador */}
          <div>
            <div className="text-[10px] font-bold tracking-widest text-stone-700 mb-2">¿CUÁL ES EL GANADOR? (el que se queda)</div>
            <div className="flex gap-2">
              <button
                onClick={() => setGanadorId(a.id)}
                disabled={guardando}
                className={`flex-1 px-3 py-2 text-xs font-black tracking-widest border-2 ${ganadorId === a.id ? "bg-emerald-600 text-white border-emerald-800" : "bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200"}`}>
                A: {a.desc.substring(0, 35)}{a.desc.length > 35 ? "…" : ""}
              </button>
              <button
                onClick={() => setGanadorId(b.id)}
                disabled={guardando}
                className={`flex-1 px-3 py-2 text-xs font-black tracking-widest border-2 ${ganadorId === b.id ? "bg-emerald-600 text-white border-emerald-800" : "bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200"}`}>
                B: {b.desc.substring(0, 35)}{b.desc.length > 35 ? "…" : ""}
              </button>
            </div>
          </div>

          {/* Vista lado a lado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {renderProducto(ganador, true)}
            {renderProducto(perdedor, false)}
          </div>

          {/* Resolución de conflictos */}
          {conflictos.length > 0 && (
            <div className="border-2 border-orange-700 bg-orange-50 p-3">
              <div className="text-[11px] font-bold text-orange-900 mb-2">
                ⚠️ CONFLICTOS DE PROVEEDOR ({conflictos.length})
              </div>
              <div className="text-[10px] text-orange-800 italic mb-3">
                Los dos productos tienen estos proveedores con datos distintos. Elige cuál se queda.
              </div>
              <div className="space-y-2">
                {conflictos.map(c => (
                  <div key={c.proveedorId} className="bg-white border border-orange-400 p-2 text-[11px]">
                    <div className="font-bold text-orange-900 mb-1">📦 {nombreProv(c.proveedorId)}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setConflictosResueltos({...conflictosResueltos, [c.proveedorId]: "ganador"})}
                        disabled={guardando}
                        className={`text-left p-2 border-2 ${conflictosResueltos[c.proveedorId] === "ganador" ? "border-emerald-700 bg-emerald-100" : "border-stone-300 bg-stone-50 hover:bg-stone-100"}`}>
                        <div className="text-[9px] font-bold text-stone-500">DATOS GANADOR</div>
                        <div className="font-mono">ref: {c.ganador.ref || "—"}</div>
                        <div className="font-mono">€{formatPrecio(c.ganador) ?? "—"}</div>
                      </button>
                      <button
                        onClick={() => setConflictosResueltos({...conflictosResueltos, [c.proveedorId]: "perdedor"})}
                        disabled={guardando}
                        className={`text-left p-2 border-2 ${conflictosResueltos[c.proveedorId] === "perdedor" ? "border-emerald-700 bg-emerald-100" : "border-stone-300 bg-stone-50 hover:bg-stone-100"}`}>
                        <div className="text-[9px] font-bold text-stone-500">DATOS PERDEDOR</div>
                        <div className="font-mono">ref: {c.perdedor.ref || "—"}</div>
                        <div className="font-mono">€{formatPrecio(c.perdedor) ?? "—"}</div>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumen */}
          <div className="bg-stone-50 border-2 border-stone-700 p-3 text-[11px]">
            <div className="font-bold text-stone-800 mb-1">RESUMEN DE LA FUSIÓN</div>
            <ul className="space-y-1 text-stone-700">
              <li>• Se quedará: <b>{ganador.desc}</b></li>
              <li>• Se borrará: <b>{perdedor.desc}</b></li>
              {proveedoresMovidos.length > 0 && (
                <li>• Proveedores que se moverán al ganador: <b>{proveedoresMovidos.map(nombreProv).join(", ")}</b></li>
              )}
              {conflictos.length > 0 && (
                <li>• Conflictos: <b>{conflictos.length} ({conflictosPendientes.length} sin resolver)</b></li>
              )}
              <li className="text-stone-500 italic">• Las equivalencias y líneas de facturas que apuntan al perdedor se redirigirán automáticamente.</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-100 border-2 border-red-700 p-2 text-[11px] text-red-900">
              ❌ Error: {error}
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2 pt-2">
            <button onClick={onCerrar} disabled={guardando}
              className="flex-1 bg-stone-200 text-stone-800 px-3 py-2 text-xs font-black tracking-widest border-2 border-stone-900 hover:bg-stone-300 disabled:opacity-50">
              CANCELAR
            </button>
            <button onClick={handleFusionar} disabled={guardando || conflictosPendientes.length > 0}
              className="flex-[2] bg-emerald-600 text-white px-3 py-2 text-xs font-black tracking-widest border-2 border-emerald-800 hover:bg-emerald-700 disabled:opacity-50">
              {guardando ? "⏳ FUSIONANDO..." : conflictosPendientes.length > 0 ? `⚠ RESUELVE ${conflictosPendientes.length} CONFLICTO${conflictosPendientes.length === 1 ? "" : "S"}` : "🔀 FUSIONAR DEFINITIVAMENTE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
//  IMPORTAR / EXPORTAR PRODUCTOS — funciones helper
// =========================================================

// Cabeceras del CSV en orden
const CSV_HEADERS = [
  "id", "desc", "familia", "unidad", "img",
  "aqua_ref", "aqua_bruto", "aqua_dto", "aqua_marca",
  "aram_ref", "aram_bruto", "aram_dto", "aram_marca"
];

// Escapa una celda CSV: si tiene coma, comillas o salto de línea → entrecomillar
function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes(";")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Genera el contenido CSV completo a partir de un array de productos
function generarCSV(productos) {
  const filas = [CSV_HEADERS.join(",")];
  for (const p of productos) {
    const aq = p.proveedores?.aqua || {};
    const ar = p.proveedores?.aram || {};
    const fila = [
      csvEscape(p.id || ""),
      csvEscape(p.desc || ""),
      csvEscape(p.familia || ""),
      csvEscape(p.unidad || ""),
      csvEscape(p.img || ""),
      csvEscape(aq.ref || ""),
      csvEscape(aq.bruto ?? ""),
      csvEscape(aq.dto ?? ""),
      csvEscape(aq.marca || ""),
      csvEscape(ar.ref || ""),
      csvEscape(ar.bruto ?? ""),
      csvEscape(ar.dto ?? ""),
      csvEscape(ar.marca || "")
    ];
    filas.push(fila.join(","));
  }
  // BOM UTF-8 para que Excel lo abra bien con acentos
  return "\ufeff" + filas.join("\n");
}

// Descarga un blob como archivo
function descargarArchivo(contenido, nombre, tipoMime) {
  const blob = new Blob([contenido], { type: tipoMime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportarCSV(productos) {
  const contenido = generarCSV(productos);
  const fecha = new Date().toISOString().slice(0, 10);
  descargarArchivo(contenido, `ARA_productos_${fecha}.csv`, "text/csv");
}

function exportarJSON(productos) {
  const contenido = JSON.stringify(productos, null, 2);
  const fecha = new Date().toISOString().slice(0, 10);
  descargarArchivo(contenido, `ARA_productos_${fecha}.json`, "application/json");
}

function descargarPlantillaCSV() {
  // Plantilla con cabeceras + 2 filas de ejemplo
  const ejemplo = [
    {
      id: "", // si vacío se generará automáticamente
      desc: "Ejemplo: codo multicapa 25",
      familia: "Multicapa",
      unidad: "uni",
      img: "mcap",
      proveedores: {
        aqua: { ref: "25742", bruto: 10.82, dto: 73, marca: "MT" },
        aram: { ref: "MCCDO25", bruto: 7.45, dto: 50, marca: "FE" }
      }
    },
    {
      id: "",
      desc: "Ejemplo: producto solo en Aramburu (deja vacíos los campos aqua_*)",
      familia: "Varios",
      unidad: "uni",
      img: "tapon",
      proveedores: {
        aram: { ref: "REF123", bruto: 5.50, dto: 50, marca: "—" }
      }
    }
  ];
  const contenido = generarCSV(ejemplo);
  descargarArchivo(contenido, "ARA_plantilla_productos.csv", "text/csv");
}

// Parser CSV simple que respeta comillas y comas dentro de campos
function parsearCSV(texto) {
  // Quitar BOM si existe
  if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);

  const filas = [];
  let fila = [];
  let celda = "";
  let dentroDeComillas = false;
  let i = 0;

  while (i < texto.length) {
    const c = texto[i];
    if (dentroDeComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { celda += '"'; i += 2; continue; } // comilla escapada
        dentroDeComillas = false;
        i++;
        continue;
      }
      celda += c;
      i++;
    } else {
      if (c === '"') { dentroDeComillas = true; i++; continue; }
      if (c === ',' || c === ';') { fila.push(celda); celda = ""; i++; continue; }
      if (c === '\n' || c === '\r') {
        // Cierra fila
        if (c === '\r' && texto[i+1] === '\n') i++; // CRLF
        fila.push(celda);
        if (fila.length > 1 || fila[0] !== "") filas.push(fila);
        fila = [];
        celda = "";
        i++;
        continue;
      }
      celda += c;
      i++;
    }
  }
  if (celda !== "" || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

// Convierte filas CSV (con cabeceras en la primera fila) a un array de productos
function csvAProductos(filas) {
  if (filas.length < 2) throw new Error("El archivo está vacío o no tiene datos");
  const cabeceras = filas[0].map(h => h.trim().toLowerCase());

  // Validar que están las cabeceras mínimas
  const obligatorias = ["desc", "familia"];
  const faltan = obligatorias.filter(h => !cabeceras.includes(h));
  if (faltan.length > 0) {
    throw new Error("Faltan columnas obligatorias: " + faltan.join(", "));
  }

  const idx = (nombre) => cabeceras.indexOf(nombre);

  const productos = [];
  const errores = [];

  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i];
    if (fila.every(c => !c.trim())) continue; // fila vacía, ignorar

    const get = (col) => {
      const j = idx(col);
      return j < 0 ? "" : (fila[j] || "").trim();
    };
    const getNum = (col) => {
      const v = get(col);
      if (v === "") return null;
      const n = parseFloat(v.replace(",", "."));
      return isNaN(n) ? null : n;
    };

    const desc = get("desc");
    if (!desc) {
      errores.push({ linea: i + 1, error: "Sin descripción" });
      continue;
    }

    const p = {
      id: get("id") || null,
      desc,
      familia: get("familia") || "Varios",
      unidad: get("unidad") || "uni",
      img: get("img") || "tapon",
      proveedores: {}
    };

    // Aquatubo
    const aqRef = get("aqua_ref");
    const aqBruto = getNum("aqua_bruto");
    if (aqRef && aqBruto !== null) {
      p.proveedores.aqua = {
        ref: aqRef,
        bruto: aqBruto,
        dto: getNum("aqua_dto") ?? 0,
        marca: get("aqua_marca") || "—"
      };
    }
    // Aramburu
    const arRef = get("aram_ref");
    const arBruto = getNum("aram_bruto");
    if (arRef && arBruto !== null) {
      p.proveedores.aram = {
        ref: arRef,
        bruto: arBruto,
        dto: getNum("aram_dto") ?? 0,
        marca: get("aram_marca") || "—"
      };
    }

    if (!p.proveedores.aqua && !p.proveedores.aram) {
      errores.push({ linea: i + 1, error: `"${desc}" sin precios de ningún proveedor` });
      continue;
    }

    productos.push(p);
  }

  return { productos, errores };
}

// =========================================================
//  Modal importar productos
// =========================================================
function ModalImportarProductos({ productosActuales, api, reload, onCerrar }) {
  const [archivo, setArchivo] = useState(null);
  const [analisis, setAnalisis] = useState(null); // { coinciden, nuevos, faltan, errores }
  const [accionFaltan, setAccionFaltan] = useState("mantener"); // mantener | borrar
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState("");
  const [progreso, setProgreso] = useState(null);

  const handleArchivo = async (e) => {
    setError("");
    setAnalisis(null);
    const f = e.target.files?.[0];
    if (!f) return;
    setArchivo(f);

    try {
      const texto = await f.text();
      let importados, errores;

      // Detectar JSON o CSV por extensión y contenido
      const esJSON = f.name.toLowerCase().endsWith(".json") || texto.trim().startsWith("[") || texto.trim().startsWith("{");

      if (esJSON) {
        let data;
        try {
          data = JSON.parse(texto);
        } catch (er) {
          throw new Error("JSON mal formado: " + er.message);
        }
        const arr = Array.isArray(data) ? data : (data.productos || []);
        importados = arr.filter(p => p && p.desc);
        errores = arr.filter(p => !p?.desc).map((p, i) => ({ linea: i + 1, error: "Sin descripción" }));
      } else {
        // CSV
        const filas = parsearCSV(texto);
        const r = csvAProductos(filas);
        importados = r.productos;
        errores = r.errores;
      }

      // Comparar con productosActuales
      const idsActuales = new Set(productosActuales.map(p => p.id));
      const descsActuales = new Map(productosActuales.map(p => [p.desc.toLowerCase().trim(), p.id]));
      const idsImportados = new Set();

      const coinciden = []; // van a actualizarse
      const nuevos = [];

      for (const p of importados) {
        // Si trae id que existe → actualizar
        if (p.id && idsActuales.has(p.id)) {
          coinciden.push(p);
          idsImportados.add(p.id);
        } else {
          // Si no trae id pero hay coincidencia por descripción exacta → actualizar
          const idEncontrado = descsActuales.get(p.desc.toLowerCase().trim());
          if (idEncontrado) {
            coinciden.push({ ...p, id: idEncontrado });
            idsImportados.add(idEncontrado);
          } else {
            nuevos.push(p);
          }
        }
      }

      // Productos en el catálogo actual que NO están en el CSV
      const faltan = productosActuales.filter(p => !idsImportados.has(p.id));

      setAnalisis({ coinciden, nuevos, faltan, errores });
    } catch (e) {
      setError(e.message);
      setAnalisis(null);
    }
  };

  const aplicarCambios = async () => {
    if (!analisis) return;
    setAplicando(true);
    setError("");
    let n = 0;
    const total = analisis.coinciden.length + analisis.nuevos.length + (accionFaltan === "borrar" ? analisis.faltan.length : 0);
    setProgreso({ hechos: 0, total });

    try {
      // 1) Actualizar coincidencias
      for (const p of analisis.coinciden) {
        await api.put("/admin/producto/" + p.id, {
          desc: p.desc, familia: p.familia, unidad: p.unidad, img: p.img,
          proveedores: p.proveedores
        });
        n++; setProgreso({ hechos: n, total });
      }
      // 2) Crear nuevos
      for (const p of analisis.nuevos) {
        const body = { desc: p.desc, familia: p.familia, unidad: p.unidad, img: p.img, proveedores: p.proveedores };
        if (p.id) body.id = p.id;
        await api.post("/admin/producto", body);
        n++; setProgreso({ hechos: n, total });
      }
      // 3) Borrar los que faltan (si así se decidió)
      if (accionFaltan === "borrar") {
        for (const p of analisis.faltan) {
          await api.del("/admin/producto/" + p.id);
          n++; setProgreso({ hechos: n, total });
        }
      }

      reload();
      alert(`✓ Importación completada:
  • ${analisis.coinciden.length} actualizados
  • ${analisis.nuevos.length} añadidos
  • ${accionFaltan === "borrar" ? analisis.faltan.length + " borrados" : analisis.faltan.length + " mantenidos sin cambios"}`);
      onCerrar();
    } catch (e) {
      setError("Error aplicando cambios: " + e.message + ". Algunos productos pueden haberse actualizado, otros no.");
    } finally {
      setAplicando(false);
      setProgreso(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/50" onClick={!aplicando ? onCerrar : undefined} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        <div className="bg-emerald-500 border-b-4 border-stone-900 p-3 flex items-center justify-between sticky top-0 z-10">
          <h3 className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            📥 IMPORTAR PRODUCTOS
          </h3>
          <button onClick={onCerrar} disabled={aplicando}
                  className="bg-stone-900 text-amber-400 p-1.5 border-2 border-stone-900 disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-stone-50 border-2 border-stone-300 p-3 text-xs leading-relaxed">
            <div className="font-bold mb-1">Sube un archivo CSV o JSON con tus productos.</div>
            <div className="text-[10px] text-stone-600">
              · Formato CSV con cabeceras: <code className="bg-stone-200 px-1">id, desc, familia, unidad, img, aqua_ref, aqua_bruto, aqua_dto, aqua_marca, aram_ref, aram_bruto, aram_dto, aram_marca</code>
              <br />· Si un producto tiene <strong>id</strong> que ya existe en tu catálogo → se actualizará
              <br />· Si no hay <strong>id</strong> pero la descripción coincide → se actualizará
              <br />· Productos nuevos se añaden automáticamente
              <br />· Si quieres una plantilla, descarga la plantilla CSV desde el botón anterior
            </div>
          </div>

          {/* Selector archivo */}
          <div>
            <label className="block w-full border-2 border-dashed border-stone-900 p-6 text-center cursor-pointer hover:bg-amber-50 transition-all">
              <input type="file" accept=".csv,.json,text/csv,application/json"
                     onChange={handleArchivo}
                     disabled={aplicando}
                     className="hidden" />
              <div className="text-2xl mb-1">📁</div>
              <div className="text-xs font-bold tracking-widest">
                {archivo ? archivo.name : "SELECCIONAR ARCHIVO CSV/JSON"}
              </div>
            </label>
          </div>

          {error && (
            <div className="bg-red-100 border-2 border-red-700 text-red-900 p-3 text-xs">
              ⚠ {error}
            </div>
          )}

          {/* Análisis */}
          {analisis && (
            <div className="space-y-3">
              <div className="border-2 border-stone-900">
                <div className="bg-stone-900 text-amber-400 p-2 text-xs font-bold tracking-widest">
                  📊 ANÁLISIS DEL ARCHIVO
                </div>
                <div className="divide-y divide-stone-200">
                  {analisis.coinciden.length > 0 && (
                    <div className="p-2 flex items-center gap-2 text-xs">
                      <span className="text-emerald-700 text-base">✏</span>
                      <span><strong>{analisis.coinciden.length}</strong> producto(s) ya existen en tu catálogo — <strong>se ACTUALIZARÁN</strong></span>
                    </div>
                  )}
                  {analisis.nuevos.length > 0 && (
                    <div className="p-2 flex items-center gap-2 text-xs">
                      <span className="text-amber-700 text-base">🆕</span>
                      <span><strong>{analisis.nuevos.length}</strong> producto(s) nuevos — <strong>se AÑADIRÁN</strong></span>
                    </div>
                  )}
                  {analisis.faltan.length > 0 && (
                    <div className="p-2 text-xs">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-stone-700 text-base">⚠</span>
                        <span><strong>{analisis.faltan.length}</strong> producto(s) están en tu catálogo pero NO en el archivo:</span>
                      </div>
                      <div className="ml-7 space-y-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="faltan" checked={accionFaltan === "mantener"}
                                 onChange={() => setAccionFaltan("mantener")} />
                          <span><strong>Mantener</strong> sin cambios (recomendado)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="faltan" checked={accionFaltan === "borrar"}
                                 onChange={() => setAccionFaltan("borrar")} />
                          <span className="text-red-700"><strong>Borrar</strong> del catálogo (¡cuidado!)</span>
                        </label>
                      </div>
                    </div>
                  )}
                  {analisis.errores.length > 0 && (
                    <div className="p-2 bg-red-50 text-xs">
                      <div className="font-bold text-red-900 mb-1">⚠ {analisis.errores.length} fila(s) con errores (se ignorarán):</div>
                      <div className="ml-3 space-y-0.5 max-h-24 overflow-y-auto">
                        {analisis.errores.slice(0, 10).map((e, i) => (
                          <div key={i} className="text-red-800">• Línea {e.linea}: {e.error}</div>
                        ))}
                        {analisis.errores.length > 10 && (
                          <div className="italic">…y {analisis.errores.length - 10} más</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progreso */}
              {progreso && (
                <div className="bg-amber-100 border-2 border-amber-700 p-3 text-xs">
                  <div className="font-bold mb-1">Aplicando cambios… {progreso.hechos} / {progreso.total}</div>
                  <div className="w-full bg-amber-200 h-2">
                    <div className="bg-amber-700 h-full transition-all" style={{ width: (progreso.hechos / Math.max(1, progreso.total) * 100) + "%" }} />
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-2 pt-2 border-t-2 border-stone-200">
                <button onClick={onCerrar} disabled={aplicando}
                        className="flex-1 text-xs font-bold tracking-widest p-3 border-2 border-stone-900 bg-white hover:bg-stone-100 disabled:opacity-50">
                  CANCELAR
                </button>
                <button onClick={aplicarCambios} disabled={aplicando || (analisis.coinciden.length === 0 && analisis.nuevos.length === 0 && (accionFaltan !== "borrar" || analisis.faltan.length === 0))}
                        className={`flex-[2] text-xs font-black tracking-widest p-3 border-2 border-stone-900 transition-all ${
                          aplicando ? "bg-stone-300 text-stone-600 cursor-wait"
                            : "bg-emerald-700 text-white hover:bg-emerald-800"
                        }`}
                        style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                  {aplicando ? "APLICANDO…" : "✓ APLICAR CAMBIOS"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Modal para crear/editar/validar producto
function ModalEditarProducto({ producto, api, reload, onCerrar, plantillaInicial, esValidacion }) {
  const inicial = producto || plantillaInicial || { desc: "", familia: "Varios", unidad: "uni", img: "tapon" };
  const [desc, setDesc] = useState(inicial.desc || "");
  const [familia, setFamilia] = useState(inicial.familia || "Varios");
  const [unidad, setUnidad] = useState(inicial.unidad || "uni");
  const [img, setImg] = useState(inicial.img || "tapon");
  const [cantPorUnidad, setCantPorUnidad] = useState(inicial.cantidadPorUnidad || "");
  const [guardando, setGuardando] = useState(false);

  // Estado dinámico por proveedor: { provId: { ref, bruto, dto, marca } }
  const [provData, setProvData] = useState(() => {
    const d = {};
    PROVEEDORES.forEach(prov => {
      const p = inicial.proveedores?.[prov.id];
      d[prov.id] = { ref: p?.ref || "", bruto: p?.bruto || "", dto: p?.dto || "", marca: p?.marca || "—" };
    });
    return d;
  });

  const setProvField = (provId, field, val) => setProvData(prev => ({ ...prev, [provId]: { ...prev[provId], [field]: val } }));

  const handleGuardar = async () => {
    if (!desc.trim()) return alert("La descripción es obligatoria");
    setGuardando(true);
    try {
      const proveedores = {};
      PROVEEDORES.forEach(prov => {
        const d = provData[prov.id];
        if (d?.ref && d?.bruto) {
          proveedores[prov.id] = { ref: d.ref, bruto: parseFloat(d.bruto), dto: parseFloat(d.dto) || 0, marca: d.marca || "—" };
        }
      });
      const body = { desc, familia, unidad, img, proveedores, cantidadPorUnidad: cantPorUnidad ? parseFloat(cantPorUnidad) : null };
      if (esValidacion) {
        await api.post("/admin/pendiente/" + esValidacion.id + "/validar", body);
      } else if (producto) {
        await api.put("/admin/producto/" + producto.id, body);
      } else {
        await api.post("/admin/producto", body);
      }
      reload();
      onCerrar();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/50" onClick={onCerrar} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        <div className="bg-amber-500 border-b-4 border-stone-900 p-3 flex items-center justify-between sticky top-0 z-10">
          <h3 className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            {esValidacion ? "✓ VALIDAR Y AÑADIR" : producto ? "✏ EDITAR PRODUCTO" : "+ NUEVO PRODUCTO"}
          </h3>
          <button onClick={onCerrar} className="bg-stone-900 text-amber-400 p-1.5 border-2 border-stone-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-1 block">DESCRIPCIÓN</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
                   className="w-full border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-1 block">FAMILIA</label>
              <select value={familia} onChange={(e) => setFamilia(e.target.value)}
                      className="w-full border-2 border-stone-900 p-2 text-xs focus:bg-amber-50 focus:outline-none font-mono">
                {FAMILIAS.filter(f => f.nombre !== "Todo").map(f => (
                  <option key={f.nombre} value={f.nombre}>{f.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-1 block">UNIDAD</label>
              <select value={unidad} onChange={(e) => setUnidad(e.target.value)}
                      className="w-full border-2 border-stone-900 p-2 text-xs focus:bg-amber-50 focus:outline-none font-mono">
                <option value="uni">unidad</option>
                <option value="rollo">rollo</option>
                <option value="barra">barra</option>
                <option value="m">metro</option>
                <option value="kg">kilo</option>
                <option value="L">litro</option>
                <option value="caja">caja</option>
                <option value="par">par</option>
                <option value="día">día</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-1 block">IMAGEN</label>
              <select value={img} onChange={(e) => setImg(e.target.value)}
                      className="w-full border-2 border-stone-900 p-2 text-xs focus:bg-amber-50 focus:outline-none font-mono">
                {["valvula","fitting","te","codo","machon","tapon","reduccion","filtro","tubo-pex","tubo-pe","tubo-pvc","te-pvc","codo-pvc","reduc-pvc","electro","cobre","mcap","bateria","latiguillo","aislamiento","abrazadera"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {(unidad === "rollo" || unidad === "barra" || unidad === "caja") && (
            <div>
              <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-1 block">
                METROS / UNIDADES POR {unidad.toUpperCase()} <span className="font-normal opacity-60">(opcional)</span>
              </label>
              <input type="number" step="0.1" min="0" value={cantPorUnidad}
                     onChange={(e) => setCantPorUnidad(e.target.value)}
                     placeholder={unidad === "rollo" ? "ej: 50 (= 1 rollo de 50m)" : "ej: 6 (= 1 barra de 6m)"}
                     className="w-full border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
            </div>
          )}

          {/* Sección dinámica por proveedor */}
          {PROVEEDORES.map(prov => {
            const d = provData[prov.id] || {};
            const col = getProvColor(prov.id);
            const neto = d.bruto ? +(parseFloat(d.bruto) * (1 - (parseFloat(d.dto) || 0) / 100)).toFixed(4) : null;
            return (
              <div key={prov.id} className={`border-2 ${COLOR_BORDER[col]||"border-blue-700"} ${COLOR_TAG_BG[col]||"bg-blue-50"} p-3`}>
                <div className={`font-black text-sm mb-2 ${COLOR_TEXT[col]||"text-blue-900"}`} style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                  <span className={`w-2 h-2 rounded-full inline-block mr-2 ${COLOR_DOT[col]||"bg-blue-600"}`} />
                  {prov.nombre.toUpperCase()} {!d.ref && <span className="text-[10px] font-normal opacity-60">(opcional)</span>}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-stone-700 mb-1 block">REF</label>
                    <input type="text" value={d.ref} onChange={(e) => setProvField(prov.id, "ref", e.target.value)}
                           className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:bg-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-700 mb-1 block">BRUTO €</label>
                    <input type="number" step="0.001" value={d.bruto} onChange={(e) => setProvField(prov.id, "bruto", e.target.value)}
                           className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:bg-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-700 mb-1 block">DTO %</label>
                    <input type="number" step="0.01" value={d.dto} onChange={(e) => setProvField(prov.id, "dto", e.target.value)}
                           className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:bg-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-700 mb-1 block">MARCA</label>
                    <input type="text" value={d.marca} onChange={(e) => setProvField(prov.id, "marca", e.target.value)}
                           className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:bg-white focus:outline-none" />
                  </div>
                </div>
                {neto !== null && (
                  <div className={`mt-2 text-xs font-bold ${COLOR_TEXT[col]||"text-blue-900"}`}>
                    Precio neto = €{neto}/{unidad}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex gap-2 pt-2 border-t-2 border-stone-200">
            <button onClick={onCerrar}
                    className="flex-1 text-xs font-bold tracking-widest p-3 border-2 border-stone-900 bg-white hover:bg-stone-100">
              CANCELAR
            </button>
            <button onClick={handleGuardar} disabled={guardando}
                    className={`flex-[2] text-xs font-black tracking-widest p-3 border-2 border-stone-900 transition-all ${
                      guardando ? "bg-stone-300 text-stone-600 cursor-wait" : "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900"
                    }`}
                    style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              {guardando ? "GUARDANDO…" : esValidacion ? "✓ VALIDAR Y AÑADIR" : "💾 GUARDAR"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
//  PESTAÑA OBRAS
// =========================================================
function PestañaObras({ data, api, reload }) {
  const [añadiendo, setAñadiendo] = useState(false);
  const [editando, setEditando] = useState(null);

  const obras = data.obras || [];

  const handleValidar = async (o) => {
    await api.put("/admin/obra/" + o.id, { pendienteValidar: false });
    reload();
  };
  const handleBorrar = async (o) => {
    if (!confirm(`¿Borrar la obra "${o.nombre}"? Los pedidos hechos a esta obra no se borran.`)) return;
    await api.del("/admin/obra/" + o.id);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-xs tracking-widest text-stone-700">{obras.length} OBRAS</div>
        <button onClick={() => setAñadiendo(true)}
                className="bg-stone-900 text-amber-400 px-4 py-2 text-xs font-black tracking-widest border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900"
                style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
          + NUEVA OBRA
        </button>
      </div>

      <div className="bg-white border-2 border-stone-900 divide-y divide-stone-200">
        {obras.map(o => (
          <div key={o.id} className="p-3 flex items-start justify-between gap-3 hover:bg-amber-50">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm flex items-center gap-2">
                {o.nombre}
                {o.pendienteValidar && (
                  <span className="text-[9px] bg-amber-500 text-stone-900 px-1.5 py-0.5 font-bold border border-stone-900">PENDIENTE VALIDAR</span>
                )}
                {o.activa === false && (
                  <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 font-bold">INACTIVA</span>
                )}
              </div>
              <div className="text-[10px] text-stone-500 mt-0.5">
                {o.dir || "Sin dirección"}
                {o.creadaPor && <> · creada por <strong>{o.creadaPor}</strong></>}
                {o.creadaEn && <> · {new Date(o.creadaEn).toLocaleDateString("es-ES")}</>}
              </div>
            </div>
            <div className="flex gap-1">
              {o.pendienteValidar && (
                <button onClick={() => handleValidar(o)}
                        className="text-[10px] font-bold bg-emerald-700 text-white px-2 py-1 border border-stone-900 hover:bg-emerald-800">
                  ✓ VALIDAR
                </button>
              )}
              <button onClick={() => setEditando(o)}
                      className="text-[10px] font-bold bg-amber-500 text-stone-900 px-2 py-1 border border-stone-900 hover:bg-amber-400">
                ✏
              </button>
              <button onClick={() => handleBorrar(o)}
                      className="text-[10px] font-bold bg-red-600 text-white px-2 py-1 border border-stone-900 hover:bg-red-700">
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      {añadiendo && <ModalEditarObra obra={null} api={api} reload={reload} onCerrar={() => setAñadiendo(false)} />}
      {editando && <ModalEditarObra obra={editando} api={api} reload={reload} onCerrar={() => setEditando(null)} />}
    </div>
  );
}

function ModalEditarObra({ obra, api, reload, onCerrar }) {
  const [nombre, setNombre] = useState(obra?.nombre || "");
  const [dir, setDir] = useState(obra?.dir || "");
  const [activa, setActiva] = useState(obra?.activa !== false);
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    if (!nombre.trim()) return alert("El nombre es obligatorio");
    setGuardando(true);
    try {
      if (obra) {
        await api.put("/admin/obra/" + obra.id, { nombre, dir, activa, pendienteValidar: false });
      } else {
        await api.post("/admin/obra", { nombre, dir });
      }
      reload();
      onCerrar();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/50" onClick={onCerrar} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-md shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        <div className="bg-amber-500 border-b-4 border-stone-900 p-3 flex items-center justify-between">
          <h3 className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            {obra ? "✏ EDITAR OBRA" : "+ NUEVA OBRA"}
          </h3>
          <button onClick={onCerrar} className="bg-stone-900 text-amber-400 p-1.5 border-2 border-stone-900">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-1 block">NOMBRE</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
                   className="w-full border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
          </div>
          <div>
            <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-1 block">DIRECCIÓN</label>
            <input type="text" value={dir} onChange={(e) => setDir(e.target.value)}
                   className="w-full border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
          </div>
          {obra && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
              <span>Obra activa (visible para operarios)</span>
            </label>
          )}
          <div className="flex gap-2 pt-2 border-t-2 border-stone-200">
            <button onClick={onCerrar}
                    className="flex-1 text-xs font-bold tracking-widest p-3 border-2 border-stone-900 bg-white hover:bg-stone-100">
              CANCELAR
            </button>
            <button onClick={handleGuardar} disabled={guardando}
                    className={`flex-[2] text-xs font-black tracking-widest p-3 border-2 border-stone-900 transition-all ${
                      guardando ? "bg-stone-300 cursor-wait" : "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900"
                    }`}
                    style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              {guardando ? "..." : "💾 GUARDAR"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
//  PESTAÑA OPERARIOS
// =========================================================
function PestañaOperarios({ data, api, reload }) {
  const [nombre, setNombre] = useState("");
  const [pinNuevo, setPinNuevo] = useState("");
  const [añadiendo, setAñadiendo] = useState(false);
  const [editandoPin, setEditandoPin] = useState(null); // id del operario editando pin
  const [pinEdit, setPinEdit] = useState("");

  const operarios = data.operarios || [];

  const handleAdd = async () => {
    if (!nombre.trim() || nombre === "Otro (escribir nombre)") return;
    if (pinNuevo && !/^\d{4,8}$/.test(pinNuevo)) { alert("El PIN debe ser de 4 a 8 dígitos"); return; }
    setAñadiendo(true);
    try {
      await api.post("/admin/operario", { nombre: nombre.trim(), activo: true, pin: pinNuevo || null });
      setNombre(""); setPinNuevo("");
      reload();
    } finally {
      setAñadiendo(false);
    }
  };
  const handleToggle = async (op) => {
    await api.put("/admin/operario/" + op.id, { activo: !op.activo });
    reload();
  };
  const handleDelete = async (op) => {
    if (!confirm(`¿Borrar a "${op.nombre}"?`)) return;
    await api.del("/admin/operario/" + op.id);
    reload();
  };
  const handleGuardarPin = async (op) => {
    if (pinEdit && !/^\d{4,8}$/.test(pinEdit)) { alert("El PIN debe ser de 4 a 8 dígitos"); return; }
    await api.put("/admin/operario/" + op.id, { pin: pinEdit || null });
    setEditandoPin(null); setPinEdit("");
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border-2 border-stone-900 p-3">
        <div className="text-[10px] tracking-widest font-bold text-stone-700 mb-2">AÑADIR OPERARIO</div>
        <div className="flex gap-2 mb-2">
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
                 placeholder="Nombre completo del operario"
                 onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                 className="flex-1 border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
        </div>
        <div className="flex gap-2">
          <input type="password" value={pinNuevo} onChange={(e) => setPinNuevo(e.target.value.replace(/\D/g,""))}
                 placeholder="PIN (4-8 dígitos, opcional)"
                 maxLength={8}
                 className="flex-1 border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
          <button onClick={handleAdd} disabled={añadiendo || nombre.trim().length < 2}
                  className={`px-4 py-2 text-xs font-black tracking-widest border-2 border-stone-900 ${
                    añadiendo || nombre.trim().length < 2
                      ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                      : "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900"
                  }`}
                  style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            + AÑADIR
          </button>
        </div>
      </div>

      <div className="bg-white border-2 border-stone-900 divide-y divide-stone-200">
        {operarios.map(op => (
          <div key={op.id} className="p-3 hover:bg-amber-50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="font-bold text-sm">{op.nombre}</div>
                <div className="text-[10px] text-stone-500 flex items-center gap-2">
                  {op.activo === false ? <span className="text-red-700 font-bold">INACTIVO</span> : <span>Activo</span>}
                  <span>·</span>
                  {op.pin ? <span className="text-emerald-700 font-bold">🔑 PIN asignado</span> : <span className="text-stone-400">Sin PIN</span>}
                </div>
              </div>
              <button onClick={() => { setEditandoPin(editandoPin === op.id ? null : op.id); setPinEdit(""); }}
                      className="text-[10px] font-bold bg-stone-200 text-stone-900 px-2 py-1 border border-stone-900 hover:bg-stone-300">
                🔑 PIN
              </button>
              <button onClick={() => handleToggle(op)}
                      className="text-[10px] font-bold bg-amber-500 text-stone-900 px-2 py-1 border border-stone-900 hover:bg-amber-400">
                {op.activo === false ? "✓ ACTIVAR" : "⏸"}
              </button>
              <button onClick={() => handleDelete(op)}
                      className="text-[10px] font-bold bg-red-600 text-white px-2 py-1 border border-stone-900 hover:bg-red-700">
                🗑
              </button>
            </div>
            {editandoPin === op.id && (
              <div className="mt-2 flex gap-2 items-center">
                <input type="password" value={pinEdit} onChange={(e) => setPinEdit(e.target.value.replace(/\D/g,""))}
                       placeholder="Nuevo PIN (4-8 dígitos) — vacío para quitar"
                       maxLength={8}
                       className="flex-1 border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
                <button onClick={() => handleGuardarPin(op)}
                        className="px-3 py-2 text-xs font-black tracking-widest border-2 border-stone-900 bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900"
                        style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                  ✓ GUARDAR
                </button>
                <button onClick={() => { setEditandoPin(null); setPinEdit(""); }}
                        className="px-3 py-2 text-xs font-bold border-2 border-stone-900 bg-white hover:bg-stone-100">
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================================================
//  PESTAÑA PEDIDOS
// =========================================================
function PestañaPedidos({ data }) {
  const [filtroObra, setFiltroObra] = useState("");
  const [filtroOp, setFiltroOp] = useState("");
  const [pedidoSel, setPedidoSel] = useState(null);

  const pedidos = (data.pedidos || []).slice().reverse(); // más reciente primero

  const filtrados = pedidos.filter(p => {
    if (filtroObra && p.obra?.id !== filtroObra) return false;
    if (filtroOp && p.operario !== filtroOp) return false;
    return true;
  });

  const totalFiltrados = filtrados.reduce((s, p) =>
    s + (p.lineasAqua || []).reduce((a, l) => a + (l.importe || 0), 0)
      + (p.lineasAram || []).reduce((a, l) => a + (l.importe || 0), 0), 0);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white border-2 border-stone-900 p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        <select value={filtroObra} onChange={(e) => setFiltroObra(e.target.value)}
                className="border-2 border-stone-900 p-2 text-xs focus:bg-amber-50 focus:outline-none font-mono">
          <option value="">— Todas las obras —</option>
          {(data.obras || []).map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <select value={filtroOp} onChange={(e) => setFiltroOp(e.target.value)}
                className="border-2 border-stone-900 p-2 text-xs focus:bg-amber-50 focus:outline-none font-mono">
          <option value="">— Todos los operarios —</option>
          {(data.operarios || []).map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="bg-stone-900 text-amber-400 p-3 border-2 border-stone-900 flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-widest opacity-70">PEDIDOS MOSTRADOS</div>
          <div className="font-black text-xl" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>{filtrados.length}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] tracking-widest opacity-70">TOTAL BASE</div>
          <div className="font-black text-xl" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>€{totalFiltrados.toFixed(2)}</div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white border-2 border-stone-900 divide-y divide-stone-200">
        {filtrados.length === 0 ? (
          <div className="p-8 text-center text-stone-500 text-sm">No hay pedidos que mostrar</div>
        ) : filtrados.slice(0, 200).map(p => {
          const totA = (p.lineasAqua || []).reduce((s, l) => s + (l.importe || 0), 0);
          const totR = (p.lineasAram || []).reduce((s, l) => s + (l.importe || 0), 0);
          return (
            <button key={p.id} onClick={() => setPedidoSel(p)}
                    className="w-full text-left p-3 hover:bg-amber-50 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{p.obra?.nombre || "—"}</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">
                    {new Date(p.fecha).toLocaleDateString("es-ES", { dateStyle: "long" })} · {p.operario}
                  </div>
                  <div className="text-[10px] mt-1 flex gap-2 flex-wrap">
                    {totA > 0 && <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 font-bold">Aqua €{totA.toFixed(2)}</span>}
                    {totR > 0 && <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 font-bold">Aram €{totR.toFixed(2)}</span>}
                    {(p.lineasNoListado || []).length > 0 && <span className="bg-stone-200 text-stone-700 px-1.5 py-0.5 font-bold">+{p.lineasNoListado.length} no list.</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>€{((totA + totR) * 1.21).toFixed(2)}</div>
                  <div className="text-[9px] text-stone-500">IVA inc.</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {pedidoSel && <ModalDetallePedido pedido={pedidoSel} onCerrar={() => setPedidoSel(null)} />}
    </div>
  );
}

function ModalDetallePedido({ pedido, onCerrar }) {
  const totA = (pedido.lineasAqua || []).reduce((s, l) => s + (l.importe || 0), 0);
  const totR = (pedido.lineasAram || []).reduce((s, l) => s + (l.importe || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/50" onClick={onCerrar} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        <div className="bg-amber-500 border-b-4 border-stone-900 p-3 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h3 className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              PEDIDO {pedido.id}
            </h3>
            <div className="text-[10px]">{new Date(pedido.fecha).toLocaleString("es-ES")}</div>
          </div>
          <button onClick={onCerrar} className="bg-stone-900 text-amber-400 p-1.5 border-2 border-stone-900">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><strong>Obra:</strong> {pedido.obra?.nombre}</div>
            <div><strong>Solicita:</strong> {pedido.operario}</div>
            <div className="col-span-2 text-[10px] text-stone-500">{pedido.obra?.dir}</div>
          </div>

          {pedido.lineasAqua?.length > 0 && (
            <div className="border-2 border-emerald-700">
              <div className="bg-emerald-700 text-white p-2 text-xs font-bold tracking-widest">AQUATUBO · €{totA.toFixed(2)}</div>
              <div className="divide-y">
                {pedido.lineasAqua.map((l, i) => (
                  <div key={i} className="p-2 text-xs flex justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-mono text-[10px] text-stone-500">{l.ref}</div>
                      <div>{l.desc}</div>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <div>{l.cantidad} × €{l.precioUnit?.toFixed(2)}</div>
                      <div className="font-bold">€{l.importe?.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pedido.lineasAram?.length > 0 && (
            <div className="border-2 border-amber-700">
              <div className="bg-amber-700 text-white p-2 text-xs font-bold tracking-widest">ARAMBURU · €{totR.toFixed(2)}</div>
              <div className="divide-y">
                {pedido.lineasAram.map((l, i) => (
                  <div key={i} className="p-2 text-xs flex justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-mono text-[10px] text-stone-500">{l.ref}</div>
                      <div>{l.desc}</div>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <div>{l.cantidad} × €{l.precioUnit?.toFixed(2)}</div>
                      <div className="font-bold">€{l.importe?.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pedido.lineasNoListado?.length > 0 && (
            <div className="border-2 border-stone-700 bg-stone-50">
              <div className="bg-stone-700 text-white p-2 text-xs font-bold tracking-widest">PRODUCTOS NO LISTADOS</div>
              <div className="divide-y">
                {pedido.lineasNoListado.map((l, i) => (
                  <div key={i} className="p-2 text-xs">
                    <div>{l.cantidad} {l.unidad} · {l.desc}</div>
                    {l.proveedor !== "indistinto" && <div className="text-[10px] text-stone-500">prov: {l.proveedor === "aqua" ? "Aquatubo" : "Aramburu"}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pedido.notas && (
            <div className="border-2 border-stone-300 bg-amber-50 p-2 text-xs">
              <div className="font-bold mb-1">📝 Notas:</div>
              <div className="whitespace-pre-wrap">{pedido.notas}</div>
            </div>
          )}

          <div className="bg-stone-900 text-amber-400 p-3 flex justify-between items-baseline">
            <div className="text-xs tracking-widest">TOTAL c/IVA</div>
            <div className="font-black text-2xl" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              €{((totA + totR) * 1.21).toFixed(2)}
            </div>
          </div>

          {pedido.proveedoresEnviados?.length > 0 && (
            <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-700 p-2">
              📧 Email enviado a: {pedido.proveedoresEnviados.join(", ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================
//  PESTAÑA PROVEEDORES
// =========================================================
function PestañaProveedores({ data, api, reload }) {
  const [nombre, setNombre] = useState("");
  const [formaPago, setFormaPago] = useState("Contado");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState("blue");
  const [añadiendo, setAñadiendo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [editForm, setEditForm] = useState({});

  const proveedores = data.proveedores || PROVEEDORES_SEED;
  const COLORES = ["emerald","amber","blue","violet","rose","teal"];

  const handleAdd = async () => {
    if (!nombre.trim()) return;
    setAñadiendo(true);
    try {
      await api.post("/admin/proveedor", { nombre: nombre.trim(), formaPago, email, color, activo: true });
      setNombre(""); setFormaPago("Contado"); setEmail(""); setColor("blue");
      reload();
    } finally { setAñadiendo(false); }
  };

  const handleEdit = (prov) => { setEditando(prov.id); setEditForm({ nombre: prov.nombre, formaPago: prov.formaPago || "", email: prov.email || "", color: prov.color || "blue" }); };
  const handleSave = async (prov) => {
    await api.put("/admin/proveedor/" + prov.id, editForm);
    setEditando(null);
    reload();
  };
  const handleToggle = async (prov) => { await api.put("/admin/proveedor/" + prov.id, { activo: !prov.activo }); reload(); };
  const handleDelete = async (prov) => {
    if (!confirm(`¿Borrar "${prov.nombre}"? Los productos con este proveedor perderán sus precios.`)) return;
    await api.del("/admin/proveedor/" + prov.id);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border-2 border-stone-900 p-3">
        <div className="text-[10px] tracking-widest font-bold text-stone-700 mb-3">AÑADIR PROVEEDOR</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[10px] font-bold text-stone-600 mb-1 block">NOMBRE</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del proveedor"
                   className="w-full border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-stone-600 mb-1 block">FORMA DE PAGO</label>
            <input type="text" value={formaPago} onChange={(e) => setFormaPago(e.target.value)} placeholder="ej: Contado"
                   className="w-full border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-stone-600 mb-1 block">EMAIL (para pedidos)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="proveedor@email.com"
                   className="w-full border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-stone-600 mb-1 block">COLOR</label>
            <div className="flex gap-1 flex-wrap">
              {COLORES.map(c => (
                <button key={c} onClick={() => setColor(c)}
                        className={`w-7 h-7 rounded-none border-2 ${color === c ? "border-stone-900 scale-110" : "border-stone-300"} bg-${c}-400`}
                        title={c} />
              ))}
            </div>
          </div>
        </div>
        <button onClick={handleAdd} disabled={añadiendo || nombre.trim().length < 2}
                className={`px-4 py-2 text-xs font-black tracking-widest border-2 border-stone-900 ${
                  añadiendo || nombre.trim().length < 2 ? "bg-stone-200 text-stone-400 cursor-not-allowed" : "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900"
                }`} style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
          + AÑADIR PROVEEDOR
        </button>
      </div>

      <div className="bg-white border-2 border-stone-900 divide-y divide-stone-200">
        {proveedores.map(prov => (
          <div key={prov.id} className="p-3 hover:bg-amber-50">
            {editando === prov.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 mb-1 block">NOMBRE</label>
                    <input type="text" value={editForm.nombre} onChange={(e) => setEditForm(f => ({...f, nombre: e.target.value}))}
                           className="w-full border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 mb-1 block">FORMA DE PAGO</label>
                    <input type="text" value={editForm.formaPago} onChange={(e) => setEditForm(f => ({...f, formaPago: e.target.value}))}
                           className="w-full border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 mb-1 block">EMAIL</label>
                    <input type="email" value={editForm.email} onChange={(e) => setEditForm(f => ({...f, email: e.target.value}))}
                           className="w-full border-2 border-stone-900 p-2 text-sm focus:bg-amber-50 focus:outline-none font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 mb-1 block">COLOR</label>
                    <div className="flex gap-1 flex-wrap">
                      {COLORES.map(c => (
                        <button key={c} onClick={() => setEditForm(f => ({...f, color: c}))}
                                className={`w-7 h-7 rounded-none border-2 ${editForm.color === c ? "border-stone-900" : "border-stone-300"} bg-${c}-400`} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleSave(prov)} className="px-3 py-1.5 text-xs font-black tracking-widest border-2 border-stone-900 bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900">✓ GUARDAR</button>
                  <button onClick={() => setEditando(null)} className="px-3 py-1.5 text-xs font-bold border-2 border-stone-900 bg-white hover:bg-stone-100">✕</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full bg-${prov.color||"blue"}-500`} />
                    <div className="font-bold text-sm">{prov.nombre}</div>
                    {(prov.id === "aqua" || prov.id === "aram") && <span className="text-[9px] bg-stone-200 px-1">ORIGINAL</span>}
                  </div>
                  <div className="text-[10px] text-stone-500 mt-0.5">
                    {prov.formaPago || "Sin forma de pago"} {prov.email && <> · {prov.email}</>}
                    {prov.activo === false && <span className="text-red-700 font-bold ml-2">INACTIVO</span>}
                  </div>
                </div>
                <button onClick={() => handleEdit(prov)} className="text-[10px] font-bold bg-amber-500 text-stone-900 px-2 py-1 border border-stone-900 hover:bg-amber-400">✏</button>
                <button onClick={() => handleToggle(prov)} className="text-[10px] font-bold bg-stone-200 text-stone-900 px-2 py-1 border border-stone-900 hover:bg-stone-300">
                  {prov.activo === false ? "✓ ACTIVAR" : "⏸"}
                </button>
                {prov.id !== "aqua" && prov.id !== "aram" && (
                  <button onClick={() => handleDelete(prov)} className="text-[10px] font-bold bg-red-600 text-white px-2 py-1 border border-stone-900 hover:bg-red-700">🗑</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================================================
//  PESTAÑA FACTURAS
// =========================================================
function PestañaFacturas({ api, pin }) {
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [facturaAbierta, setFacturaAbierta] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [mostrarAnalisis, setMostrarAnalisis] = useState(false);
  const [mostrarEquivalencias, setMostrarEquivalencias] = useState(false);
  const fileRef = useRef(null);
  const FAC_URL = "https://araujo-bot.onrender.com/api/facturas";

  const cargar = async () => {
    setCargando(true);
    try {
      const r = await fetch(FAC_URL + "/lista", { headers: { "x-admin-pin": pin } });
      const data = await r.json();
      setFacturas(Array.isArray(data) ? data : []);
    } catch { } finally { setCargando(false); }
  };

  useEffect(() => { cargar(); }, []);

  const handleSubir = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setSubiendo(true);
    let okCount = 0, errCount = 0, dupCount = 0;
    const duplicadas = [];
    let primera = null;
    try {
      for (const file of files) {
        try {
          const form = new FormData();
          form.append("factura", file);
          const r = await fetch(FAC_URL + "/subir", { method: "POST", headers: { "x-admin-pin": pin }, body: form });
          const data = await r.json();
          if (r.status === 409 && data.motivo === "archivo_duplicado") {
            dupCount++;
            duplicadas.push({ nombre: file.name, ya: data.facturaExistente });
            continue;
          }
          if (!data.ok) { errCount++; continue; }
          okCount++;
          if (!primera) primera = data.factura;
        } catch { errCount++; }
      }
      await cargar();
      // Mensajes de resultado
      if (dupCount > 0) {
        const lista = duplicadas.map(d => {
          const ref = d.ya.numero_factura ? `${d.ya.proveedor || "?"} ${d.ya.numero_factura}` : d.ya.archivoOriginal;
          return `  • "${d.nombre}" ya existe como ${ref}`;
        }).join("\n");
        alert(`⚠️ ${dupCount} factura${dupCount === 1 ? "" : "s"} duplicada${dupCount === 1 ? "" : "s"} (no subida${dupCount === 1 ? "" : "s"}):\n${lista}\n\n${okCount > 0 ? `✅ ${okCount} subida${okCount === 1 ? "" : "s"} correctamente.` : ""}`);
      }
      // Si solo hay 1 factura subida (y no era duplicada), abrirla directamente
      if (files.length === 1 && primera && dupCount === 0) {
        setFacturaAbierta(primera);
      } else if (okCount > 0 && dupCount === 0) {
        const msg = errCount > 0
          ? `✅ ${okCount} subidas, ${errCount} fallaron. Pulsa 'EXTRAER TODAS' para procesarlas con IA.`
          : `✅ ${okCount} facturas subidas. Pulsa 'EXTRAER TODAS' para procesarlas con IA.`;
        alert(msg);
      }
    } catch (e) { alert("Error subiendo: " + e.message); }
    finally { setSubiendo(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const [extrayendoTodas, setExtrayendoTodas] = useState(false);
  const handleExtraerTodas = async () => {
    const pendientes = facturas.filter(f => f.estado === "pendiente_extraccion");
    if (pendientes.length === 0) { alert("No hay facturas pendientes de extraer."); return; }
    if (!confirm(`Vas a extraer ${pendientes.length} facturas con IA. Cada una cuesta ~6 céntimos en API. ¿Continuar?`)) return;
    setExtrayendoTodas(true);
    let ok = 0, err = 0;
    for (const f of pendientes) {
      try {
        const r = await fetch(FAC_URL + "/extraer/" + f.id, { method: "POST", headers: { "x-admin-pin": pin } });
        if (r.ok) ok++; else err++;
        // Recargar la lista periódicamente para que el usuario vea progreso
        await cargar();
      } catch { err++; }
    }
    setExtrayendoTodas(false);
    alert(`Extracción completada: ${ok} ok, ${err} con error.`);
  };

  const handleEliminar = async (id) => {
    if (!confirm("¿Eliminar esta factura?")) return;
    await fetch(FAC_URL + "/factura/" + id, { method: "DELETE", headers: { "x-admin-pin": pin } });
    cargar();
  };

  const estadoColor = { pendiente_extraccion: "bg-stone-200 text-stone-700", extrayendo: "bg-blue-200 text-blue-800", pendiente_revision: "bg-amber-200 text-amber-800", completado: "bg-emerald-200 text-emerald-800", error: "bg-red-200 text-red-800" };
  const estadoLabel = { pendiente_extraccion: "Sin extraer", extrayendo: "Extrayendo...", pendiente_revision: "Pendiente revisión", completado: "Completado", error: "Error" };

  return (
    <div className="space-y-4">
      {/* Subir factura */}
      <div className="bg-white border-2 border-stone-900 p-4">
        <div className="text-[10px] tracking-widest font-bold text-stone-700 mb-3">IMPORTAR FACTURAS</div>
        <p className="text-xs text-stone-600 mb-3">Sube una o varias facturas en PDF, JPG o PNG. La IA extraerá automáticamente los productos y precios para revisión.</p>
        <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleSubir} className="hidden" />
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => fileRef.current?.click()} disabled={subiendo || extrayendoTodas}
                  className={`flex-1 p-4 font-black text-sm tracking-widest border-2 border-stone-900 transition-all ${subiendo ? "bg-stone-300 cursor-wait" : "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900"}`}
                  style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            {subiendo ? "⏳ SUBIENDO..." : "📄 SUBIR FACTURAS"}
          </button>
          {facturas.some(f => f.estado === "pendiente_extraccion") && (
            <button onClick={handleExtraerTodas} disabled={subiendo || extrayendoTodas}
                    className={`p-4 font-black text-sm tracking-widest border-2 border-stone-900 transition-all ${extrayendoTodas ? "bg-stone-300 cursor-wait" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                    style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              {extrayendoTodas ? "⏳ EXTRAYENDO..." : `🤖 EXTRAER TODAS (${facturas.filter(f => f.estado === "pendiente_extraccion").length})`}
            </button>
          )}
        </div>
      </div>

      {/* Buscador y filtros */}
      {facturas.length > 0 && (() => {
        // Lista de proveedores únicos (de las facturas ya extraídas)
        const provs = Array.from(new Set(
          facturas.map(f => f.datosExtraidos?.proveedor).filter(Boolean)
        )).sort((a, b) => a.localeCompare(b));
        return (
          <div className="bg-white border-2 border-stone-900 p-3 space-y-2">
            <div className="text-[10px] tracking-widest font-bold text-stone-700">BUSCADOR</div>
            <div className="flex gap-2 flex-wrap items-center">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, proveedor o nº factura…"
                className="flex-1 min-w-[200px] border-2 border-stone-900 p-2 text-xs font-mono focus:outline-none focus:bg-amber-50" />
              <select
                value={filtroProveedor}
                onChange={(e) => setFiltroProveedor(e.target.value)}
                className="border-2 border-stone-900 p-2 text-xs font-mono bg-white focus:outline-none">
                <option value="todos">Todos los proveedores</option>
                {provs.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="border-2 border-stone-900 p-2 text-xs font-mono bg-white focus:outline-none">
                <option value="todos">Todos los estados</option>
                <option value="pendiente_extraccion">Sin extraer</option>
                <option value="pendiente_revision">Pendiente revisión</option>
                <option value="completado">Completado</option>
                <option value="error">Error</option>
              </select>
              {(busqueda || filtroProveedor !== "todos" || filtroEstado !== "todos") && (
                <button
                  onClick={() => { setBusqueda(""); setFiltroProveedor("todos"); setFiltroEstado("todos"); }}
                  className="px-3 py-2 text-[10px] font-bold border-2 border-stone-900 bg-stone-100 hover:bg-stone-200">
                  ✕ LIMPIAR
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Lista de facturas */}
      <div className="bg-white border-2 border-stone-900">
        {(() => {
          // Aplicar filtros
          const q = busqueda.toLowerCase().trim();
          const facturasFiltradas = facturas.filter(f => {
            if (filtroEstado !== "todos" && f.estado !== filtroEstado) return false;
            if (filtroProveedor !== "todos" && f.datosExtraidos?.proveedor !== filtroProveedor) return false;
            if (q) {
              const enNombre = (f.archivoOriginal || "").toLowerCase().includes(q);
              const enProv = (f.datosExtraidos?.proveedor || "").toLowerCase().includes(q);
              const enNum = (f.datosExtraidos?.numero_factura || "").toLowerCase().includes(q);
              if (!enNombre && !enProv && !enNum) return false;
            }
            return true;
          });
          const filtrandoActivo = q || filtroProveedor !== "todos" || filtroEstado !== "todos";
          return (
            <>
        <div className="bg-stone-900 text-amber-400 p-2 text-[10px] font-bold tracking-widest flex items-center justify-between gap-2 flex-wrap">
          <span>
            {filtrandoActivo
              ? `MOSTRANDO ${facturasFiltradas.length} de ${facturas.length}`
              : `FACTURAS IMPORTADAS (${facturas.length})`}
          </span>
          <div className="flex items-center gap-3 flex-wrap">
          {(() => {
            // Impacto agregado de las facturas filtradas
            let totalSube = 0, totalBaja = 0, nFactImpacto = 0, totalFacturado = 0;
            facturasFiltradas.forEach(f => {
              let subF = 0, bajF = 0;
              (f.lineasRevision || []).forEach(l => {
                if (!l.variacionPrecio) return;
                const cant = parseFloat(l.lineaOriginal?.cantidad) || 0;
                const imp = (l.variacionPrecio.diff || 0) * cant;
                if (l.variacionPrecio.sube) subF += imp;
                if (l.variacionPrecio.baja) bajF += imp;
              });
              if (subF !== 0 || bajF !== 0) {
                nFactImpacto++;
                // Total robusto: usa el extraído por IA, o si no, suma las líneas
                const tExtraido = parseFloat(f.datosExtraidos?.total) || 0;
                const tSumado = (f.lineasRevision || []).reduce((acc, l) => acc + (parseFloat(l.lineaOriginal?.importe_linea) || 0), 0);
                totalFacturado += tExtraido > 0 ? tExtraido : tSumado;
              }
              totalSube += subF; totalBaja += bajF;
            });
            const totalNeto = totalSube + totalBaja;
            if (nFactImpacto === 0) return null;
            const pctGlobal = totalFacturado > 0 ? (totalNeto / totalFacturado) * 100 : null;
            return (
              <span className="font-mono normal-case tracking-normal flex items-center gap-2 flex-wrap">
                {totalFacturado > 0 && (
                  <span className="opacity-70">Facturado: €{totalFacturado.toFixed(2)} ·</span>
                )}
                <span className="opacity-70">Impacto:</span>
                <span className={totalNeto > 0.01 ? "text-red-400" : totalNeto < -0.01 ? "text-emerald-400" : "text-stone-300"}>
                  {totalNeto > 0.01 ? "📈 +" : totalNeto < -0.01 ? "📉 " : "⚖️ "}€{Math.abs(totalNeto).toFixed(2)}
                  {pctGlobal !== null && (
                    <span className="ml-1 text-[9px]">({totalNeto >= 0 ? "+" : ""}{pctGlobal.toFixed(1)}%)</span>
                  )}
                </span>
                <span className="text-[9px] opacity-60">
                  (▲€{totalSube.toFixed(2)} · ▼€{Math.abs(totalBaja).toFixed(2)})
                </span>
              </span>
            );
          })()}
          {facturasFiltradas.some(f => (f.lineasRevision || []).length > 0) && (
            <button
              onClick={() => setMostrarAnalisis(true)}
              title="Análisis transversal: ve qué productos te están subiendo en TODAS las facturas"
              className="bg-amber-400 text-stone-900 px-3 py-1 text-[10px] font-black tracking-widest border border-amber-300 hover:bg-amber-300">
              📊 ANÁLISIS POR PRODUCTO
            </button>
          )}
          <button
            onClick={() => setMostrarEquivalencias(true)}
            title="Equivalencias aprendidas: gestiona las relaciones entre referencias de proveedor y productos del catálogo. Útil cuando detectas matches incorrectos."
            className="bg-violet-500 text-white px-3 py-1 text-[10px] font-black tracking-widest border border-violet-700 hover:bg-violet-600">
            🔗 EQUIVALENCIAS
          </button>
          </div>
        </div>
        {cargando ? (
          <div className="p-8 text-center text-stone-500 text-sm">Cargando...</div>
        ) : facturas.length === 0 ? (
          <div className="p-8 text-center text-stone-500 text-sm">No hay facturas importadas aún</div>
        ) : facturasFiltradas.length === 0 ? (
          <div className="p-8 text-center text-stone-500 text-sm">No hay facturas que coincidan con los filtros aplicados</div>
        ) : (
          <div className="divide-y divide-stone-200">
            {facturasFiltradas.map(f => {
              // Calcular impacto económico de la factura (solo líneas con variación, ignorando "ignorado")
              let impactoSube = 0, impactoBaja = 0, nSube = 0, nBaja = 0;
              (f.lineasRevision || []).forEach(l => {
                if (!l.variacionPrecio) return;
                const cant = parseFloat(l.lineaOriginal?.cantidad) || 0;
                const impacto = (l.variacionPrecio.diff || 0) * cant;
                if (l.variacionPrecio.sube) { impactoSube += impacto; nSube++; }
                if (l.variacionPrecio.baja) { impactoBaja += impacto; nBaja++; }
              });
              const impactoNeto = impactoSube + impactoBaja;
              const tieneImpacto = nSube > 0 || nBaja > 0;
              // Total de la factura: primero intenta el extraído por IA, si no, suma las líneas
              const totalExtraido = parseFloat(f.datosExtraidos?.total) || 0;
              const totalSumado = (f.lineasRevision || []).reduce((acc, l) => acc + (parseFloat(l.lineaOriginal?.importe_linea) || 0), 0);
              const totalFactura = totalExtraido > 0 ? totalExtraido : totalSumado;
              const pctImpacto = totalFactura > 0 && tieneImpacto ? (impactoNeto / totalFactura) * 100 : null;
              return (
              <div key={f.id} className="p-3 hover:bg-amber-50 flex items-center gap-3">
                <div className="text-2xl">📄</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{f.archivoOriginal}</div>
                  <div className="text-[10px] text-stone-500">
                    {new Date(f.fechaSubida).toLocaleString("es-ES")}
                    {f.datosExtraidos?.proveedor && <span className="ml-2 font-bold">{f.datosExtraidos.proveedor}</span>}
                    {f.datosExtraidos?.numero_factura && <span className="ml-2">Fac. {f.datosExtraidos.numero_factura}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[9px] px-1.5 py-0.5 font-bold rounded-sm ${estadoColor[f.estado] || "bg-stone-200"}`}>
                      {estadoLabel[f.estado] || f.estado}
                    </span>
                    {totalFactura > 0 && (
                      <span className="text-[10px] font-mono font-bold bg-stone-900 text-amber-400 px-2 py-0.5 rounded-sm">
                        TOTAL €{totalFactura.toFixed(2)}
                      </span>
                    )}
                    {f.resumen && (
                      <span className="text-[9px] text-stone-500">
                        {f.resumen.actualizados} actualizados · {f.resumen.nuevos} nuevos · {f.resumen.ignorados} ignorados
                      </span>
                    )}
                    {f.lineasRevision?.length > 0 && (
                      <span className="text-[9px] text-stone-500">{f.lineasRevision.length} líneas</span>
                    )}
                  </div>
                </div>

                {/* Impacto económico de la factura */}
                {tieneImpacto && (
                  <div className={`shrink-0 text-right border-2 px-2 py-1 ${
                    impactoNeto > 0.01 ? "bg-red-50 border-red-600" :
                    impactoNeto < -0.01 ? "bg-emerald-50 border-emerald-600" :
                    "bg-stone-50 border-stone-400"
                  }`}>
                    <div className={`text-sm font-black font-mono leading-none ${
                      impactoNeto > 0.01 ? "text-red-700" :
                      impactoNeto < -0.01 ? "text-emerald-700" :
                      "text-stone-700"
                    }`}>
                      {impactoNeto > 0.01 ? "📈 +" : impactoNeto < -0.01 ? "📉 " : "⚖️ "}
                      €{Math.abs(impactoNeto).toFixed(2)}
                      {pctImpacto !== null && (
                        <span className="text-[10px] font-bold ml-1 opacity-80">
                          ({impactoNeto >= 0 ? "+" : ""}{pctImpacto.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] font-mono text-stone-600 mt-0.5">
                      {nSube > 0 && <span className="text-red-700">▲€{impactoSube.toFixed(2)}</span>}
                      {nSube > 0 && nBaja > 0 && <span className="mx-1">·</span>}
                      {nBaja > 0 && <span className="text-emerald-700">▼€{Math.abs(impactoBaja).toFixed(2)}</span>}
                    </div>
                  </div>
                )}

                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setFacturaAbierta(f)}
                          className="text-[10px] font-bold bg-amber-500 text-stone-900 px-2 py-1 border border-stone-900 hover:bg-amber-400">
                    {f.estado === "pendiente_extraccion" ? "EXTRAER" : "VER"}
                  </button>
                  <button onClick={() => handleEliminar(f.id)}
                          className="text-[10px] font-bold bg-red-600 text-white px-2 py-1 border border-stone-900 hover:bg-red-700">
                    🗑
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
            </>
          );
        })()}
      </div>

      {facturaAbierta && (
        <ModalRevisionFactura
          factura={facturaAbierta}
          pin={pin}
          onCerrar={() => { setFacturaAbierta(null); cargar(); }}
        />
      )}

      {mostrarAnalisis && (() => {
        // Recalcular facturas filtradas para el modal
        const q = busqueda.toLowerCase().trim();
        const facturasParaAnalisis = facturas.filter(f => {
          if (filtroEstado !== "todos" && f.estado !== filtroEstado) return false;
          if (filtroProveedor !== "todos" && f.datosExtraidos?.proveedor !== filtroProveedor) return false;
          if (q) {
            const enNombre = (f.archivoOriginal || "").toLowerCase().includes(q);
            const enProv = (f.datosExtraidos?.proveedor || "").toLowerCase().includes(q);
            const enNum = (f.datosExtraidos?.numero_factura || "").toLowerCase().includes(q);
            if (!enNombre && !enProv && !enNum) return false;
          }
          return true;
        });
        return (
          <ModalAnalisisProductos
            facturas={facturasParaAnalisis}
            filtrosActivos={{ busqueda, proveedor: filtroProveedor, estado: filtroEstado }}
            pin={pin}
            onCerrar={() => setMostrarAnalisis(false)}
            onAbrirFactura={(f) => { setMostrarAnalisis(false); setFacturaAbierta(f); }}
            onCambioCatalogo={() => { cargar(); /* recarga facturas tras crear/asociar producto */ }}
          />
        );
      })()}

      {mostrarEquivalencias && (
        <ModalEquivalencias
          pin={pin}
          onCerrar={() => setMostrarEquivalencias(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  MODAL DE EQUIVALENCIAS APRENDIDAS
// ─────────────────────────────────────────────────────────
function ModalEquivalencias({ pin, onCerrar }) {
  const [equivalencias, setEquivalencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("todos");
  const [editando, setEditando] = useState(null); // idx que está editando
  const [busquedaProd, setBusquedaProd] = useState("");
  const [migrando, setMigrando] = useState(false);
  const FAC_URL = "https://araujo-bot.onrender.com/api/facturas";

  const cargar = async () => {
    setCargando(true);
    try {
      const r = await fetch(FAC_URL + "/equivalencias", { headers: { "x-admin-pin": pin } });
      const data = await r.json();
      if (Array.isArray(data)) setEquivalencias(data);
    } catch (e) {
      alert("Error cargando equivalencias: " + e.message);
    } finally { setCargando(false); }
  };

  useEffect(() => { cargar(); }, []);

  const handleBorrar = async (eq) => {
    if (!confirm(`¿Borrar la equivalencia de ${eq.proveedor_nombre} ref ${eq.referencia_proveedor} → ${eq.producto_desc}?\n\nLa próxima vez que aparezca esta referencia en una factura, la IA volverá a buscar el producto desde cero.`)) return;
    try {
      const r = await fetch(FAC_URL + "/equivalencias/" + eq.idx, {
        method: "DELETE",
        headers: { "x-admin-pin": pin }
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error);
      cargar();
    } catch (e) { alert("Error: " + e.message); }
  };

  const handleEditar = async (eq, nuevoProductoId) => {
    try {
      const r = await fetch(FAC_URL + "/equivalencias/" + eq.idx, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({ producto_id: nuevoProductoId })
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error);
      setEditando(null);
      setBusquedaProd("");
      cargar();
    } catch (e) { alert("Error: " + e.message); }
  };

  // Lista de proveedores únicos
  const proveedoresUnicos = Array.from(new Set(equivalencias.map(e => e.proveedor_nombre))).sort();

  // Filtrar
  const q = busqueda.toLowerCase().trim();
  const filtradas = equivalencias.filter(eq => {
    if (filtroProveedor !== "todos" && eq.proveedor_nombre !== filtroProveedor) return false;
    if (q) {
      const enRef = eq.referencia_proveedor.toLowerCase().includes(q);
      const enDescProv = (eq.descripcion_proveedor || "").toLowerCase().includes(q);
      const enDescCat = (eq.producto_desc || "").toLowerCase().includes(q);
      if (!enRef && !enDescProv && !enDescCat) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/60" onClick={onCerrar} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-5xl max-h-[95vh] overflow-y-auto shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="bg-violet-700 text-white border-b-4 border-stone-900 p-3 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h3 className="font-black text-lg" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              🔗 EQUIVALENCIAS APRENDIDAS
            </h3>
            <div className="text-[10px] opacity-90 mt-0.5">
              {equivalencias.length} equivalencia{equivalencias.length === 1 ? "" : "s"} aprendida{equivalencias.length === 1 ? "" : "s"}
              {filtradas.length !== equivalencias.length && ` · mostrando ${filtradas.length}`}
            </div>
          </div>
          <button onClick={onCerrar} className="bg-white text-violet-700 font-black px-3 py-1 border-2 border-white hover:bg-violet-100">
            ✕
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* Aviso explicativo */}
          <div className="bg-violet-50 border-2 border-violet-300 p-3 text-[11px] text-violet-900">
            <b>¿Qué son las equivalencias?</b> Cada vez que aplicas una factura al catálogo, la app aprende qué referencia de proveedor corresponde a qué producto del catálogo. Esto acelera futuras facturas: cuando vuelva a aparecer la misma referencia, la IA la matcheará automáticamente con confianza alta.
            <br /><br />
            <b>¿Por qué editar?</b> Si en algún momento aplicaste una factura con un match incorrecto (ej. la IA confundió un codo de latón con uno de plástico), la equivalencia mala quedó guardada. Aquí puedes corregirla o borrarla para que las próximas facturas no la repitan.
          </div>

          {/* Mantenimiento del sistema */}
          <div className="bg-amber-50 border-2 border-amber-400 p-3 text-[11px] text-amber-900 flex items-start gap-3">
            <div className="flex-1">
              <b>🔧 Mantenimiento:</b> Si el modal de Análisis sigue mostrando productos como 🆕 Nuevo aunque ya estén creados en el catálogo, es que esas facturas se aplicaron antes de un fix que añadimos hace poco. Pulsa este botón para sincronizar el estado interno y que el Análisis las muestre correctamente. Es seguro — no toca el catálogo, solo actualiza metadata.
            </div>
            <button
              onClick={async () => {
                if (migrando) return;
                if (!confirm("¿Sincronizar el estado de las facturas ya aplicadas?\n\nNo se modificará el catálogo, solo la metadata interna de las facturas. Es una operación segura y se puede ejecutar varias veces sin riesgo.")) return;
                setMigrando(true);
                try {
                  const r = await fetch(FAC_URL + "/migrar/marcar-aplicadas", {
                    method: "POST",
                    headers: { "x-admin-pin": pin, "Content-Type": "application/json" }
                  });
                  const data = await r.json();
                  if (!r.ok) throw new Error(data.error || "Error en la migración");
                  alert("✅ " + data.mensaje);
                } catch (e) {
                  alert("Error: " + e.message);
                } finally {
                  setMigrando(false);
                }
              }}
              disabled={migrando}
              className="bg-amber-600 text-white px-3 py-2 text-[10px] font-black tracking-widest border-2 border-amber-800 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-wait whitespace-nowrap">
              {migrando ? "⏳ SINCRONIZANDO..." : "🔄 SINCRONIZAR"}
            </button>
          </div>

          {/* Filtros */}
          <div className="flex gap-2 flex-wrap items-center bg-stone-50 border-2 border-stone-900 p-2">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por ref, descripción del proveedor o producto del catálogo…"
              className="flex-1 min-w-[200px] border border-stone-900 p-1.5 text-xs font-mono focus:outline-none focus:bg-white" />
            <select
              value={filtroProveedor}
              onChange={(e) => setFiltroProveedor(e.target.value)}
              className="border border-stone-900 p-1.5 text-xs font-mono bg-white focus:outline-none">
              <option value="todos">Todos los proveedores</option>
              {proveedoresUnicos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {(busqueda || filtroProveedor !== "todos") && (
              <button
                onClick={() => { setBusqueda(""); setFiltroProveedor("todos"); }}
                className="px-2 py-1 text-[10px] font-bold border-2 border-stone-900 bg-stone-100 hover:bg-stone-200">
                ✕ LIMPIAR
              </button>
            )}
          </div>

          {/* Tabla */}
          {cargando ? (
            <div className="p-8 text-center text-stone-500 text-sm">Cargando…</div>
          ) : filtradas.length === 0 ? (
            <div className="p-8 text-center text-stone-500 text-sm border-2 border-stone-200">
              {equivalencias.length === 0 ? "Aún no hay equivalencias aprendidas. Aplica alguna factura al catálogo para empezar." : "No hay equivalencias que coincidan con los filtros."}
            </div>
          ) : (
            <div className="border-2 border-stone-900 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-stone-900 text-amber-400 text-[10px] font-bold tracking-widest">
                  <tr>
                    <th className="text-left p-2">PROVEEDOR</th>
                    <th className="text-left p-2">REF PROV</th>
                    <th className="text-left p-2">DESCRIPCIÓN PROV</th>
                    <th className="text-left p-2">→ PRODUCTO CATÁLOGO</th>
                    <th className="text-left p-2">FAMILIA</th>
                    <th className="text-right p-2">FECHA</th>
                    <th className="p-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map(eq => (
                    <React.Fragment key={eq.idx}>
                      <tr className={`border-t border-stone-200 hover:bg-violet-50 ${eq.editadaManualmente ? "bg-violet-50/50" : ""}`}>
                        <td className="p-2 font-bold">{eq.proveedor_nombre}</td>
                        <td className="p-2 font-mono text-[10px]">{eq.referencia_proveedor}</td>
                        <td className="p-2 text-stone-600 max-w-[200px] truncate">{eq.descripcion_proveedor}</td>
                        <td className="p-2">
                          <span className="text-stone-400 mr-1">→</span>
                          <span className={`font-bold ${eq.producto_desc.includes("no encontrado") ? "text-red-700" : ""}`}>{eq.producto_desc}</span>
                          {eq.editadaManualmente && (
                            <span className="ml-2 text-[8px] bg-violet-200 text-violet-800 px-1 rounded">editada</span>
                          )}
                        </td>
                        <td className="p-2 text-[10px] text-stone-500">{eq.producto_familia}</td>
                        <td className="p-2 text-right text-[10px] text-stone-500">{eq.fecha ? new Date(eq.fecha).toLocaleDateString("es-ES") : "—"}</td>
                        <td className="p-2">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => { setEditando(editando === eq.idx ? null : eq.idx); setBusquedaProd(""); }}
                              title="Cambiar a qué producto del catálogo apunta esta equivalencia"
                              className={`px-2 py-1 text-[10px] font-bold border ${editando === eq.idx ? "bg-violet-700 text-white border-violet-900" : "bg-white text-violet-700 border-violet-300 hover:bg-violet-100"}`}>
                              ✎
                            </button>
                            <button onClick={() => handleBorrar(eq)}
                              title="Borrar la equivalencia. La próxima factura con esta ref empezará desde cero."
                              className="px-2 py-1 text-[10px] font-bold border bg-white text-red-700 border-red-300 hover:bg-red-50">
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editando === eq.idx && (
                        <tr className="bg-violet-50 border-t border-stone-200">
                          <td colSpan={7} className="p-2">
                            <div className="text-[10px] font-bold tracking-widest text-violet-800 mb-1">
                              CAMBIAR A QUÉ PRODUCTO APUNTA
                            </div>
                            <input
                              type="text"
                              value={busquedaProd}
                              onChange={(e) => setBusquedaProd(e.target.value)}
                              placeholder="Empieza a escribir descripción o referencia…"
                              autoFocus
                              className="w-full border border-violet-700 p-2 text-xs font-mono focus:outline-none focus:bg-white" />
                            {busquedaProd.length >= 2 && (
                              <div className="mt-1 max-h-48 overflow-y-auto border border-violet-300 bg-white">
                                {(() => {
                                  const ql = busquedaProd.toLowerCase();
                                  const resultados = CATALOGO.filter(p =>
                                    p.desc.toLowerCase().includes(ql) || p.id.toLowerCase().includes(ql)
                                  ).slice(0, 20);
                                  if (resultados.length === 0) {
                                    return <div className="p-2 text-[11px] text-stone-500 italic">Ningún producto coincide</div>;
                                  }
                                  return resultados.map(p => (
                                    <button key={p.id}
                                      onClick={() => handleEditar(eq, p.id)}
                                      className="w-full text-left p-2 text-xs hover:bg-violet-100 border-b border-stone-200 flex items-center gap-2">
                                      <span className="font-bold flex-1">{p.desc}</span>
                                      <span className="text-[10px] text-stone-500">{p.familia}</span>
                                      <span className="text-[10px] font-mono text-violet-700">{p.id}</span>
                                    </button>
                                  ));
                                })()}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalAnalisisProductos({ facturas, filtrosActivos, pin, onCerrar, onAbrirFactura, onCambioCatalogo }) {
  const [orden, setOrden] = useState("impacto"); // impacto | frecuencia | pct
  const [filtroDireccion, setFiltroDireccion] = useState("todos"); // todos | sube | baja | sospechoso | nuevo | pendiente
  const [busquedaProd, setBusquedaProd] = useState("");
  const [productoExpandido, setProductoExpandido] = useState(null);
  const [excluirRectificativas, setExcluirRectificativas] = useState(true); // por defecto SÍ se excluyen
  const [productoCrear, setProductoCrear] = useState(null); // producto del agregado que se está creando
  const FAC_URL = "https://araujo-bot.onrender.com/api/facturas";

  // Detector de factura rectificativa:
  // 1. Nº de factura contiene "FR" o empieza por "R" (Aquatubo: 26AVFR00117, 25AVFR03182)
  // 2. O total negativo (es un abono)
  // 3. O archivo original empieza por "R"
  const esRectificativa = (f) => {
    const num = (f.datosExtraidos?.numero_factura || "").toUpperCase();
    const total = parseFloat(f.datosExtraidos?.total) || 0;
    const archivo = (f.archivoOriginal || "").toUpperCase();
    return /\bFR\d|^R\d|^[A-Z]{0,4}R\d/.test(num) || total < 0 || /^R[\s_-]/.test(archivo);
  };

  // Lista de facturas usable después del filtro de rectificativas
  const facturasUsables = useMemo(() =>
    excluirRectificativas ? facturas.filter(f => !esRectificativa(f)) : facturas,
    [facturas, excluirRectificativas]
  );
  const numRectificativas = facturas.length - facturasUsables.length;

  // Agregar líneas por productoSugerido (id del catálogo) o por descripción si no hay match
  // IMPORTANTE: incluimos TODAS las líneas, no solo las que tienen variacionPrecio,
  // para que productos nuevos y otras líneas también aparezcan en el análisis.
  const agregado = useMemo(() => {
    const mapa = new Map(); // key → { id, desc, ref, apariciones: [] }
    facturasUsables.forEach(f => {
      (f.lineasRevision || []).forEach((l, idx) => {
        // Clave de agregación: id del producto del catálogo si existe, si no la referencia del proveedor
        const key = l.productoSugerido || `ref:${l.lineaOriginal?.referencia_proveedor || ""}|desc:${(l.lineaOriginal?.descripcion_original || "").substring(0, 40)}`;
        if (!mapa.has(key)) {
          const prodCat = l.productoSugerido ? CATALOGO.find(p => p.id === l.productoSugerido) : null;
          mapa.set(key, {
            key,
            id: l.productoSugerido,
            descCat: prodCat?.desc || null,
            descFact: l.lineaOriginal?.descripcion_original || "",
            ref: l.lineaOriginal?.referencia_proveedor || "",
            unidad: l.lineaOriginal?.unidad || "uni",
            apariciones: []
          });
        }
        const cant = parseFloat(l.lineaOriginal?.cantidad) || 0;
        const tieneVar = !!l.variacionPrecio;
        const impacto = tieneVar ? (l.variacionPrecio.diff || 0) * cant : 0;
        mapa.get(key).apariciones.push({
          facturaId: f.id,
          lineaIdx: idx, // imprescindible para que el bulk pueda apuntar a la línea exacta
          proveedorId: l.proveedorId, // necesario para crear/asociar producto
          facturaNombre: f.archivoOriginal,
          numFact: f.datosExtraidos?.numero_factura || "",
          fecha: f.datosExtraidos?.fecha || f.fechaSubida,
          proveedor: f.datosExtraidos?.proveedor || "",
          cantidad: cant,
          precioActual: l.precioActual,
          precioFactura: l.precioUnitarioNeto,
          diff: tieneVar ? l.variacionPrecio.diff : null,
          pct: tieneVar ? l.variacionPrecio.pct : null,
          sube: tieneVar ? l.variacionPrecio.sube : false,
          baja: tieneVar ? l.variacionPrecio.baja : false,
          impacto,
          // Si la línea ya fue aplicada al catálogo, la consideramos "confirmado"
          // independientemente del estado original (nuevo, confirmado, etc.)
          estado: l.aplicada ? "confirmado" : l.estado,
          aplicada: !!l.aplicada,
          tieneVariacion: tieneVar
        });
      });
    });
    // Calcular agregados por producto
    const lista = Array.from(mapa.values()).map(p => {
      const aps = p.apariciones;
      const apsConVar = aps.filter(a => a.tieneVariacion);
      const impactoTotal = aps.reduce((acc, a) => acc + a.impacto, 0);
      const subidas = aps.filter(a => a.sube).length;
      const bajadas = aps.filter(a => a.baja).length;
      const cantTotal = aps.reduce((acc, a) => acc + a.cantidad, 0);
      const diffPromedio = apsConVar.length > 0
        ? apsConVar.reduce((acc, a) => acc + (a.diff || 0), 0) / apsConVar.length
        : 0;

      // % ponderado REAL: sobrecoste / lo que hubiera gastado al precio antiguo
      // (mucho más fiable que la media aritmética de % cuando hay outliers)
      const apsConPrecioActual = aps.filter(a => a.precioActual !== null && a.precioActual > 0);
      const gastoAntiguo = apsConPrecioActual.reduce((acc, a) => acc + (a.precioActual * a.cantidad), 0);
      const gastoNuevo   = apsConPrecioActual.reduce((acc, a) => acc + (a.precioFactura * a.cantidad), 0);
      const pctPonderado = gastoAntiguo > 0 ? ((gastoNuevo - gastoAntiguo) / gastoAntiguo) * 100 : 0;

      // Precio "antes" y "después" medios ponderados por cantidad
      const precioAntesMedio = gastoAntiguo > 0 && cantTotal > 0
        ? gastoAntiguo / apsConPrecioActual.reduce((acc, a) => acc + a.cantidad, 0)
        : null;
      const precioNuevoMedio = cantTotal > 0
        ? aps.reduce((acc, a) => acc + (a.precioFactura * a.cantidad), 0) / cantTotal
        : null;

      // Conservamos pctPromedio aritmético para compat (se usa en algún sitio), pero el bueno es pctPonderado
      const pctPromedio = apsConVar.length > 0
        ? apsConVar.reduce((acc, a) => acc + (a.pct || 0), 0) / apsConVar.length
        : 0;
      const precioMin = aps.length > 0 ? Math.min(...aps.map(a => a.precioFactura)) : 0;
      const precioMax = aps.length > 0 ? Math.max(...aps.map(a => a.precioFactura)) : 0;

      // Contadores por estado de las apariciones
      const estadoCount = { confirmado: 0, nuevo: 0, revisar: 0, pendiente: 0, ignorado: 0 };
      aps.forEach(a => {
        if (estadoCount[a.estado] !== undefined) estadoCount[a.estado]++;
      });
      // Estado dominante: el más frecuente. Si hay nuevos o pendientes mezclados con
      // confirmados, priorizamos los que requieren atención.
      let estadoDominante;
      if (estadoCount.revisar > 0)         estadoDominante = "revisar";
      else if (estadoCount.pendiente > 0)  estadoDominante = "pendiente";
      else if (estadoCount.nuevo > 0)      estadoDominante = "nuevo";
      else if (estadoCount.confirmado > 0) estadoDominante = "confirmado";
      else                                  estadoDominante = "ignorado";

      return {
        ...p, impactoTotal, subidas, bajadas, cantTotal,
        diffPromedio, pctPromedio, pctPonderado,
        precioAntesMedio, precioNuevoMedio, precioMin, precioMax,
        estadoCount, estadoDominante,
        tieneVariacionAlguna: apsConVar.length > 0
      };
    });
    return lista;
  }, [facturasUsables]);

  // Filtrar y ordenar
  const lista = useMemo(() => {
    const q = busquedaProd.toLowerCase().trim();
    return agregado
      .filter(p => {
        if (filtroDireccion === "sube" && p.impactoTotal <= 0.01) return false;
        if (filtroDireccion === "baja" && p.impactoTotal >= -0.01) return false;
        if (filtroDireccion === "sospechoso" && Math.abs(p.pctPonderado) <= 100) return false;
        if (filtroDireccion === "nuevo" && (p.estadoCount.nuevo || 0) === 0) return false;
        if (filtroDireccion === "pendiente" && (p.estadoCount.pendiente || 0) + (p.estadoCount.revisar || 0) === 0) return false;
        if (q) {
          const enDesc = (p.descCat || p.descFact).toLowerCase().includes(q);
          const enRef = p.ref.toLowerCase().includes(q);
          if (!enDesc && !enRef) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (orden === "impacto")    return Math.abs(b.impactoTotal) - Math.abs(a.impactoTotal);
        if (orden === "frecuencia") return b.apariciones.length - a.apariciones.length;
        if (orden === "pct")        return Math.abs(b.pctPonderado) - Math.abs(a.pctPonderado);
        return 0;
      });
  }, [agregado, orden, filtroDireccion, busquedaProd]);

  // Contadores para los chips
  const sospechosos = agregado.filter(p => Math.abs(p.pctPonderado) > 100).length;
  const nuevos = agregado.filter(p => (p.estadoCount.nuevo || 0) > 0).length;
  const pendientes = agregado.filter(p => (p.estadoCount.pendiente || 0) + (p.estadoCount.revisar || 0) > 0).length;

  // Totales agregados
  const totalImpacto    = lista.reduce((acc, p) => acc + p.impactoTotal, 0);
  const totalProductos  = lista.length;
  const totalApariciones = lista.reduce((acc, p) => acc + p.apariciones.length, 0);

  // Helper: agrupar apariciones de un producto por tramos de precio facturado.
  // Cada tramo = un precio facturado distinto (con tolerancia 0.01 €).
  // Devuelve [{ precio, apariciones, fechaIni, fechaFin, cantTotal, sobrecoste, diffUnitario }]
  const calcularTramosPrecio = (producto) => {
    const aps = producto.apariciones.slice().sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
    const tramos = [];
    for (const a of aps) {
      // Buscar tramo existente con precio similar (tolerancia 1 céntimo)
      const tramoExistente = tramos.find(t => Math.abs(t.precio - a.precioFactura) < 0.01);
      if (tramoExistente) {
        tramoExistente.apariciones.push(a);
      } else {
        tramos.push({
          precio: a.precioFactura,
          apariciones: [a]
        });
      }
    }
    // Calcular agregados por tramo
    return tramos.map(t => {
      const fechas = t.apariciones.map(a => a.fecha).filter(Boolean).sort();
      const cantTotal = t.apariciones.reduce((acc, a) => acc + a.cantidad, 0);
      const sobrecoste = t.apariciones.reduce((acc, a) => acc + a.impacto, 0);
      // Diff unitario respecto al precio anterior (precioActual del catálogo)
      const precioAntes = t.apariciones[0].precioActual;
      const diffUnitario = precioAntes !== null ? t.precio - precioAntes : null;
      const pctVar = precioAntes !== null && precioAntes > 0 ? ((t.precio - precioAntes) / precioAntes) * 100 : null;
      return {
        precio: t.precio,
        precioAntes,
        diffUnitario,
        pctVar,
        apariciones: t.apariciones,
        fechaIni: fechas[0] || null,
        fechaFin: fechas[fechas.length - 1] || null,
        cantTotal,
        sobrecoste,
        nFacturas: t.apariciones.length
      };
    }).sort((a, b) => (a.fechaIni || "").localeCompare(b.fechaIni || ""));
  };

  // Exportar a PDF
  const exportarPDF = async () => {
    let jsPDFmod;
    try { jsPDFmod = await import("jspdf"); } catch(e) { alert("No se pudo cargar PDF"); return; }
    const { jsPDF } = jsPDFmod;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const PW = 210, PH = 297, ML = 15, MR = 15;
    const W = PW - ML - MR;

    // Datos generales — usamos facturasUsables (las que NO son rectificativas si hay filtro)
    const proveedor = filtrosActivos.proveedor !== "todos"
      ? filtrosActivos.proveedor
      : (facturasUsables.find(f => f.datosExtraidos?.proveedor)?.datosExtraidos?.proveedor || "Proveedor");
    const fechas = facturasUsables.map(f => f.datosExtraidos?.fecha).filter(Boolean).sort();
    const fechaIni = fechas[0] ? new Date(fechas[0]).toLocaleDateString("es-ES") : "—";
    const fechaFin = fechas[fechas.length - 1] ? new Date(fechas[fechas.length - 1]).toLocaleDateString("es-ES") : "—";
    const totalFacturado = facturasUsables.reduce((acc, f) => {
      const t = parseFloat(f.datosExtraidos?.total) || 0;
      if (t > 0) return acc + t;
      return acc + (f.lineasRevision || []).reduce((a, l) => a + (parseFloat(l.lineaOriginal?.importe_linea) || 0), 0);
    }, 0);
    const pctSobreFact = totalFacturado > 0 ? (totalImpacto / totalFacturado) * 100 : 0;

    // Solo subidas significativas para top
    const subidasReales = lista.filter(p => p.impactoTotal > 0.5).sort((a, b) => b.impactoTotal - a.impactoTotal);
    const top = subidasReales.slice(0, 5);
    const concentracionTop = top.reduce((acc, p) => acc + p.impactoTotal, 0);
    const pctConcentracion = totalImpacto > 0 ? (concentracionTop / totalImpacto) * 100 : 0;

    let y = 18;

    // ═══ CABECERA ═══
    doc.setFillColor(20); doc.rect(0, 0, PW, 12, "F");
    doc.setTextColor(255, 200, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text("ARA CORPORATE SOCIEDAD DE INVERSIONES, SL", ML, 7);
    doc.setFontSize(7); doc.setTextColor(255);
    doc.text("CIF B90488222 · Avd San Francisco Javier 9 PL6 MOD 9, 41018 Sevilla", ML, 10);
    doc.setTextColor(0);

    // Título
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("INFORME DE DESVIACIONES DE PRECIO", PW / 2, y, { align: "center" }); y += 5;
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Proveedor: ${proveedor}`, PW / 2, y, { align: "center" }); y += 5;
    doc.setFontSize(7.5); doc.setTextColor(80);
    doc.text(`Período analizado: ${fechaIni} — ${fechaFin}  ·  ${facturasUsables.length} facturas  ·  ${totalApariciones} líneas analizadas`, PW / 2, y, { align: "center" });
    if (excluirRectificativas && numRectificativas > 0) {
      y += 3;
      doc.setFontSize(6.5); doc.setTextColor(120); doc.setFont("helvetica", "italic");
      doc.text(`(${numRectificativas} factura${numRectificativas === 1 ? "" : "s"} rectificativa${numRectificativas === 1 ? "" : "s"} excluida${numRectificativas === 1 ? "" : "s"} del análisis)`, PW / 2, y, { align: "center" });
      doc.setFont("helvetica", "normal");
    }
    doc.setTextColor(0); y += 6;

    // ═══ BLOQUE 1: RESUMEN EJECUTIVO ═══
    const ALTO_RESUMEN = 44; // antes 38, agrandado para que quepa el mensaje destacado dentro
    doc.setFillColor(245, 240, 230); doc.rect(ML, y, W, ALTO_RESUMEN, "F");
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.rect(ML, y, W, ALTO_RESUMEN);
    y += 5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(80);
    doc.text("RESUMEN EJECUTIVO", ML + 3, y); y += 5;

    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(0);
    const c1 = ML + 3, c2 = ML + 70, c3 = ML + 110;
    doc.text(`Importe total facturado:`, c1, y);
    doc.setFont("helvetica", "bold"); doc.text(`EUR ${totalFacturado.toFixed(2)}`, c2, y);
    doc.setFont("helvetica", "normal"); y += 4;

    doc.text(`Sobrecoste detectado:`, c1, y);
    if (totalImpacto > 0.01) doc.setTextColor(180, 0, 0);
    else if (totalImpacto < -0.01) doc.setTextColor(0, 130, 0);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(`${totalImpacto >= 0 ? "+" : ""}EUR ${totalImpacto.toFixed(2)}`, c2, y);
    if (pctSobreFact !== 0) {
      doc.setFontSize(8.5);
      doc.text(`(${pctSobreFact >= 0 ? "+" : ""}${pctSobreFact.toFixed(1)}% sobre facturado)`, c2 + 35, y);
    }
    doc.setTextColor(0); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); y += 5;

    doc.text(`Productos con desviación:`, c1, y);
    doc.setFont("helvetica", "bold"); doc.text(`${subidasReales.length}`, c2, y);
    doc.setFont("helvetica", "normal"); y += 4;

    doc.text(`Concentración del impacto:`, c1, y);
    doc.setFont("helvetica", "bold");
    doc.text(`Top ${top.length} productos = ${pctConcentracion.toFixed(0)}% del sobrecoste total`, c2, y);
    doc.setFont("helvetica", "normal"); y += 6;

    // Mensaje destacado (DENTRO del cuadro del resumen, no fuera)
    doc.setFillColor(255, 230, 200); doc.setDrawColor(180, 100, 0); doc.setLineWidth(0.3);
    const msg = totalImpacto > 0
      ? `Las facturas analizadas reflejan un sobrecoste de EUR ${totalImpacto.toFixed(2)} respecto a los precios pactados.`
      : `Las facturas analizadas reflejan un ahorro de EUR ${Math.abs(totalImpacto).toFixed(2)}.`;
    doc.rect(ML + 3, y - 2, W - 6, 6, "FD");
    doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(60);
    doc.text(msg, ML + 5, y + 2);
    doc.setTextColor(0); doc.setFont("helvetica", "normal");
    y += 8; // dentro del cuadro principal todavía

    // Salir del cuadro del resumen
    y += 4;

    // ═══ BLOQUE 2: TOP DESVIACIONES ═══
    if (top.length > 0) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(150, 0, 0);
      doc.text(`PRINCIPALES DESVIACIONES (${pctConcentracion.toFixed(0)}% del sobrecoste)`, ML, y);
      doc.setTextColor(0); y += 5;

      doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.setTextColor(100);
      doc.text("Productos con mayor impacto económico, ordenados por sobrecoste:", ML, y);
      doc.setTextColor(0); doc.setFont("helvetica", "normal"); y += 5;

      // Tarjetas del top con TRAMOS DE PRECIO (no precio medio engañoso)
      for (const p of top) {
        const tramos = calcularTramosPrecio(p);
        // Solo nos interesan tramos con sobrecoste real (excluyendo los que están al precio pactado)
        const tramosSobrecoste = tramos.filter(t => Math.abs(t.sobrecoste) > 0.01);
        // Si no hay tramos con sobrecoste claro (caso raro: producto con sobrecoste pequeño y disperso),
        // mostramos al menos los tramos con precio distinto al original
        const tramosMostrar = tramosSobrecoste.length > 0 ? tramosSobrecoste : tramos;

        // Altura dinámica: 18 cabecera + (5 dato + 4 facturas) por tramo + 4 línea base
        const altoPorTramo = 9; // 5 datos + 4 línea de facturas
        const altoBox = 18 + (tramosMostrar.length * altoPorTramo) + 4;
        if (y + altoBox > PH - 50) { doc.addPage(); y = 18; }

        doc.setFillColor(255, 248, 240); doc.setDrawColor(180, 100, 0); doc.setLineWidth(0.4);
        doc.rect(ML, y, W, altoBox, "FD");

        // Cabecera del producto
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(0);
        const xMaxNombre = PW - MR - 60; // dejamos espacio para % e impacto
        let nombreCorto = p.descCat || p.descFact;
        while (doc.getTextWidth(nombreCorto) > (xMaxNombre - ML - 3) && nombreCorto.length > 30) {
          nombreCorto = nombreCorto.substring(0, nombreCorto.length - 4) + "…";
        }
        doc.text(nombreCorto, ML + 3, y + 5);
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100);
        doc.text(`Ref: ${p.ref || "—"}  ·  Apariciones: ${p.apariciones.length} factura${p.apariciones.length === 1 ? "" : "s"}  ·  Cant. total: ${p.cantTotal.toFixed(0)} ${p.unidad}`, ML + 3, y + 10);
        doc.setTextColor(0);

        // % e impacto totales a la derecha
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(180, 0, 0);
        doc.text(`${p.pctPonderado >= 0 ? "+" : ""}${p.pctPonderado.toFixed(1)}%`, PW - MR - 3, y + 5, { align: "right" });
        doc.setFontSize(11);
        doc.text(`${p.impactoTotal >= 0 ? "+" : ""}EUR ${p.impactoTotal.toFixed(2)}`, PW - MR - 3, y + 10, { align: "right" });
        doc.setTextColor(0); doc.setFont("helvetica", "normal");

        // Línea separadora
        doc.setDrawColor(180, 100, 0); doc.setLineWidth(0.2);
        doc.line(ML + 3, y + 13, PW - MR - 3, y + 13);

        // Cabecera de la tabla de tramos
        let yT = y + 17;
        doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(80);
        const cT = {
          precio: ML + 3,
          desde:  ML + 35,
          hasta:  ML + 60,
          nFac:   ML + 85,
          cant:   ML + 105,
          dif:    ML + 130,
          sobre:  PW - MR - 3
        };
        doc.text("Precio facturado", cT.precio, yT);
        doc.text("Desde",            cT.desde,  yT);
        doc.text("Hasta",             cT.hasta,  yT);
        doc.text("Facturas",          cT.nFac,   yT, { align: "right" });
        doc.text("Cant.",             cT.cant,   yT, { align: "right" });
        doc.text("Dif/u",             cT.dif,    yT, { align: "right" });
        doc.text("Sobrecoste",        cT.sobre,  yT, { align: "right" });
        yT += 4;
        doc.setTextColor(0); doc.setFont("helvetica", "normal"); doc.setFontSize(8);

        // Cada tramo (línea de datos + línea de facturas debajo)
        for (const t of tramosMostrar) {
          const esTramoNeutro = t.precioAntes !== null && Math.abs(t.precio - t.precioAntes) < 0.01;
          const fechaIniTxt = t.fechaIni ? new Date(t.fechaIni).toLocaleDateString("es-ES") : "—";
          const fechaFinTxt = t.fechaFin ? new Date(t.fechaFin).toLocaleDateString("es-ES") : "—";

          // Marca visual: pactado original (verde) vs subido (rojo)
          if (esTramoNeutro) {
            doc.setTextColor(0, 100, 0);
            doc.setFont("helvetica", "normal");
          } else {
            doc.setTextColor(180, 0, 0);
            doc.setFont("helvetica", "bold");
          }
          doc.setFontSize(8);
          doc.text(`EUR ${t.precio.toFixed(4)}`, cT.precio, yT);
          if (esTramoNeutro) doc.text("(pactado)", cT.precio + 22, yT);

          doc.setTextColor(0); doc.setFont("helvetica", "normal");
          doc.text(fechaIniTxt, cT.desde, yT);
          if (fechaFinTxt !== fechaIniTxt) doc.text(fechaFinTxt, cT.hasta, yT);
          doc.text(String(t.nFacturas), cT.nFac, yT, { align: "right" });
          doc.text(t.cantTotal.toFixed(0), cT.cant, yT, { align: "right" });

          // Diff/u
          if (t.diffUnitario !== null) {
            if (Math.abs(t.diffUnitario) > 0.0001) {
              doc.setTextColor(t.diffUnitario > 0 ? 180 : 0, t.diffUnitario > 0 ? 0 : 130, 0);
              doc.setFont("helvetica", "bold");
            }
            doc.text(`${t.diffUnitario >= 0 ? "+" : ""}${t.diffUnitario.toFixed(4)}`, cT.dif, yT, { align: "right" });
            doc.setTextColor(0); doc.setFont("helvetica", "normal");
          }

          // Sobrecoste
          if (Math.abs(t.sobrecoste) > 0.01) {
            doc.setTextColor(t.sobrecoste > 0 ? 180 : 0, t.sobrecoste > 0 ? 0 : 130, 0);
            doc.setFont("helvetica", "bold");
            doc.text(`${t.sobrecoste >= 0 ? "+" : ""}EUR ${t.sobrecoste.toFixed(2)}`, cT.sobre, yT, { align: "right" });
            doc.setFont("helvetica", "normal");
          } else {
            doc.setTextColor(120);
            doc.text("—", cT.sobre, yT, { align: "right" });
          }

          // Línea de facturas afectadas debajo del tramo (en gris pequeño)
          yT += 4;
          const numsFac = t.apariciones.map(a => a.numFact).filter(Boolean);
          if (numsFac.length > 0) {
            doc.setTextColor(80); doc.setFontSize(6.5); doc.setFont("helvetica", "italic");
            // Truncar el texto si excede el ancho disponible
            const prefijo = "Facturas: ";
            const maxAncho = (PW - MR - 3) - (ML + 8) - doc.getTextWidth(prefijo);
            let textoFac = numsFac.join(", ");
            if (doc.getTextWidth(textoFac) > maxAncho) {
              // Reducir progresivamente: probar con +X más
              for (let n = numsFac.length - 1; n >= 1; n--) {
                const cand = numsFac.slice(0, n).join(", ") + `, +${numsFac.length - n} más`;
                if (doc.getTextWidth(cand) <= maxAncho) {
                  textoFac = cand;
                  break;
                }
              }
            }
            doc.text(prefijo + textoFac, ML + 8, yT);
            doc.setTextColor(0); doc.setFont("helvetica", "normal");
          }

          yT += 5;
        }

        y += altoBox + 3;
      }

      y += 3;
    }

    // ═══ BLOQUE 3: PETICIÓN ═══
    if (y > PH - 45) { doc.addPage(); y = 18; }
    doc.setFillColor(40, 40, 40); doc.rect(ML, y, W, 30, "F");
    doc.setTextColor(255, 200, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("SOLICITAMOS A VUESTRO DEPARTAMENTO COMERCIAL:", ML + 4, y + 6);
    doc.setTextColor(255); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("[ ]  Aclaración sobre las desviaciones de precio detectadas en este informe.", ML + 4, y + 13);
    doc.text("[ ]  Regularización de los precios al nivel pactado en condiciones comerciales.", ML + 4, y + 18);
    doc.text(`[ ]  Abono o nota de crédito por el sobrecoste de EUR ${totalImpacto.toFixed(2)} correspondiente al período analizado.`, ML + 4, y + 23);
    doc.text("[ ]  Reunión comercial para revisar las condiciones aplicadas.", ML + 4, y + 28);
    doc.setTextColor(0);
    y += 34;

    doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(100);
    doc.text("Quedamos a la espera de su respuesta a la mayor brevedad posible.", ML, y);
    doc.setTextColor(0); y += 6;

    // ═══ SECCIÓN: DESGLOSE FACTURA POR FACTURA DEL TOP ═══
    if (top.length > 0) {
      doc.addPage();
      y = 18;

      // Cabecera
      doc.setFillColor(20); doc.rect(0, 0, PW, 12, "F");
      doc.setTextColor(255, 200, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text("DESGLOSE FACTURA POR FACTURA · PRINCIPALES DESVIACIONES", ML, 7);
      doc.setFontSize(7); doc.setTextColor(255);
      doc.text(`${proveedor} · ${fechaIni} - ${fechaFin}`, ML, 10);
      doc.setTextColor(0);

      doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(100);
      doc.text("Detalle de cada aparición de los productos del top, con factura, fecha, cantidad y sobrecoste de la línea.", ML, y);
      doc.setTextColor(0); y += 7;

      for (const p of top) {
        const tramos = calcularTramosPrecio(p);

        // Si no cabe el bloque mínimo del producto, salta de página
        // (cabecera 9 + tramos + tabla detalle 6 + apariciones × 3.5)
        const altoMinProducto = 9 + 4 + (tramos.length * 5) + 6 + (p.apariciones.length * 3.5);
        if (y + altoMinProducto > PH - 18) { doc.addPage(); y = 18; }

        // Cabecera del producto
        doc.setFillColor(245, 235, 220); doc.setDrawColor(180, 100, 0); doc.setLineWidth(0.3);
        doc.rect(ML, y, W, 8, "FD");
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(0);
        // Truncar nombre si pisa el sobrecoste de la derecha
        const xMaxNombreD = PW - MR - 60;
        let nombreProducto = p.descCat || p.descFact;
        while (doc.getTextWidth(nombreProducto) > (xMaxNombreD - ML - 2) && nombreProducto.length > 30) {
          nombreProducto = nombreProducto.substring(0, nombreProducto.length - 4) + "…";
        }
        doc.text(nombreProducto, ML + 2, y + 4);
        doc.setFontSize(7); doc.setTextColor(100); doc.setFont("helvetica", "normal");
        doc.text(`Ref ${p.ref || "—"}`, ML + 2, y + 7);
        // Subtotal a la derecha
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(180, 0, 0);
        doc.text(`Sobrecoste: ${p.impactoTotal >= 0 ? "+" : ""}EUR ${p.impactoTotal.toFixed(2)}`, PW - MR - 2, y + 5, { align: "right" });
        doc.setTextColor(0); doc.setFont("helvetica", "normal");
        y += 10;

        // ── Resumen de tramos (nuevo) ──
        if (tramos.length > 1) {
          doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(80);
          doc.text("HISTÓRICO DE PRECIOS:", ML + 2, y);
          doc.setFont("helvetica", "normal"); doc.setTextColor(0); y += 3;

          for (const t of tramos) {
            const fIni = t.fechaIni ? new Date(t.fechaIni).toLocaleDateString("es-ES") : "—";
            const fFin = t.fechaFin && t.fechaFin !== t.fechaIni ? ` — ${new Date(t.fechaFin).toLocaleDateString("es-ES")}` : "";
            const esTramoNeutro = t.precioAntes !== null && Math.abs(t.precio - t.precioAntes) < 0.01;
            doc.setFontSize(7.5);
            // Cuadradito de color como bullet (más fiable que un Unicode "●" en helvetica)
            if (esTramoNeutro) doc.setFillColor(0, 130, 0);
            else doc.setFillColor(180, 0, 0);
            doc.rect(ML + 3, y - 2, 1.8, 1.8, "F");

            doc.setTextColor(0); doc.setFont("helvetica", "normal");
            const etiq = esTramoNeutro ? "(precio pactado)" : (t.diffUnitario !== null ? `(${t.diffUnitario >= 0 ? "+" : ""}${t.diffUnitario.toFixed(4)}/u, ${t.pctVar >= 0 ? "+" : ""}${t.pctVar.toFixed(1)}%)` : "");
            doc.text(`EUR ${t.precio.toFixed(4)}  ${etiq}`, ML + 8, y);
            doc.text(`Período: ${fIni}${fFin}  ·  ${t.nFacturas} factura${t.nFacturas === 1 ? "" : "s"}  ·  ${t.cantTotal.toFixed(0)} ${p.unidad}`, ML + 80, y);
            // Sobrecoste del tramo a la derecha
            if (Math.abs(t.sobrecoste) > 0.01) {
              doc.setFont("helvetica", "bold"); doc.setTextColor(t.sobrecoste > 0 ? 180 : 0, t.sobrecoste > 0 ? 0 : 130, 0);
              doc.text(`${t.sobrecoste >= 0 ? "+" : ""}EUR ${t.sobrecoste.toFixed(2)}`, PW - MR - 2, y, { align: "right" });
              doc.setFont("helvetica", "normal"); doc.setTextColor(0);
            }
            y += 4;
          }
          y += 1;
        }

        // ── Tabla detalle factura por factura ──
        // Layout más espaciado para evitar solapamientos
        const sc = { fec: ML + 2, fac: ML + 22, cant: ML + 78, pant: ML + 102, pnue: ML + 130, dif: ML + 155, sobre: PW - MR - 2 };
        doc.setFillColor(60); doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
        doc.rect(ML, y - 2.5, W, 4, "F");
        doc.text("Fecha",         sc.fec,   y);
        doc.text("Nº Factura",    sc.fac,   y);
        doc.text("Cant.",         sc.cant,  y, { align: "right" });
        doc.text("P. anterior",   sc.pant,  y, { align: "right" });
        doc.text("P. facturado",  sc.pnue,  y, { align: "right" });
        doc.text("Dif/u",         sc.dif,   y, { align: "right" });
        doc.text("Sobrecoste",    sc.sobre, y, { align: "right" });
        y += 4.5; // antes 3 — espacio suficiente para que la primera fila no pise la cabecera
        doc.setTextColor(0); doc.setFont("helvetica", "normal"); doc.setFontSize(6.8);

        // Líneas ordenadas por fecha — TODAS, sin truncar
        const apsOrd = p.apariciones.slice().sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
        for (const a of apsOrd) {
          if (y > PH - 14) {
            doc.addPage(); y = 18;
            // Repetir cabecera del producto en la nueva página (versión compacta)
            doc.setFillColor(245, 235, 220); doc.setDrawColor(180, 100, 0); doc.setLineWidth(0.3);
            doc.rect(ML, y, W, 6, "FD");
            doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(0);
            doc.text(`${nombreProducto} (continuación)`, ML + 2, y + 4); y += 7;
            // Cabecera de tabla repetida
            doc.setFillColor(60); doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
            doc.rect(ML, y - 2.5, W, 4, "F");
            doc.text("Fecha",         sc.fec,   y);
            doc.text("Nº Factura",    sc.fac,   y);
            doc.text("Cant.",         sc.cant,  y, { align: "right" });
            doc.text("P. anterior",   sc.pant,  y, { align: "right" });
            doc.text("P. facturado",  sc.pnue,  y, { align: "right" });
            doc.text("Dif/u",         sc.dif,   y, { align: "right" });
            doc.text("Sobrecoste",    sc.sobre, y, { align: "right" });
            y += 4.5; // antes 3
            doc.setTextColor(0); doc.setFont("helvetica", "normal"); doc.setFontSize(6.8);
          }
          const fechaTxt = a.fecha ? new Date(a.fecha).toLocaleDateString("es-ES") : "—";
          let facTxt = a.numFact || (a.facturaNombre || "").substring(0, 22);
          // Recortar si excede el espacio disponible para nº factura
          const maxAnchoFac = sc.cant - sc.fac - 4;
          while (doc.getTextWidth(facTxt) > maxAnchoFac && facTxt.length > 8) {
            facTxt = facTxt.substring(0, facTxt.length - 2);
          }
          doc.text(fechaTxt, sc.fec, y);
          doc.text(facTxt, sc.fac, y);
          doc.text(`${a.cantidad}`, sc.cant, y, { align: "right" });
          doc.text(a.precioActual !== null ? `EUR ${a.precioActual.toFixed(4)}` : "—", sc.pant, y, { align: "right" });
          doc.text(`EUR ${a.precioFactura.toFixed(4)}`, sc.pnue, y, { align: "right" });
          if (a.diff > 0.0001) doc.setTextColor(180, 0, 0);
          else if (a.diff < -0.0001) doc.setTextColor(0, 130, 0);
          doc.text(`${a.diff >= 0 ? "+" : ""}${a.diff.toFixed(4)}`, sc.dif, y, { align: "right" });
          doc.setFont("helvetica", "bold");
          doc.text(`${a.impacto >= 0 ? "+" : ""}EUR ${a.impacto.toFixed(2)}`, sc.sobre, y, { align: "right" });
          doc.setFont("helvetica", "normal"); doc.setTextColor(0);
          y += 3.5;
        }
        y += 4;
      }
    }

    // ═══ ANEXO: TABLA COMPLETA ═══
    if (lista.length > 0) {
      doc.addPage();
      y = 18;

      // Cabecera anexo
      doc.setFillColor(20); doc.rect(0, 0, PW, 12, "F");
      doc.setTextColor(255, 200, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text("ANEXO TÉCNICO · DETALLE COMPLETO POR PRODUCTO", ML, 7);
      doc.setFontSize(7); doc.setTextColor(255);
      doc.text(`${proveedor} · ${fechaIni} - ${fechaFin}`, ML, 10);
      doc.setTextColor(0);

      doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(100);
      doc.text(`Listado completo de los ${lista.length} productos con desviación detectada.`, ML, y);
      doc.text(`% REAL = sobrecoste real ponderado por cantidad (no media aritmética).`, ML, y + 3);
      doc.setTextColor(0); y += 8;

      // Tabla anexo (vertical, A4 portrait)
      const cols = { ref: ML, desc: ML + 16, vec: ML + 95, pAnt: ML + 108, pNue: ML + 130, pct: ML + 152, imp: ML + 168 };
      doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setFillColor(40); doc.setTextColor(255);
      doc.rect(ML, y - 3, W, 5, "F");
      doc.text("Ref",       cols.ref,  y);
      doc.text("Producto",  cols.desc, y);
      doc.text("Veces",     cols.vec,  y, { align: "right" });
      doc.text("P. ant.",   cols.pAnt, y, { align: "right" });
      doc.text("P. nuevo",  cols.pNue, y, { align: "right" });
      doc.text("% real",    cols.pct,  y, { align: "right" });
      doc.text("Impacto EUR", cols.imp + 16, y, { align: "right" });
      y += 4;
      doc.setTextColor(0); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);

      for (const p of lista) {
        if (y > PH - 18) {
          doc.addPage(); y = 18;
          // Repetir cabecera tabla
          doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setFillColor(40); doc.setTextColor(255);
          doc.rect(ML, y - 3, W, 5, "F");
          doc.text("Ref",       cols.ref,  y);
          doc.text("Producto",  cols.desc, y);
          doc.text("Veces",     cols.vec,  y, { align: "right" });
          doc.text("P. ant.",   cols.pAnt, y, { align: "right" });
          doc.text("P. nuevo",  cols.pNue, y, { align: "right" });
          doc.text("% real",    cols.pct,  y, { align: "right" });
          doc.text("Impacto EUR", cols.imp + 16, y, { align: "right" });
          y += 4;
          doc.setTextColor(0); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
        }
        const desc = (p.descCat || p.descFact).substring(0, 50);
        doc.text(p.ref || "—", cols.ref, y);
        doc.text(desc, cols.desc, y);
        doc.text(String(p.apariciones.length), cols.vec, y, { align: "right" });
        doc.text(p.precioAntesMedio !== null ? p.precioAntesMedio.toFixed(4) : "—", cols.pAnt, y, { align: "right" });
        doc.text(p.precioNuevoMedio !== null ? p.precioNuevoMedio.toFixed(4) : "—", cols.pNue, y, { align: "right" });
        doc.text(`${p.pctPonderado >= 0 ? "+" : ""}${p.pctPonderado.toFixed(1)}%`, cols.pct, y, { align: "right" });
        const impStr = `${p.impactoTotal >= 0 ? "+" : ""}${p.impactoTotal.toFixed(2)}`;
        if (p.impactoTotal > 0.01) doc.setTextColor(180, 0, 0);
        else if (p.impactoTotal < -0.01) doc.setTextColor(0, 130, 0);
        doc.text(impStr, cols.imp + 16, y, { align: "right" });
        doc.setTextColor(0);
        y += 3.3;
      }

      // Total anexo
      y += 2;
      doc.setLineWidth(0.4); doc.line(ML, y, PW - MR, y); y += 4;
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text("IMPACTO NETO TOTAL:", cols.imp + 16 - 30, y, { align: "right" });
      if (totalImpacto > 0.01) doc.setTextColor(180, 0, 0);
      else if (totalImpacto < -0.01) doc.setTextColor(0, 130, 0);
      doc.text(`EUR ${totalImpacto >= 0 ? "+" : ""}${totalImpacto.toFixed(2)}`, cols.imp + 16, y, { align: "right" });
      doc.setTextColor(0);
    }

    // Pie en última página
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "italic"); doc.setFontSize(6.5); doc.setTextColor(120);
      doc.text(`Página ${i} de ${pageCount}  ·  Informe generado automáticamente desde el sistema ARA Corporate  ·  ${new Date().toLocaleDateString("es-ES", { dateStyle: "long" })}`, PW / 2, PH - 6, { align: "center" });
    }

    const provSlug = proveedor.replace(/[^a-z0-9]/gi, "_").substring(0, 30);
    doc.save(`Informe_Desviaciones_${provSlug}_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  // Copiar resumen para email
  const copiarResumen = () => {
    let txt = `ANÁLISIS DE VARIACIÓN DE PRECIOS POR PRODUCTO\n`;
    txt += `Fecha: ${new Date().toLocaleDateString("es-ES")}\n`;
    txt += `Productos analizados: ${totalProductos} (${totalApariciones} apariciones en ${facturasUsables.length} facturas)\n`;
    if (excluirRectificativas && numRectificativas > 0) {
      txt += `(${numRectificativas} rectificativa${numRectificativas === 1 ? "" : "s"} excluida${numRectificativas === 1 ? "" : "s"} del análisis)\n`;
    }
    txt += `Impacto neto: ${totalImpacto >= 0 ? "+" : ""}€${totalImpacto.toFixed(2)}\n\n`;
    txt += `DETALLE:\n`;
    lista.forEach(p => {
      const desc = (p.descCat || p.descFact).substring(0, 60);
      txt += `\n• ${desc} (ref ${p.ref || "—"})\n`;
      txt += `  Aparece en ${p.apariciones.length} factura${p.apariciones.length === 1 ? "" : "s"} · ${p.precioAntesMedio !== null ? `€${p.precioAntesMedio.toFixed(4)} → €${p.precioNuevoMedio.toFixed(4)}` : "—"} (${p.pctPonderado >= 0 ? "+" : ""}${p.pctPonderado.toFixed(1)}%) · sobrecoste €${p.impactoTotal >= 0 ? "+" : ""}${p.impactoTotal.toFixed(2)}\n`;
    });
    navigator.clipboard.writeText(txt).then(
      () => alert("✅ Resumen copiado al portapapeles. Pégalo en tu email."),
      () => alert("No se pudo copiar. Selecciona el texto manualmente.")
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/60" onClick={onCerrar} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="bg-stone-900 text-amber-400 border-b-4 border-stone-900 p-3 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h3 className="font-black text-lg" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              📊 ANÁLISIS POR PRODUCTO
            </h3>
            <div className="text-[10px] opacity-80 mt-0.5">
              {totalProductos} productos · {totalApariciones} apariciones · {facturasUsables.length} factura{facturasUsables.length === 1 ? "" : "s"} analizada{facturasUsables.length === 1 ? "" : "s"}
              {excluirRectificativas && numRectificativas > 0 && (
                <span className="ml-2 opacity-70">({numRectificativas} rectif. excluida{numRectificativas === 1 ? "" : "s"})</span>
              )}
              {(filtrosActivos.proveedor !== "todos" || filtrosActivos.estado !== "todos" || filtrosActivos.busqueda) && (
                <span className="ml-2 bg-amber-500 text-stone-900 px-1.5 py-0.5 rounded-sm font-bold">
                  filtrado
                </span>
              )}
            </div>
          </div>
          <button onClick={onCerrar} className="bg-amber-400 text-stone-900 font-black px-3 py-1 border-2 border-amber-300 hover:bg-amber-300">
            ✕
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* Resumen impacto */}
          <div className={`border-2 border-stone-900 p-3 flex items-center gap-3 ${
            totalImpacto > 0.01 ? "bg-red-50" : totalImpacto < -0.01 ? "bg-emerald-50" : "bg-stone-50"
          }`}>
            <div className="text-3xl">
              {totalImpacto > 0.01 ? "📈" : totalImpacto < -0.01 ? "📉" : "⚖️"}
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold tracking-widest text-stone-600">IMPACTO ECONÓMICO TOTAL</div>
              <div className={`text-2xl font-black font-mono ${totalImpacto > 0.01 ? "text-red-700" : totalImpacto < -0.01 ? "text-emerald-700" : "text-stone-700"}`}>
                {totalImpacto >= 0 ? "+" : ""}€{totalImpacto.toFixed(2)}
              </div>
              <div className="text-[11px] text-stone-600">
                en {totalApariciones} líneas de {facturasUsables.length} factura{facturasUsables.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={exportarPDF}
                title="Exportar este análisis en PDF para enviar al proveedor"
                className="px-3 py-2 text-xs font-black tracking-widest border-2 border-stone-900 bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900"
                style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                📄 PDF
              </button>
              <button onClick={copiarResumen}
                title="Copiar resumen del análisis en texto plano para pegar en un email"
                className="px-3 py-2 text-xs font-black tracking-widest border-2 border-stone-900 bg-white text-stone-900 hover:bg-stone-100"
                style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                📋 COPIAR
              </button>
            </div>
          </div>

          {/* Toggle de rectificativas (separado, contextual) */}
          {numRectificativas > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 p-2 text-[11px]">
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={excluirRectificativas}
                  onChange={(e) => setExcluirRectificativas(e.target.checked)}
                  className="cursor-pointer" />
                <span className="font-bold">Excluir facturas rectificativas del análisis</span>
                <span className="text-stone-600">({numRectificativas} detectada{numRectificativas === 1 ? "" : "s"})</span>
              </label>
              <span className="text-[10px] text-stone-500 italic">
                {excluirRectificativas ? "Recomendado para reclamar al proveedor" : "Incluyendo abonos en el cálculo"}
              </span>
            </div>
          )}

          {/* Filtros internos del análisis */}
          <div className="flex flex-wrap items-center gap-2 bg-stone-50 border-2 border-stone-900 p-2">
            <input
              type="text"
              value={busquedaProd}
              onChange={(e) => setBusquedaProd(e.target.value)}
              placeholder="Buscar producto…"
              className="flex-1 min-w-[150px] border border-stone-900 p-1.5 text-xs font-mono focus:outline-none focus:bg-white" />
            <span className="text-[9px] font-bold tracking-widest text-stone-600">DIRECCIÓN:</span>
            {[
              { key: "todos", label: "Todos" },
              { key: "sube", label: "▲ Suben" },
              { key: "baja", label: "▼ Bajan" },
            ].map(d => (
              <button key={d.key} onClick={() => setFiltroDireccion(d.key)}
                className={`px-2 py-1 text-[10px] font-bold border ${filtroDireccion === d.key ? "bg-stone-900 text-amber-400 border-stone-900" : "bg-white text-stone-700 border-stone-300 hover:border-stone-900"}`}>
                {d.label}
              </button>
            ))}
            {sospechosos > 0 && (
              <button
                onClick={() => setFiltroDireccion(filtroDireccion === "sospechoso" ? "todos" : "sospechoso")}
                title="Productos con variación > 100%. Probablemente matches incorrectos de la IA. Revisa antes de exportar el PDF."
                className={`px-2 py-1 text-[10px] font-bold border ${filtroDireccion === "sospechoso" ? "bg-red-700 text-white border-red-900" : "bg-red-50 text-red-700 border-red-400 hover:bg-red-100"}`}>
                🚨 Sospechosos ({sospechosos})
              </button>
            )}
            {nuevos > 0 && (
              <button
                onClick={() => setFiltroDireccion(filtroDireccion === "nuevo" ? "todos" : "nuevo")}
                title="Productos NUEVOS detectados que se crearán al aplicar las facturas. Revísalos antes de aplicar."
                className={`px-2 py-1 text-[10px] font-bold border ${filtroDireccion === "nuevo" ? "bg-blue-700 text-white border-blue-900" : "bg-blue-50 text-blue-700 border-blue-400 hover:bg-blue-100"}`}>
                🆕 Nuevos ({nuevos})
              </button>
            )}
            {pendientes > 0 && (
              <button
                onClick={() => setFiltroDireccion(filtroDireccion === "pendiente" ? "todos" : "pendiente")}
                title="Productos con líneas pendientes de decidir o marcadas como 'revisar'. Tienes que decidir qué hacer con ellas."
                className={`px-2 py-1 text-[10px] font-bold border ${filtroDireccion === "pendiente" ? "bg-amber-600 text-white border-amber-800" : "bg-amber-50 text-amber-800 border-amber-400 hover:bg-amber-100"}`}>
                ⏳ Pendientes ({pendientes})
              </button>
            )}
            <span className="text-[9px] font-bold tracking-widest text-stone-600 ml-2">ORDENAR:</span>
            {[
              { key: "impacto",    label: "Impacto €" },
              { key: "frecuencia", label: "Frecuencia" },
              { key: "pct",        label: "% variación" },
            ].map(o => (
              <button key={o.key} onClick={() => setOrden(o.key)}
                className={`px-2 py-1 text-[10px] font-bold border ${orden === o.key ? "bg-stone-900 text-amber-400 border-stone-900" : "bg-white text-stone-700 border-stone-300 hover:border-stone-900"}`}>
                {o.label}
              </button>
            ))}
          </div>

          {/* Aviso si filtro sospechosos activo */}
          {filtroDireccion === "sospechoso" && (
            <div className="bg-red-50 border-2 border-red-700 p-2 text-[11px] text-red-900">
              <b>🚨 Mostrando productos con variación &gt; 100%.</b> Estos suelen ser matches incorrectos de la IA (cuando se confunde un producto con otro distinto). Revisa cada línea: usa <b>🔍 CAMBIAR PRODUCTO</b> para reasignar al producto correcto, o <b>✕ NO APLICAR</b> si la línea está mal extraída. Limpiar estos antes de exportar el PDF al proveedor da credibilidad al informe.
            </div>
          )}
          {filtroDireccion === "nuevo" && (
            <div className="bg-blue-50 border-2 border-blue-700 p-2 text-[11px] text-blue-900">
              <b>🆕 Mostrando productos NUEVOS detectados.</b> Son los que aún no existen en tu catálogo. Despliega cada fila con <b>▶</b> para ver en qué facturas aparece. Si quieres revisar cada uno antes de crearlo, abre la factura con [IR] y decide ahí. Si ves muchas apariciones del mismo producto, basta con que entres a UNA factura — la equivalencia se aprende automáticamente.
            </div>
          )}
          {filtroDireccion === "pendiente" && (
            <div className="bg-amber-50 border-2 border-amber-700 p-2 text-[11px] text-amber-900">
              <b>⏳ Mostrando productos con líneas sin decidir.</b> Líneas marcadas como <i>pendiente</i> (la IA no se decidió) o <i>revisar</i> (subida de precio sospechosa). Tienes que ir a cada factura y decidir si actualizas precio, creas producto nuevo o ignoras. Si no decides, esas líneas se saltarán al aplicar la factura.
            </div>
          )}

          {/* Tabla de productos */}
          {lista.length === 0 ? (
            <div className="p-8 text-center text-stone-500 text-sm border-2 border-stone-200">
              No hay productos con variación que coincidan con los filtros.
            </div>
          ) : (
            <div className="border-2 border-stone-900 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-stone-900 text-amber-400 text-[10px] font-bold tracking-widest">
                  <tr>
                    <th className="text-left p-2 w-10"></th>
                    <th className="text-left p-2">REF</th>
                    <th className="text-left p-2">PRODUCTO</th>
                    <th className="text-center p-2 whitespace-nowrap">ESTADO</th>
                    <th className="text-right p-2 whitespace-nowrap">VECES</th>
                    <th className="text-right p-2 whitespace-nowrap">% REAL</th>
                    <th className="text-right p-2 whitespace-nowrap">DIF/U PROM</th>
                    <th className="text-right p-2 whitespace-nowrap">CANT TOT</th>
                    <th className="text-right p-2 whitespace-nowrap">IMPACTO €</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(p => {
                    const expandido = productoExpandido === p.key;
                    // Configuración visual del estado dominante
                    const estadoConfig = {
                      confirmado: { label: "✅ OK",        color: "bg-emerald-100 text-emerald-800" },
                      nuevo:      { label: "🆕 Nuevo",     color: "bg-blue-100 text-blue-800" },
                      revisar:    { label: "⚠️ Revisar",   color: "bg-orange-100 text-orange-800" },
                      pendiente:  { label: "⏳ Pendiente", color: "bg-amber-100 text-amber-800" },
                      ignorado:   { label: "✕ Ignorado",   color: "bg-stone-200 text-stone-700" },
                    };
                    const ec = estadoConfig[p.estadoDominante] || estadoConfig.confirmado;
                    // Si hay mezcla de estados (ej. mayoría confirmado + alguno pendiente), avisamos con un *
                    const tieneMezcla = Object.values(p.estadoCount).filter(n => n > 0).length > 1;
                    const tooltipMezcla = tieneMezcla
                      ? `Mezcla: ${Object.entries(p.estadoCount).filter(([k,v]) => v > 0).map(([k,v]) => `${v} ${k}`).join(" · ")}`
                      : "";
                    return (
                      <React.Fragment key={p.key}>
                        <tr
                          onClick={() => setProductoExpandido(expandido ? null : p.key)}
                          className={`border-t border-stone-200 cursor-pointer hover:bg-amber-50 ${expandido ? "bg-amber-100" : ""}`}>
                          <td className="p-2 text-center text-stone-500">{expandido ? "▼" : "▶"}</td>
                          <td className="p-2 font-mono text-[10px]">{p.ref || "—"}</td>
                          <td className="p-2 font-bold">{p.descCat || p.descFact}</td>
                          <td className="p-2 text-center">
                            {p.estadoDominante === "nuevo" && !p.aplicada ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); setProductoCrear(p); }}
                                title="Crear este producto en el catálogo o asociarlo a uno existente"
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap ${ec.color} hover:bg-blue-200 hover:ring-2 hover:ring-blue-500 cursor-pointer transition-all`}>
                                {ec.label}{tieneMezcla ? "*" : ""} ▸
                              </button>
                            ) : (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap ${ec.color}`} title={tooltipMezcla}>
                                {ec.label}{tieneMezcla ? "*" : ""}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right font-mono">{p.apariciones.length}</td>
                          {p.tieneVariacionAlguna ? (
                            <>
                              <td className={`p-2 text-right font-mono font-bold ${p.pctPonderado > 0 ? "text-red-700" : p.pctPonderado < 0 ? "text-emerald-700" : ""}`}>
                                {p.pctPonderado >= 0 ? "+" : ""}{p.pctPonderado.toFixed(1)}%
                              </td>
                              <td className={`p-2 text-right font-mono ${p.diffPromedio > 0 ? "text-red-700" : p.diffPromedio < 0 ? "text-emerald-700" : ""}`}>
                                {p.diffPromedio >= 0 ? "+" : ""}€{p.diffPromedio.toFixed(3)}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-2 text-right font-mono text-stone-400">—</td>
                              <td className="p-2 text-right font-mono text-stone-400">—</td>
                            </>
                          )}
                          <td className="p-2 text-right font-mono">{p.cantTotal.toFixed(0)} {p.unidad}</td>
                          <td className={`p-2 text-right font-mono font-black ${p.impactoTotal > 0.01 ? "text-red-700" : p.impactoTotal < -0.01 ? "text-emerald-700" : "text-stone-400"}`}>
                            {Math.abs(p.impactoTotal) < 0.01 ? "—" : `${p.impactoTotal >= 0 ? "+" : ""}€${p.impactoTotal.toFixed(2)}`}
                          </td>
                        </tr>
                        {expandido && (
                          <tr className="bg-stone-50 border-t border-stone-200">
                            <td colSpan={9} className="p-2">
                              <div className="text-[10px] font-bold tracking-widest text-stone-600 mb-1">
                                APARICIONES ({p.apariciones.length}) · precio min €{p.precioMin.toFixed(4)} · max €{p.precioMax.toFixed(4)}
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-[11px]">
                                  <thead className="text-[9px] text-stone-500 font-bold">
                                    <tr>
                                      <th className="text-left p-1">FECHA</th>
                                      <th className="text-left p-1">FACTURA</th>
                                      <th className="text-center p-1">ESTADO</th>
                                      <th className="text-right p-1">CANT</th>
                                      <th className="text-right p-1">PRECIO ANTES</th>
                                      <th className="text-right p-1">PRECIO FACT</th>
                                      <th className="text-right p-1">DIF/U</th>
                                      <th className="text-right p-1">%</th>
                                      <th className="text-right p-1">IMPACTO</th>
                                      <th className="p-1"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {p.apariciones.slice().sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")).map((a, i) => {
                                      const fact = facturas.find(f => f.id === a.facturaId);
                                      // Badge de estado por aparición
                                      const estadoLineaConfig = {
                                        confirmado: { label: "✅",   color: "bg-emerald-100 text-emerald-800", title: "Confirmado: se actualizará el precio del catálogo" },
                                        nuevo:      { label: "🆕",   color: "bg-blue-100 text-blue-800",       title: "Nuevo: se creará en el catálogo" },
                                        revisar:    { label: "⚠️",   color: "bg-orange-100 text-orange-800",   title: "Revisar: subida sospechosa, decide manualmente" },
                                        pendiente:  { label: "⏳",   color: "bg-amber-100 text-amber-800",     title: "Pendiente: la IA no está segura, decide manualmente" },
                                        ignorado:   { label: "✕",    color: "bg-stone-200 text-stone-700",     title: "Ignorado: no toca el catálogo" },
                                      };
                                      const elc = estadoLineaConfig[a.estado] || estadoLineaConfig.confirmado;
                                      return (
                                        <tr key={i} className="border-t border-stone-200">
                                          <td className="p-1 font-mono">{a.fecha ? new Date(a.fecha).toLocaleDateString("es-ES") : "—"}</td>
                                          <td className="p-1 font-mono text-[10px]">{a.numFact || a.facturaNombre.substring(0, 30)}</td>
                                          <td className="p-1 text-center">
                                            <span className={`text-[10px] font-bold px-1 py-0.5 rounded-sm ${elc.color}`} title={elc.title}>
                                              {elc.label}
                                            </span>
                                          </td>
                                          <td className="p-1 text-right font-mono">{a.cantidad}</td>
                                          <td className="p-1 text-right font-mono">{a.precioActual !== null ? `€${a.precioActual.toFixed(4)}` : "—"}</td>
                                          <td className="p-1 text-right font-mono font-bold">€{a.precioFactura.toFixed(4)}</td>
                                          {a.tieneVariacion ? (
                                            <>
                                              <td className={`p-1 text-right font-mono ${a.sube ? "text-red-700" : a.baja ? "text-emerald-700" : ""}`}>
                                                {a.diff >= 0 ? "+" : ""}€{a.diff.toFixed(4)}
                                              </td>
                                              <td className={`p-1 text-right font-mono font-bold ${a.sube ? "text-red-700" : a.baja ? "text-emerald-700" : ""}`}>
                                                {a.pct >= 0 ? "+" : ""}{a.pct.toFixed(1)}%
                                              </td>
                                            </>
                                          ) : (
                                            <>
                                              <td className="p-1 text-right text-stone-400">—</td>
                                              <td className="p-1 text-right text-stone-400">—</td>
                                            </>
                                          )}
                                          <td className={`p-1 text-right font-mono font-bold ${a.impacto > 0.01 ? "text-red-700" : a.impacto < -0.01 ? "text-emerald-700" : "text-stone-400"}`}>
                                            {Math.abs(a.impacto) < 0.01 ? "—" : `${a.impacto >= 0 ? "+" : ""}€${a.impacto.toFixed(2)}`}
                                          </td>
                                          <td className="p-1 text-right">
                                            {fact && (
                                              <button onClick={(e) => { e.stopPropagation(); onAbrirFactura(fact); }}
                                                className="text-[9px] font-bold bg-amber-500 text-stone-900 px-1.5 py-0.5 border border-stone-900 hover:bg-amber-400">
                                                IR
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {productoCrear && (
        <ModalCrearProductoDesdeAnalisis
          producto={productoCrear}
          pin={pin}
          onCerrar={() => setProductoCrear(null)}
          onCreado={() => {
            setProductoCrear(null);
            if (onCambioCatalogo) onCambioCatalogo();
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  MODAL: Crear producto en catálogo desde el modal Análisis
//  (o asociar a producto existente)
// ─────────────────────────────────────────────────────────────────────────
function ModalCrearProductoDesdeAnalisis({ producto, pin, onCerrar, onCreado }) {
  const [descripcion, setDescripcion] = useState(producto.descCat || producto.descFact || "");
  const [familia, setFamilia] = useState("");
  const [unidad, setUnidad] = useState(producto.unidad || "uni");
  const [guardando, setGuardando] = useState(false);
  const [modo, setModo] = useState("crear"); // "crear" | "asociar"
  const [busquedaProd, setBusquedaProd] = useState("");
  const [productoExistente, setProductoExistente] = useState(null);
  const [filtroFamilia, setFiltroFamilia] = useState(""); // familia seleccionada para filtrar candidatos
  const FAC_URL = "https://araujo-bot.onrender.com/api/facturas";

  // Familias únicas del catálogo + opción "(Nueva familia)"
  const familias = useMemo(() => {
    const set = new Set();
    CATALOGO.forEach(p => { if (p.familia) set.add(p.familia); });
    return Array.from(set).sort();
  }, []);

  // Inicializar familia: la más probable según la descripción
  // Estrategia: scoring por palabras clave que aparecen TANTO en la descripción facturada
  // como en el nombre de la familia. La familia que más palabras comparta gana.
  // Esto evita el problema de "REDUCCION PVC" matcheando con "Accesorios Latón"
  // solo porque "reduccion" pegó con "accesorio" antes que "pvc" con "pvc".
  useEffect(() => {
    if (!descripcion || familias.length === 0) return;
    const desc = descripcion.toLowerCase();

    // Sinónimos: si la descripción tiene la clave, considera estas palabras como presentes
    const sinonimos = {
      "laton": ["latón"],
      "latón": ["laton"],
      "tuberia": ["tubería", "tubo"],
      "tubería": ["tuberia", "tubo"],
      "valvula": ["válvula", "grifo", "esfera"],
      "válvula": ["valvula", "grifo", "esfera"],
      "evac": ["evacuación", "evacuacion"],
      "evacuacion": ["evac", "evacuación"],
      "evacuación": ["evac", "evacuacion"],
    };

    // Tokenizamos la descripción facturada (palabras significativas, mínimo 3 letras)
    const tokensDesc = new Set();
    desc.split(/[\s\-\/\.,;:]+/).filter(t => t.length >= 3).forEach(t => {
      tokensDesc.add(t);
      // añadir sinónimos
      if (sinonimos[t]) sinonimos[t].forEach(s => tokensDesc.add(s));
    });

    // Para cada familia del catálogo, contar cuántos tokens coinciden con la descripción.
    // PRIORIDAD: materiales (pvc, laton, cobre, multicapa, pe) valen el doble — son más distintivos.
    const materiales = ["pvc", "latón", "laton", "cobre", "multicapa", "galvanizado", "evacuación", "evacuacion"];
    const familiaScores = familias.map(f => {
      const fLower = f.toLowerCase();
      const tokensFam = fLower.split(/[\s\-\/\.,;:]+/).filter(t => t.length >= 3);
      let score = 0;
      for (const tk of tokensFam) {
        if (tokensDesc.has(tk)) {
          score += materiales.includes(tk) ? 2 : 1;
        }
      }
      return { familia: f, score };
    });

    // Ordenar por score descendente y tomar la mejor (si hay alguna con score > 0)
    familiaScores.sort((a, b) => b.score - a.score);
    let famMatch = null;
    if (familiaScores[0]?.score > 0) {
      famMatch = familiaScores[0].familia;
    } else {
      // Fallback: ningún token coincide → poner la familia "Varios" si existe, o la primera
      famMatch = familias.find(f => f.toLowerCase().includes("vario")) || familias[0];
    }

    setFamilia(famMatch);
    setFiltroFamilia(famMatch);
  }, [familias.length]);

  // Helper para mostrar nombre de proveedor (no solo el id)
  // Buscamos en las facturas qué nombre tienen los proveedores
  const proveedoresPorId = useMemo(() => {
    const map = {};
    // No tenemos acceso directo a los proveedores aquí, pero la prop producto puede traer info
    // Como mínimo, ponemos el primer carácter del id
    return map;
  }, []);

  // Score de similitud entre dos cadenas (0..1)
  // Cuenta tokens compartidos: cuántas palabras del query aparecen en el target
  const calcularSimilitud = (query, target) => {
    if (!query || !target) return 0;
    const q = query.toLowerCase().replace(/[^\w\s\d]/g, " ").trim();
    const t = target.toLowerCase().replace(/[^\w\s\d]/g, " ");
    if (!q) return 0;
    const tokensQ = q.split(/\s+/).filter(x => x.length >= 2);
    if (tokensQ.length === 0) return 0;
    let coincidencias = 0;
    for (const tok of tokensQ) {
      if (t.includes(tok)) coincidencias++;
    }
    return coincidencias / tokensQ.length;
  };

  // Buscar productos del catálogo que coincidan con la búsqueda
  // Aplica filtro por familia, busca, ordena por similitud
  const candidatosExistentes = useMemo(() => {
    let resultado = CATALOGO;

    // Filtro por familia (si hay una seleccionada)
    if (filtroFamilia) {
      resultado = resultado.filter(p => p.familia === filtroFamilia);
    }

    // Si no hay query y hay filtro, mostramos los primeros 30 de la familia
    if (!busquedaProd.trim()) {
      if (filtroFamilia) return resultado.slice(0, 30);
      return [];
    }

    // Filtro de búsqueda: descripción, id o ref de proveedor
    const q = busquedaProd.toLowerCase();
    resultado = resultado.filter(p =>
      p.desc?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q) ||
      Object.values(p.proveedores || {}).some(pv => pv.ref?.toLowerCase().includes(q))
    );

    // Ordenar por similitud combinada (query + descripción facturada del proveedor)
    // De forma que los más relevantes salgan arriba
    const queryParaSimilitud = busquedaProd + " " + (producto.descFact || "");
    resultado = resultado
      .map(p => ({ p, score: calcularSimilitud(queryParaSimilitud, p.desc + " " + (p.familia || "")) }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.p);

    return resultado.slice(0, 30);
  }, [busquedaProd, filtroFamilia, producto.descFact]);

  // Datos derivados del producto del análisis
  const apariciones = producto.apariciones.map(a => ({
    facturaId: a.facturaId,
    lineaIdx: producto.apariciones.indexOf(a) // orden en el array original
  }));
  // FIX: apariciones tienen que tener lineaIdx real, no el del array agregado
  const aparicionesReales = producto.apariciones.map(a => ({
    facturaId: a.facturaId,
    lineaIdx: a.lineaIdx !== undefined ? a.lineaIdx : 0
  }));
  const proveedorId = producto.apariciones[0]?.proveedorId || producto.apariciones[0]?.facturaId; // se ajusta abajo
  const refProv = producto.ref;
  const ultimoPrecio = producto.apariciones.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))[0]?.precioFactura || 0;

  const handleCrear = async () => {
    if (!descripcion.trim()) { alert("La descripción no puede estar vacía"); return; }
    if (guardando) return;
    setGuardando(true);
    try {
      // Necesitamos enriquecer con lineaIdx real y proveedorId real, mirando las facturas reales
      const payload = {
        descripcion: descripcion.trim(),
        familia: familia.trim() || "Varios",
        unidad: unidad.trim() || "uni",
        referenciaProveedor: refProv,
        proveedorId: producto.apariciones[0]?.proveedorId,
        precioFacturado: ultimoPrecio,
        apariciones: producto.apariciones.map(a => ({
          facturaId: a.facturaId,
          lineaIdx: a.lineaIdx
        }))
      };
      const r = await fetch(FAC_URL + "/crear-producto-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error creando producto");
      alert("✅ " + data.mensaje);
      onCreado();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleAsociar = async () => {
    if (!productoExistente) { alert("Selecciona un producto del catálogo primero"); return; }
    if (guardando) return;
    setGuardando(true);
    try {
      const payload = {
        productoId: productoExistente.id,
        referenciaProveedor: refProv,
        proveedorId: producto.apariciones[0]?.proveedorId,
        precioFacturado: ultimoPrecio,
        apariciones: producto.apariciones.map(a => ({
          facturaId: a.facturaId,
          lineaIdx: a.lineaIdx
        }))
      };
      const r = await fetch(FAC_URL + "/asociar-producto-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error asociando producto");
      alert("✅ " + data.mensaje);
      onCreado();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/70" onClick={onCerrar} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="bg-blue-700 text-white border-b-4 border-stone-900 p-3 flex items-center justify-between">
          <h3 className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            🆕 AÑADIR AL CATÁLOGO
          </h3>
          <button onClick={onCerrar} disabled={guardando}
            className="bg-white text-blue-700 font-black px-3 py-1 border-2 border-white hover:bg-blue-100 disabled:opacity-50">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Datos detectados de la factura */}
          <div className="bg-blue-50 border-2 border-blue-400 p-3 text-xs space-y-1">
            <div className="text-[10px] font-bold tracking-widest text-blue-900 mb-2">DATOS DETECTADOS EN FACTURA</div>
            <div><b>Ref proveedor:</b> <span className="font-mono">{refProv || "—"}</span></div>
            <div><b>Descripción facturada:</b> {producto.descFact}</div>
            <div><b>Apariciones:</b> {producto.apariciones.length} factura{producto.apariciones.length === 1 ? "" : "s"} · {producto.cantTotal.toFixed(0)} {producto.unidad}</div>
            <div><b>Último precio facturado:</b> €{ultimoPrecio.toFixed(4)}</div>
          </div>

          {/* Selector de modo */}
          <div className="flex gap-2 border-b-2 border-stone-900">
            <button
              onClick={() => setModo("crear")}
              className={`flex-1 px-3 py-2 text-xs font-black tracking-widest border-2 border-b-0 ${modo === "crear" ? "bg-blue-600 text-white border-blue-800" : "bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200"}`}>
              ✅ CREAR PRODUCTO NUEVO
            </button>
            <button
              onClick={() => setModo("asociar")}
              className={`flex-1 px-3 py-2 text-xs font-black tracking-widest border-2 border-b-0 ${modo === "asociar" ? "bg-violet-600 text-white border-violet-800" : "bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200"}`}>
              🔍 ASOCIAR A EXISTENTE
            </button>
          </div>

          {modo === "crear" ? (
            // ── MODO CREAR ───────────────────────────────────────
            <div className="space-y-3">
              <div className="text-[11px] text-stone-700 italic">
                Crea este producto en tu catálogo. La descripción del proveedor suele ser críptica — edítala a algo legible (ej. "Codo 90° latón H 1/2"" en lugar de "CODO 90 LT H 12").
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest text-stone-700">DESCRIPCIÓN DEL PRODUCTO</label>
                <input
                  type="text"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej: Codo 90° latón H 1/2&quot;"
                  className="w-full border-2 border-stone-900 p-2 text-sm font-mono mt-1 focus:outline-none focus:bg-amber-50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-stone-700">FAMILIA</label>
                  <input
                    type="text"
                    value={familia}
                    onChange={(e) => setFamilia(e.target.value)}
                    list="familias-list"
                    placeholder="Ej: Accesorios"
                    className="w-full border-2 border-stone-900 p-2 text-sm mt-1 focus:outline-none focus:bg-amber-50" />
                  <datalist id="familias-list">
                    {familias.map(f => <option key={f} value={f} />)}
                  </datalist>
                  <div className="text-[9px] text-stone-500 mt-1">Escribe una nueva o elige existente</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-stone-700">UNIDAD</label>
                  <input
                    type="text"
                    value={unidad}
                    onChange={(e) => setUnidad(e.target.value)}
                    placeholder="uni / m / kg…"
                    className="w-full border-2 border-stone-900 p-2 text-sm font-mono mt-1 focus:outline-none focus:bg-amber-50" />
                </div>
              </div>
              <div className="bg-amber-50 border-2 border-amber-400 p-2 text-[10px] text-amber-900">
                <b>Al crear el producto:</b> se guardará en el catálogo, se asociará a las {producto.apariciones.length} apariciones de esta referencia, y se aprenderá la equivalencia <code className="bg-amber-200 px-1">{refProv}</code> → este producto. Las próximas facturas con esa ref se matchearán automáticamente.
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={onCerrar} disabled={guardando}
                  className="flex-1 bg-stone-200 text-stone-800 px-3 py-2 text-xs font-black tracking-widest border-2 border-stone-900 hover:bg-stone-300 disabled:opacity-50">
                  CANCELAR
                </button>
                <button onClick={handleCrear} disabled={guardando || !descripcion.trim()}
                  className="flex-[2] bg-blue-600 text-white px-3 py-2 text-xs font-black tracking-widest border-2 border-blue-800 hover:bg-blue-700 disabled:opacity-50">
                  {guardando ? "⏳ CREANDO..." : "✅ CREAR Y ASOCIAR APARICIONES"}
                </button>
              </div>
            </div>
          ) : (
            // ── MODO ASOCIAR ────────────────────────────────────
            <div className="space-y-3">
              <div className="text-[11px] text-stone-700 italic">
                Si este producto YA existe en tu catálogo (con otra descripción), búscalo y asócialo. Útil cuando la IA no encontró el match porque las descripciones son distintas.
              </div>
              {/* Selector de familia y buscador */}
              <div className="grid grid-cols-[180px_1fr] gap-2">
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-stone-700">FAMILIA</label>
                  <select
                    value={filtroFamilia}
                    onChange={(e) => { setFiltroFamilia(e.target.value); setProductoExistente(null); }}
                    className="w-full border-2 border-stone-900 p-2 text-sm bg-white mt-1 focus:outline-none focus:bg-amber-50">
                    <option value="">Todas las familias</option>
                    {familias.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-stone-700">BUSCAR EN CATÁLOGO</label>
                  <input
                    type="text"
                    value={busquedaProd}
                    onChange={(e) => { setBusquedaProd(e.target.value); setProductoExistente(null); }}
                    placeholder="Busca por descripción, ref o ID… (ej. codo 18 3/4)"
                    autoFocus
                    className="w-full border-2 border-stone-900 p-2 text-sm font-mono mt-1 focus:outline-none focus:bg-amber-50" />
                </div>
              </div>
              {/* Hint de uso */}
              {!busquedaProd.trim() && filtroFamilia && (
                <div className="text-[10px] text-stone-500 italic">
                  Mostrando los primeros 30 productos de la familia <b>{filtroFamilia}</b>. Escribe arriba para refinar la búsqueda.
                </div>
              )}
              {!busquedaProd.trim() && !filtroFamilia && (
                <div className="text-[10px] text-stone-500 italic">
                  Selecciona una familia o escribe algo para buscar en el catálogo.
                </div>
              )}
              {/* Resultados */}
              {candidatosExistentes.length > 0 && (
                <div className="border-2 border-stone-900 max-h-72 overflow-y-auto">
                  {candidatosExistentes.map(p => {
                    // ¿Tiene ya nuestro proveedor configurado? Si sí, marcamos con aviso
                    const proveedorActual = producto.apariciones[0]?.proveedorId;
                    const yaConProveedor = proveedorActual && p.proveedores?.[proveedorActual];
                    const proveedoresKeys = Object.keys(p.proveedores || {});
                    return (
                      <div key={p.id}
                        onClick={() => setProductoExistente(p)}
                        className={`p-2 cursor-pointer border-b border-stone-200 hover:bg-violet-50 ${productoExistente?.id === p.id ? "bg-violet-100 ring-2 ring-violet-600" : ""}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm">{p.desc}</div>
                            <div className="text-[10px] text-stone-500 font-mono">
                              {p.id} · <span className="text-violet-700">{p.familia || "—"}</span> · {p.unidad}
                            </div>
                          </div>
                          {yaConProveedor && (
                            <div className="text-[9px] bg-amber-100 text-amber-900 border border-amber-400 px-1.5 py-0.5 rounded-sm whitespace-nowrap" title="Este producto YA tiene este proveedor con otra ref. Probablemente NO es el match correcto.">
                              ⚠ ya con tu proveedor
                            </div>
                          )}
                        </div>
                        {proveedoresKeys.length > 0 && (
                          <div className="text-[9px] text-stone-600 font-mono mt-1 truncate">
                            <span className="text-stone-400">Proveedores:</span> {proveedoresKeys.map(pid => {
                              const pv = p.proveedores[pid];
                              const esElNuestro = pid === proveedorActual;
                              return (
                                <span key={pid} className={esElNuestro ? "text-amber-700 font-bold" : ""}>
                                  {pid.substring(0, 3).toUpperCase()}(ref {pv.ref || "—"} · €{pv.bruto?.toFixed(2) || "—"})
                                </span>
                              );
                            }).reduce((acc, el, i) => i === 0 ? [el] : [...acc, " · ", el], [])}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Mensaje si no hay resultados */}
              {(busquedaProd.trim() || filtroFamilia) && candidatosExistentes.length === 0 && (
                <div className="border-2 border-stone-200 p-3 text-center text-stone-500 text-xs italic">
                  No se encontró ningún producto con esos criterios. Quizá tengas que crear uno nuevo.
                </div>
              )}
              {productoExistente && (
                <div className="bg-violet-50 border-2 border-violet-400 p-2 text-[10px] text-violet-900">
                  <b>Asociarás esta referencia al producto:</b> "{productoExistente.desc}". Se actualizará el precio del proveedor en ese producto a €{ultimoPrecio.toFixed(4)}, y se aprenderá la equivalencia para futuras facturas.
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={onCerrar} disabled={guardando}
                  className="flex-1 bg-stone-200 text-stone-800 px-3 py-2 text-xs font-black tracking-widest border-2 border-stone-900 hover:bg-stone-300 disabled:opacity-50">
                  CANCELAR
                </button>
                <button onClick={handleAsociar} disabled={guardando || !productoExistente}
                  className="flex-[2] bg-violet-600 text-white px-3 py-2 text-xs font-black tracking-widest border-2 border-violet-800 hover:bg-violet-700 disabled:opacity-50">
                  {guardando ? "⏳ ASOCIANDO..." : "🔍 ASOCIAR A ESTE PRODUCTO"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalRevisionFactura({ factura: facturaInicial, pin, onCerrar }) {
  const [factura, setFactura] = useState(facturaInicial);
  const [extrayendo, setExtrayendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [busquedas, setBusquedas] = useState({});
  const [creandoProv, setCreandoProv] = useState(false);
  const [nuevoProv, setNuevoProv] = useState({ nombre: factura.proveedorDesconocido?.nombreDetectado || "", formaPago: "Contado", color: "blue", email: "" });
  const [cambioIdx, setCambioIdx] = useState(null); // idx de la línea cuyo buscador 'cambiar producto' está abierto
  const [busquedaCambio, setBusquedaCambio] = useState(""); // texto del buscador
  const FAC_URL = "https://araujo-bot.onrender.com/api/facturas";
  const COLORES_PROV = ["emerald","amber","blue","violet","rose","teal"];

  const recargar = async () => {
    try {
      const r = await fetch(FAC_URL + "/ver/" + factura.id, { headers: { "x-admin-pin": pin } });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Error " + r.status }));
        throw new Error(err.error || "Error " + r.status);
      }
      setFactura(await r.json());
    } catch (e) {
      alert("No se pudo recargar la factura: " + e.message);
    }
  };

  const handleCrearProveedor = async () => {
    if (!nuevoProv.nombre.trim()) return;
    setCreandoProv(true);
    try {
      const r = await fetch(FAC_URL + "/crear-proveedor/" + factura.id, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify(nuevoProv)
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error);
      setFactura(data.factura);
    } catch (e) { alert("Error: " + e.message); }
    finally { setCreandoProv(false); }
  };

  const handleExtraer = async () => {
    setExtrayendo(true);
    try {
      const r = await fetch(FAC_URL + "/extraer/" + factura.id, { method: "POST", headers: { "x-admin-pin": pin } });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error);
      setFactura(data.factura);
    } catch (e) { alert("Error extrayendo: " + e.message); }
    finally { setExtrayendo(false); }
  };

  const updateLinea = async (idx, changes) => {
    try {
      const r = await fetch(FAC_URL + "/linea/" + factura.id + "/" + idx, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify(changes)
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Error " + r.status }));
        throw new Error(err.error || "Error " + r.status);
      }
      await recargar();
    } catch (e) {
      alert("No se pudo actualizar la línea: " + e.message);
    }
  };

  // Cambia el producto sugerido de una línea y recalcula la variación de precio
  // contra el nuevo producto seleccionado
  const cambiarProducto = async (idx, nuevoProductoId) => {
    const linea = (factura.lineasRevision || []).find(l => l.idx === idx);
    if (!linea) return;
    const prod = CATALOGO.find(p => p.id === nuevoProductoId);
    if (!prod) return alert("Producto no encontrado");

    // Recalcular precio actual y variación
    const provData = prod.proveedores?.[linea.proveedorId];
    let precioActual = null;
    let variacionPrecio = null;
    if (provData) {
      const netoActual = provData.dto > 0
        ? +(provData.bruto * (1 - provData.dto / 100)).toFixed(4)
        : provData.bruto;
      precioActual = netoActual;
      const diff = (linea.precioUnitarioNeto || 0) - netoActual;
      const pct = netoActual > 0 ? +((diff / netoActual) * 100).toFixed(1) : 0;
      variacionPrecio = { diff: +diff.toFixed(4), pct, sube: diff > 0.001, baja: diff < -0.001 };
    }

    await updateLinea(idx, {
      productoSugerido: nuevoProductoId,
      confianza: 100,            // el usuario lo eligió a mano: máxima confianza
      estado: "confirmado",
      precioActual,
      variacionPrecio,
      tieneEnCatalogo: precioActual !== null
    });
    setCambioIdx(null);
    setBusquedaCambio("");
  };

  const handleConfirmar = async (forzar = false) => {
    const esReaplicacion = factura.estado === "completado";

    // Contar líneas sin decidir desde el frontend para poder avisar antes
    const sinDecidir = lineas.filter(l => l.estado === "pendiente" || l.estado === "revisar");

    if (sinDecidir.length > 0 && !forzar) {
      const ok = confirm(
        `⚠️ Tienes ${sinDecidir.length} línea${sinDecidir.length === 1 ? "" : "s"} sin decidir (pendiente o revisar).\n\n` +
        `Esas líneas se IGNORARÁN al aplicar al catálogo (no actualizan precio ni crean producto).\n\n` +
        `¿Quieres aplicar de todos modos?`
      );
      if (!ok) return;
      forzar = true;
    } else if (esReaplicacion) {
      const ok = confirm(
        `Esta factura YA está aplicada al catálogo. ¿Quieres re-aplicar los cambios?\n\n` +
        `Los productos ya existentes se actualizarán con los nuevos datos.\n` +
        `Las equivalencias incorrectas se sobrescribirán.`
      );
      if (!ok) return;
    } else {
      if (!confirm("¿Aplicar todos los cambios al catálogo?")) return;
    }

    setConfirmando(true);
    try {
      const r = await fetch(FAC_URL + "/confirmar/" + factura.id, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({ forzar })
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || "Error desconocido");
      const saltadosTxt = data.saltados ? `, ${data.saltados} saltadas` : "";
      const reTxt = data.esReaplicacion ? " (re-aplicación)" : "";
      alert(`✅ Aplicado${reTxt}: ${data.actualizados} actualizados, ${data.nuevos} nuevos, ${data.ignorados} ignorados${saltadosTxt}`);
      recargar();
    } catch (e) { alert("Error al aplicar: " + e.message); }
    finally { setConfirmando(false); }
  };

  const handleInformePDF = async () => {
    let jsPDFmod;
    try { jsPDFmod = await import("jspdf"); } catch(e) { alert("No se pudo cargar PDF"); return; }
    const { jsPDF } = jsPDFmod;
    // Horizontal (landscape)
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
    const PW = 297; // page width landscape
    const ML = 12; // margin left
    const MR = 12; // margin right
    const W = PW - ML - MR; // usable width
    let y = 14;

    const subidas = lineas.filter(l => l.variacionPrecio?.sube && l.estado !== "ignorado");
    const bajadas = lineas.filter(l => l.variacionPrecio?.baja && l.estado !== "ignorado");

    if (subidas.length === 0 && bajadas.length === 0) {
      alert("No hay variaciones de precio para reportar.");
      return;
    }

    // Cabecera
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("INFORME DE VARIACION DE PRECIOS", PW / 2, y, { align: "center" }); y += 6;
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text("ARA Corporate Sociedad de Inversiones, SL · CIF B90488222", PW / 2, y, { align: "center" }); y += 4;
    doc.text("Avd San Francisco Javier 9 PL6 MOD 9, 41018 Sevilla", PW / 2, y, { align: "center" }); y += 7;
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(ML, y, PW - MR, y); y += 5;

    // Datos factura en dos columnas
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(`Proveedor: ${factura.datosExtraidos?.proveedor || "-"}`, ML, y);
    doc.text(`Factura: ${factura.datosExtraidos?.numero_factura || "-"}`, PW / 2, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha factura: ${factura.datosExtraidos?.fecha || "-"}`, ML, y);
    doc.text(`Fecha informe: ${new Date().toLocaleDateString("es-ES", { dateStyle: "long" })}`, PW / 2, y);
    y += 4;
    doc.text(`Total factura: EUR${factura.datosExtraidos?.total?.toFixed(2) || "-"}`, ML, y);
    y += 6;
    doc.setDrawColor(180); doc.setLineWidth(0.3); doc.line(ML, y, PW - MR, y); y += 5;

    // Columnas: Ref | Descripción | Cant | P.anterior | P.nuevo | Dif.unit | Total fact anterior | Total fact nuevo | Dif.total | %
    const cols = {
      ref:  ML,
      desc: ML + 18,
      cant: ML + 118,
      pant: ML + 133,
      pnew: ML + 155,
      dunit: ML + 175,
      tant: ML + 198,
      tnew: ML + 222,
      dtot: ML + 245,
      pct:  PW - MR,
    };

    const pintarTabla = (titulo, items, colorR, colorG, colorB) => {
      if (items.length === 0) return;
      if (y > 175) { doc.addPage(); y = 14; }

      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.setTextColor(colorR, colorG, colorB);
      doc.text(`${titulo} (${items.length} productos)`, ML, y); y += 5;
      doc.setTextColor(0, 0, 0);

      // Cabecera tabla
      doc.setFillColor(230, 230, 230);
      doc.rect(ML, y - 4, W, 6, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7);
      doc.text("Ref", cols.ref, y);
      doc.text("Descripcion", cols.desc, y);
      doc.text("Cant", cols.cant, y, { align: "right" });
      doc.text("P.Anterior", cols.pant, y, { align: "right" });
      doc.text("P.Nuevo", cols.pnew, y, { align: "right" });
      doc.text("Dif/uni", cols.dunit, y, { align: "right" });
      doc.text("Total anterior", cols.tant, y, { align: "right" });
      doc.text("Total nuevo", cols.tnew, y, { align: "right" });
      doc.text("Dif.total", cols.dtot, y, { align: "right" });
      doc.text("% Var.", cols.pct, y, { align: "right" });
      y += 4;

      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      let sumDifTotal = 0;
      let sumTotAnterior = 0;
      let sumTotNuevo = 0;

      items.forEach(l => {
        if (y > 190) { doc.addPage(); y = 14; }
        const ref = (l.lineaOriginal?.referencia_proveedor || "-").substring(0, 10);
        const desc = (l.lineaOriginal?.descripcion_original || "").length > 52
          ? l.lineaOriginal.descripcion_original.substring(0, 50) + ".."
          : (l.lineaOriginal?.descripcion_original || "");
        const cant = parseFloat(l.lineaOriginal?.cantidad) || 0;
        const actual = l.precioActual || 0;
        const nuevo = l.precioUnitarioNeto || 0;
        const diffUnit = nuevo - actual;
        const totAnt = actual * cant;
        const totNew = nuevo * cant;
        const diffTot = totNew - totAnt;
        const pct = l.variacionPrecio?.pct || 0;
        sumDifTotal += diffTot;
        sumTotAnterior += totAnt;
        sumTotNuevo += totNew;

        doc.text(ref, cols.ref, y);
        doc.text(desc, cols.desc, y);
        doc.text(String(cant), cols.cant, y, { align: "right" });
        doc.text("EUR" + actual.toFixed(4), cols.pant, y, { align: "right" });
        doc.text("EUR" + nuevo.toFixed(4), cols.pnew, y, { align: "right" });
        doc.setTextColor(colorR, colorG, colorB);
        doc.text((diffUnit >= 0 ? "+" : "") + "EUR" + diffUnit.toFixed(4), cols.dunit, y, { align: "right" });
        doc.setTextColor(0,0,0);
        doc.text("EUR" + totAnt.toFixed(2), cols.tant, y, { align: "right" });
        doc.text("EUR" + totNew.toFixed(2), cols.tnew, y, { align: "right" });
        doc.setTextColor(colorR, colorG, colorB);
        doc.text((diffTot >= 0 ? "+" : "") + "EUR" + diffTot.toFixed(2), cols.dtot, y, { align: "right" });
        doc.text((pct >= 0 ? "+" : "") + pct + "%", cols.pct, y, { align: "right" });
        doc.setTextColor(0,0,0);
        y += 3.8;
      });

      // Totales
      y += 1; doc.setLineWidth(0.3); doc.line(cols.tant - 10, y, PW - MR, y); y += 3.5;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text("TOTAL:", cols.tant - 30, y);
      doc.text("EUR" + sumTotAnterior.toFixed(2), cols.tant, y, { align: "right" });
      doc.text("EUR" + sumTotNuevo.toFixed(2), cols.tnew, y, { align: "right" });
      doc.setTextColor(colorR, colorG, colorB);
      doc.text((sumDifTotal >= 0 ? "+" : "") + "EUR" + sumDifTotal.toFixed(2), cols.dtot, y, { align: "right" });
      doc.setTextColor(0,0,0);
      y += 8;
    };

    pintarTabla("PRODUCTOS CON SUBIDA DE PRECIO", subidas, 180, 0, 0);
    pintarTabla("PRODUCTOS CON BAJADA DE PRECIO", bajadas, 0, 130, 0);

    // Resumen final
    if (y > 175) { doc.addPage(); y = 14; }
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(ML, y, PW - MR, y); y += 5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("RESUMEN GLOBAL DEL IMPACTO", ML, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const totalSubidaUnit = subidas.reduce((s,l) => s + ((l.precioUnitarioNeto||0) - (l.precioActual||0)) * (l.lineaOriginal?.cantidad||0), 0);
    const totalBajadaUnit = bajadas.reduce((s,l) => s + ((l.precioUnitarioNeto||0) - (l.precioActual||0)) * (l.lineaOriginal?.cantidad||0), 0);
    doc.setTextColor(180,0,0);
    doc.text(`Impacto subidas:  EUR${totalSubidaUnit.toFixed(2)} sobre esta factura`, ML, y); y += 4;
    doc.setTextColor(0,130,0);
    doc.text(`Impacto bajadas:  EUR${totalBajadaUnit.toFixed(2)} sobre esta factura`, ML, y); y += 4;
    doc.setTextColor(0,0,0);
    const neto = totalSubidaUnit + totalBajadaUnit;
    doc.setFont("helvetica", "bold");
    doc.text(`Impacto neto:     EUR${(neto >= 0 ? "+" : "") + neto.toFixed(2)} sobre esta factura`, ML, y); y += 7;

    doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(100);
    doc.text("Informe generado automaticamente desde el sistema de gestion de pedidos ARA Corporate.", ML, y); y += 3.5;
    doc.text("Los precios anteriores corresponden a los registrados en el catalogo interno en el momento de la importacion.", ML, y);
    doc.setTextColor(0);

    const fname = `Informe_Variacion_${(factura.datosExtraidos?.proveedor || "proveedor").replace(/[^a-z0-9]/gi,"_")}_${factura.datosExtraidos?.numero_factura || factura.id}.pdf`;
    doc.save(fname);
  };

  const confianzaColor = (c) => c >= 90 ? "text-emerald-700 font-bold" : c >= 70 ? "text-amber-700 font-bold" : "text-red-700 font-bold";
  const estadoBtn = (linea, estado) => linea.estado === estado
    ? "bg-stone-900 text-amber-400 border-stone-900"
    : "bg-white text-stone-700 border-stone-300 hover:border-stone-900";

  const lineas = factura.lineasRevision || [];
  const [filtro, setFiltro] = useState("todo");
  const [orden, setOrden]   = useState("factura"); // factura | impacto-sube | impacto-baja | pct-sube | pct-baja
  const pendientes  = lineas.filter(l => l.estado === "pendiente").length;
  const confirmadas = lineas.filter(l => l.estado === "confirmado").length;
  const nuevas      = lineas.filter(l => l.estado === "nuevo").length;
  const ignoradas   = lineas.filter(l => l.estado === "ignorado").length;
  const revisar     = lineas.filter(l => l.estado === "revisar").length;

  // Impacto económico = diff_unitario × cantidad de la factura
  // Incluimos TODAS las líneas con variación, incluso las ignoradas:
  // ignorar significa "no aplicar al catálogo", no "ocultar del análisis económico"
  const impactoLinea = (l) => {
    if (!l.variacionPrecio) return 0;
    const cant = parseFloat(l.lineaOriginal?.cantidad) || 0;
    return l.variacionPrecio.diff * cant;
  };
  const lineasSube = lineas.filter(l => l.variacionPrecio?.sube);
  const lineasBaja = lineas.filter(l => l.variacionPrecio?.baja);
  const subidas     = lineasSube.length;
  const bajadas     = lineasBaja.length;
  const impactoSube = lineasSube.reduce((acc, l) => acc + impactoLinea(l), 0); // > 0
  const impactoBaja = lineasBaja.reduce((acc, l) => acc + impactoLinea(l), 0); // < 0
  const impactoNeto = impactoSube + impactoBaja;
  const diffSubeUnit = lineasSube.reduce((acc, l) => acc + (l.variacionPrecio?.diff || 0), 0);
  const diffBajaUnit = lineasBaja.reduce((acc, l) => acc + (l.variacionPrecio?.diff || 0), 0);

  const lineasFiltradas = lineas.filter(l => {
    if (filtro === "todo")       return true;
    if (filtro === "pendiente")  return l.estado === "pendiente";
    if (filtro === "confirmado") return l.estado === "confirmado";
    if (filtro === "nuevo")      return l.estado === "nuevo";
    if (filtro === "ignorado")   return l.estado === "ignorado";
    if (filtro === "revisar")    return l.estado === "revisar";
    if (filtro === "sube")       return l.variacionPrecio?.sube;
    if (filtro === "baja")       return l.variacionPrecio?.baja;
    return true;
  }).slice().sort((a, b) => {
    if (orden === "factura")      return a.idx - b.idx;
    if (orden === "impacto-sube") return impactoLinea(b) - impactoLinea(a);          // mayor subida primero
    if (orden === "impacto-baja") return impactoLinea(a) - impactoLinea(b);          // mayor bajada (más negativo) primero
    if (orden === "pct-sube")     return (b.variacionPrecio?.pct || 0) - (a.variacionPrecio?.pct || 0);
    if (orden === "pct-baja")     return (a.variacionPrecio?.pct || 0) - (b.variacionPrecio?.pct || 0);
    return a.idx - b.idx;
  });

  // Accion masiva — aplica a las líneas filtradas
  const accionMasiva = async (nuevoEstado) => {
    const indices = lineasFiltradas.map(l => l.idx);
    try {
      const resultados = await Promise.all(indices.map(idx =>
        fetch(`https://araujo-bot.onrender.com/api/facturas/linea/${factura.id}/${idx}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-admin-pin": pin },
          body: JSON.stringify({ estado: nuevoEstado })
        })
      ));
      const fallidas = resultados.filter(r => !r.ok).length;
      if (fallidas > 0) alert(`Atención: ${fallidas} de ${indices.length} líneas no se pudieron actualizar.`);
      await recargar();
    } catch (e) {
      alert("Error en acción masiva: " + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/50" onClick={onCerrar} />
      <div className="relative bg-white border-4 border-stone-900 w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="bg-amber-500 border-b-4 border-stone-900 p-3 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h3 className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
              🧾 {factura.archivoOriginal}
            </h3>
            <div className="text-[10px]">
              {factura.datosExtraidos?.proveedor && <span className="font-bold">{factura.datosExtraidos.proveedor}</span>}
              {factura.datosExtraidos?.numero_factura && <span className="ml-2">Fac. {factura.datosExtraidos.numero_factura}</span>}
              {factura.datosExtraidos?.fecha && <span className="ml-2">{factura.datosExtraidos.fecha}</span>}
              {factura.datosExtraidos?.total && <span className="ml-2 font-bold">Total: €{factura.datosExtraidos.total}</span>}
            </div>
          </div>
          <button onClick={onCerrar} className="bg-stone-900 text-amber-400 p-1.5 border-2 border-stone-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Proveedor desconocido — paso previo */}
          {factura.proveedorDesconocido && factura.estado === "pendiente_revision" && (
            <div className="border-4 border-amber-500 bg-amber-50 p-4 space-y-3">
              <div className="font-black text-base" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                ⚠️ PROVEEDOR NO RECONOCIDO
              </div>
              <div className="text-sm text-stone-700">
                La factura indica: <span className="font-bold">"{factura.proveedorDesconocido.nombreDetectado}"</span>
                {factura.proveedorDesconocido.cifDetectado && <span className="ml-2 text-stone-500">CIF: {factura.proveedorDesconocido.cifDetectado}</span>}
              </div>
              <div className="text-xs text-stone-600">Este proveedor no existe en tu catálogo. Rellena los datos para crearlo:</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-stone-600">NOMBRE</label>
                  <input type="text" value={nuevoProv.nombre || factura.proveedorDesconocido.nombreDetectado}
                    onChange={(e) => setNuevoProv(p => ({...p, nombre: e.target.value}))}
                    className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:outline-none focus:bg-white" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-stone-600">FORMA DE PAGO</label>
                  <input type="text" value={nuevoProv.formaPago}
                    onChange={(e) => setNuevoProv(p => ({...p, formaPago: e.target.value}))}
                    className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:outline-none focus:bg-white" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-stone-600">EMAIL</label>
                  <input type="email" value={nuevoProv.email}
                    onChange={(e) => setNuevoProv(p => ({...p, email: e.target.value}))}
                    className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:outline-none focus:bg-white" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-stone-600">COLOR</label>
                  <div className="flex gap-1 mt-1">
                    {COLORES_PROV.map(c => (
                      <button key={c} onClick={() => setNuevoProv(p => ({...p, color: c}))}
                              className={`w-7 h-7 border-2 ${nuevoProv.color === c ? "border-stone-900" : "border-stone-300"} bg-${c}-400`} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCrearProveedor} disabled={creandoProv}
                        className={`px-4 py-2 font-black text-xs tracking-widest border-2 border-stone-900 ${creandoProv ? "bg-stone-300 cursor-wait" : "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900"}`}
                        style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                  {creandoProv ? "CREANDO..." : "✓ CREAR PROVEEDOR Y CONTINUAR"}
                </button>
              </div>
            </div>
          )}

          {/* Sin extraer */}
          {factura.estado === "pendiente_extraccion" && (
            <div className="text-center py-8">
              <div className="text-stone-500 mb-4">La factura aún no ha sido procesada por la IA</div>
              <button onClick={handleExtraer} disabled={extrayendo}
                      className={`px-8 py-4 font-black text-sm tracking-widest border-2 border-stone-900 ${extrayendo ? "bg-stone-300 cursor-wait" : "bg-stone-900 text-amber-400 hover:bg-amber-400 hover:text-stone-900"}`}
                      style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                {extrayendo ? "⏳ EXTRAYENDO CON IA..." : "🤖 EXTRAER CON IA"}
              </button>
            </div>
          )}

          {/* Extrayendo */}
          {factura.estado === "extrayendo" && (
            <div className="text-center py-8">
              <div className="text-stone-500">La IA está analizando la factura...</div>
            </div>
          )}

          {/* Error */}
          {factura.estado === "error" && (
            <div className="bg-red-50 border-2 border-red-700 p-4">
              <div className="font-bold text-red-700 mb-2">Error al extraer</div>
              <div className="text-xs text-red-600">{factura.errorMsg}</div>
              <button onClick={handleExtraer} className="mt-3 px-4 py-2 text-xs font-bold bg-red-700 text-white border-2 border-stone-900">
                REINTENTAR
              </button>
            </div>
          )}

          {/* Revisión */}
          {(factura.estado === "pendiente_revision" || factura.estado === "completado") && lineas.length > 0 && (
            <>
              {/* Alerta resumen de impacto económico */}
              {(subidas > 0 || bajadas > 0) && (
                <div className={`border-2 border-stone-900 p-2.5 flex items-center gap-3 ${
                  impactoNeto > 0.01 ? "bg-red-50" :
                  impactoNeto < -0.01 ? "bg-emerald-50" :
                  "bg-stone-50"
                }`}>
                  <div className="text-2xl">
                    {impactoNeto > 0.01 ? "📈" : impactoNeto < -0.01 ? "📉" : "⚖️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-bold tracking-widest text-stone-600">IMPACTO NETO DE ESTA FACTURA</div>
                    <div className="text-sm font-bold text-stone-900">
                      {impactoNeto > 0.01 && (
                        <span className="text-red-700">
                          +€{impactoNeto.toFixed(2)} más caro que tus precios actuales
                        </span>
                      )}
                      {impactoNeto < -0.01 && (
                        <span className="text-emerald-700">
                          €{impactoNeto.toFixed(2)} más barato que tus precios actuales
                        </span>
                      )}
                      {Math.abs(impactoNeto) <= 0.01 && (
                        <span className="text-stone-700">Sin variación neta significativa</span>
                      )}
                      <span className="text-[10px] text-stone-500 ml-2 font-normal">
                        ({subidas} {subidas === 1 ? "subida" : "subidas"} · {bajadas} {bajadas === 1 ? "bajada" : "bajadas"})
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Filtros clickables */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 text-center">
                {[
                  { key: "todo",       label: "TODO",         val: lineas.length,  extra: null, tooltip: "Mostrar todas las líneas",                            active: "bg-stone-900 text-amber-400",       inactive: "bg-stone-100 text-stone-700 hover:bg-stone-200" },
                  { key: "pendiente",  label: "POR DECIDIR",  val: pendientes,     extra: null, tooltip: "Líneas que requieren tu decisión (la IA no está segura)", active: "bg-amber-500 text-white",       inactive: "bg-amber-50 text-amber-800 hover:bg-amber-100"  },
                  { key: "revisar",    label: "⚠️ REVISAR",   val: revisar,        extra: null, tooltip: "Match correcto pero subida de precio sospechosa (>50%)", active: "bg-orange-600 text-white",       inactive: "bg-orange-50 text-orange-800 hover:bg-orange-100" },
                  { key: "confirmado", label: "ACTUALIZAR",   val: confirmadas,    extra: null, tooltip: "Líneas que actualizarán el precio del producto en el catálogo", active: "bg-emerald-600 text-white", inactive: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100" },
                  { key: "nuevo",      label: "AÑADIR",       val: nuevas,         extra: null, tooltip: "Productos nuevos que se crearán en el catálogo",       active: "bg-blue-600 text-white",            inactive: "bg-blue-50 text-blue-800 hover:bg-blue-100"    },
                  { key: "ignorado",   label: "NO APLICAR",   val: ignoradas,      extra: null, tooltip: "Líneas que se saltarán (no se aplicarán al catálogo)", active: "bg-stone-700 text-white",        inactive: "bg-stone-100 text-stone-600 hover:bg-stone-200"  },
                  { key: "sube",       label: "▲ SUBEN",      val: subidas,        extra: subidas > 0 ? { tot: `+€${impactoSube.toFixed(2)}`,  unit: `+€${diffSubeUnit.toFixed(3)}/ud` } : null, tooltip: "Líneas con precio mayor que el catálogo actual",   active: "bg-red-600 text-white",   inactive: "bg-red-50 text-red-800 hover:bg-red-100"       },
                  { key: "baja",       label: "▼ BAJAN",      val: bajadas,        extra: bajadas > 0 ? { tot: `€${impactoBaja.toFixed(2)}`,   unit: `€${diffBajaUnit.toFixed(3)}/ud` }  : null, tooltip: "Líneas con precio menor que el catálogo actual",   active: "bg-green-600 text-white", inactive: "bg-green-50 text-green-800 hover:bg-green-100" },
                ].map(s => (
                  <button key={s.key} title={s.tooltip} onClick={() => setFiltro(f => f === s.key ? "todo" : s.key)}
                    className={`p-2 border-2 border-stone-900 transition-all ${filtro === s.key ? s.active : s.inactive}`}>
                    <div className="font-black text-xl leading-none">{s.val}</div>
                    <div className="text-[9px] font-bold tracking-widest mt-0.5">{s.label}</div>
                    {s.extra && (
                      <div className="mt-1 leading-tight">
                        <div className="text-[10px] font-black font-mono">{s.extra.tot}</div>
                        <div className="text-[8px] font-mono opacity-75">{s.extra.unit}</div>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Selector de orden — solo cuando hay variaciones */}
              {(subidas > 0 || bajadas > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 bg-stone-50 border-2 border-stone-900 p-2">
                  <span className="text-[10px] font-bold tracking-widest text-stone-600 mr-1">ORDENAR:</span>
                  {[
                    { key: "factura",      label: "Orden factura" },
                    { key: "impacto-sube", label: "▲ Mayor € subida" },
                    { key: "impacto-baja", label: "▼ Mayor € bajada" },
                    { key: "pct-sube",     label: "▲ Mayor % subida" },
                    { key: "pct-baja",     label: "▼ Mayor % bajada" },
                  ].map(o => (
                    <button key={o.key} onClick={() => setOrden(o.key)}
                      className={`px-2 py-1 text-[10px] font-bold border border-stone-900 transition-all ${
                        orden === o.key ? "bg-stone-900 text-amber-400" : "bg-white text-stone-700 hover:bg-stone-100"
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Acciones masivas sobre filtro activo */}
              {filtro !== "todo" && lineasFiltradas.length > 0 && (
                <div className="flex gap-2 items-center bg-stone-50 border-2 border-stone-900 p-2 flex-wrap">
                  <span className="text-[10px] font-bold text-stone-600 flex-1">
                    {lineasFiltradas.length} líneas filtradas — acción masiva:
                  </span>
                  <button onClick={() => accionMasiva("confirmado")}
                    title="Marca todas las líneas filtradas para actualizar precio"
                    className="px-2 py-1 text-[10px] font-bold bg-emerald-600 text-white border border-stone-900 hover:bg-emerald-700">
                    ✓ ACTUALIZAR TODAS
                  </button>
                  <button onClick={() => accionMasiva("ignorado")}
                    title="Marca todas las líneas filtradas para no aplicarlas al catálogo"
                    className="px-2 py-1 text-[10px] font-bold bg-red-600 text-white border border-stone-900 hover:bg-red-700">
                    ✕ NO APLICAR NINGUNA
                  </button>
                  <button onClick={() => accionMasiva("pendiente")}
                    title="Vuelve a poner todas las líneas filtradas en estado por decidir"
                    className="px-2 py-1 text-[10px] font-bold bg-stone-200 text-stone-900 border border-stone-900 hover:bg-stone-300">
                    ↺ RESETEAR
                  </button>
                </div>
              )}

              {/* Líneas */}
              <div className="space-y-2">
                {lineasFiltradas.map((linea) => (
                  <div key={linea.idx} className={`border-2 ${linea.estado === "revisar" ? "border-orange-600 ring-2 ring-orange-300" : "border-stone-900"} ${linea.estado === "ignorado" ? "opacity-40" : ""}`}>
                    {/* Cabecera línea */}
                    <div className={`p-2 flex items-start gap-2 ${linea.estado === "revisar" ? "bg-orange-50" : "bg-stone-100"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] text-stone-500">{linea.lineaOriginal.referencia_proveedor}</span>
                          {linea.estado === "revisar" && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 bg-orange-600 text-white tracking-widest">
                              ⚠️ REVISAR · subida sospechosa
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-sm">{linea.lineaOriginal.descripcion_original}</div>
                        <div className="text-[10px] text-stone-600">
                          {linea.lineaOriginal.cantidad} {linea.lineaOriginal.unidad} × €{linea.lineaOriginal.precio_unitario?.toFixed(3)}
                        </div>
                      </div>
                      {/* Importe de la línea destacado */}
                      <div className="shrink-0 text-right">
                        <div className="text-[8px] font-bold tracking-widest text-stone-500">IMPORTE</div>
                        <div className="text-lg font-black font-mono text-stone-900 leading-none">
                          €{(parseFloat(linea.lineaOriginal.importe_linea) || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Producto sugerido (solo si tiene match válido y NO está marcado como nuevo) */}
                    <div className="p-2 space-y-2">
                      {linea.productoSugerido && linea.estado !== "nuevo" && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-stone-500">Sugerido:</span>
                          <span className="text-xs font-bold flex-1">
                            {CATALOGO.find(p => p.id === linea.productoSugerido)?.desc || linea.productoSugerido}
                          </span>
                          <span className={`text-[10px] ${confianzaColor(linea.confianza)}`}>
                            {linea.confianza}% {linea.aprendida ? "✓ aprendido" : ""}
                          </span>
                          {linea.tieneEnCatalogo && (
                            <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 font-bold">YA EN CATÁLOGO</span>
                          )}
                        </div>
                      )}

                      {/* Aviso de producto nuevo (sustituye a la sugerencia cuando se va a crear) */}
                      {linea.estado === "nuevo" && (
                        <div className="bg-blue-50 border border-blue-300 px-2 py-1 text-[11px] text-blue-900 flex items-center gap-2">
                          <span className="text-base">🆕</span>
                          <span><b>Producto nuevo</b> — se creará en tu catálogo cuando apliques la factura</span>
                        </div>
                      )}

                      {/* Comparativa de precio (solo si tiene sentido: NO es nuevo, hay precio actual) */}
                      {linea.estado !== "nuevo" && (
                        <div className="bg-stone-50 border border-stone-200 p-2 rounded-sm space-y-1">
                          <div className="flex items-center gap-3 flex-wrap text-[10px]">
                            <span className="text-stone-500">Bruto: <span className="font-mono font-bold text-stone-800">€{(linea.precioUnitarioBruto||0).toFixed(3)}</span></span>
                            {linea.descuento > 0 && <span className="text-stone-500">Dto: <span className="font-bold text-amber-700">{linea.descuento}%</span></span>}
                            <span className="text-stone-500">Neto: <span className="font-mono font-bold text-stone-900">€{(linea.precioUnitarioNeto||0).toFixed(4)}</span></span>
                            {linea.precioActual !== null && (
                              <span className="text-stone-500">
                                Actual: <span className="font-mono font-bold">€{linea.precioActual.toFixed(4)}</span>
                                {linea.variacionPrecio && linea.variacionPrecio.pct !== 0 && (
                                  <span className={`ml-1 font-bold ${linea.variacionPrecio.sube ? "text-red-600" : "text-emerald-600"}`}>
                                    {linea.variacionPrecio.sube ? "▲" : "▼"} {Math.abs(linea.variacionPrecio.pct)}%
                                    {" "}(€{Math.abs(linea.variacionPrecio.diff).toFixed(4)})
                                  </span>
                                )}
                                {linea.variacionPrecio && linea.variacionPrecio.pct === 0 && (
                                  <span className="ml-1 text-stone-400">= sin cambio</span>
                                )}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-stone-500">Precio a guardar:</span>
                            <input type="number" step="0.0001" value={linea.precioUnitarioNeto || ""}
                              onChange={(e) => updateLinea(linea.idx, { precioUnitarioNeto: parseFloat(e.target.value) })}
                              className="w-24 border border-stone-400 p-1 text-xs font-mono text-center focus:outline-none focus:border-stone-900" />
                            <span className="text-[10px] text-stone-500">€/{linea.lineaOriginal.unidad}</span>
                          </div>
                        </div>
                      )}

                      {/* En estado nuevo, mostrar solo el precio que se va a guardar (sin comparativa irrelevante) */}
                      {linea.estado === "nuevo" && (
                        <div className="bg-stone-50 border border-stone-200 p-2 rounded-sm flex items-center gap-2">
                          <span className="text-[10px] text-stone-500">Precio a guardar en el nuevo producto:</span>
                          <input type="number" step="0.0001" value={linea.precioUnitarioNeto || ""}
                            onChange={(e) => updateLinea(linea.idx, { precioUnitarioNeto: parseFloat(e.target.value) })}
                            className="w-24 border border-stone-400 p-1 text-xs font-mono text-center focus:outline-none focus:border-stone-900" />
                          <span className="text-[10px] text-stone-500">€/{linea.lineaOriginal.unidad}</span>
                        </div>
                      )}

                      {/* Botones de acción */}
                      <div className="flex gap-1 flex-wrap">
                        {[
                          { key: "confirmado", label: "✓ ACTUALIZAR PRECIO",   tooltip: "Es este producto. Sustituye el precio del catálogo por el de la factura." },
                          { key: "nuevo",      label: "+ AÑADIR AL CATÁLOGO",  tooltip: "Este producto no existe todavía. Crea un producto nuevo con los datos de la factura." },
                          { key: "ignorado",   label: "✕ NO APLICAR",          tooltip: "Salta esta línea. No toca el catálogo y no aprende equivalencia." },
                        ].map(btn => (
                          <button key={btn.key}
                            title={btn.tooltip}
                            onClick={() => updateLinea(linea.idx, { estado: btn.key })}
                            className={`px-2 py-1 text-[10px] font-bold border ${estadoBtn(linea, btn.key)}`}>
                            {btn.label}
                          </button>
                        ))}
                        <button
                          title="El producto sugerido por la IA está mal. Abre un buscador para elegir el correcto de tu catálogo."
                          onClick={() => { setCambioIdx(cambioIdx === linea.idx ? null : linea.idx); setBusquedaCambio(""); }}
                          className={`px-2 py-1 text-[10px] font-bold border ${cambioIdx === linea.idx ? "bg-violet-600 text-white border-stone-900" : "bg-white text-stone-700 border-stone-300 hover:border-violet-600 hover:text-violet-700"}`}>
                          🔍 CAMBIAR PRODUCTO
                        </button>
                      </div>

                      {/* Buscador de catálogo (cambiar producto) */}
                      {cambioIdx === linea.idx && (
                        <div className="bg-violet-50 border-2 border-violet-600 p-2 space-y-2">
                          <div className="text-[9px] font-bold tracking-widest text-violet-800">BUSCAR PRODUCTO EN CATÁLOGO</div>
                          <input
                            type="text"
                            autoFocus
                            value={busquedaCambio}
                            onChange={(e) => setBusquedaCambio(e.target.value)}
                            placeholder="Descripción o referencia…"
                            className="w-full border-2 border-stone-900 p-2 text-xs font-mono focus:outline-none focus:bg-white" />
                          <div className="max-h-48 overflow-y-auto border border-stone-200 bg-white">
                            {(() => {
                              const q = busquedaCambio.toLowerCase().trim();
                              const filtrados = q
                                ? CATALOGO.filter(p =>
                                    p.desc.toLowerCase().includes(q) ||
                                    Object.values(p.proveedores || {}).some(pv => (pv?.ref || "").toLowerCase().includes(q))
                                  ).slice(0, 30)
                                : [];
                              if (!q) return <div className="p-2 text-[10px] text-stone-500 italic">Empieza a escribir para ver resultados…</div>;
                              if (filtrados.length === 0) return <div className="p-2 text-[10px] text-stone-500">Sin coincidencias</div>;
                              return filtrados.map(p => {
                                const provThis = p.proveedores?.[linea.proveedorId];
                                return (
                                  <button key={p.id}
                                    onClick={() => cambiarProducto(linea.idx, p.id)}
                                    className="w-full text-left p-2 hover:bg-violet-100 border-b border-stone-100 last:border-b-0">
                                    <div className="text-xs font-bold">{p.desc}</div>
                                    <div className="text-[10px] text-stone-500">
                                      {provThis ? <>ref: <span className="font-mono">{provThis.ref || "—"}</span> · €{provThis.bruto}{provThis.dto > 0 && ` (-${provThis.dto}%)`}</> : <span className="italic">sin datos para este proveedor</span>}
                                      {p.familia && <span className="ml-2">· {p.familia}</span>}
                                    </div>
                                  </button>
                                );
                              });
                            })()}
                          </div>
                          <div className="text-[9px] text-stone-500">Al seleccionar uno se confirma la línea y se recalcula la variación de precio.</div>
                        </div>
                      )}

                      {/* Sugerencias alternativas */}
                      {linea.sugerencias?.length > 1 && linea.estado !== "ignorado" && (
                        <div className="text-[10px] text-stone-500">
                          Otras opciones:
                          {linea.sugerencias.slice(1).map(s => (
                            <button key={s.id}
                              onClick={() => cambiarProducto(linea.idx, s.id)}
                              className="ml-2 underline text-stone-700 hover:text-stone-900">
                              {s.desc} ({s.confianza}%)
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Campos para producto nuevo */}
                      {linea.estado === "nuevo" && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-blue-50 p-2 border border-blue-300">
                          <div className="sm:col-span-2">
                            <label className="text-[9px] font-bold text-stone-600">DESCRIPCIÓN ESTÁNDAR</label>
                            <input type="text" defaultValue={linea.descripcionPersonalizada || linea.lineaOriginal.descripcion_original}
                              onBlur={(e) => updateLinea(linea.idx, { descripcionPersonalizada: e.target.value })}
                              className="w-full border border-stone-400 p-1 text-xs font-mono focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-stone-600">REFERENCIA PROVEEDOR</label>
                            <input type="text" defaultValue={linea.lineaOriginal.referencia_proveedor || ""} disabled
                              className="w-full border border-stone-300 bg-stone-100 p-1 text-xs font-mono text-stone-600" />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-stone-600">UNIDAD</label>
                            <input type="text" defaultValue={linea.lineaOriginal.unidad || "uni"} disabled
                              className="w-full border border-stone-300 bg-stone-100 p-1 text-xs font-mono text-stone-600" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[9px] font-bold text-stone-600">FAMILIA</label>
                            <select defaultValue={linea.familiaPersonalizada || "Varios"}
                              onChange={(e) => updateLinea(linea.idx, { familiaPersonalizada: e.target.value })}
                              className="w-full border border-stone-400 p-1 text-xs font-mono focus:outline-none">
                              {FAMILIAS.filter(f => f.nombre !== "Todo").map(f => (
                                <option key={f.nombre} value={f.nombre}>{f.nombre}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Botón confirmar todo */}
              {/* Botón informe variación precios */}
              {lineas.some(l => l.variacionPrecio && (l.variacionPrecio.sube || l.variacionPrecio.baja)) && (
                <button onClick={handleInformePDF}
                        className="w-full p-3 font-black text-sm tracking-widest border-2 border-stone-900 bg-stone-100 text-stone-900 hover:bg-stone-200"
                        style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                  📊 INFORME DE VARIACIÓN DE PRECIOS (PDF)
                </button>
              )}

              {factura.estado === "pendiente_revision" && (
                <button onClick={() => handleConfirmar(false)} disabled={confirmando}
                        className={`w-full p-4 font-black text-sm tracking-widest border-2 border-stone-900 ${confirmando ? "bg-stone-300 cursor-wait" : "bg-emerald-700 text-white hover:bg-emerald-800"}`}
                        style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                  {confirmando ? "APLICANDO..." : "✓ APLICAR AL CATÁLOGO"}
                </button>
              )}

              {factura.estado === "completado" && (
                <div className="space-y-2">
                  <div className="bg-emerald-50 border-2 border-emerald-700 p-2 text-[11px] text-emerald-900 flex items-start gap-2">
                    <span className="text-base">✅</span>
                    <div className="flex-1">
                      <b>Factura ya aplicada al catálogo.</b>
                      {factura.resumen && (
                        <span className="block opacity-80 mt-0.5">
                          Resultado: {factura.resumen.actualizados} precios actualizados, {factura.resumen.nuevos} productos nuevos
                          {factura.resumen.ignorados > 0 && `, ${factura.resumen.ignorados} ignorados`}
                          {factura.resumen.saltados > 0 && `, ${factura.resumen.saltados} saltados`}.
                        </span>
                      )}
                      {factura.historialAplicaciones && factura.historialAplicaciones.length > 1 && (
                        <span className="block opacity-70 text-[10px] mt-0.5">
                          Aplicada {factura.historialAplicaciones.length} veces (la última: {new Date(factura.historialAplicaciones[factura.historialAplicaciones.length - 1].fecha).toLocaleString("es-ES")})
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleConfirmar(false)} disabled={confirmando}
                          title="Vuelve a aplicar la factura al catálogo. Útil si has detectado errores y los has corregido."
                          className={`w-full p-3 font-black text-xs tracking-widest border-2 border-stone-900 ${confirmando ? "bg-stone-300 cursor-wait" : "bg-amber-500 text-stone-900 hover:bg-amber-400"}`}
                          style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
                    {confirmando ? "RE-APLICANDO..." : "🔄 RE-APLICAR AL CATÁLOGO"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// =========================================================
//  PESTAÑA CONFIG
// =========================================================
function PestañaConfig({ data, api, reload, pin, onSalir }) {
  const dc = data.datosCliente || {};
  const ce = data.configEmail || {};
  const [razon, setRazon] = useState(dc.razonSocial || "");
  const [cif, setCif] = useState(dc.cif || "");
  const [direccion, setDireccion] = useState(dc.direccion || "");
  const [tel, setTel] = useState(dc.telefono || "");
  const [emailC, setEmailC] = useState(dc.email || "");
  const [pago, setPago] = useState(dc.formaPago || "");

  const [emailAqua, setEmailAqua] = useState(ce.emailAquatubo || "");
  const [emailAram, setEmailAram] = useState(ce.emailAramburu || "");
  const [emailCC, setEmailCC] = useState(ce.emailCC || "");
  const [firmaNombre, setFirmaNombre] = useState(ce.nombreFirma || "");
  const [firmaTel, setFirmaTel] = useState(ce.telefonoFirma || "");
  const [emailActivo, setEmailActivo] = useState(ce.activo || false);

  const [pinViejo, setPinViejo] = useState("");
  const [pinNuevo, setPinNuevo] = useState("");

  const [guardando, setGuardando] = useState("");

  const guardarDatos = async () => {
    setGuardando("datos");
    try {
      await api.put("/admin/datos-cliente", {
        razonSocial: razon, cif, direccion, telefono: tel, email: emailC, formaPago: pago
      });
      reload();
      alert("✓ Datos del cliente guardados");
    } catch (e) { alert("Error: " + e.message); }
    finally { setGuardando(""); }
  };
  const guardarEmail = async () => {
    setGuardando("email");
    try {
      await api.put("/admin/config-email", {
        emailAquatubo: emailAqua, emailAramburu: emailAram, emailCC, nombreFirma: firmaNombre, telefonoFirma: firmaTel, activo: emailActivo
      });
      reload();
      alert("✓ Configuración de email guardada");
    } catch (e) { alert("Error: " + e.message); }
    finally { setGuardando(""); }
  };
  const cambiarPin = async () => {
    if (!/^\d{4,8}$/.test(pinNuevo)) return alert("El nuevo PIN debe ser de 4 a 8 dígitos");
    if (!confirm("¿Cambiar el PIN? Tendrás que volver a entrar con el nuevo.")) return;
    try {
      await api.post("/admin/cambiar-pin", { nuevoPin: pinNuevo });
      alert("✓ PIN cambiado. Volviendo al login.");
      onSalir();
    } catch (e) { alert("Error: " + e.message); }
  };

  return (
    <div className="space-y-4">
      {/* Datos cliente */}
      <div className="bg-white border-2 border-stone-900">
        <div className="bg-stone-900 text-amber-400 p-2 text-xs font-bold tracking-widest" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
          🏢 DATOS DE ARA CORPORATE (aparecen en cabecera de pedidos)
        </div>
        <div className="p-3 space-y-2 text-xs">
          {[
            ["Razón social", razon, setRazon],
            ["CIF", cif, setCif],
            ["Dirección", direccion, setDireccion],
            ["Teléfono", tel, setTel],
            ["Email", emailC, setEmailC],
            ["Forma de pago", pago, setPago],
          ].map(([lbl, v, setV]) => (
            <div key={lbl}>
              <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-0.5 block">{lbl.toUpperCase()}</label>
              <input type="text" value={v} onChange={(e) => setV(e.target.value)}
                     className="w-full border-2 border-stone-900 p-2 focus:bg-amber-50 focus:outline-none font-mono" />
            </div>
          ))}
          <button onClick={guardarDatos} disabled={guardando === "datos"}
                  className="bg-stone-900 text-amber-400 px-4 py-2 text-xs font-black tracking-widest border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900"
                  style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            {guardando === "datos" ? "..." : "💾 GUARDAR DATOS"}
          </button>
        </div>
      </div>

      {/* Email */}
      <div className="bg-white border-2 border-stone-900">
        <div className="bg-stone-900 text-amber-400 p-2 text-xs font-bold tracking-widest" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
          📧 ENVÍO DE PEDIDOS POR EMAIL
        </div>
        <div className="p-3 space-y-2 text-xs">
          <div className="text-[10px] text-stone-500 leading-relaxed bg-stone-50 p-2 border border-stone-300">
            Para activar el envío automático por email necesitas:
            <br />1) Crear cuenta en <strong>resend.com</strong> (gratis hasta 3.000 emails/mes)
            <br />2) Añadir su API key en Render → araujo-bot → Environment como <code className="bg-stone-200 px-1">ARA_RESEND_API_KEY</code>
            <br />3) Activar el switch de abajo
          </div>
          {[
            ["Email pedidos AQUATUBO", emailAqua, setEmailAqua],
            ["Email pedidos ARAMBURU", emailAram, setEmailAram],
            ["Email CC (copia)", emailCC, setEmailCC],
            ["Nombre firma", firmaNombre, setFirmaNombre],
            ["Teléfono firma", firmaTel, setFirmaTel],
          ].map(([lbl, v, setV]) => (
            <div key={lbl}>
              <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-0.5 block">{lbl.toUpperCase()}</label>
              <input type="text" value={v} onChange={(e) => setV(e.target.value)}
                     className="w-full border-2 border-stone-900 p-2 focus:bg-amber-50 focus:outline-none font-mono" />
            </div>
          ))}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={emailActivo} onChange={(e) => setEmailActivo(e.target.checked)} />
            <span className="font-bold">Envío de email activado</span>
          </label>
          <button onClick={guardarEmail} disabled={guardando === "email"}
                  className="bg-stone-900 text-amber-400 px-4 py-2 text-xs font-black tracking-widest border-2 border-stone-900 hover:bg-amber-400 hover:text-stone-900"
                  style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            {guardando === "email" ? "..." : "💾 GUARDAR EMAIL"}
          </button>
        </div>
      </div>

      {/* Cambiar PIN */}
      <div className="bg-white border-2 border-stone-900">
        <div className="bg-red-600 text-white p-2 text-xs font-bold tracking-widest" style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
          🔐 CAMBIAR PIN ADMIN
        </div>
        <div className="p-3 space-y-2 text-xs">
          <div>
            <label className="text-[10px] tracking-widest font-bold text-stone-700 mb-0.5 block">NUEVO PIN (4-8 dígitos)</label>
            <input type="password" value={pinNuevo} onChange={(e) => setPinNuevo(e.target.value)}
                   maxLength={8}
                   className="w-full border-2 border-stone-900 p-2 focus:bg-amber-50 focus:outline-none font-mono" />
          </div>
          <button onClick={cambiarPin} disabled={pinNuevo.length < 4}
                  className={`px-4 py-2 text-xs font-black tracking-widest border-2 border-stone-900 ${
                    pinNuevo.length >= 4 ? "bg-red-600 text-white hover:bg-red-700" : "bg-stone-200 text-stone-400 cursor-not-allowed"
                  }`}
                  style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}>
            🔐 CAMBIAR PIN
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================
//  ROOT
// =========================================================
export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [, forceUpdate] = useState(0);
  const [cargando, setCargando] = useState(!datosCargados);
  const [adminPin, setAdminPin] = useState(null);
  const [vistaAdmin, setVistaAdmin] = useState(
    typeof window !== "undefined" && (
      window.location.search.includes("admin") ||
      window.location.hash.includes("admin")
    )
  );

  useEffect(() => {
    if (datosCargados) return;
    cargarDatosBackend().then(() => {
      setCargando(false);
      forceUpdate(n => n + 1);
    });
  }, []);

  if (cargando) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center font-mono p-6"
           style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(0,0,0,0.02) 30px, rgba(0,0,0,0.02) 31px)" }}>
        <div className="bg-amber-500 border-4 border-stone-900 p-6 shadow-[8px_8px_0_0_rgba(0,0,0,1)] max-w-md w-full text-center">
          <div className="text-[10px] tracking-[0.3em] mb-2">ARA CORPORATE</div>
          <h1 className="font-black text-3xl leading-none mb-3" style={{ fontFamily: "Archivo Black, Impact, sans-serif" }}>
            CARGANDO CATÁLOGO…
          </h1>
          <div className="flex items-center justify-center gap-1 my-4">
            <span className="w-2 h-2 bg-stone-900 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-stone-900 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-stone-900 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <div className="text-xs">Conectando con el sistema…</div>
        </div>
      </div>
    );
  }

  // Vista admin (con PIN o pidiendo PIN)
  if (vistaAdmin) {
    if (!adminPin) {
      return <PantallaLoginAdmin
        onLogin={(pin) => setAdminPin(pin)}
        onSalir={() => {
          setVistaAdmin(false);
          if (window.history && window.location.search.includes("admin")) {
            window.history.replaceState({}, "", window.location.pathname);
          }
        }}
      />;
    }
    return <PanelAdmin pin={adminPin} onSalir={() => {
      setAdminPin(null);
      setVistaAdmin(false);
      if (window.history && window.location.search.includes("admin")) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }} />;
  }

  // Vista operario normal
  if (!usuario) return <PantallaLogin onLogin={setUsuario} onAdminClick={() => setVistaAdmin(true)} />;
  return <CatalogoApp usuario={usuario} onLogout={() => setUsuario(null)} />;
}
