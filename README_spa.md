<p align="center">
  <img src="images/HYDRA_UMC_BANNER.svg" alt="HYDRA-UMC-DASHBOARD-AI banner" width="100%">
</p>

# 🧠 HYDRA-UMC-DASHBOARD-AI

<p align="center"><a href="README.md">🇺🇸 English</a> | 🇪🇸 <b>Español</b> | <a href="README_fra.md">🇫🇷 Français</a> | <a href="README_ita.md">🇮🇹 Italiano</a> | <a href="README_deu.md">🇩🇪 Deutsch</a> | <a href="README_zho.md">🇨🇳 简体中文</a> | <a href="README_jpn.md">🇯🇵 日本語</a></p>

### 📈 Extensión Analítica con IA para el Dashboard Web de STUDIO

<p align="left">
  <img src="https://img.shields.io/badge/Licencia-GPL%203.0-blue.svg" alt="GPL 3.0">
  <img src="https://img.shields.io/badge/Stack-React%20%2F%20Vite%20%2F%20TypeScript-61DAFB.svg" alt="React/Vite/TS">
  <img src="https://img.shields.io/badge/Feature-AI%20Insights-blueviolet.svg" alt="Insights">
</p>

---

## 1. 🛠️ VISIÓN TÉCNICA GENERAL

**HYDRA-UMC-DASHBOARD-AI** es el plugin analítico para la interfaz web de STUDIO. Mejora el dashboard estándar con insights de IA en tiempo real, análisis predictivo de tendencias y resaltado automático de anomalías.

Transforma datos brutos de telemetría en inteligencia accionable, ofreciendo a los operarios de planta "Resúmenes Inteligentes" del rendimiento de la flota, patrones de consumo energético y alertas de mantenimiento predictivo directamente en el navegador. Reutiliza el mismo stack que HYDRA-UMC-STUDIO (React 19 + Vite + TypeScript) en vez de introducir uno nuevo, de forma que a futuro pueda incrustarse como un panel dentro del propio STUDIO.

### Características Clave:
* 🧠 **Resúmenes Inteligentes (v0)** — estadísticas reales de mínimo/máximo/promedio/último valor/tendencia calculadas a partir del historial real de HYDRA-UMC-DATALAKE. *(implementado como estadísticas reales, todavía no un resumen generado por IA — ver COMPILACIÓN Y EJECUCIÓN abajo)*
* 🔒 **Verja de Proveedor de IA (v0)** — validación real de esquema de entrada/salida para la futura narrativa basada en LLM, más un respaldo estadístico real y honestamente etiquetado usado siempre que no hay proveedor de IA configurado o uno falla/devuelve salida no estructurada. *(implementado y conectado al panel de Resumen de Tendencia hoy; un proveedor real basado en LLM está planeado)*
* 🛡️ **Verja de Contrato Externo (v0)** — valida cada respuesta de Datalake y del servicio de anomalías antes de que un panel calcule o la muestre; rechaza números, flags, identificadores sobredimensionados y caracteres de control no seguros malformados. *(implementado; ver [`docs/SECURITY.md`](docs/SECURITY.md))*
* 📈 **Predicción de Tendencias** — un modelo de predicción real, más allá del indicador de dirección real-pero-simple de v0. *(planeado)*
* 🚨 **Resaltado de Anomalías (v0)** — comprueba las muestras reales más recientes contra una línea base real ya ajustada de HYDRA-UMC-ANOMALY-DETECTOR. *(implementado como un panel de texto real; superponerlo en la vista 3D de STUDIO está planeado)*
* 🛠️ **Consejos de Optimización** — sugiere cambios de parámetros para mejorar el tiempo de ciclo o la vida útil de los motores. *(planeado)*
* ✅ **Andamiaje del toolchain** — una aplicación React/Vite/TypeScript real que compila limpio con `tsc --noEmit` y sirve con Vite. *(implementado — ver COMPILACIÓN Y EJECUCIÓN abajo)*

---

## 2. 🔄 FLUJO DE DASHBOARD AI

```mermaid
flowchart LR
    STUDIO["HYDRA-UMC-STUDIO"] --> DASH_AI["DASHBOARD-AI (Plugin)"]
    LAKE["HYDRA-UMC-DATALAKE"] --> ANALY["Motor de Análisis IA"]
    ANALY --> DASH_AI
    DASH_AI --> INSIGHTS["Widgets y Alertas Inteligentes"]
    INSIGHTS --> OPERATOR["Vista en el Navegador"]
```

