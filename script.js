/* ==========================================================================
   ESTADO GLOBAL Y CONFIGURACIÓN DE CATEGORÍAS
   ========================================================================== */

let usuarioActual = { nombre: "", codigoE: "" };
let listaGestiones = [];
let plantillaPendiente = null;
let fechaToaPorDefecto = "";
let franjaToaPorDefecto = "AM1";

const CATEGORIAS_CONFIG = {
  CONFIRMA: [
    { id: 'CONF_LLAMADA', nombre: 'Confirma visita en llamada' },
    { id: 'CONF_ADELANTO', nombre: 'Adelanto de visita' },
    { id: 'CONF_MANTIENE', nombre: 'Mantiene fecha programada' }
  ],
  CICLO: [
    { id: 'CICLO_CONTACTO', nombre: 'Ciclo de llamadas (Falta de contacto)' }
  ],
  REPROGRAMAR: [
    { id: 'REPRO_CLIENTE', nombre: 'Reprogramado por Cliente' },
    { id: 'REPRO_CLARO', nombre: 'Reprogramado por Claro' }
  ],
  RECHAZOS: [
    { id: 'RECH_NO_DESEA_MESA', nombre: 'Cliente no desea servicio (Mesa)' },
    { id: 'RECH_NO_DESEA_CAMPO', nombre: 'Cliente no desea servicio (Campo)' },
    { id: 'RECH_DUPLICIDAD', nombre: 'Por Duplicidad de SOT / Pedido' },
    { id: 'RECH_FACILIDADES', nombre: 'Sin Facilidades Técnicas' },
    { id: 'RECH_TITULARIDAD', nombre: 'Error de Titularidad / Datos' },
    { id: 'RECH_ZONA_PELIGROSA', nombre: 'Zona de alto riesgo / Inaccesible' }
  ]
};

/* ==========================================================================
   INICIALIZACIÓN Y EVENTOS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function() {
  cargarSesionGuardada();

  // Escuchar evento click directo sobre el botón "Ingresar"
  const btnIngresar = document.getElementById('btnIngresarLogin');
  if (btnIngresar) {
    btnIngresar.addEventListener('click', function(e) {
      e.preventDefault();
      iniciarSesion();
    });
  }

  // Permitir presionar "Enter" dentro de las casillas del Login sin recargar la página
  const inputE = document.getElementById('inputUsuarioE');
  if (inputE) {
    inputE.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        iniciarSesion();
      }
    });
  }

  document.getElementById('btnCerrarSesion')?.addEventListener('click', cerrarSesion);
  document.getElementById('btnProcesarTOA')?.addEventListener('click', procesarTextoTOA);
  document.getElementById('selectCategoria')?.addEventListener('change', actualizarSubcategorias);
  document.getElementById('selectSubcategoria')?.addEventListener('change', renderizarCamposDinamicos);
  document.getElementById('btnGenerarPlantilla')?.addEventListener('click', generarPlantilla);
  document.getElementById('btnCopiarPlantilla')?.addEventListener('click', copiarPlantilla);
  document.getElementById('btnGuardarBloc')?.addEventListener('click', intentarGuardarEnBloc);
  document.getElementById('btnExportarBloc')?.addEventListener('click', exportarBloc);

  document.getElementById('btnConfirmarDuplicado')?.addEventListener('click', confirmarAgregarDuplicado);
  document.getElementById('btnCancelarDuplicado')?.addEventListener('click', cancelarAgregarDuplicado);

  actualizarSubcategorias();
});

/* ==========================================================================
   GESTIÓN DE SESIÓN
   ========================================================================== */

