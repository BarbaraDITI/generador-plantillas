/* ==========================================================================
   ESTADO GLOBAL Y CONFIGURACIÓN DE CATEGORÍAS
   ========================================================================== */

let usuarioActual = { nombre: "", codigoE: "" };
let listaGestiones = [];
let plantillaPendiente = null;

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

  document.getElementById('formLogin').addEventListener('submit', function(e) {
    e.preventDefault();
    iniciarSesion();
  });
  document.getElementById('btnCerrarSesion').addEventListener('click', cerrarSesion);

  document.getElementById('btnProcesarTOA').addEventListener('click', procesarTextoTOA);
  document.getElementById('selectCategoria').addEventListener('change', actualizarSubcategorias);
  document.getElementById('selectSubcategoria').addEventListener('change', renderizarCamposDinamicos);
  document.getElementById('btnGenerarPlantilla').addEventListener('click', generarPlantilla);
  document.getElementById('btnCopiarPlantilla').addEventListener('click', copiarPlantilla);
  document.getElementById('btnGuardarBloc').addEventListener('click', intentarGuardarEnBloc);
  document.getElementById('btnExportarBloc').addEventListener('click', exportarBloc);

  document.getElementById('btnConfirmarDuplicado').addEventListener('click', confirmarAgregarDuplicado);
  document.getElementById('btnCancelarDuplicado').addEventListener('click', cancelarAgregarDuplicado);

  actualizarSubcategorias();
});

/* ==========================================================================
   GESTIÓN DE SESIÓN
   ========================================================================== */

function iniciarSesion() {
  const nombre = document.getElementById('inputNombreADP').value.trim();
  const codigoE = document.getElementById('inputUsuarioE').value.trim().toUpperCase();

  const regexE = /^E\d{6}$/;

  if (!nombre) {
    alert("Por favor, ingresa tu nombre completo.");
    return;
  }
  if (!regexE.test(codigoE)) {
    alert("El código debe empezar con 'E' seguido de 6 números (Ejemplo: E760644).");
    return;
  }

  usuarioActual = { nombre, codigoE };
  localStorage.setItem('adpNombre', nombre);
  localStorage.setItem('adpCodigoE', codigoE);

  document.getElementById('labelUsuario').innerText = `ADP: ${usuarioActual.nombre} (${usuarioActual.codigoE})`;
  document.getElementById('loginModal').style.display = 'none';
}

function cargarSesionGuardada() {
  const n = localStorage.getItem('adpNombre');
  const e = localStorage.getItem('adpCodigoE');

  if (n && e) {
    usuarioActual = { nombre: n, codigoE: e };
    document.getElementById('inputNombreADP').value = n;
    document.getElementById('inputUsuarioE').value = e;
    document.getElementById('labelUsuario').innerText = `ADP: ${n} (${e})`;
    document.getElementById('loginModal').style.display = 'none';
  } else {
    document.getElementById('loginModal').style.display = 'flex';
  }
}

function cerrarSesion() {
  localStorage.removeItem('adpNombre');
  localStorage.removeItem('adpCodigoE');
  document.getElementById('labelUsuario').innerText = "ADP: No conectado";
  document.getElementById('loginModal').style.display = 'flex';
}

/* ==========================================================================
   PROCESADOR DE TEXTO TOA Y LECTURA DE CLIENTE
   ========================================================================== */

function procesarTextoTOA() {
  const text = document.getElementById('rawInput').value;

  if (!text.trim()) {
    alert("Por favor, pega el texto extraído de TOA.");
    return;
  }

  // Búsqueda flexible de SOT
  const sotMatch = text.match(/(?:SOT|sot|Nro SOT|N° SOT|Orden)\s*[:\t\r\n]*\s*(\d+)/i) || text.match(/\b\d{7,9}\b/);
  // Búsqueda flexible de Teléfono
  const telMatch = text.match(/(?:telefonosiac|Telefonos|Telefono|Contacto|Movil|Celular)\s*[:\t\r\n]*\s*(\d{7,9})/i) || text.match(/\b9\d{8}\b/);
  // Búsqueda mejorada de Cliente (Soporta múltiples palabras y caracteres en español)
  const clienteMatch = text.match(/(?:CLIENTE)\s*[:\t\r\n]*\s*([A-ZÁÉÍÓÚÑa-zñáéíóú\s.,]+)(?=\r|\n|$)/i);
  // Búsqueda flexible de Contrata
  const contrataMatch = text.match(/(?:Contrata)\s*[:\t\r\n]*\s*([^\n\r]+)/i);

  const sot = sotMatch ? (sotMatch[1] || sotMatch[0]) : "S/N";
  const telefono = telMatch ? (telMatch[1] || telMatch[0]) : "S/N";
  const cliente = clienteMatch ? clienteMatch[1].trim() : "S/N";
  const contrata = contrataMatch ? contrataMatch[1].trim() : "SAVAL";

  // Se asignan directamente a las cajas de texto de la interfaz para poder editarlas o seleccionarlas
  document.getElementById('pvSOT').value = sot;
  document.getElementById('pvTel').value = telefono;
  document.getElementById('pvCliente').value = cliente;
  document.getElementById('pvContrata').value = contrata;

  renderizarCamposDinamicos();
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

  const inputFecha = document.getElementById('inputFecha');
  if (inputFecha) {
    const hoy = new Date().toISOString().split('T')[0];
    inputFecha.value = hoy;
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
    alert("Debes iniciar sesión primero.");
    document.getElementById('loginModal').style.display = 'flex';
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

function copiarPlantilla() {
  const area = document.getElementById('outputPlantilla');
  if (!area.value) {
    alert("No hay ninguna plantilla generada para copiar.");
    return;
  }
  area.select();
  document.execCommand('copy');
  alert("¡Plantilla copiada al portapapeles!");
}

/* ==========================================================================
   BLOC DE NOTAS Y ADVERTENCIA DE DUPLICADOS
   ========================================================================== */

function intentarGuardarEnBloc() {
  const plantillaGen = document.getElementById('outputPlantilla').value.trim();
  if (!plantillaGen) {
    alert("Genera una plantilla primero.");
    return;
  }

  const esDuplicado = listaGestiones.some(g => g.plantilla === plantillaGen);

  if (esDuplicado) {
    plantillaPendiente = plantillaGen;
    document.getElementById('duplicateModal').style.display = 'flex';
  } else {
    guardarEnBlocDirecto(plantillaGen);
  }
}

function confirmarAgregarDuplicado() {
  if (plantillaPendiente) {
    guardarEnBlocDirecto(plantillaPendiente);
    plantillaPendiente = null;
  }
  document.getElementById('duplicateModal').style.display = 'none';
}

function cancelarAgregarDuplicado() {
  plantillaPendiente = null;
  document.getElementById('duplicateModal').style.display = 'none';
}

function guardarEnBlocDirecto(textoPlantilla) {
  const clienteData = obtenerClienteData();
  const item = {
    id: listaGestiones.length + 1,
    sot: clienteData.sot,
    telefono: clienteData.telefono,
    plantilla: textoPlantilla
  };

  listaGestiones.push(item);
  renderizarBloc();
}

function renderizarBloc() {
  const container = document.getElementById('blocNotasView');
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
    alert("No hay registros en el bloc para exportar.");
    return;
  }
  const text = document.getElementById('blocNotasView').innerText;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Registro_Gestiones_${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
}