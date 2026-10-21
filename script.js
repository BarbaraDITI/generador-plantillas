/* ==========================================================================
   1. ESTADO GLOBAL Y CONFIGURACIÓN DE CATEGORÍAS
   ========================================================================== */

let usuarioActual = { nombre: "", codigoE: "" };
let listaGestiones = [];
let plantillaPendiente = null;
let fechaToaPorDefecto = "";
let franjaToaPorDefecto = "AM1";

// Variables extraídas de TOA para Fuera de TOA y Habilitar Franja
let planoExtraido = "S/N";
let subTipoExtraido = "S/N";
let codClienteExtraido = "S/N";
let direccionExtraida = "S/N";
let distritoExtraido = "S/N";

const SUBMOTIVOS_RECHAZO = {
  RECH_NO_DESEA_MESA: [
    "Cliente ya tiene servicio de otro operador",
    "Titular no ha contratado ningun servicio a Claro",
    "Demora en la atención de la solicitud, ya no desea esperar.",
    "Cliente no desea servicio por Motivos personales."
  ],
  RECH_FACILIDADES: [
    "Dueño de Casa y/o Edificio no autoriza la instalacion.",
    "Al momento de la instalación no hay acceso al techo",
    "Al momento de la instalación se valida ducterias obstruidas",
    "Cliente cuenta con sot de suspensión y/o baja"
  ],
  RECH_DIRECCION: [
    "Dirección registrada en el sistema es errada. (numero, lt, mz, nombre calle, distrito)"
  ],
  RECH_OFERTA: [
    "Tecnología incorrecta FTTH/HFC/OVERLAP Instalación/ Post Venta]",
    "Velocidad de Internet no es acorde a lo solicitado por el cliente",
    "Cantidad o Modelo de Decos no es acorde a lo solicitado por el cliente",
    "Cliente solicito atención PostVenta (Decos adicionales, traslados, etc.)",
    "Cliente solicita adicionar la telefonía",
    "Decodificadores descontinuados (Básico HD, Básico, Standard, DVR)"
  ],
  RECH_MUDANZA: [
    "Cliente salió de viaje y en el domicilio no tienen conocimiento de la Instalación.",
    "Cliente no vive en esta dirección, se mudó.",
    "Cliente indica que pronto se mudará o viajará y rechaza instalación."
  ],
  RECH_SISTEMA: [
    "Sin workflow, sin tareas generadas",
    "Campaña mal configurada, no figura etiquetas correctas",
    "Solicitud mal generada (no genera reservas, duplicidad de números, duplicidad de etiquetas, Sin Co_id, sin CustomerID, Sin plano, etc.)"
  ]
};

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
    { id: 'RECH_NO_DESEA_MESA', nombre: '1. Cliente no desea servicio - Mesa' },
    { id: 'RECH_DUPLICIDAD', nombre: '2. Por duplicidad - Mesa' },
    { id: 'RECH_FACILIDADES', nombre: '3. Por facilidades técnicas del cliente - Mesa' },
    { id: 'RECH_CONTACTO', nombre: '4. Por falta de contacto - Mesa' },
    { id: 'RECH_DIRECCION', nombre: '5. Por mal ingreso de dirección - Mesa' },
    { id: 'RECH_OFERTA', nombre: '6. Por mala oferta - Mesa' },
    { id: 'RECH_MUDANZA', nombre: '7. Por mudanza o viaje - Mesa' },
    { id: 'RECH_SISTEMA', nombre: '8. Por SOT con errores de Sistema - Mesa' },
    { id: 'RECH_FRAUDE', nombre: '9. Por posible fraude - Mesa' }
  ],
  FUERA_TOA: [
    { id: 'FTOA_GENERAL', nombre: 'Plantilla Fuera de TOA' }
  ]
};

