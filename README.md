# ARA Catálogo — App de pedidos de obra

App web interna para que los operarios de **ARA Corporate** pidan materiales con comparativa de precios entre **Aquatubo SL** y **Aramburu Guzmán SLU**.

---

## 🚀 OPCIÓN A: Probarla en local (en tu Mac)

```bash
cd ara-catalogo
npm install
npm run dev
```

Se abre en `http://localhost:5173`. Para parar: `Ctrl+C`.

---

## 🌍 OPCIÓN B: Subirla a internet (URL pública)

Para que tus operarios la abran desde el móvil en obra, hay que subirla a un servicio de hosting. Te dejo configurados los 3 más típicos.

### B1) Render.com — paso a paso

⚠️ **Aviso**: Render gratis pone la web a "dormir" tras 15 minutos sin tráfico. Cuando alguien entra después, tarda ~30 segundos en despertar. Si esto te molesta, usa Vercel (B2).

**1. Crea cuenta en GitHub** (si no tienes)
   - Ve a [github.com](https://github.com) y regístrate con tu email.

**2. Sube el proyecto a GitHub**

   Abre Terminal en la carpeta `ara-catalogo`:

   ```bash
   cd ara-catalogo
   git init
   git add .
   git commit -m "primer despliegue"
   ```

   Luego en GitHub: botón verde **"New repository"** → nombre `ara-catalogo` → **Create repository**.

   Vuelve a Terminal y pega los 3 comandos que GitHub te muestra (algo como):

   ```bash
   git remote add origin https://github.com/TU-USUARIO/ara-catalogo.git
   git branch -M main
   git push -u origin main
   ```

**3. Conectar Render con GitHub**

   - Ve a [render.com](https://render.com) y regístrate (con tu cuenta de GitHub para que sea más fácil).
   - En el dashboard pulsa **"New +"** → **"Static Site"**.
   - Render te pedirá conectar tu GitHub. Autorízalo.
   - Selecciona el repositorio `ara-catalogo`.

**4. Configurar el deploy**

   Render leerá automáticamente el archivo `render.yaml` que ya te he dejado, así que verás los campos rellenos:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

   Solo tienes que pulsar **"Create Static Site"**.

**5. Esperar ~3 minutos**

   Render hace `npm install`, `npm run build` y despliega. Cuando termine te dará una URL tipo:

   ```
   https://ara-catalogo.onrender.com
   ```

   Esa URL es la que envías a tus operarios. Cualquier móvil con internet la abre.

**6. Actualizaciones futuras**

   Cada vez que cambies algo (productos, precios, etc.):

   ```bash
   git add .
   git commit -m "actualizo precios marzo"
   git push
   ```

   Render redespliega automáticamente en 2-3 minutos.

---

### B2) Vercel.com (recomendada — más rápida y sin dormir)

Igual que Render pero la web no duerme nunca y deploya en 30 segundos:

1. Sube el proyecto a GitHub (igual que en B1, paso 2).
2. Ve a [vercel.com](https://vercel.com) → regístrate con GitHub.
3. **"Add New Project"** → selecciona `ara-catalogo` → **Deploy**.
4. Listo. URL tipo `https://ara-catalogo.vercel.app`.

El archivo `vercel.json` ya está configurado.

---

### B3) Netlify.com (alternativa, también buena)

1. Sube a GitHub (igual que arriba).
2. Ve a [netlify.com](https://netlify.com) → **"Add new site"** → **Import from Git**.
3. Selecciona el repo. URL tipo `https://ara-catalogo.netlify.app`.

El archivo `netlify.toml` ya está configurado.

---

## 📦 Estructura del proyecto

```
ara-catalogo/
├── package.json           ← dependencias
├── vite.config.js         ← config Vite
├── tailwind.config.js     ← config Tailwind
├── postcss.config.js
├── render.yaml            ← config para Render
├── vercel.json            ← config para Vercel
├── netlify.toml           ← config para Netlify
├── index.html             ← HTML base
├── README.md              ← este archivo
└── src/
    ├── main.jsx           ← entry point
    ├── App.jsx            ← TODO el código (componentes + catálogo)
    └── index.css          ← estilos Tailwind
```

Todo el código está en `src/App.jsx`. Dentro encontrarás:

- **`OBRAS`** — array de obras activas
- **`OPERARIOS`** — array de operarios
- **`CATALOGO`** — los 168 productos con sus precios
- **`FAMILIAS`** — categorías de filtrado
- Componentes: `PantallaLogin`, `CardProducto`, `CatalogoApp`

---

## ✏️ Cómo añadir o modificar productos

Edita `src/App.jsx`. Cada producto sigue este formato:

```js
{
  id: "mc-codo-25",
  desc: "Codo multicapa 25",
  familia: "Multicapa",
  unidad: "uni",
  img: "mcap",
  proveedores: {
    aqua: { ref: "25742", bruto: 10.82, dto: 73, marca: "MT" },
    aram: { ref: "MCCDO25", bruto: 7.45, dto: 50, marca: "FE" },
  }
}
```

- Si un producto solo lo tiene **uno** de los proveedores, omite la otra clave
- `bruto` = PVP de tarifa (lo que sale en la columna "Precio" de la factura)
- `dto` = % de descuento pactado (columna "%Dto")
- El **precio neto** se calcula automáticamente con `bruto × (1 − dto/100)`

Al guardar el archivo en local con `npm run dev`, Vite recarga la web automáticamente. En producción (Render/Vercel/Netlify), recuerda hacer `git push` para que se redespliegue.

---

## 🎨 Tipos de imagen disponibles para `img`

`valvula`, `fitting`, `fitting-pe`, `te`, `codo`, `machon`, `tapon`, `reduccion`, `filtro`, `tubo-pex`, `tubo-pe`, `tubo-pvc`, `te-pvc`, `codo-pvc`, `reduc-pvc`, `electro`, `cobre`, `mcap`, `bateria`, `latiguillo`, `aislamiento`, `abrazadera`

---

## 📝 Notas importantes

- Esta es una **demo interna**. No envía pedidos reales a los proveedores.
- Los precios y descuentos provienen de las facturas reales recibidas entre **oct/2025 y abr/2026**.
- Si un proveedor cambia tarifa, hay que actualizar `bruto` y/o `dto` manualmente en `App.jsx`.
- La app NO requiere login real (sin contraseñas), solo selecciona quién eres + en qué obra estás.

## 🆘 Si algo falla en local

- **`command not found: npm`** → instala Node.js desde [nodejs.org](https://nodejs.org/) (versión LTS).
- **`EACCES permission denied`** en npm install → prueba con `sudo npm install`.
- **El navegador no se abre solo** → ve manualmente a `http://localhost:5173`.
- **Render: build failed** → comprueba que has subido `package.json` y `package-lock.json` al repo.
