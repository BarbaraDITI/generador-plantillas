// ============================================================================
// 1. CONFIGURACIÓN Y CONEXIÓN A SUPABASE
// ============================================================================
const SUPABASE_URL = 'https://tjflvdvnsxmrkouleoyn.supabase.co';
const SUPABASE_ANON_KEY = 'PEGA_AQUI_TU_CLAVE_PUBLISHABLE'; // Ej: sb_publishable_...
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const URL_MICROSOFT_FORMS = "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=CkbVXyW03kmb0PzSYnDTDHJyTl3EI1JImzWpf0AOFcFUQVRVUkRGUUlNNzhDUktCNjBSN0hQOVozWi4u";

const METAS_DIARIAS = {
    'Full Time': 45,
    'Part Time': 25
};

// Tipificaciones alineadas a los 4 resultados exactos de tu columna 'GESTION'
const SUBMOTIVOS_CONFIG = {
    'CONFIRMO': [
        'Confirma visita con titular en llamada',
        'Confirma visita con familiar autorizado',
        'Confirma adelanto de visita (AM0)'
    ],
    'NO CONTESTA': [
        'Ciclo 1 - No contesta / Buzón de voz',
        'Ciclo 2 - Corta llamada / Sin audio',
        'Ciclo 3 - Número equivocado / Fuera de servicio'
    ],
    'REPROGRAMADO': [
        'Reprogramación a solicitud del cliente',
        'Reprogramación por falta de cuota técnica',
        'Reprogramación por incidencia externa'
    ],
    'RECHAZADO': [
        '1. Cliente ya cuenta con servicio instalado',
        '2. Desiste del servicio por demora',
        '3. Dirección errada / Sin cobertura técnica',
        '4. Titular no reconoce solicitud de venta',
        '5. Duplicidad de SOT en sistema',
        '6. Cliente solicita baja / cancelación',
        '7. Falta de facilidades técnicas en domicilio',
        '8. Fuera de zona de atención asignada'
    ]
};

let usuarioActivo = null;
let usuarioTemporal = null;
let gestionesDelDiaLocal = [];
let horaInicioActividad = new Date().toISOString();

// ============================================================================
// 2. INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const hoy = obtenerFechaLima();
    const mesActual = hoy.slice(0, 7);
    
    if (document.getElementById('fecha-visita')) document.getElementById('fecha-visita').value = hoy;
    if (document.getElementById('admin-filtro-fecha')) document.getElementById('admin-filtro-fecha').value = hoy;
    if (document.getElementById('admin-filtro-mes')) document.getElementById('admin-filtro-mes').value = mesActual;
    
    actualizarSubcategorias();

    const sesionGuardada = localStorage.getItem('sesion_hitss_v3');
    if (sesionGuardada) {
        usuarioActivo = JSON.parse(sesionGuardada);
        mostrarInterfazPorRol(usuarioActivo);
    }
});

function obtenerFechaLima() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }); // Formato YYYY-MM-DD
}