function iniciarSesion() {
  const inputNombre = document.getElementById('inputNombreADP');
  const inputE = document.getElementById('inputUsuarioE');

  if (!inputNombre || !inputE) return;

  const nombre = inputNombre.value.trim();
  const codigoE = inputE.value.trim().toUpperCase();

  const regexE = /^E\d{6}$/;

  if (!nombre) {
    mostrarToast("⚠️ Por favor, ingresa tu nombre completo", "#dc3545");
    return;
  }
  if (!regexE.test(codigoE)) {
    mostrarToast("⚠️ El código debe empezar con 'E' seguido de 6 números (Ej: E750344)", "#dc3545");
    return;
  }

  usuarioActual = { nombre, codigoE };
  localStorage.setItem('adpNombre', nombre);
  localStorage.setItem('adpCodigoE', codigoE);

  const labelUser = document.getElementById('labelUsuario');
  if (labelUser) labelUser.innerText = `ADP: ${usuarioActual.nombre} (${usuarioActual.codigoE})`;

  const modalLogin = document.getElementById('loginModal');
  if (modalLogin) modalLogin.style.display = 'none';

  mostrarToast(`👋 ¡Bienvenido/a, ${nombre}!`);
}

function cargarSesionGuardada() {
  const n = localStorage.getItem('adpNombre');
  const e = localStorage.getItem('adpCodigoE');

  if (n && e) {
    usuarioActual = { nombre: n, codigoE: e };
    const inputNombre = document.getElementById('inputNombreADP');
    const inputE = document.getElementById('inputUsuarioE');
    if (inputNombre) inputNombre.value = n;
    if (inputE) inputE.value = e;

    const labelUser = document.getElementById('labelUsuario');
    if (labelUser) labelUser.innerText = `ADP: ${n} (${e})`;

    const modalLogin = document.getElementById('loginModal');
    if (modalLogin) modalLogin.style.display = 'none';
  } else {
    const modalLogin = document.getElementById('loginModal');
    if (modalLogin) modalLogin.style.display = 'flex';
  }
}

function cerrarSesion() {
  localStorage.removeItem('adpNombre');
  localStorage.removeItem('adpCodigoE');
  
  const labelUser = document.getElementById('labelUsuario');
  if (labelUser) labelUser.innerText = "ADP: No conectado";

  const modalLogin = document.getElementById('loginModal');
  if (modalLogin) modalLogin.style.display = 'flex';
}

/* ==========================================================================
   PROCESADOR DE TEXTO TOA (EXTRACCIÓN AUTOMÁTICA)
   ========================================================================== */