/* ==========================================================================
   2. INICIALIZACIÓN Y EVENTOS DOM
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function() {
  cargarSesionGuardada();
  inicializarTema();

  const btnIngresar = document.getElementById('btnIngresarLogin');
  if (btnIngresar) {
    btnIngresar.addEventListener('click', function(e) {
      e.preventDefault();
      iniciarSesion();
    });
  }

  const inputE = document.getElementById('inputUsuarioE');
  if (inputE) {
    inputE.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        iniciarSesion();
      }
    });
  }

  document.getElementById('btnToggleTheme')?.addEventListener('click', function() {
    const temaActual = document.documentElement.getAttribute('data-theme');
    const nuevoTema = temaActual === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nuevoTema);
    localStorage.setItem('themeADP', nuevoTema);
    actualizarBotonTema(nuevoTema);
  });

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

  document.getElementById('btnCopiarHabilitar')?.addEventListener('click', function() {
    const area = document.getElementById('outputHabilitarFranja');
    if (!area || !area.value.trim()) return;

    const textoLimpio = area.value.replace(/\r?\n/g, "\r\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textoLimpio);
    }
    mostrarToast("📋 Formato Habilitar Franja copiado");
  });

  document.getElementById('inputSupCargo')?.addEventListener('input', function() {
    const clienteData = obtenerClienteData();
    const fechaVisita = obtenerFechaYFranjaFormateada();
    generarFormatoHabilitarFranja(clienteData.sot, planoExtraido, fechaVisita, this.value);
  });

  actualizarSubcategorias();
});

/* ==========================================================================
   3. GESTIÓN DE SESIÓN Y TEMA
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

function inicializarTema() {
  const temaGuardado = localStorage.getItem('themeADP') || 'light';
  document.documentElement.setAttribute('data-theme', temaGuardado);
  actualizarBotonTema(temaGuardado);
}

function actualizarBotonTema(tema) {
  const icon = document.getElementById('themeIcon');
  const text = document.getElementById('themeText');
  
  if (icon && text) {
    if (tema === 'dark') {
      icon.innerText = '☀️';
      text.innerText = 'Claro';
    } else {
      icon.innerText = '🌙';
      text.innerText = 'Oscuro';
    }
  }
}

/* ==========================================================================
   4. PROCESADOR DE TEXTO TOA (EXTRACCIÓN DE DATOS)
   ========================================================================== */