function obtenerHoraLima() {
    return parseInt(new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit' }), 10);
}

// ============================================================================
// 3. CONTROL DE ACCESO INTELIGENTE (LOGIN / ACTIVACIÓN / REGISTRO)
// ============================================================================
async function verificarCodigoE() {
    const codigo = document.getElementById('input-codigo-e').value.toUpperCase().trim();
    if (!codigo) return mostrarToast("⚠️ Ingresa tu Usuario E");

    const { data: user, error } = await supabaseClient
        .from('usuarios')
        .select('*')
        .eq('codigo_e', codigo)
        .single();

    document.getElementById('paso-codigo').style.display = 'none';

    if (user) {
        if (!user.activo) {
            alert("Este usuario se encuentra inactivo. Contacta a tu supervisor.");
            return reiniciarLogin();
        }
        usuarioTemporal = user;
        if (user.password_pin) {
            document.getElementById('saludo-reconocido').innerText = `Hola, ${user.nombre_completo}`;
            document.getElementById('detalle-reconocido').innerText = `${user.codigo_e} • ${user.modalidad} • ${user.area}`;
            document.getElementById('paso-login').style.display = 'block';
        } else {
            document.getElementById('saludo-activar').innerText = `¡Bienvenido, ${user.nombre_completo}!`;
            document.getElementById('detalle-activar').innerText = `${user.codigo_e} • ${user.modalidad} • Área: ${user.area}`;
            document.getElementById('paso-activar').style.display = 'block';
        }
    } else {
        usuarioTemporal = { codigo_e: codigo };
        document.getElementById('paso-registro-nuevo').style.display = 'block';
    }
}

function validarPassword() {
    const pass = document.getElementById('login-pass').value.trim();
    if (pass === usuarioTemporal.password_pin) {
        completarLogin(usuarioTemporal);
    } else {
        mostrarToast("❌ Contraseña incorrecta");
    }
}

async function activarCuenta() {
    const nuevaPass = document.getElementById('nueva-pass').value.trim();
    if (nuevaPass.length < 4) return mostrarToast("⚠️ La clave debe tener al menos 4 caracteres");

    const { data, error } = await supabaseClient
        .from('usuarios')
        .update({ password_pin: nuevaPass })
        .eq('codigo_e', usuarioTemporal.codigo_e)
        .select()
        .single();

    if (error) return mostrarToast("❌ Error al activar cuenta");
    mostrarToast("✅ Cuenta activada correctamente");
    completarLogin(data);
}

async function registrarDesdeCero() {
    const nombre = document.getElementById('reg-nombre').value.toUpperCase().trim();
    const modalidad = document.getElementById('reg-modalidad').value;
    const area = document.getElementById('reg-area').value;
    const pass = document.getElementById('reg-pass').value.trim();

    if (!nombre || pass.length < 4) return mostrarToast("⚠️ Completa tu nombre y una clave de mínimo 4 caracteres");

    const { data, error } = await supabaseClient
        .from('usuarios')
        .insert([{
            codigo_e: usuarioTemporal.codigo_e,
            nombre_completo: nombre,
            modalidad: modalidad,
            area: area,
            password_pin: pass,
            fecha_ingreso: obtenerFechaLima(),
            rol: 'ADP',
            activo: true
        }])
        .select()
        .single();

    if (error) return mostrarToast("❌ Error al registrar: " + error.message);
    mostrarToast("✅ Registro completado");
    completarLogin(data);
}

function completarLogin(user) {
    usuarioActivo = user;
    localStorage.setItem('sesion_hitss_v3', JSON.stringify(user));
    mostrarInterfazPorRol(user);
}

function mostrarInterfazPorRol(user) {
    document.getElementById('pantalla-auth').style.display = 'none';
    document.getElementById('app-principal').style.display = 'block';
    document.getElementById('badge-rol-activo').innerText = `${user.rol} • ${user.area}`;
    document.getElementById('info-usuario-topbar').innerText = `${user.nombre_completo} (${user.codigo_e})`;

    // Seleccionar por defecto la cola según su área en Leyenda
    if (user.area === 'Migraciónes' && document.getElementById('cola-manual')) {
        document.getElementById('cola-manual').value = 'MIGRACIONES';
    }

    if (user.rol === 'ADMIN') {
        document.getElementById('vista-admin').style.display = 'block';
        document.getElementById('vista-adp').style.display = 'none';
        cargarDashboardSupervisor();
    } else {
        document.getElementById('vista-adp').style.display = 'block';
        document.getElementById('vista-admin').style.display = 'none';
        cargarDatosPersonalesADP();
    }
}

function reiniciarLogin() {
    usuarioTemporal = null;
    document.getElementById('paso-codigo').style.display = 'block';
    document.getElementById('paso-login').style.display = 'none';
    document.getElementById('paso-activar').style.display = 'none';
    document.getElementById('paso-registro-nuevo').style.display = 'none';
}

function cerrarSesion() {
    localStorage.removeItem('sesion_hitss_v3');
    location.reload();
}

// ============================================================================
// 4. OPERACIÓN DEL ASESOR (REGEX TOA + PLANTILLA + SUPABASE + FORMS)
// ============================================================================
function procesarTextoTOA() {
    const raw = document.getElementById('texto-toa').value;
    if (!raw.trim()) return mostrarToast("⚠️ Pega el texto de TOA primero");

    // Marcar hora de inicio real de gestión para medir tiempo operativo
    horaInicioActividad = new Date().toISOString();

    const sotMatch = raw.match(/(?:SOT|Orden|Actividad)[:\s#-]*(\d{7,10})/i) || raw.match(/\b(\d{8,9})\b/);
    const telMatch = raw.match(/(?:Tel[eé]fono|Celular|M[oó]vil|Contacto)[:\s]*([9]\d{8})/i) || raw.match(/\b(9\d{8})\b/);
    const clienteMatch = raw.match(/(?:Cliente|Titular|Nombre)[:\s]*([A-ZÁÉÍÓÚÑ\s]{5,45})(?:\n|Tel|Dir|SOT|$)/i);
    const contrataMatch = raw.match(/(?:Contrata|Empresa|Proveedor)[:\s]*([A-Z0-9\s.-]{3,30})(?:\n|$)/i);

    document.getElementById('campo-sot').value = sotMatch ? sotMatch[1] : '';
    document.getElementById('campo-telefono').value = telMatch ? telMatch[1] : '';
    document.getElementById('campo-cliente').value = clienteMatch ? clienteMatch[1].trim().toUpperCase() : '';
    document.getElementById('campo-contrata').value = contrataMatch ? contrataMatch[1].trim().toUpperCase() : 'SAVAL';

    // Detectar Departamento del Perú automáticamente si aparece en el texto de TOA
    const selectDepto = document.getElementById('campo-departamento');
    const textoUpper = raw.toUpperCase();
    for (let opt of selectDepto.options) {
        if (textoUpper.includes(opt.value)) {
            selectDepto.value = opt.value;
            break;
        }
    }

    mostrarToast("✅ Datos extraídos de TOA");
}

function actualizarSubcategorias() {
    const cat = document.getElementById('cat-principal').value;
    const selectSub = document.getElementById('sub-motivo');
    selectSub.innerHTML = '';
    (SUBMOTIVOS_CONFIG[cat] || []).forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.innerText = sub;
        selectSub.appendChild(opt);
    });
}

async function generarYGuardarPlantilla() {
    const sot = document.getElementById('campo-sot').value.trim();
    const telefono = document.getElementById('campo-telefono').value.trim() || 'S/N';
    const departamento = document.getElementById('campo-departamento').value;
    const cliente = document.getElementById('campo-cliente').value.trim().toUpperCase() || 'TITULAR';
    const contrata = document.getElementById('campo-contrata').value.trim().toUpperCase() || 'CONTRATA';
    const gestion = document.getElementById('cat-principal').value;
    const colaManual = document.getElementById('cola-manual').value;
    const submotivo = document.getElementById('sub-motivo').value;
    const fechaCliente = document.getElementById('fecha-visita').value;
    const franja = document.getElementById('franja-horaria').value;
    const idLlamada = document.getElementById('id-llamada').value.trim() || 'S/N';

    if (!sot) return mostrarToast("⚠️ Ingresa o extrae el número de SOT");

    const partesFecha = fechaCliente.split('-');
    const fechaCorta = partesFecha.length === 3 ? `${partesFecha[2]}/${partesFecha[1]}` : fechaCliente;

    const plantillaTexto = 
`MESA MULTISKILL HITSS - ${gestion} (${colaManual})
SOT: ${sot}
DÍA Y FRANJA: ${fechaCorta} ${franja}
DEPARTAMENTO: ${departamento}
CLIENTE: ${cliente}
NÚMERO: ${telefono}
CONTRATA: ${contrata}
MOTIVO: ${submotivo}
ID DE LLAMADA: ${idLlamada}
ASESOR: ${usuarioActivo.nombre_completo} (${usuarioActivo.codigo_e})`;

    document.getElementById('plantilla-resultado').value = plantillaTexto;

    // 1. Copiar al portapapeles de inmediato
    try {
        await navigator.clipboard.writeText(plantillaTexto);
    } catch (e) {
        console.warn("No se pudo copiar automáticamente:", e);
    }

    // 2. Detectar automáticamente columna '¿YA TIENE GESTION?' (SI / NO)
    const yaTieneGestionHoy = gestionesDelDiaLocal.some(g => g.sot === sot) ? 'SI' : 'NO';
    if (yaTieneGestionHoy === 'SI') {
        const confirmar = confirm(`⚠️ La SOT ${sot} ya registra una gestión previa hoy (se marcará ¿YA TIENE GESTION? = SI). ¿Continuar?`);
        if (!confirmar) return;
    }

    // 3. Guardar en Supabase con exactamente las columnas de 'Sheet1'
    const abrirForms = document.getElementById('check-abrir-forms').checked;
    const ahora = new Date();
    const { error } = await supabaseClient.from('gestiones_sot').insert([{
        usuario_e: usuarioActivo.codigo_e,
        sot: sot,
        fecha_desea_cliente: fechaCliente,
        franja: franja,
        hora_inicio: horaInicioActividad,
        hora_finalizacion: ahora.toISOString(),
        fecha_gestion: obtenerFechaLima(),
        intervalo: obtenerHoraLima(),
        gestion: gestion,
        submotivo: submotivo,
        departamento: departamento,
        ya_tiene_gestion: yaTieneGestionHoy,
        sot_gestionada_manual: colaManual,
        id_llamada: idLlamada,
        cliente_nombre: cliente,
        telefono_cliente: telefono,
        contrata: contrata,
        enviado_forms: abrirForms
    }]);

    // Reiniciar reloj para la siguiente SOT
    horaInicioActividad = new Date().toISOString();

    if (error) {
        mostrarToast("⚠️ Copiada, pero falló guardado en nube: " + error.message);
    } else {
        mostrarToast("✅ Plantilla copiada y SOT registrada en BD");
        cargarDatosPersonalesADP();
    }

    if (abrirForms) abrirMicrosoftForms();
}

function abrirMicrosoftForms() {
    window.open(URL_MICROSOFT_FORMS, '_blank');
}

function generarFormatoFranja() {
    const sup = document.getElementById('sup-franja').value.toUpperCase().trim() || 'SUPERVISOR EN TURNO';
    const sot = document.getElementById('campo-sot').value.trim() || 'S/N';
    const franja = document.getElementById('franja-horaria').value;
    const fecha = document.getElementById('fecha-visita').value;

    document.getElementById('resultado-franja').value = 
`SOLICITUD DE HABILITACIÓN DE FRANJA
PARA: ${sup}
SOT: ${sot}
FECHA / FRANJA REQUERIDA: ${fecha} - ${franja}
SOLICITADO POR: ${usuarioActivo.nombre_completo} (${usuarioActivo.codigo_e})`;
}

// ============================================================================
// 5. PANEL DE AVANCE PERSONAL Y RANKING DEL ADP
// ============================================================================
async function cargarDatosPersonalesADP() {
    const hoy = obtenerFechaLima();

    const { data: todasHoy, error } = await supabaseClient
        .from('gestiones_sot')
        .select('*')
        .eq('fecha_gestion', hoy)
        .order('hora_finalizacion', { ascending: true });

    if (error) return console.error(error);

    gestionesDelDiaLocal = todasHoy.filter(g => g.usuario_e === usuarioActivo.codigo_e);
    const totalMio = gestionesDelDiaLocal.length;
    const confirmadosMios = gestionesDelDiaLocal.filter(g => g.gestion === 'CONFIRMO').length;
    const meta = METAS_DIARIAS[usuarioActivo.modalidad] || 45;
    const porcentaje = Math.round((totalMio / meta) * 100);

    // Cadencia promedio en minutos
    let cadenciaTxt = "Sin registros";
    if (totalMio > 1) {
        const t1 = new Date(gestionesDelDiaLocal[0].hora_finalizacion);
        const t2 = new Date(gestionesDelDiaLocal[totalMio - 1].hora_finalizacion);
        const promMin = (((t2 - t1) / 60000) / (totalMio - 1)).toFixed(1);
        cadenciaTxt = `1 SOT cada ${promMin} min`;
    } else if (totalMio === 1) {
        cadenciaTxt = "1er registro del turno";
    }

    // Ranking del turno
    const conteoPorAsesor = {};
    todasHoy.forEach(g => {
        conteoPorAsesor[g.usuario_e] = (conteoPorAsesor[g.usuario_e] || 0) + 1;
    });
    const rankingOrdenado = Object.entries(conteoPorAsesor).sort((a, b) => b[1] - a[1]);
    const miPosicion = rankingOrdenado.findIndex(item => item[0] === usuarioActivo.codigo_e) + 1;

    document.getElementById('adp-avance-hoy').innerText = `${totalMio} / ${meta} SOTs`;
    document.getElementById('adp-porcentaje').innerText = `${porcentaje}% (${confirmadosMios} Confirm.)`;
    document.getElementById('adp-cadencia').innerText = cadenciaTxt;
    document.getElementById('adp-ranking').innerText = miPosicion > 0 ? `Puesto #${miPosicion} de ${rankingOrdenado.length}` : 'Sin ranking aún';

    // Renderizar Bloc Numerado
    const contenedorBloc = document.getElementById('lista-bloc');
    document.getElementById('contador-bloc').innerText = `Total: ${totalMio}`;

    if (totalMio === 0) {
        contenedorBloc.innerHTML = `<p class="empty-msg">Aún no hay gestiones registradas hoy.</p>`;
        return;
    }

    contenedorBloc.innerHTML = gestionesDelDiaLocal.map((g, index) => {
        const hora = new Date(g.hora_finalizacion).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        return `<div class="bloc-item"><strong>${index + 1}. SOT: ${g.sot}</strong> [${hora}] • ${g.franja}\nEstado: <strong>${g.gestion}</strong> (${g.sot_gestionada_manual})\nDepto: ${g.departamento} | ID: ${g.id_llamada}\n************************************</div>`;
    }).join('');
}

function exportarBlocTXT() {
    if (gestionesDelDiaLocal.length === 0) return mostrarToast("⚠️ No hay registros para exportar");
    const hoy = obtenerFechaLima();
    let contenido = `REPORTE DIARIO MESA MULTISKILL HITSS\nASESOR: ${usuarioActivo.nombre_completo} (${usuarioActivo.codigo_e})\nFECHA: ${hoy}\n====================================\n\n`;
    
    gestionesDelDiaLocal.forEach((g, idx) => {
        contenido += `${idx + 1}.\nSOT: ${g.sot}\nGestion: ${g.gestion}\nFranja: ${g.franja}\nDepartamento: ${g.departamento}\nCola: ${g.sot_gestionada_manual}\nMotivo: ${g.submotivo}\nID Llamada: ${g.id_llamada}\n************************************\n`;
    });

    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Registro_Gestiones_${usuarioActivo.codigo_e}_${hoy}.txt`;
    link.click();
}

// ============================================================================
// 6. DASHBOARD GERENCIAL DEL ADMINISTRADOR (REPLICA 'DINAMICA' + 'GESTION')
// ============================================================================
function cambiarModoFiltroAdmin() {
    const modo = document.getElementById('admin-modo-filtro').value;
    document.getElementById('admin-filtro-fecha').style.display = modo === 'dia' ? 'inline-block' : 'none';
    document.getElementById('admin-filtro-mes').style.display = modo === 'mes' ? 'inline-block' : 'none';
    cargarDashboardSupervisor();
}

function calcularMesesAntiguedad(fechaIngresoStr) {
    if (!fechaIngresoStr) return '0 meses';
    const ingreso = new Date(fechaIngresoStr);
    const hoy = new Date();
    const meses = (hoy.getFullYear() - ingreso.getFullYear()) * 12 + (hoy.getMonth() - ingreso.getMonth());
    return `${Math.max(0, meses)} meses`;
}

async function cargarDashboardSupervisor() {
    const modo = document.getElementById('admin-modo-filtro').value;
    const filtroArea = document.getElementById('admin-filtro-area').value;

    let queryAsesores = supabaseClient.from('usuarios').select('*').eq('rol', 'ADP').eq('activo', true);
    if (filtroArea !== 'TODAS') queryAsesores = queryAsesores.eq('area', filtroArea);
    const { data: asesores } = await queryAsesores;

    let queryGestiones = supabaseClient.from('gestiones_sot').select('*');
    let multiplicadorDias = 1;

    if (modo === 'dia') {
        const fecha = document.getElementById('admin-filtro-fecha').value;
        queryGestiones = queryGestiones.eq('fecha_gestion', fecha);
    } else {
        const mes = document.getElementById('admin-filtro-mes').value;
        queryGestiones = queryGestiones.gte('fecha_gestion', `${mes}-01`).lte('fecha_gestion', `${mes}-31`);
        multiplicadorDias = 22;
    }

    const { data: gestiones, error } = await queryGestiones;
    if (error) return console.error(error);

    const filasProcesadas = (asesores || []).map(adp => {
        const susGestiones = gestiones
            .filter(g => g.usuario_e === adp.codigo_e)
            .sort((a, b) => new Date(a.hora_finalizacion) - new Date(b.hora_finalizacion));

        const total = susGestiones.length;
        const meta = (METAS_DIARIAS[adp.modalidad] || 45) * multiplicadorDias;
        const cumple = total >= meta;

        // Cadencia promedio en minutos
        let cadenciaMin = null;
        if (total > 1) {
            const diffMin = (new Date(susGestiones[total - 1].hora_finalizacion) - new Date(susGestiones[0].hora_finalizacion)) / 60000;
            cadenciaMin = (diffMin / (total - 1)).toFixed(1);
        }

        // Intervalos horarios exactos de 'DINAMICA' (7 a 20+)
        const horas = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map(h => susGestiones.filter(g => g.intervalo === h).length);
        horas.push(susGestiones.filter(g => g.intervalo >= 20).length);

        // Desglose por GESTION
        const conf = susGestiones.filter(g => g.gestion === 'CONFIRMO').length;
        const noCont = susGestiones.filter(g => g.gestion === 'NO CONTESTA').length;
        const rech = susGestiones.filter(g => g.gestion === 'RECHAZADO').length;
        const repro = susGestiones.filter(g => g.gestion === 'REPROGRAMADO').length;

        return { adp, total, meta, cumple, cadenciaMin, horas, conf, noCont, rech, repro };
    }).sort((a, b) => b.total - a.total);

    // KPIs Globales
    const totalMesa = filasProcesadas.reduce((acc, f) => acc + f.total, 0);
    const totalConf = filasProcesadas.reduce((acc, f) => acc + f.conf, 0);
    const totalContactados = filasProcesadas.reduce((acc, f) => acc + (f.conf + f.rech + f.repro), 0);
    const pctConf = totalMesa > 0 ? Math.round((totalConf / totalMesa) * 100) : 0;
    const pctContactabilidad = totalMesa > 0 ? Math.round((totalContactados / totalMesa) * 100) : 0;

    const totalCumplen = filasProcesadas.filter(f => f.cumple).length;
    const cadenciasValidas = filasProcesadas.filter(f => f.cadenciaMin !== null).map(f => parseFloat(f.cadenciaMin));
    const promCadenciaMesa = cadenciasValidas.length > 0 
        ? (cadenciasValidas.reduce((a, b) => a + b, 0) / cadenciasValidas.length).toFixed(1) + ' min'
        : '-- min';

    document.getElementById('kpi-global-sots').innerText = totalMesa;
    document.getElementById('kpi-global-efectividad').innerText = `${pctConf}% / ${pctContactabilidad}%`;
    document.getElementById('kpi-global-cumplen').innerText = `${totalCumplen} / ${filasProcesadas.length}`;
    document.getElementById('kpi-global-cadencia').innerText = promCadenciaMesa;

    const tbody = document.getElementById('tabla-admin-body');
    tbody.innerHTML = filasProcesadas.map((f, idx) => `
        <tr>
            <td><strong>#${idx + 1}</strong></td>
            <td>${f.adp.nombre_completo}</td>
            <td>${calcularMesesAntiguedad(f.adp.fecha_ingreso)}</td>
            <td>${f.adp.modalidad}</td>
            <td>${f.adp.area}</td>
            ${f.horas.map(c => `<td>${c > 0 ? c : ''}</td>`).join('')}
            <td><strong>${f.conf}</strong></td>
            <td>${f.noCont}</td>
            <td>${f.rech}</td>
            <td>${f.repro}</td>
            <td><strong>${f.total}</strong> / ${f.meta}</td>
            <td><span class="${f.cumple ? 'badge-ok' : 'badge-warn'}">${f.cumple ? 'CUMPLE' : 'BAJO META'}</span></td>
            <td>${f.cadenciaMin ? `Cada ${f.cadenciaMin} min` : '-'}</td>
        </tr>
    `).join('');
}

function exportarReporteAdminCSV() {
    const tabla = document.getElementById('tabla-reporte-admin');
    let csv = [];
    for (let row of tabla.rows) {
        let cols = Array.from(row.cells).map(c => `"${c.innerText.replace(/\n/g, ' ')}"`);
        csv.push(cols.join(','));
    }
    const blob = new Blob(["\uFEFF" + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Productividad_HITSS_${obtenerFechaLima()}.csv`;
    link.click();
}

// ============================================================================
// 7. UTILIDADES
// ============================================================================
function limpiarCampos() {
    ['texto-toa', 'campo-sot', 'campo-telefono', 'campo-cliente', 'campo-contrata', 'plantilla-resultado'].forEach(id => {
        document.getElementById(id).value = '';
    });
    mostrarToast("🧹 Campos limpiados");
}

function copiarTextoElemento(id) {
    const el = document.getElementById(id);
    if (!el.value) return mostrarToast("⚠️ No hay texto para copiar");
    navigator.clipboard.writeText(el.value);
    mostrarToast("📋 Texto copiado al portapapeles");
}

function alternarTema() {
    document.body.classList.toggle('dark-mode');
    const esOscuro = document.body.classList.contains('dark-mode');
    document.getElementById('btn-tema').innerText = esOscuro ? '☀️ Claro' : '🌙 Oscuro';
}

function mostrarToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}// ============================================================================
// 1. CONFIGURACIÓN Y CONEXIÓN A SUPABASE
// ============================================================================
const SUPABASE_URL = 'https://tjflvdvnsxmrkouleoyn.supabase.co';
const SUPABASE_ANON_KEY = 'PEGA_AQUI_TU_CLAVE_PUBLISHABLE'; // Ej: sb_publishable_...
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const URL_MICROSOFT_FORMS = "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=CkbVXyW03kmb0PzSYnDTDHJyTl3EI1JImzWpf0AOFcFUQVRVUkRGUUlNNzhDUktCNjBSN0hQOVozWi4u";