function procesarTextoTOA() {
  const text = document.getElementById('rawInput').value;

  if (!text.trim()) {
    mostrarToast("⚠️ Pega el texto extraído de TOA", "#dc3545");
    return;
  }

  // 1. EXTRAER SOT
  const sotMatch = text.match(/(?:SOT|sot|Nro SOT|N° SOT|Orden)\s*[:\t\r\n]*\s*(\d+)/i) || text.match(/\b\d{8,9}\b/);

  // 2. EXTRAER TELÉFONO
  const telMatch = text.match(/(?:Telefono|Telefono\s*Cliente|Contacto|Movil|Celular|Telefonos)\s*[:\t\r\n]*\s*(\d{7,9})/i) || text.match(/\b9\d{8}\b/);

  // 3. EXTRAER CLIENTE
  let cliente = "S/N";
  const clienteMatch = text.match(/Nombre\s*[:\t\r\n]+\s*([\s\S]*?)(?=\s*Tipo\s*de\s*Documento)/i);

  if (clienteMatch && clienteMatch[1]) {
    cliente = clienteMatch[1].replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  } else {
    const clienteFallback = text.match(/(?:CLIENTE|Abonado|Cliente)\s*[:\t\r\n]*\s*([A-ZÁÉÍÓÚÑa-zñáéíóú\s.,]+)(?=\r|\n|$)/i);
    if (clienteFallback && clienteFallback[1]) {
      cliente = clienteFallback[1].trim();
    }
  }

  if (/^(CLIENTE|NOMBRE|ABONADO|S\/N)$/i.test(cliente)) {
    cliente = "S/N";
  }

  // 4. EXTRAER CONTRATA
  let contrata = "SAVAL";
  const contrataDirectaMatch = text.match(/\b(?:INST|MANT|REVI|MANTENIMIENTO)\s+([A-Z0-9]+)/i);

  if (contrataDirectaMatch && contrataDirectaMatch[1]) {
    contrata = contrataDirectaMatch[1].toUpperCase().trim();
  } else {
    const detallesMatch = text.match(/Detalles?\s+de\s+actividad[\s\S]*?\n\s*([A-Z0-9]+)/i);
    if (detallesMatch && detallesMatch[1] && !/^(DETALLES|DATOS|VELASQUEZ|ORACLE)$/i.test(detallesMatch[1])) {
      contrata = detallesMatch[1].toUpperCase().trim();
    } else {
      const contrataFallback = actividadesYContratas(text);
      if (contrataFallback) contrata = contrataFallback;
    }
  }

  // 5. EXTRAER FECHA Y FRANJA HORARIA AUTOMÁTICAMENTE
  const fechaMatch = text.match(/(?:Fecha\s*de\s*Programacion|Fecha)\s*[:\t\r\n]*\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i) || text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);

  if (fechaMatch && fechaMatch[1]) {
    const partes = fechaMatch[1].split('/');
    if (partes.length === 3) {
      let dia = partes[0].padStart(2, '0');
      let mes = partes[1].padStart(2, '0');
      let anio = partes[2].length === 2 ? `20${partes[2]}` : partes[2];
      fechaToaPorDefecto = `${anio}-${mes}-${dia}`;
    }
  } else {
    fechaToaPorDefecto = new Date().toISOString().split('T')[0];
  }

  const franjaMatch = text.match(/\b(AM0|AM1|PM1|PM2|PM3)\b/i);
  if (franjaMatch) {
    franjaToaPorDefecto = franjaMatch[1].toUpperCase();
  } else {
    franjaToaPorDefecto = "AM1";
  }

  // Asignar los valores extraídos a las casillas de vista previa
  const sot = sotMatch ? (sotMatch[1] || sotMatch[0]) : "S/N";
  const telefono = telMatch ? (telMatch[1] || telMatch[0]) : "S/N";

  document.getElementById('pvSOT').value = sot;
  document.getElementById('pvTel').value = telefono;
  document.getElementById('pvCliente').value = cliente;
  document.getElementById('pvContrata').value = contrata;

  renderizarCamposDinamicos();
  mostrarToast("✅ Datos procesados correctamente");
}

function actividadesYContratas(textoCompleto) {
  const contratasConocidas = [
    "INSERTEL", "SAVAL", "DOMINION", "COBRA", "LIMA TEL", 
    "TELCOS", "COMFICA", "IIC", "CARLEI", "TELECOM", "EZENTIS", "CAM"
  ];
  
  const textoUpper = textoCompleto.toUpperCase();
  for (const c of contratasConocidas) {
    if (textoUpper.includes(c)) {
      return c;
    }
  }
  return null;
}

function obtenerClienteData() {
  return {
    sot: document.getElementById('pvSOT').value.trim() || "S/N",
    telefono: document.getElementById('pvTel').value.trim() || "S/N",
    cliente: document.getElementById('pvCliente').value.trim() || "S/N",
    contrata: document.getElementById('pvContrata').value.trim() || "SAVAL"
  };
}

/* ==========================================================================
   DYNAMIC FORM CONTROLS
   ========================================================================== */

function actualizarSubcategorias() {
  const cat = document.getElementById('selectCategoria').value;
  const subSelect = document.getElementById('selectSubcategoria');
  subSelect.innerHTML = '';

  if (CATEGORIAS_CONFIG[cat]) {
    CATEGORIAS_CONFIG[cat].forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.nombre;
      subSelect.appendChild(opt);
    });
  }

  renderizarCamposDinamicos();
}