---

## 3. 🧱 ARQUITECTURA Y DECISIONES DE DISEÑO

* **Por qué es un proyecto Node/TS, no uno en Python como los otros proyectos afines a IA.** Es una extensión directa del propio frontend React/Vite de HYDRA-UMC-STUDIO, no un servicio de IA independiente - igualar el propio stack de STUDIO (en vez del stack Python de HYDRA-UMC-COGNITIVE-NODE) es lo que le permite montarse de verdad como un panel real de STUDIO más adelante, no una app aparte a la que los usuarios tengan que cambiar.
* **Por qué es hermano de STUDIO, no una carpeta dentro de él.** Mantener esto como su propio repo/build permite que la capa de dashboard de IA se versione y publique de forma independiente al propio calendario de lanzamientos de control de robots de STUDIO - el mismo motivo que en su día separó a HYDRA-UMC-SERVER de STUDIO.
* **Por qué el punto de entrada solo imprime identidad/versión/rol hoy.** Etapa de andamiaje: probar que el paquete compila limpiamente precede a los paneles reales del dashboard.
* **Cómo encaja en el resto del ecosistema.** Extiende HYDRA-UMC-STUDIO con información impulsada por IA, respaldada por HYDRA-UMC-COGNITIVE-NODE - la superficie visual de lo que esa capa cognitiva realmente decide.
* **Por qué el panel de Comprobación de Anomalías comprueba `/stats` antes de ofrecer puntuar nada.** El propio detector de HYDRA-UMC-ANOMALY-DETECTOR es una única línea base compartida, ajustada en memoria (ver el propio `api.py` de ese proyecto) - este dashboard deliberadamente no gestiona su ajuste (mutar el estado compartido del detector desde un dashboard orientado a lectura sería un acoplamiento real indebido). Un estado real de "todavía no ajustado" se muestra exactamente como tal, no se mezcla con un error genérico.
* **Por qué el Resumen de Tendencias reporta "dirección", no una predicción.** Un signo real de delta primero-a-último (con un pequeño umbral de ruido relativo para que una señal plana no parpadee entre "sube"/"baja") es honesto sobre lo que v0 realmente calcula - un modelo de predicción real es trabajo futuro real y separado, no algo que fingir con una extrapolación lineal disfrazada de "predicción".
* **Por qué `safeGenerateNarrative()` valida la petición pero nunca lanza excepción por una respuesta mala.** Una petición malformada es un bug real de conexionado en este código - no hay un resumen al que recurrir honestamente, así que se le permite lanzar excepción. Una respuesta *malformada/no estructurada* de un proveedor es un hecho de la vida para cualquier API externa real - ese camino siempre degrada al respaldo estadístico real en vez de romper el panel, porque quien llama ya tiene todo lo que necesita (el resumen real) para decir algo verdadero.
* **Por qué `NO_PROVIDER_CONFIGURED` reutiliza `summary.ts` en vez de una implementación de respaldo separada.** Una segunda fórmula de "narrativa de respaldo" independiente se desincronizaría de las estadísticas reales en las que el panel ya confía y que ya muestra numéricamente - reutilizar los mismos valores de `TrendSummary` mantiene la narrativa de respaldo demostrablemente consistente con los números justo al lado.

---

## 📂 ESTRUCTURA DE DIRECTORIOS

Aplicación puramente software — sin hardware, firmware ni sistema operativo propios; esas carpetas se omiten por política de estructura del repositorio.