const METAS_DIARIAS = {
    'Full Time': 45,
    'Part Time': 25
};

// Tipificaciones alineadas a los 4 resultados exactos de tu columna 'GESTION'
const SUBMOTIVOS_CONFIG = {
    'CONFIRMO': [
        'Confirma visita con titular en llamada',
        'Confirma visita con familiar autorizado',
        'Confirma adelanto de visita (AM0)'
    ],
    'NO CONTESTA': [
        'Ciclo 1 - No contesta / Buzón de voz',
        'Ciclo 2 - Corta llamada / Sin audio',
        'Ciclo 3 - Número equivocado / Fuera de servicio'
    ],
    'REPROGRAMADO': [
        'Reprogramación a solicitud del cliente',
        'Reprogramación por falta de cuota técnica',
        'Reprogramación por incidencia externa'
    ],
    'RECHAZADO': [
        '1. Cliente ya cuenta con servicio instalado',
        '2. Desiste del servicio por demora',
        '3. Dirección errada / Sin cobertura técnica',
        '4. Titular no reconoce solicitud de venta',
        '5. Duplicidad de SOT en sistema',
        '6. Cliente solicita baja / cancelación',
        '7. Falta de facilidades técnicas en domicilio',
        '8. Fuera de zona de atención asignada'
    ]
};