function renderizarCamposDinamicos() {
  const subcat = document.getElementById('selectSubcategoria').value;
  const contenedor = document.getElementById('contenedorDinamico');
  contenedor.innerHTML = '';

  let html = '<div class="grid-2">';

  if (subcat.startsWith('CONF_')) {
    html += `
      <div>
        <label class="lbl-sm">Fecha de Visita</label>
        <input type="date" id="inputFecha">
      </div>
      <div>
        <label class="lbl-sm">Franja Horaria</label>
        <select id="selectFranja">
          <option value="AM0">AM0</option>
          <option value="AM1">AM1</option>
          <option value="PM1">PM1</option>
          <option value="PM2">PM2</option>
          <option value="PM3">PM3</option>
        </select>
      </div>
      <div style="grid-column: span 2;">
        <label class="lbl-sm">ID Llamada</label>
        <input type="text" id="inputIDLlamada" placeholder="Ej: 17909701296">
      </div>
    `;
  } else if (subcat === 'CICLO_CONTACTO') {
    html += `
      <div>
        <label class="lbl-sm">Ciclo Nro</label>
        <input type="text" id="inputCiclo" value="1">
      </div>
      <div>
        <label class="lbl-sm">Cant. Llamadas</label>
        <input type="text" id="inputCantLlamadas" value="4">
      </div>
      <div>
        <label class="lbl-sm">Sub-Motivo</label>
        <select id="selectSubmotivo">
          <option value="No contesta">No contesta</option>
          <option value="Buzón de voz">Buzón de voz</option>
          <option value="Número no existe">Número no existe</option>
          <option value="Apagado">Apagado</option>
          <option value="Corta llamada">Corta llamada</option>
        </select>
      </div>
      <div>
        <label class="lbl-sm">ID Llamada</label>
        <input type="text" id="inputIDLlamada" placeholder="Ej: 17909701296">
      </div>
    `;
  } else if (subcat.startsWith('REPRO_')) {
    const esClaro = subcat === 'REPRO_CLARO';
    html += `
      <div style="grid-column: span 2;">
        <label class="lbl-sm">Motivo Reprogramación</label>
        <select id="inputMotivoDetalle">
          ${esClaro ? `
            <option value="# Pérdida de fecha de agendamiento"># Pérdida de fecha de agendamiento</option>
            <option value="Errores en la generación de la SOT">Errores en la generación de la SOT</option>
            <option value="Inconvenientes con la contratista">Inconvenientes con la contratista</option>
            <option value="Configuraciones de TOA (OFSC)">Configuraciones de TOA (OFSC)</option>
          ` : `
            <option value="# Cambios en las fechas y franjas solicitadas"># Cambios en fechas/franjas solicitadas</option>
            <option value="Facilidades del cliente">Facilidades del cliente</option>
            <option value="Falta de contacto">Falta de contacto</option>
            <option value="Ausente">Ausente</option>
          `}
        </select>
      </div>
      <div>
        <label class="lbl-sm">Nueva Fecha</label>
        <input type="date" id="inputFecha">
      </div>
      <div>
        <label class="lbl-sm">Nueva Franja</label>
        <select id="selectFranja">
          <option value="AM0">AM0</option>
          <option value="AM1">AM1</option>
          <option value="PM1">PM1</option>
          <option value="PM2">PM2</option>
          <option value="PM3">PM3</option>
        </select>
      </div>
      <div>
        <label class="lbl-sm">ID Llamada</label>
        <input type="text" id="inputIDLlamada" placeholder="Ej: 17909701296">
      </div>
      <div>
        <label class="lbl-sm">Observación</label>
        <input type="text" id="inputObs" placeholder="Observaciones adicionales...">
      </div>
    `;
  } else if (subcat.startsWith('RECH_')) {
    html += `
      <div>
        <label class="lbl-sm">ID Llamada / Código</label>
        <input type="text" id="inputIDLlamada" placeholder="Ej: 17909701296">
      </div>
      <div>
        <label class="lbl-sm">SOT Duplicada / Detalle</label>
        <input type="text" id="inputDetalleRechazo" placeholder="Ej: SOT duplicada 12345 / Sin facilidades">
      </div>
      <div style="grid-column: span 2;">
        <label class="lbl-sm">Sustento / Observación</label>
        <input type="text" id="inputObs" placeholder="Motivo detallado del rechazo...">
      </div>
    `;
  }

  html += '</div>';
  contenedor.innerHTML = html;

  // Carga automática de Fecha y Franja extraídas
  const inputFecha = document.getElementById('inputFecha');
  if (inputFecha) {
    inputFecha.value = fechaToaPorDefecto || new Date().toISOString().split('T')[0];
  }

  const selectFranja = document.getElementById('selectFranja');
  if (selectFranja && franjaToaPorDefecto) {
    selectFranja.value = franjaToaPorDefecto;
  }
}