```text
HYDRA-UMC-DASHBOARD-AI/
├── src/
│   ├── api/                 # Clientes HTTP reales: datalakeClient.ts, anomalyClient.ts
│   ├── lib/
│   │   ├── summary.ts        # Estadísticas reales de resumen de tendencias
│   │   └── aiProvider.ts     # Verja real de proveedor de IA: validación de esquema + respaldo honesto
│   ├── components/
│   │   ├── TrendSummaryPanel.tsx
│   │   └── AnomalyCheckPanel.tsx
│   ├── main.tsx              # Punto de entrada de la aplicación
│   ├── App.tsx                # Componente raíz - monta ambos paneles reales
│   ├── index.css              # Hoja de estilos base
│   └── vite-env.d.ts          # Tipado de VITE_DATALAKE_URL / VITE_ANOMALY_URL
├── tests/                   # Tests reales: round-trips HTTP + tests de componentes
├── scripts/
│   ├── bump-version.mjs    # Incremento de versión estilo cuentakilómetros (ejecutado por build)
│   ├── serve_static.py     # Servidor real de archivos estáticos para el SPA compilado en dist/ (hueco de despliegue en la CM5 encontrado en vivo)
│   └── test_serve_static.py # Tests reales para serve_static.py
├── systemd/
│   └── hydra-umc-dashboard-ai.service # Unidad systemd del servidor estático local en la CM5
├── tools/
│   ├── build_test.py       # Comprobación de compilación sin versionado
│   └── ci_validate.py      # Validación de manifiesto/CHANGELOG/docs usada por CI
├── docs/
│   └── SECURITY.md          # Contrato público de seguridad de contenido externo y despliegue
├── build/                  # Reservado para artefactos de release (dist/ está ignorado por git)
├── images/                 # Medios y diagramas
├── index.html              # HTML de entrada de Vite
├── vite.config.ts          # Configuración del bundler Vite + Vitest
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── bump_manifest_version.py # Sincroniza la versión de hydra-umc.project.json con la de package.json (--sync)
├── dev.sh / dev.bat        # Servidor de desarrollo real: instala deps + vite
├── build.sh / build.bat    # Build real: instala deps + suite de tests real + incrementa versión + tsc + vite build
└── package.json
```

---

## 4. ⚙️ COMPILACIÓN Y EJECUCIÓN

Requiere Node.js >= 20.

```bash
# Linux/macOS
./dev.sh      # instala dependencias, arranca el servidor de Vite en :5174
./build.sh    # instala deps, corre la suite de tests real, incrementa la versión, valida tipos, compila dist/

# Windows
dev.bat
build.bat
```

`npm run build` encadena `node scripts/bump-version.mjs && tsc --noEmit && vite build` — el incremento de versión solo ocurre una vez que la comprobación estricta de TypeScript ya ha pasado, así que un build roto nunca publica un número de versión incrementado. `npm run dev` arranca Vite en el puerto `5174` (separado del `5173` propio de HYDRA-UMC-STUDIO, para que ambos puedan correr a la vez). `npm test` corre la suite real de Vitest directamente.

Por defecto los dos paneles reales apuntan a `http://localhost:8095` (HYDRA-UMC-DATALAKE) y `http://localhost:8097` (HYDRA-UMC-ANOMALY-DETECTOR) - sobreescribible con `VITE_DATALAKE_URL`/`VITE_ANOMALY_URL` (definidas antes de `vite build`/`vite dev`, Vite las inserta en tiempo de build) para apuntar a un despliegue distinto.

Lee [`docs/SECURITY.md`](docs/SECURITY.md) antes de configurar esas URL visibles en el navegador o conectar un proveedor de IA real; define la validación de respuestas, seguridad de contenido, comportamiento ante fallos y la regla de no incluir secretos.

Cada fetch real de Resumen de Tendencia también corre la verja real de proveedor de IA. Sin proveedor real configurado (el default honesto de v0), el panel muestra el respaldo estadístico real, claramente etiquetado:

```ts
import { safeGenerateNarrative, NO_PROVIDER_CONFIGURED } from './lib/aiProvider'

const narrative = await safeGenerateNarrative(NO_PROVIDER_CONFIGURED, { sourceId, kind, field, summary })
// { narrative: "robot-1/motor_temp/value: 4 sample(s), ranging 10.00 to 50.00,
//    averaging 29.00, latest 36.00 (rising).", generatedBy: 'statistical-fallback' }
```

Un proveedor que lanza excepción, o devuelve una respuesta con `narrative` ausente o malformada, degrada a ese mismo respaldo real en vez de romper el panel o no mostrar nada.

---

## 🔗 Proyectos Relacionados

Este proyecto es parte del ecosistema de robótica HYDRA-UMC del mismo autor (JuanenRac / Electro Hobby 3D). Vale la pena conocerlo, ya que una petición podría en realidad ser sobre alguno de estos en vez de sobre este repositorio.