let usuarioActivo = null;
let usuarioTemporal = null;
let gestionesDelDiaLocal = [];
let horaInicioActividad = new Date().toISOString();

// ============================================================================
// 2. INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const hoy = obtenerFechaLima();
    const mesActual = hoy.slice(0, 7);
    
    if (document.getElementById('fecha-visita')) document.getElementById('fecha-visita').value = hoy;
    if (document.getElementById('admin-filtro-fecha')) document.getElementById('admin-filtro-fecha').value = hoy;
    if (document.getElementById('admin-filtro-mes')) document.getElementById('admin-filtro-mes').value = mesActual;
    
    actualizarSubcategorias();

    const sesionGuardada = localStorage.getItem('sesion_hitss_v3');
    if (sesionGuardada) {
        usuarioActivo = JSON.parse(sesionGuardada);
        mostrarInterfazPorRol(usuarioActivo);
    }
});

function obtenerFechaLima() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }); // Formato YYYY-MM-DD
}

function obtenerHoraLima() {
    return parseInt(new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit' }), 10);
}

// ============================================================================
// 3. CONTROL DE ACCESO INTELIGENTE (LOGIN / ACTIVACIÓN / REGISTRO)
// ============================================================================
async function verificarCodigoE() {
    const codigo = document.getElementById('input-codigo-e').value.toUpperCase().trim();
    if (!codigo) return mostrarToast("⚠️ Ingresa tu Usuario E");

    const { data: user, error } = await supabaseClient
        .from('usuarios')
        .select('*')
        .eq('codigo_e', codigo)
        .single();

    document.getElementById('paso-codigo').style.display = 'none';

    if (user) {
        if (!user.activo) {
            alert("Este usuario se encuentra inactivo. Contacta a tu supervisor.");
            return reiniciarLogin();
        }
        usuarioTemporal = user;
        if (user.password_pin) {
            document.getElementById('saludo-reconocido').innerText = `Hola, ${user.nombre_completo}`;
            document.getElementById('detalle-reconocido').innerText = `${user.codigo_e} • ${user.modalidad} • ${user.area}`;
            document.getElementById('paso-login').style.display = 'block';
        } else {
            document.getElementById('saludo-activar').innerText = `¡Bienvenido, ${user.nombre_completo}!`;
            document.getElementById('detalle-activar').innerText = `${user.codigo_e} • ${user.modalidad} • Área: ${user.area}`;
            document.getElementById('paso-activar').style.display = 'block';
        }
    } else {
        usuarioTemporal = { codigo_e: codigo };
        document.getElementById('paso-registro-nuevo').style.display = 'block';
    }
}

function validarPassword() {
    const pass = document.getElementById('login-pass').value.trim();
    if (pass === usuarioTemporal.password_pin) {
        completarLogin(usuarioTemporal);
    } else {
        mostrarToast("❌ Contraseña incorrecta");
    }
}

async function activarCuenta() {
    const nuevaPass = document.getElementById('nueva-pass').value.trim();
    if (nuevaPass.length < 4) return mostrarToast("⚠️ La clave debe tener al menos 4 caracteres");

    const { data, error } = await supabaseClient
        .from('usuarios')
        .update({ password_pin: nuevaPass })
        .eq('codigo_e', usuarioTemporal.codigo_e)
        .select()
        .single();

    if (error) return mostrarToast("❌ Error al activar cuenta");
    mostrarToast("✅ Cuenta activada correctamente");
    completarLogin(data);
}

async function registrarDesdeCero() {
    const nombre = document.getElementById('reg-nombre').value.toUpperCase().trim();
    const modalidad = document.getElementById('reg-modalidad').value;
    const area = document.getElementById('reg-area').value;
    const pass = document.getElementById('reg-pass').value.trim();

    if (!nombre || pass.length < 4) return mostrarToast("⚠️ Completa tu nombre y una clave de mínimo 4 caracteres");

    const { data, error } = await supabaseClient
        .from('usuarios')
        .insert([{
            codigo_e: usuarioTemporal.codigo_e,
            nombre_completo: nombre,
            modalidad: modalidad,
            area: area,
            password_pin: pass,
            fecha_ingreso: obtenerFechaLima(),
            rol: 'ADP',
            activo: true
        }])
        .select()
        .single();

    if (error) return mostrarToast("❌ Error al registrar: " + error.message);
    mostrarToast("✅ Registro completado");
    completarLogin(data);
}

function completarLogin(user) {
    usuarioActivo = user;
    localStorage.setItem('sesion_hitss_v3', JSON.stringify(user));
    mostrarInterfazPorRol(user);
}

function mostrarInterfazPorRol(user) {
    document.getElementById('pantalla-auth').style.display = 'none';
    document.getElementById('app-principal').style.display = 'block';
    document.getElementById('badge-rol-activo').innerText = `${user.rol} • ${user.area}`;
    document.getElementById('info-usuario-topbar').innerText = `${user.nombre_completo} (${user.codigo_e})`;

    // Seleccionar por defecto la cola según su área en Leyenda
    if (user.area === 'Migraciónes' && document.getElementById('cola-manual')) {
        document.getElementById('cola-manual').value = 'MIGRACIONES';
    }

    if (user.rol === 'ADMIN') {
        document.getElementById('vista-admin').style.display = 'block';
        document.getElementById('vista-adp').style.display = 'none';
        cargarDashboardSupervisor();
    } else {
        document.getElementById('vista-adp').style.display = 'block';
        document.getElementById('vista-admin').style.display = 'none';
        cargarDatosPersonalesADP();
    }
}

function reiniciarLogin() {
    usuarioTemporal = null;
    document.getElementById('paso-codigo').style.display = 'block';
    document.getElementById('paso-login').style.display = 'none';
    document.getElementById('paso-activar').style.display = 'none';
    document.getElementById('paso-registro-nuevo').style.display = 'none';
}

function cerrarSesion() {
    localStorage.removeItem('sesion_hitss_v3');
    location.reload();
}

// ============================================================================
// 4. OPERACIÓN DEL ASESOR (REGEX TOA + PLANTILLA + SUPABASE + FORMS)
// ============================================================================
function procesarTextoTOA() {
    const raw = document.getElementById('texto-toa').value;
    if (!raw.trim()) return mostrarToast("⚠️ Pega el texto de TOA primero");

    // Marcar hora de inicio real de gestión para medir tiempo operativo
    horaInicioActividad = new Date().toISOString();

    const sotMatch = raw.match(/(?:SOT|Orden|Actividad)[:\s#-]*(\d{7,10})/i) || raw.match(/\b(\d{8,9})\b/);
    const telMatch = raw.match(/(?:Tel[eé]fono|Celular|M[oó]vil|Contacto)[:\s]*([9]\d{8})/i) || raw.match(/\b(9\d{8})\b/);
    const clienteMatch = raw.match(/(?:Cliente|Titular|Nombre)[:\s]*([A-ZÁÉÍÓÚÑ\s]{5,45})(?:\n|Tel|Dir|SOT|$)/i);
    const contrataMatch = raw.match(/(?:Contrata|Empresa|Proveedor)[:\s]*([A-Z0-9\s.-]{3,30})(?:\n|$)/i);

    document.getElementById('campo-sot').value = sotMatch ? sotMatch[1] : '';
    document.getElementById('campo-telefono').value = telMatch ? telMatch[1] : '';
    document.getElementById('campo-cliente').value = clienteMatch ? clienteMatch[1].trim().toUpperCase() : '';
    document.getElementById('campo-contrata').value = contrataMatch ? contrataMatch[1].trim().toUpperCase() : 'SAVAL';

    // Detectar Departamento del Perú automáticamente si aparece en el texto de TOA
    const selectDepto = document.getElementById('campo-departamento');
    const textoUpper = raw.toUpperCase();
    for (let opt of selectDepto.options) {
        if (textoUpper.includes(opt.value)) {
            selectDepto.value = opt.value;
            break;
        }
    }

    mostrarToast("✅ Datos extraídos de TOA");
}

function actualizarSubcategorias() {
    const cat = document.getElementById('cat-principal').value;
    const selectSub = document.getElementById('sub-motivo');
    selectSub.innerHTML = '';
    (SUBMOTIVOS_CONFIG[cat] || []).forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.innerText = sub;
        selectSub.appendChild(opt);
    });
}

async function generarYGuardarPlantilla() {
    const sot = document.getElementById('campo-sot').value.trim();
    const telefono = document.getElementById('campo-telefono').value.trim() || 'S/N';
    const departamento = document.getElementById('campo-departamento').value;
    const cliente = document.getElementById('campo-cliente').value.trim().toUpperCase() || 'TITULAR';
    const contrata = document.getElementById('campo-contrata').value.trim().toUpperCase() || 'CONTRATA';
    const gestion = document.getElementById('cat-principal').value;
    const colaManual = document.getElementById('cola-manual').value;
    const submotivo = document.getElementById('sub-motivo').value;
    const fechaCliente = document.getElementById('fecha-visita').value;
    const franja = document.getElementById('franja-horaria').value;
    const idLlamada = document.getElementById('id-llamada').value.trim() || 'S/N';

    if (!sot) return mostrarToast("⚠️ Ingresa o extrae el número de SOT");

    const partesFecha = fechaCliente.split('-');
    const fechaCorta = partesFecha.length === 3 ? `${partesFecha[2]}/${partesFecha[1]}` : fechaCliente;

    const plantillaTexto = 
`MESA MULTISKILL HITSS - ${gestion} (${colaManual})
SOT: ${sot}
DÍA Y FRANJA: ${fechaCorta} ${franja}
DEPARTAMENTO: ${departamento}
CLIENTE: ${cliente}
NÚMERO: ${telefono}
CONTRATA: ${contrata}
MOTIVO: ${submotivo}
ID DE LLAMADA: ${idLlamada}
ASESOR: ${usuarioActivo.nombre_completo} (${usuarioActivo.codigo_e})`;

    document.getElementById('plantilla-resultado').value = plantillaTexto;

    // 1. Copiar al portapapeles de inmediato
    try {
        await navigator.clipboard.writeText(plantillaTexto);
    } catch (e) {
        console.warn("No se pudo copiar automáticamente:", e);
    }

    // 2. Detectar automáticamente columna '¿YA TIENE GESTION?' (SI / NO)
    const yaTieneGestionHoy = gestionesDelDiaLocal.some(g => g.sot === sot) ? 'SI' : 'NO';
    if (yaTieneGestionHoy === 'SI') {
        const confirmar = confirm(`⚠️ La SOT ${sot} ya registra una gestión previa hoy (se marcará ¿YA TIENE GESTION? = SI). ¿Continuar?`);
        if (!confirmar) return;
    }

    // 3. Guardar en Supabase con exactamente las columnas de 'Sheet1'
    const abrirForms = document.getElementById('check-abrir-forms').checked;
    const ahora = new Date();
    const { error } = await supabaseClient.from('gestiones_sot').insert([{
        usuario_e: usuarioActivo.codigo_e,
        sot: sot,
        fecha_desea_cliente: fechaCliente,
        franja: franja,
        hora_inicio: horaInicioActividad,
        hora_finalizacion: ahora.toISOString(),
        fecha_gestion: obtenerFechaLima(),
        intervalo: obtenerHoraLima(),
        gestion: gestion,
        submotivo: submotivo,
        departamento: departamento,
        ya_tiene_gestion: yaTieneGestionHoy,
        sot_gestionada_manual: colaManual,
        id_llamada: idLlamada,
        cliente_nombre: cliente,
        telefono_cliente: telefono,
        contrata: contrata,
        enviado_forms: abrirForms
    }]);

    // Reiniciar reloj para la siguiente SOT
    horaInicioActividad = new Date().toISOString();

    if (error) {
        mostrarToast("⚠️ Copiada, pero falló guardado en nube: " + error.message);
    } else {
        mostrarToast("✅ Plantilla copiada y SOT registrada en BD");
        cargarDatosPersonalesADP();
    }

    if (abrirForms) abrirMicrosoftForms();
}

function abrirMicrosoftForms() {
    window.open(URL_MICROSOFT_FORMS, '_blank');
}

function generarFormatoFranja() {
    const sup = document.getElementById('sup-franja').value.toUpperCase().trim() || 'SUPERVISOR EN TURNO';
    const sot = document.getElementById('campo-sot').value.trim() || 'S/N';
    const franja = document.getElementById('franja-horaria').value;
    const fecha = document.getElementById('fecha-visita').value;

    document.getElementById('resultado-franja').value = 
`SOLICITUD DE HABILITACIÓN DE FRANJA
PARA: ${sup}
SOT: ${sot}
FECHA / FRANJA REQUERIDA: ${fecha} - ${franja}
SOLICITADO POR: ${usuarioActivo.nombre_completo} (${usuarioActivo.codigo_e})`;
}

// ============================================================================
// 5. PANEL DE AVANCE PERSONAL Y RANKING DEL ADP
// ============================================================================
async function cargarDatosPersonalesADP() {
    const hoy = obtenerFechaLima();

    const { data: todasHoy, error } = await supabaseClient
        .from('gestiones_sot')
        .select('*')
        .eq('fecha_gestion', hoy)
        .order('hora_finalizacion', { ascending: true });

    if (error) return console.error(error);

    gestionesDelDiaLocal = todasHoy.filter(g => g.usuario_e === usuarioActivo.codigo_e);
    const totalMio = gestionesDelDiaLocal.length;
    const confirmadosMios = gestionesDelDiaLocal.filter(g => g.gestion === 'CONFIRMO').length;
    const meta = METAS_DIARIAS[usuarioActivo.modalidad] || 45;
    const porcentaje = Math.round((totalMio / meta) * 100);

    // Cadencia promedio en minutos
    let cadenciaTxt = "Sin registros";
    if (totalMio > 1) {
        const t1 = new Date(gestionesDelDiaLocal[0].hora_finalizacion);
        const t2 = new Date(gestionesDelDiaLocal[totalMio - 1].hora_finalizacion);
        const promMin = (((t2 - t1) / 60000) / (totalMio - 1)).toFixed(1);
        cadenciaTxt = `1 SOT cada ${promMin} min`;
    } else if (totalMio === 1) {
        cadenciaTxt = "1er registro del turno";
    }

    // Ranking del turno
    const conteoPorAsesor = {};
    todasHoy.forEach(g => {
        conteoPorAsesor[g.usuario_e] = (conteoPorAsesor[g.usuario_e] || 0) + 1;
    });
    const rankingOrdenado = Object.entries(conteoPorAsesor).sort((a, b) => b[1] - a[1]);
    const miPosicion = rankingOrdenado.findIndex(item => item[0] === usuarioActivo.codigo_e) + 1;

    document.getElementById('adp-avance-hoy').innerText = `${totalMio} / ${meta} SOTs`;
    document.getElementById('adp-porcentaje').innerText = `${porcentaje}% (${confirmadosMios} Confirm.)`;
    document.getElementById('adp-cadencia').innerText = cadenciaTxt;
    document.getElementById('adp-ranking').innerText = miPosicion > 0 ? `Puesto #${miPosicion} de ${rankingOrdenado.length}` : 'Sin ranking aún';

    // Renderizar Bloc Numerado
    const contenedorBloc = document.getElementById('lista-bloc');
    document.getElementById('contador-bloc').innerText = `Total: ${totalMio}`;

    if (totalMio === 0) {
        contenedorBloc.innerHTML = `<p class="empty-msg">Aún no hay gestiones registradas hoy.</p>`;
        return;
    }

    contenedorBloc.innerHTML = gestionesDelDiaLocal.map((g, index) => {
        const hora = new Date(g.hora_finalizacion).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        return `<div class="bloc-item"><strong>${index + 1}. SOT: ${g.sot}</strong> [${hora}] • ${g.franja}\nEstado: <strong>${g.gestion}</strong> (${g.sot_gestionada_manual})\nDepto: ${g.departamento} | ID: ${g.id_llamada}\n************************************</div>`;
    }).join('');
}

function exportarBlocTXT() {
    if (gestionesDelDiaLocal.length === 0) return mostrarToast("⚠️ No hay registros para exportar");
    const hoy = obtenerFechaLima();
    let contenido = `REPORTE DIARIO MESA MULTISKILL HITSS\nASESOR: ${usuarioActivo.nombre_completo} (${usuarioActivo.codigo_e})\nFECHA: ${hoy}\n====================================\n\n`;
    
    gestionesDelDiaLocal.forEach((g, idx) => {
        contenido += `${idx + 1}.\nSOT: ${g.sot}\nGestion: ${g.gestion}\nFranja: ${g.franja}\nDepartamento: ${g.departamento}\nCola: ${g.sot_gestionada_manual}\nMotivo: ${g.submotivo}\nID Llamada: ${g.id_llamada}\n************************************\n`;
    });

    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Registro_Gestiones_${usuarioActivo.codigo_e}_${hoy}.txt`;
    link.click();
}

// ============================================================================
// 6. DASHBOARD GERENCIAL DEL ADMINISTRADOR (REPLICA 'DINAMICA' + 'GESTION')
// ============================================================================
function cambiarModoFiltroAdmin() {
    const modo = document.getElementById('admin-modo-filtro').value;
    document.getElementById('admin-filtro-fecha').style.display = modo === 'dia' ? 'inline-block' : 'none';
    document.getElementById('admin-filtro-mes').style.display = modo === 'mes' ? 'inline-block' : 'none';
    cargarDashboardSupervisor();
}

function calcularMesesAntiguedad(fechaIngresoStr) {
    if (!fechaIngresoStr) return '0 meses';
    const ingreso = new Date(fechaIngresoStr);
    const hoy = new Date();
    const meses = (hoy.getFullYear() - ingreso.getFullYear()) * 12 + (hoy.getMonth() - ingreso.getMonth());
    return `${Math.max(0, meses)} meses`;
}

async function cargarDashboardSupervisor() {
    const modo = document.getElementById('admin-modo-filtro').value;
    const filtroArea = document.getElementById('admin-filtro-area').value;

    let queryAsesores = supabaseClient.from('usuarios').select('*').eq('rol', 'ADP').eq('activo', true);
    if (filtroArea !== 'TODAS') queryAsesores = queryAsesores.eq('area', filtroArea);
    const { data: asesores } = await queryAsesores;

    let queryGestiones = supabaseClient.from('gestiones_sot').select('*');
    let multiplicadorDias = 1;

    if (modo === 'dia') {
        const fecha = document.getElementById('admin-filtro-fecha').value;
        queryGestiones = queryGestiones.eq('fecha_gestion', fecha);
    } else {
        const mes = document.getElementById('admin-filtro-mes').value;
        queryGestiones = queryGestiones.gte('fecha_gestion', `${mes}-01`).lte('fecha_gestion', `${mes}-31`);
        multiplicadorDias = 22;
    }

    const { data: gestiones, error } = await queryGestiones;
    if (error) return console.error(error);

    const filasProcesadas = (asesores || []).map(adp => {
        const susGestiones = gestiones
            .filter(g => g.usuario_e === adp.codigo_e)
            .sort((a, b) => new Date(a.hora_finalizacion) - new Date(b.hora_finalizacion));

        const total = susGestiones.length;
        const meta = (METAS_DIARIAS[adp.modalidad] || 45) * multiplicadorDias;
        const cumple = total >= meta;

        // Cadencia promedio en minutos
        let cadenciaMin = null;
        if (total > 1) {
            const diffMin = (new Date(susGestiones[total - 1].hora_finalizacion) - new Date(susGestiones[0].hora_finalizacion)) / 60000;
            cadenciaMin = (diffMin / (total - 1)).toFixed(1);
        }

        // Intervalos horarios exactos de 'DINAMICA' (7 a 20+)
        const horas = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map(h => susGestiones.filter(g => g.intervalo === h).length);
        horas.push(susGestiones.filter(g => g.intervalo >= 20).length);

        // Desglose por GESTION
        const conf = susGestiones.filter(g => g.gestion === 'CONFIRMO').length;
        const noCont = susGestiones.filter(g => g.gestion === 'NO CONTESTA').length;
        const rech = susGestiones.filter(g => g.gestion === 'RECHAZADO').length;
        const repro = susGestiones.filter(g => g.gestion === 'REPROGRAMADO').length;

        return { adp, total, meta, cumple, cadenciaMin, horas, conf, noCont, rech, repro };
    }).sort((a, b) => b.total - a.total);

    // KPIs Globales
    const totalMesa = filasProcesadas.reduce((acc, f) => acc + f.total, 0);
    const totalConf = filasProcesadas.reduce((acc, f) => acc + f.conf, 0);
    const totalContactados = filasProcesadas.reduce((acc, f) => acc + (f.conf + f.rech + f.repro), 0);
    const pctConf = totalMesa > 0 ? Math.round((totalConf / totalMesa) * 100) : 0;
    const pctContactabilidad = totalMesa > 0 ? Math.round((totalContactados / totalMesa) * 100) : 0;

    const totalCumplen = filasProcesadas.filter(f => f.cumple).length;
    const cadenciasValidas = filasProcesadas.filter(f => f.cadenciaMin !== null).map(f => parseFloat(f.cadenciaMin));
    const promCadenciaMesa = cadenciasValidas.length > 0 
        ? (cadenciasValidas.reduce((a, b) => a + b, 0) / cadenciasValidas.length).toFixed(1) + ' min'
        : '-- min';

    document.getElementById('kpi-global-sots').innerText = totalMesa;
    document.getElementById('kpi-global-efectividad').innerText = `${pctConf}% / ${pctContactabilidad}%`;
    document.getElementById('kpi-global-cumplen').innerText = `${totalCumplen} / ${filasProcesadas.length}`;
    document.getElementById('kpi-global-cadencia').innerText = promCadenciaMesa;

    const tbody = document.getElementById('tabla-admin-body');
    tbody.innerHTML = filasProcesadas.map((f, idx) => `
        <tr>
            <td><strong>#${idx + 1}</strong></td>
            <td>${f.adp.nombre_completo}</td>
            <td>${calcularMesesAntiguedad(f.adp.fecha_ingreso)}</td>
            <td>${f.adp.modalidad}</td>
            <td>${f.adp.area}</td>
            ${f.horas.map(c => `<td>${c > 0 ? c : ''}</td>`).join('')}
            <td><strong>${f.conf}</strong></td>
            <td>${f.noCont}</td>
            <td>${f.rech}</td>
            <td>${f.repro}</td>
            <td><strong>${f.total}</strong> / ${f.meta}</td>
            <td><span class="${f.cumple ? 'badge-ok' : 'badge-warn'}">${f.cumple ? 'CUMPLE' : 'BAJO META'}</span></td>
            <td>${f.cadenciaMin ? `Cada ${f.cadenciaMin} min` : '-'}</td>
        </tr>
    `).join('');
}

function exportarReporteAdminCSV() {
    const tabla = document.getElementById('tabla-reporte-admin');
    let csv = [];
    for (let row of tabla.rows) {
        let cols = Array.from(row.cells).map(c => `"${c.innerText.replace(/\n/g, ' ')}"`);
        csv.push(cols.join(','));
    }
    const blob = new Blob(["\uFEFF" + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Productividad_HITSS_${obtenerFechaLima()}.csv`;
    link.click();
}

// ============================================================================
// 7. UTILIDADES
// ============================================================================
function limpiarCampos() {
    ['texto-toa', 'campo-sot', 'campo-telefono', 'campo-cliente', 'campo-contrata', 'plantilla-resultado'].forEach(id => {
        document.getElementById(id).value = '';
    });
    mostrarToast("🧹 Campos limpiados");
}

function copiarTextoElemento(id) {
    const el = document.getElementById(id);
    if (!el.value) return mostrarToast("⚠️ No hay texto para copiar");
    navigator.clipboard.writeText(el.value);
    mostrarToast("📋 Texto copiado al portapapeles");
}

function alternarTema() {
    document.body.classList.toggle('dark-mode');
    const esOscuro = document.body.classList.contains('dark-mode');
    document.getElementById('btn-tema').innerText = esOscuro ? '☀️ Claro' : '🌙 Oscuro';
}

function mostrarToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}