function procesarTextoTOA() {
  const text = document.getElementById('rawInput').value;

  if (!text.trim()) {
    mostrarToast("⚠️ Pega el texto extraído de TOA", "#dc3545");
    return;
  }

  // Extracción de SOT
  const sotMatch = text.match(/(?:SOT|sot|Nro SOT|N° SOT|Orden)\s*[:\t\r\n]*\s*(\d+)/i) || text.match(/\b\d{8,9}\b/);

  // Extracción de Teléfono
  const telMatch = text.match(/(?:Telefono|Telefono\s*Cliente|Contacto|Movil|Celular|Telefonos)\s*[:\t\r\n]*\s*(\d{7,9})/i) || text.match(/\b9\d{8}\b/);

  // Extracción de Cliente
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

  // Extracción de Contrata
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

  // Extracción de Fecha y Franja Horaria
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

  // Extracción de variables secundarias
  const planoMatch = text.match(/(?:Plano)\s*[:\t\r\n]*\s*([A-Z0-9-]+)/i);
  if (planoMatch) planoExtraido = planoMatch[1].trim();

  const subTipoMatch = text.match(/(?:Sub\s*Tipo\s*de\s*Orden|Subtipo)\s*[:\t\r\n]*\s*([^\r\n]+)/i);
  if (subTipoMatch) subTipoExtraido = subTipoMatch[1].trim();

  const codClienteMatch = text.match(/(?:Código\s*de\s*Cliente|Cod\s*Cliente)\s*[:\t\r\n]*\s*(\d+)/i);
  if (codClienteMatch) codClienteExtraido = codClienteMatch[1].trim();

  const dirMatch = text.match(/(?:Direccion|Dirección)\s*[:\t\r\n]*\s*([^\r\n]+)/i);
  if (dirMatch) direccionExtraida = dirMatch[1].trim();

  const distMatch = text.match(/(?:Distrito)\s*[:\t\r\n]*\s*([^\r\n]+)/i);
  if (distMatch) distritoExtraido = distMatch[1].trim();

  // Asignar valores a la vista previa
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
   5. CONTROLES DINÁMICOS
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

  if (subcat.startsWith('CONF_') || subcat === 'FTOA_GENERAL') {
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
    const clienteData = obtenerClienteData();

    if (subcat === 'RECH_DUPLICIDAD') {
      html += `
        <div>
          <label class="lbl-sm">Nro. SOT Duplicada Atendida</label>
          <input type="text" id="inputSotDuplicada" placeholder="Ej: 91501234">
        </div>
        <div>
          <label class="lbl-sm">ID Llamada</label>
          <input type="text" id="inputIDLlamada" placeholder="Ej: 17909701296">
        </div>
      `;
    } else if (subcat === 'RECH_DIRECCION') {
      html += `
        <div>
          <label class="lbl-sm">Persona que Contesta</label>
          <input type="text" id="inputPersonaContesta" value="${clienteData.cliente}">
        </div>
        <div>
          <label class="lbl-sm">ID Llamada</label>
          <input type="text" id="inputIDLlamada" placeholder="Ej: 17909701296">
        </div>
        <div style="grid-column: span 2;">
          <label class="lbl-sm">Dirección Correcta</label>
          <input type="text" id="inputDireccionCorrecta" placeholder="Escribe la dirección correcta completa...">
        </div>
        <div style="grid-column: span 2;">
          <label class="lbl-sm">Submotivo de Rechazo</label>
          <select id="selectSubmotivoRechazo">
            ${SUBMOTIVOS_RECHAZO.RECH_DIRECCION.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
      `;
    } else if (subcat === 'RECH_SISTEMA') {
      html += `
        <div style="grid-column: span 2;">
          <label class="lbl-sm">Submotivo de Rechazo</label>
          <select id="selectSubmotivoRechazo">
            ${SUBMOTIVOS_RECHAZO.RECH_SISTEMA.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="lbl-sm">Detalle Error de Sistema</label>
          <input type="text" id="inputDetalleSistema" placeholder="Ej: Sin Co_id / Sin workflow">
        </div>
        <div>
          <label class="lbl-sm">ID Llamada</label>
          <input type="text" id="inputIDLlamada" placeholder="Ej: 17909701296">
        </div>
      `;
    } else if (subcat === 'RECH_FRAUDE') {
      html += `
        <div>
          <label class="lbl-sm">Persona que Contesta</label>
          <input type="text" id="inputPersonaContesta" value="${clienteData.cliente}">
        </div>
        <div>
          <label class="lbl-sm">ID Llamada</label>
          <input type="text" id="inputIDLlamada" placeholder="Ej: 17909701296">
        </div>
        <div>
          <label class="lbl-sm">Customer ID / DNI</label>
          <input type="text" id="inputCustomerID" placeholder="Ej: 44868042">
        </div>
        <div>
          <label class="lbl-sm">Autorizado Por</label>
          <input type="text" id="inputAutorizadoPor" placeholder="Ej: SUPERVISOR JUAN PEREZ">
        </div>
      `;
    } else if (subcat === 'RECH_CONTACTO') {
      html += `
        <div>
          <label class="lbl-sm">Persona que Contesta</label>
          <input type="text" id="inputPersonaContesta" value="NO RESPONDE / SIN CONTACTO">
        </div>
        <div>
          <label class="lbl-sm">ID Llamada</label>
          <input type="text" id="inputIDLlamada" placeholder="Ej: 17909701296">
        </div>
      `;
    } else {
      const opciones = SUBMOTIVOS_RECHAZO[subcat] || [];
      html += `
        <div>
          <label class="lbl-sm">Persona que Contesta</label>
          <input type="text" id="inputPersonaContesta" value="${clienteData.cliente}">
        </div>
        <div>
          <label class="lbl-sm">ID Llamada</label>
          <input type="text" id="inputIDLlamada" placeholder="Ej: 17909701296">
        </div>
        <div style="grid-column: span 2;">
          <label class="lbl-sm">Submotivo de Rechazo</label>
          <select id="selectSubmotivoRechazo">
            ${opciones.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
      `;
    }
  }

  html += '</div>';
  contenedor.innerHTML = html;

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
   6. GENERACIÓN DE PLANTILLAS Y HERRAMIENTAS
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
  const personaContesta = v('inputPersonaContesta') || clienteData.cliente;
  const submotivo = v('selectSubmotivoRechazo');
  const supCargo = v('inputSupCargo') || "SIN ASIGNAR";
  const realizadorCompleto = `${usuarioActual.nombre.toUpperCase()} - ADP MULTISKILL HITSS`;

  let p = "";

  switch (subcat) {
    case 'FTOA_GENERAL':
      p = `*FUERA DE TOA*\n📌 SOT: ${clienteData.sot}\n⚙️ SUB TIPO: ${subTipoExtraido}\n🏡 DIRECCIÓN: ${direccionExtraida}\n📍 DISTRITO: ${distritoExtraido}\n🛠️ SERVICIO: FTTH\n🔑 PLANO: ${planoExtraido}\n👤 CLIENTE: ${clienteData.cliente}\n🔢 COD CLIENTE: ${codClienteExtraido}\n📱 CELULAR DEL CLIENTE: ${clienteData.telefono}\n📅 FECHA Y FRANJA: ${fechaVisita}\n✍️ REALIZADO POR: ${realizadorCompleto}`;
      break;

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
      p = `MESA MULTISKILL HITSS\nRECHAZO EN MESA / CAMPO: RECHAZO EN MESA\nPERSONA QUE CONTESTA: ${personaContesta}\nNUMERO DE CONTACTO: ${clienteData.telefono}\nMOTIVO DEL RECHAZO: CLIENTE NO DESEA EL SERVICIO - MESA\nSUBMOTIVO DE RECHAZO: ${submotivo}\nID DE LLAMADA: ${idLlamada}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'RECH_DUPLICIDAD':
      p = `MESA MULTISKILL HITSS\nRECHAZO EN MESA / CAMPO: RECHAZADO EN MESA\nNUMERO DE CONTACTO: ${clienteData.telefono}\nMOTIVO DEL RECHAZO: RECHAZADO POR DUPLICIDAD\nSUBMOTIVO DE RECHAZO: se atendió con otra SOT\nSE PROCEDE AL RECHAZO DE LA SOLICITUD POR DUPLICIDAD DE SOT, SE ATENDIÓ CON LA SOT: ${v('inputSotDuplicada') || 'S/N'}\nID DE LLAMADA: ${idLlamada}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'RECH_FACILIDADES':
      p = `MESA MULTISKILL HITSS\nRECHAZO EN MESA / CAMPO: RECHAZADO EN MESA\nPERSONA QUE CONTESTA: ${personaContesta}\nNUMERO DE CONTACTO: ${clienteData.telefono}\nMOTIVO DEL RECHAZO: FACILIDADES TÉCNICAS DEL CLIENTE\nSUBMOTIVO DE RECHAZO: ${submotivo}\nID DE LLAMADA: ${idLlamada}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'RECH_CONTACTO':
      p = `MESA MULTISKILL HITSS\nRECHAZO EN MESA / CAMPO: RECHAZO EN MESA\nPERSONA QUE CONTESTA: ${personaContesta}\nNUMERO DE CONTACTO: ${clienteData.telefono}\nMOTIVO DEL RECHAZO: FALTA DE CONTACTO\nSUBMOTIVO DE RECHAZO: No hay contacto con el cliente (números errados)\nID DE LLAMADA: ${idLlamada}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'RECH_DIRECCION':
      p = `MESA MULTISKILL HITSS\nRECHAZO EN MESA / CAMPO: RECHAZADO EN MESA\nPERSONA QUE CONTESTA: ${personaContesta}\nNUMERO DE CONTACTO: ${clienteData.telefono}\nMOTIVO DEL RECHAZO: MAL INGRESO DE DIRECCIÓN\nDIRECCIÓN CORRECTA: ${v('inputDireccionCorrecta') || 'S/N'}\nSUBMOTIVO DE RECHAZO: ${submotivo}\nID DE LLAMADA: ${idLlamada}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'RECH_OFERTA':
      p = `MESA MULTISKILL HITSS\nRECHAZO EN MESA / CAMPO: RECHAZADO EN MESA\nPERSONA QUE CONTESTA: ${personaContesta}\nNUMERO DE CONTACTO: ${clienteData.telefono}\nMOTIVO DEL RECHAZO: MALA OFERTA\nSUBMOTIVO DE RECHAZO: ${submotivo}\nID DE LLAMADA: ${idLlamada}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'RECH_MUDANZA':
      p = `MESA MULTISKILL HITSS\nRECHAZO EN MESA / CAMPO: RECHAZADO EN MESA\nPERSONA QUE CONTESTA: ${personaContesta}\nNUMERO DE CONTACTO: ${clienteData.telefono}\nMOTIVO DEL RECHAZO: MUDANZA O VIAJE\nSUBMOTIVO DE RECHAZO: ${submotivo}\nID DE LLAMADA: ${idLlamada}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'RECH_SISTEMA':
      p = `MESA MULTISKILL HITSS\nRECHAZO EN MESA / CAMPO: RECHAZADO EN MESA\nMOTIVO DEL RECHAZO: SOT CON ERRORES EN EL SISTEMA\nSUBMOTIVO DE RECHAZO: ${submotivo}\nSE PROCEDE AL RECHAZO DE LA SOLICITUD POR TENER ERRORES DE SISTEMAS: ${v('inputDetalleSistema') || 'SIN ESPECIFICAR'}\nID DE LLAMADA: ${idLlamada}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
    case 'RECH_FRAUDE':
      p = `MESA MULTISKILL HITSS\nRECHAZO EN MESA / CAMPO: RECHAZADO EN MESA\nPERSONA QUE CONTESTA: ${personaContesta}\nNUMERO DE CONTACTO: ${clienteData.telefono}\nMOTIVO DEL RECHAZO: POSIBLE FRAUDE\nSUBMOTIVO DE RECHAZO: Cliente ya tiene un servicio activo en la misma dirección\nCUSTOMER ID: ${v('inputCustomerID') || 'S/N'}\nAUTORIZADO POR: ${v('inputAutorizadoPor') || 'S/N'}\nID DE LLAMADA: ${idLlamada}\nREALIZADO POR: ${realizadorCompleto}`;
      break;
  }

  document.getElementById('outputPlantilla').value = p;
  generarFormatoHabilitarFranja(clienteData.sot, planoExtraido, fechaVisita, supCargo);
}

function generarFormatoHabilitarFranja(sot, plano, fechaFranja, sup) {
  const formato = `MESA MULTISKILL HITSS - FORMATO PARA HABILITAR FRANJA\n📥 SOT: ${sot}\n🪚 PLANO: ${plano}\n📅 FECHA Y FRANJA: ${fechaFranja}\n📧 Motivo: SIN FRANJAS DISPONIBLES\n🚨 Sup acargo: ${sup}`;
  
  const elHabilitar = document.getElementById('outputHabilitarFranja');
  if (elHabilitar) {
    elHabilitar.value = formato;
  }
}

/* ==========================================================================
   7. BLOC DE NOTAS, MODALES Y TOASTS
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