/* ==========================================================================
   HELPERS & GENERACIÓN DE PLANTILLAS
   ========================================================================== */

function v(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function obtenerFechaYFranjaFormateada() {
  const rawFecha = v('inputFecha');
  const franja = v('selectFranja');
  
  if (!rawFecha) return `XX/XX ${franja}`.trim();

  const partes = rawFecha.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]} ${franja}`;
  }
  return `${rawFecha} ${franja}`;
}

function generarPlantilla() {
  if (!usuarioActual.nombre) {
    mostrarToast("⚠️ Debes iniciar sesión primero", "#dc3545");
    const modalLogin = document.getElementById('loginModal');
    if (modalLogin) modalLogin.style.display = 'flex';
    return;
  }

  const clienteData = obtenerClienteData();
  const subcat = document.getElementById('selectSubcategoria').value;
  const idLlamada = v('inputIDLlamada') || "S/N";
  const fechaVisita = obtenerFechaYFranjaFormateada();
  const obs = v('inputObs') || "SIN OBSERVACIONES";
  const motivoDetalle = v('inputMotivoDetalle');
  const detalleRechazo = v('inputDetalleRechazo');
  const realizadorCompleto = `${usuarioActual.nombre.toUpperCase()} - ADP MULTISKILL HITSS`;

  let p = "";

  switch (subcat) {
    case 'CONF_LLAMADA':
      p = `MESA MULTISKILL HITSS - CONFIRMA VISITA\nSOT: ${clienteData.sot}\nDÍA Y FRANJA: ${fechaVisita}\nCLIENTE: ${clienteData.cliente}\nNUMERO: ${clienteData.telefono}\nCONTRATA: ${clienteData.contrata}\nID DE LLAMADA: ${idLlamada}\nREALIZADO POR: ${usuarioActual.nombre.toUpperCase()}`;
      break;
    case 'CONF_ADELANTO':
      p = `MESA MULTISKILL HITSS - ADELANTA VISITA\nSOT: ${clienteData.sot}\nDÍA Y FRANJA: ${fechaVisita}\nCLIENTE: ${clienteData.cliente}\nNUMERO: ${clienteData.telefono}\nCONTRATA: ${clienteData.contrata}\nID DE LLAMADA: ${idLlamada}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'CONF_MANTIENE':
      p = `MESA MULTISKILL HITSS - MANTIENE FECHA DE VISITA\nSOT: ${clienteData.sot}\nDÍA Y FRANJA: ${fechaVisita}\nCLIENTE: ${clienteData.cliente}\nNUMERO: ${clienteData.telefono}\nCONTRATA: ${clienteData.contrata}\nID DE LLAMADA: ${idLlamada}\nREALIZADO POR: ${usuarioActual.nombre.toUpperCase()}`;
      break;
    case 'CICLO_CONTACTO':
      p = `MESA MULTISKILL HITSS - CICLO DE LLAMADAS\nCICLO DE LLAMADA NRO: ${v('inputCiclo') || '1'}\nCANTIDAD DE LLAMADAS: ${v('inputCantLlamadas') || '4'}\nNUMERO: ${clienteData.telefono}\nMOTIVO: FALTA DE CONTACTO\nSUB-MOTIVO: ${v('selectSubmotivo')}\nID DE LLAMADA: ${idLlamada}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'REPRO_CLIENTE':
      p = `MESA MULTISKILL HITSS\nREPROGRAMADO EN MESA / REAGENDADO POR CLIENTE\nMOTIVO DE REPROGRAMACIÓN: CLIENTE ${motivoDetalle}\nCLIENTE: ${clienteData.cliente}\nTELÉFONO: ${clienteData.telefono}\nNUEVA FECHA Y FRANJA DE VISITA: ${fechaVisita}\nOBSERVACIÓN: ${obs}\nCONTRATA: ${clienteData.contrata}\nREALIZADO POR: ${realizadorCompleto}\nCÓD LLAMADA: ${idLlamada}`;
      break;
    case 'REPRO_CLARO':
      p = `MESA MULTISKILL HITSS\nREPROGRAMADO EN MESA / REAGENDADO POR CLARO\nMOTIVO DE REPROGRAMACIÓN: CLARO ${motivoDetalle}\nCLIENTE: ${clienteData.cliente}\nTELÉFONO: ${clienteData.telefono}\nNUEVA FECHA Y FRANJA DE VISITA: ${fechaVisita}\nOBSERVACIÓN: ${obs}\nCONTRATA: ${clienteData.contrata}\nREALIZADO POR: ${realizadorCompleto}\nCÓD LLAMADA: ${idLlamada}`;
      break;
    case 'RECH_NO_DESEA_MESA':
      p = `MESA MULTISKILL HITSS - RECHAZO EN MESA\nMOTIVO: CLIENTE NO DESEA EL SERVICIO\nSOT: ${clienteData.sot}\nCLIENTE: ${clienteData.cliente}\nTELÉFONO: ${clienteData.telefono}\nCONTRATA: ${clienteData.contrata}\nSUSTENTO: ${obs}\nID LLAMADA: ${idLlamada}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'RECH_NO_DESEA_CAMPO':
      p = `MESA MULTISKILL HITSS - RECHAZO EN CAMPO\nMOTIVO: CLIENTE CANCELA EN DOMICILIO / NO DESEA\nSOT: ${clienteData.sot}\nCLIENTE: ${clienteData.cliente}\nTELÉFONO: ${clienteData.telefono}\nCONTRATA: ${clienteData.contrata}\nOBSERVACIÓN: ${obs}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'RECH_DUPLICIDAD':
      p = `MESA MULTISKILL HITSS - RECHAZO POR DUPLICIDAD\nSOT A CANCELAR: ${clienteData.sot}\nDETALLE / SOT DUPLICADA: ${detalleRechazo}\nCLIENTE: ${clienteData.cliente}\nOBSERVACIÓN: ${obs}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'RECH_FACILIDADES':
      p = `MESA MULTISKILL HITSS - RECHAZO TÉCNICO\nMOTIVO: SIN FACILIDADES TÉCNICAS\nSOT: ${clienteData.sot}\nCLIENTE: ${clienteData.cliente}\nCONTRATA: ${clienteData.contrata}\nDETALLE TÉCNICO: ${detalleRechazo || obs}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'RECH_TITULARIDAD':
      p = `MESA MULTISKILL HITSS - RECHAZO DATOS / TITULARIDAD\nSOT: ${clienteData.sot}\nCLIENTE: ${clienteData.cliente}\nSUSTENTO: ${obs}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'RECH_ZONA_PELIGROSA':
      p = `MESA MULTISKILL HITSS - RECHAZO COBERURA / ZONA RIESGO\nSOT: ${clienteData.sot}\nCLIENTE: ${clienteData.cliente}\nCONTRATA: ${clienteData.contrata}\nOBSERVACIÓN: ZONA PELIGROSA / SIN ACCESO - ${obs}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
  }

  document.getElementById('outputPlantilla').value = p;
}

/* ==========================================================================
   FUNCIÓN DE NOTIFICACIÓN FLOTANTE (TOAST DE 3 SEGUNDOS)
   ========================================================================== */

let toastTimeout;

function mostrarToast(mensaje, color = "#28a745") {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;

  clearTimeout(toastTimeout);

  toast.innerText = mensaje;
  toast.style.backgroundColor = color;
  toast.classList.add('show');

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function copiarPlantilla() {
  const area = document.getElementById('outputPlantilla');
  if (!area || !area.value.trim()) {
    mostrarToast("⚠️ Genera una plantilla antes de copiar", "#dc3545");
    return;
  }

  const textoLimpio = area.value.replace(/\r?\n/g, "\r\n").replace(/\u200B/g, "");

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textoLimpio).catch(() => {
      copiarFallback(textoLimpio);
    });
  } else {
    copiarFallback(textoLimpio);
  }

  mostrarToast("📋 ¡Plantilla copiada correctamente!");
}

function copiarFallback(texto) {
  const tempInput = document.createElement("textarea");
  tempInput.value = texto;
  tempInput.style.position = "fixed";
  tempInput.style.left = "-9999px";
  document.body.appendChild(tempInput);
  
  tempInput.select();
  try {
    document.execCommand("copy");
  } catch (err) {
    console.error("Error al copiar");
  }
  document.body.removeChild(tempInput);
}

/* ==========================================================================
   BLOC DE NOTAS Y ADVERTENCIA DE DUPLICADOS
   ========================================================================== */

function intentarGuardarEnBloc() {
  const plantillaGen = document.getElementById('outputPlantilla').value.trim();
  if (!plantillaGen) {
    mostrarToast("⚠️ Genera una plantilla primero", "#dc3545");
    return;
  }

  const esDuplicado = listaGestiones.some(g => g.plantilla === plantillaGen);

  if (esDuplicado) {
    plantillaPendiente = plantillaGen;
    const modalDup = document.getElementById('duplicateModal');
    if (modalDup) modalDup.style.display = 'flex';
  } else {
    guardarEnBlocDirecto(plantillaGen);
  }
}

function confirmarAgregarDuplicado() {
  if (plantillaPendiente) {
    guardarEnBlocDirecto(plantillaPendiente);
    plantillaPendiente = null;
  }
  const modalDup = document.getElementById('duplicateModal');
  if (modalDup) modalDup.style.display = 'none';
}

function cancelarAgregarDuplicado() {
  plantillaPendiente = null;
  const modalDup = document.getElementById('duplicateModal');
  if (modalDup) modalDup.style.display = 'none';
}

/* ==========================================================================
   FUNCIÓN PARA LIMPIAR TODOS LOS CAMPOS AUTOMÁTICAMENTE
   ========================================================================== */

function limpiarTodosLosCampos() {
  const rawInput = document.getElementById('rawInput');
  if (rawInput) rawInput.value = '';

  document.getElementById('pvSOT').value = '';
  document.getElementById('pvTel').value = '';
  document.getElementById('pvCliente').value = '';
  document.getElementById('pvContrata').value = '';

  const inputIDLlamada = document.getElementById('inputIDLlamada');
  if (inputIDLlamada) inputIDLlamada.value = '';

  const inputObs = document.getElementById('inputObs');
  if (inputObs) inputObs.value = '';

  const inputDetalleRechazo = document.getElementById('inputDetalleRechazo');
  if (inputDetalleRechazo) inputDetalleRechazo.value = '';

  const outputPlantilla = document.getElementById('outputPlantilla');
  if (outputPlantilla) outputPlantilla.value = '';
}

/* ==========================================================================
   GUARDAR EN BLOC Y LIMPIAR
   ========================================================================== */

function guardarEnBlocDirecto(textoPlantilla) {
  const clienteDataActual = obtenerClienteData();
  const item = {
    id: listaGestiones.length + 1,
    sot: clienteDataActual.sot,
    telefono: clienteDataActual.telefono,
    plantilla: textoPlantilla
  };

  listaGestiones.push(item);
  renderizarBloc();
    
  mostrarToast("💾 ¡Plantilla guardada en el Bloc de Notas!");
  limpiarTodosLosCampos();
}

function renderizarBloc() {
  const container = document.getElementById('blocNotasView');
  if (!container) return;

  if (listaGestiones.length === 0) {
    container.innerText = "Aún no hay registros guardados hoy.";
    return;
  }

  let textContent = "";
  listaGestiones.forEach(g => {
    textContent += `${g.id}.\nNumero SOT: ${g.sot}\nTelefono: ${g.telefono}\nPlantilla generada:\n${g.plantilla}\n\n**********\n\n`;
  });

  container.innerText = textContent;
}

function exportarBloc() {
  if (listaGestiones.length === 0) {
    mostrarToast("⚠️ No hay registros en el bloc para exportar", "#dc3545");
    return;
  }
  const container = document.getElementById('blocNotasView');
  if (!container) return;

  const text = container.innerText;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Registro_Gestiones_${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
}