**Directamente Relacionados**
- **[HYDRA-UMC-STUDIO](https://github.com/JuanenRac/HYDRA-UMC-STUDIO)** — panel de control web con visualización 3D multi-robot en tiempo real — el panel que este proyecto extiende directamente.
- **[HYDRA-UMC-COGNITIVE-NODE](https://github.com/JuanenRac/HYDRA-UMC-COGNITIVE-NODE)** — nodo de integración para el pipeline cognitivo Hailo-10 (orquestación de LLM/VLA/voz) — el backend de IA que alimenta este panel.
- **[HYDRA-UMC-DATALAKE](https://github.com/JuanenRac/HYDRA-UMC-DATALAKE)** — almacén de series temporales real respaldado por sqlite3, con una API HTTP real de ingesta/consulta — el historial real del que el panel de Resúmenes Inteligentes calcula sus estadísticas.
- **[HYDRA-UMC-ANOMALY-DETECTOR](https://github.com/JuanenRac/HYDRA-UMC-ANOMALY-DETECTOR)** — detector de anomalías real basado en FFT + línea base estadística, con monitorización de deriva — la línea base ajustada contra la que el panel de Resaltado de Anomalías puntúa las muestras recientes.

**También Forma Parte del Ecosistema**

*Hardware y Plataforma Base*
- **[HYDRA-UMC](https://github.com/JuanenRac/HYDRA-UMC)** — la placa madre física del brazo robótico: host CM5 + coprocesador STM32H745 de doble núcleo, coordinando hasta 8 brazos herramienta por CAN-OTA/SPI-OTA.
- **[HYDRA-UMC-OS](https://github.com/JuanenRac/HYDRA-UMC-OS)** — capa de producto reproducible sobre Raspberry Pi OS para el CM5: agente de solo lectura, config/perfiles validados, aprovisionamiento WiFi de primer contacto.
- **[HYDRA-UMC-SDK](https://github.com/JuanenRac/HYDRA-UMC-SDK)** — el contrato JSON-Schema compartido y la barrera de seguridad contra la que cada bridge valida sus comandos.

*Backend Central y Clientes*
- **[HYDRA-UMC-SERVER](https://github.com/JuanenRac/HYDRA-UMC-SERVER)** — el backend headless real (REST/WebSocket) con el que habla de verdad cada cliente de control.
- **[HYDRA-UMC-SUITE](https://github.com/JuanenRac/HYDRA-UMC-SUITE)** — centro de mando de enjambre de escritorio (PySide6) para varios servidores a la vez, empaquetado como ejecutable independiente.
- **[HYDRA-UMC-ANDROID-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-ANDROID-CONTROL)** — app nativa de control para Android con inicio de sesión biométrico y un compañero Wear OS emparejado.
- **[HYDRA-UMC-IOS-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-IOS-CONTROL)** — app de control para iOS/iPadOS (Flutter) con sincronización en tiempo real por WebSocket.
- **[HYDRA-UMC-DSI](https://github.com/JuanenRac/HYDRA-UMC-DSI)** — interfaz táctil nativa para la pantalla táctil DSI de 7" a bordo, embebida en el propio CM5.
- **[HYDRA-UMC-EDITOR-URDF](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-URDF)** — creador/editor gráfico de URDF de escritorio que envía los modelos terminados al propio catálogo de STUDIO.
- **[HYDRA-UMC-BRIDGE-AMR](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-AMR)** — barrera de coordinación para flotas AGV/AMR mediante un publicador MQTT VDA 5050 real.
- **[HYDRA-UMC-BRIDGE-CNC](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-CNC)** — coordinador de alto nivel para celdas CNC con acceso real a estado/bytes de control GRBL.
- **[HYDRA-UMC-BRIDGE-DROIDS](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-DROIDS)** — barrera de coordinación para droides con patas/humanoides, con un emisor de comandos real para Boston Dynamics Spot.
- **[HYDRA-UMC-BRIDGE-LASER](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-LASER)** — coordinador de seguridad para celdas láser que lee 3 salvaguardas GPIO reales de llave/carcasa/enclavamiento.
- **[HYDRA-UMC-BRIDGE-OPENPNP](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-OPENPNP)** — coordinador de alto nivel seguro para el flujo de placas de pick-and-place OpenPnP.
- **[HYDRA-UMC-BRIDGE-PRINTER3D](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-PRINTER3D)** — barrera de coordinación segura para impresoras 3D Moonraker/Klipper, con comandos de trabajo reales y controlados.
- **[HYDRA-UMC-BRIDGE-ROS2](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-ROS2)** — coordinador de seguridad con un transporte ROS 2 rclpy real, importado de forma perezosa.
- **[HYDRA-UMC-BRIDGE-UAV](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-UAV)** — barrera de coordinación para UAV equipados con cámara, con un emisor de comandos MAVLink real.

*Plataforma de Herramientas URTC*
- **[URTC](https://github.com/JuanenRac/URTC)** — firmware para la placa física del Universal Robot Tool Controller, más de 25 perfiles de herramienta por bus CAN.
- **[URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER)** — herramienta de escritorio con GUI para flashear placas URTC, CAN-OTA más SWD/JTAG de chip completo.
- **[URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER)** — herramienta de escritorio de diagnóstico CAN-bus en vivo para placas URTC, un panel por perfil de herramienta.
- **[URTC-WEB-STUDIO](https://github.com/JuanenRac/URTC-WEB-STUDIO)** — alternativa basada en navegador a URTC-TESTER mediante la Web Serial API, sin instalación local.

*Nodo IA de Visión (Hailo-8)*
- **[HYDRA-UMC-VISION-NODE](https://github.com/JuanenRac/HYDRA-UMC-VISION-NODE)** — nodo de integración para el pipeline de visión Hailo-8, con una comprobación real de disponibilidad de hardware por etapa.
- **[HYDRA-UMC-DETECTION-HEF](https://github.com/JuanenRac/HYDRA-UMC-DETECTION-HEF)** — registro real de modelos compilados con verificación de carga segura por arquitectura Hailo/checksum.
- **[HYDRA-UMC-VISION-STREAMER](https://github.com/JuanenRac/HYDRA-UMC-VISION-STREAMER)** — generador real de pipeline GStreamer + config MediaMTX, con una frontera de integración HailoRT real.
- **[HYDRA-UMC-VISUAL-SERVOING-API](https://github.com/JuanenRac/HYDRA-UMC-VISUAL-SERVOING-API)** — ley de corrección real de Position-Based Visual Servoing, con puerta de seguridad según el estado de zona previo.
- **[HYDRA-UMC-SAFETY-ZONES](https://github.com/JuanenRac/HYDRA-UMC-SAFETY-ZONES)** — comprobación real de invasión de zona y solicitud de E-STOP, con exigencia de vigencia de calibración.

*Nodo IA Cognitivo (Hailo-10)*
- **[HYDRA-UMC-VLA-ENGINE](https://github.com/JuanenRac/HYDRA-UMC-VLA-ENGINE)** — codificación/decodificación real de tokens de acción y generación de trayectoria para un modelo Vision-Language-Action.
- **[HYDRA-UMC-VOICE-UI](https://github.com/JuanenRac/HYDRA-UMC-VOICE-UI)** — front-end de voz real (VAD + analizador de intención) con un relé a Watch acotado y con confirmación.
- **[HYDRA-UMC-SEMANTIC-PLANNER](https://github.com/JuanenRac/HYDRA-UMC-SEMANTIC-PLANNER)** — descomposición real de tareas basada en reglas y recuperación semántica de errores sobre códigos de error del MCU.
- **[HYDRA-UMC-DOCS-QA](https://github.com/JuanenRac/HYDRA-UMC-DOCS-QA)** — búsqueda real de documentos TF-IDF (solo librería estándar) sobre los propios documentos Markdown de este ecosistema.

*Orquestación y Enjambre*
- **[HYDRA-UMC-ORCHESTRATOR](https://github.com/JuanenRac/HYDRA-UMC-ORCHESTRATOR)** — nodo de integración con un contrato real de informe de salud gRPC/Protobuf y una máquina de estados de misión.
- **[HYDRA-UMC-JOB-DISPATCHER](https://github.com/JuanenRac/HYDRA-UMC-JOB-DISPATCHER)** — cola de trabajos real basada en prioridad con deduplicación, sobre una API HTTP real.
- **[HYDRA-UMC-NODE-HEALING](https://github.com/JuanenRac/HYDRA-UMC-NODE-HEALING)** — watchdog de salud de flota real basado en gRPC, con reintento/backoff y detección de discrepancia de identidad.
- **[HYDRA-UMC-PATH-PLANNER-3D](https://github.com/JuanenRac/HYDRA-UMC-PATH-PLANNER-3D)** — planificador de rutas 3D real basado en RRT, con validación real de colisión de obstáculos/espacio de trabajo.
- **[HYDRA-UMC-SWARM-SYNC](https://github.com/JuanenRac/HYDRA-UMC-SWARM-SYNC)** — sincronización de estado real mediante CRDT LWW-Element-Map, con pruebas de propiedades para convergencia multi-celda.

*Gemelo Digital y Simulación*
- **[HYDRA-UMC-TWIN](https://github.com/JuanenRac/HYDRA-UMC-TWIN)** — nodo de integración para el motor de gemelo digital, con un contrato real de sincronización por compatibilidad de versión.
- **[HYDRA-UMC-HIL-BRIDGE](https://github.com/JuanenRac/HYDRA-UMC-HIL-BRIDGE)** — enclavamiento de seguridad real hardware-in-the-loop que enruta comandos entre simulación y hardware real.
- **[HYDRA-UMC-PHYSICS-REPLICA](https://github.com/JuanenRac/HYDRA-UMC-PHYSICS-REPLICA)** — cinemática directa real y validación de límites articulares sobre un subconjunto real de URDF.
- **[HYDRA-UMC-SYNTHETIC-DATA-GEN](https://github.com/JuanenRac/HYDRA-UMC-SYNTHETIC-DATA-GEN)** — generador real de escenas 2D procedurales con exportación de anotaciones YOLO/COCO.

*Datos y Analítica*
- **[HYDRA-UMC-PRODUCTION-REPORTS](https://github.com/JuanenRac/HYDRA-UMC-PRODUCTION-REPORTS)** — cálculo real de OEE/disponibilidad sobre el histórico de DATALAKE, con exportación CSV reproducible.
- **[HYDRA-UMC-TELEMETRY-COLLECTOR](https://github.com/JuanenRac/HYDRA-UMC-TELEMETRY-COLLECTOR)** — pipeline real de ingesta CAN/WebSocket hacia DATALAKE, con deduplicación por secuencia.

*Pasarela Industrial*
- **[HYDRA-UMC-GATEWAY-INDUSTRIAL](https://github.com/JuanenRac/HYDRA-UMC-GATEWAY-INDUSTRIAL)** — nodo de integración que retransmite a protocolos industriales, con una capa real de lista blanca de comandos/contrapresión.
- **[HYDRA-UMC-OPCUA-SERVER](https://github.com/JuanenRac/HYDRA-UMC-OPCUA-SERVER)** — espacio de direcciones OPC-UA real, verificado con una sesión de cliente real del protocolo binario.
- **[HYDRA-UMC-MQTT-BROKER](https://github.com/JuanenRac/HYDRA-UMC-MQTT-BROKER)** — broker MQTT real con autenticación por cliente opcional y ACL de tópicos.
- **[HYDRA-UMC-MTCONNECT-ADAPTER](https://github.com/JuanenRac/HYDRA-UMC-MTCONNECT-ADAPTER)** — endpoints XML reales `/probe` y `/current` de MTConnect, con salida en modo degradado.

*Herramientas Complementarias y Operaciones del Ecosistema*
- **[HYDRA-UMC-TOOL-CLI](https://github.com/JuanenRac/HYDRA-UMC-TOOL-CLI)** — CLI de flota con un contrato real y estable de códigos de salida, cliente real y en vivo de la propia API de HYDRA-UMC-SERVER.
- **[HYDRA-UMC-WATCH](https://github.com/JuanenRac/HYDRA-UMC-WATCH)** — app compañera de WearOS con alertas hápticas reales y un relé de voz al teléfono emparejado.
- **[URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK)** — firmware para un rack de montaje de placas con decodificación real de ID de herramienta y lógica de precalentamiento Smart Idle.
- **[URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL)** — firmware más un compañero de visión real en Python para un cabezal de inspección térmica/RGB.
- **[HYDRA-UMC-UPDATER](https://github.com/JuanenRac/HYDRA-UMC-UPDATER)** — herramienta administrativa de escritorio que descubre, clona y actualiza cada repositorio de este ecosistema.


---

## 📚 Documentación y Comunidad

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — stack tecnológico y pautas de codificación para un pull request.
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — los estándares de comportamiento esperados en esta comunidad.
- **[SUPPORT.md](SUPPORT.md)** — dónde hacer preguntas y reportar errores.
- **[LICENSE.md](LICENSE.md)** — la licencia propia de este proyecto.

## 👤 AUTOR
**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)

## 📜 LICENCIA
GPL-3.0 - Ver LICENSE para más detalles.
