# Production Line Live

App web para digitalizar un juego físico de línea de producción con LEGO.

Los estudiantes arman físicamente productos **Bicolor**, **Amarillo** y **Rojo** en el aula. La app registra pedidos, tiempos por estación, calidad, errores y entregas para mostrar un dashboard en vivo.

## Pantallas incluidas

- `/` — ingreso de estudiante/profesor con sala, equipo, ronda y rol.
- `/play` — pantalla del estudiante según rol.
- `/dashboard` — tablero en vivo para proyectar.
- `/admin` — reiniciar ronda y cargar programas 4:2:2 o 8:4:4.

## Stack

- Next.js
- React
- Supabase
- Vercel

## 1. Crear base de datos en Supabase

1. Entra a Supabase y crea un proyecto.
2. Ve a **SQL Editor**.
3. Copia y ejecuta el archivo:

```txt
supabase/schema.sql
```

4. Ve a **Project Settings > API**.
5. Copia:
   - Project URL
   - anon public key

## 2. Configurar variables locales

Crea un archivo `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY
```

## 3. Ejecutar localmente

```bash
npm install
npm run dev
```

Luego abre:

```txt
http://localhost:3000
```

## 4. Publicar en Vercel

1. Sube este proyecto a GitHub.
2. En Vercel, crea un nuevo proyecto desde ese repositorio.
3. Agrega las variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.
5. Vercel te dará un link público, por ejemplo:

```txt
https://production-line-live.vercel.app
```

## Flujo sugerido en clase

1. El profesor proyecta `/dashboard`.
2. Los estudiantes entran al link desde su celular.
3. Cada estudiante coloca código de sala, equipo, ronda y rol.
4. El cliente crea pedidos.
5. Montaje 1 y Montaje 2 registran inicio/fin.
6. Calidad marca OK o Error.
7. Despacho marca Entregado.
8. El dashboard muestra pedidos, WIP, errores, tiempo promedio y cuello de botella.

## Importante

Este esquema permite lectura y escritura con la clave pública de Supabase porque está pensado para un prototipo en aula. Para una versión formal, conviene agregar autenticación, roles y políticas de seguridad más estrictas.
