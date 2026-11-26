// ============================================================================
// 1. CONFIGURACIÓN Y CONEXIÓN A SUPABASE (POSTGRESQL EN LA NUBE)
// ============================================================================
const SUPABASE_URL = 'https://tjflvdvnsxmrkouleoyn.supabase.co';
const SUPABASE_ANON_KEY = 'PEGA_AQUI_TU_CLAVE_PUBLISHABLE'; // Ej: sb_publishable_...
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Link oficial del formulario corporativo HITSS
const URL_MICROSOFT_FORMS = "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=CkbVXyW03kmb0PzSYnDTDHJyTl3EI1JImzWpf0AOFcFUQVRVUkRGUUlNNzhDUktCNjBSN0hQOVozWi4u";

// Metas diarias mínimas por modalidad
const METAS_DIARIAS = {
    'Full Time': 45,
    'Part Time': 25
};

// Diccionario de submotivos operativos (Mantenibilidad modular RNF-10)
const SUBMOTIVOS_CONFIG = {
    'CONFIRMA': [
        'Confirma visita en llamada con titular',
        'Confirma visita con familiar autorizado',
        'Confirma adelanto de visita (AM0)'
    ],
    'CICLO': [
        'Ciclo 1 - No contesta / Buzón de voz',
        'Ciclo 2 - Corta llamada / Sin audio',
        'Ciclo 3 - Número equivocado / Fuera de servicio'
    ],
    'REPROGRAMA': [
        'Reprogramación a solicitud del cliente',
        'Reprogramación por falta de cuota técnica',
        'Reprogramación por incidencia climática / externa'
    ],
    'RECHAZO': [
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

// ============================================================================
// 2. INICIALIZACIÓN AL CARGAR LA PÁGINA
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const hoy = new Date().toISOString().split('T')[0];
    const mesActual = hoy.slice(0, 7);
    
    if (document.getElementById('fecha-visita')) document.getElementById('fecha-visita').value = hoy;
    if (document.getElementById('admin-filtro-fecha')) document.getElementById('admin-filtro-fecha').value = hoy;
    if (document.getElementById('admin-filtro-mes')) document.getElementById('admin-filtro-mes').value = mesActual;
    
    actualizarSubcategorias();

    // Verificar si ya hay sesión iniciada en el navegador
    const sesionGuardada = localStorage.getItem('sesion_hitss_v2');
    if (sesionGuardada) {
        usuarioActivo = JSON.parse(sesionGuardada);
        mostrarInterfazPorRol(usuarioActivo);
    }
});

// ============================================================================
// 3. CONTROL DE ACCESO INTELIGENTE (LOGIN / ACTIVACIÓN / REGISTRO)
// ============================================================================
async function verificarCodigoE() {
    const codigo = document.getElementById('input-codigo-e').value.toUpperCase().trim();
    if (!codigo) return mostrarToast("⚠️ Ingresa tu Código E");

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
            document.getElementById('detalle-reconocido').innerText = `${user.codigo_e} • ${user.modalidad} (${user.rol})`;
            document.getElementById('paso-login').style.display = 'block';
        } else {
            document.getElementById('saludo-activar').innerText = `¡Bienvenido, ${user.nombre_completo}!`;
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

    if (error) return mostrarToast("❌ Error al guardar contraseña");
    mostrarToast("✅ Cuenta activada correctamente");
    completarLogin(data);
}

async function registrarDesdeCero() {
    const nombre = document.getElementById('reg-nombre').value.toUpperCase().trim();
    const modalidad = document.getElementById('reg-modalidad').value;
    const pass = document.getElementById('reg-pass').value.trim();

    if (!nombre || pass.length < 4) return mostrarToast("⚠️ Completa tu nombre y una clave de mínimo 4 caracteres");

    const { data, error } = await supabaseClient
        .from('usuarios')
        .insert([{
            codigo_e: usuarioTemporal.codigo_e,
            nombre_completo: nombre,
            modalidad: modalidad,
            password_pin: pass,
            fecha_ingreso: new Date().toISOString().split('T')[0],
            rol: 'ADP',
            activo: true
        }])
        .select()
        .single();

    if (error) return mostrarToast("❌ Error al registrar usuario: " + error.message);
    mostrarToast("✅ Registro completado");
    completarLogin(data);
}

function completarLogin(user) {
    usuarioActivo = user;
    localStorage.setItem('sesion_hitss_v2', JSON.stringify(user));
    mostrarInterfazPorRol(user);
}

function mostrarInterfazPorRol(user) {
    document.getElementById('pantalla-auth').style.display = 'none';
    document.getElementById('app-principal').style.display = 'block';
    document.getElementById('badge-rol-activo').innerText = user.rol;
    document.getElementById('info-usuario-topbar').innerText = `${user.nombre_completo} (${user.codigo_e})`;

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
    localStorage.removeItem('sesion_hitss_v2');
    location.reload();
}

// ============================================================================
// 4. MÓDULO OPERATIVO DEL ASESOR (REGEX + PLANTILLAS + SUPABASE + FORMS)
// ============================================================================
function procesarTextoTOA() {
    const raw = document.getElementById('texto-toa').value;
    if (!raw.trim()) return mostrarToast("⚠️ Pega el texto de TOA primero");

    // Extracción mediante Expresiones Regulares (RF-03)
    const sotMatch = raw.match(/(?:SOT|Orden|Actividad)[:\s#-]*(\d{7,10})/i) || raw.match(/\b(\d{8,9})\b/);
    const telMatch = raw.match(/(?:Tel[eé]fono|Celular|M[oó]vil|Contacto)[:\s]*([9]\d{8})/i) || raw.match(/\b(9\d{8})\b/);
    const clienteMatch = raw.match(/(?:Cliente|Titular|Nombre)[:\s]*([A-ZÁÉÍÓÚÑ\s]{5,45})(?:\n|Tel|Dir|SOT|$)/i);
    const contrataMatch = raw.match(/(?:Contrata|Empresa|Proveedor)[:\s]*([A-Z0-9\s.-]{3,30})(?:\n|$)/i);

    document.getElementById('campo-sot').value = sotMatch ? sotMatch[1] : 'NO ENCONTRADO';
    document.getElementById('campo-telefono').value = telMatch ? telMatch[1] : 'NO ENCONTRADO';
    document.getElementById('campo-cliente').value = clienteMatch ? clienteMatch[1].trim().toUpperCase() : '';
    document.getElementById('campo-contrata').value = contrataMatch ? contrataMatch[1].trim().toUpperCase() : 'SAVAL';

    mostrarToast("✅ Datos extraídos con RegEx");
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
    const telefono = document.getElementById('campo-telefono').value.trim();
    const cliente = document.getElementById('campo-cliente').value.trim().toUpperCase() || 'TITULAR';
    const contrata = document.getElementById('campo-contrata').value.trim().toUpperCase() || 'CONTRATA';
    const categoria = document.getElementById('cat-principal').value;
    const submotivo = document.getElementById('sub-motivo').value;
    const fecha = document.getElementById('fecha-visita').value;
    const franja = document.getElementById('franja-horaria').value;
    const idLlamada = document.getElementById('id-llamada').value.trim() || 'S/N';

    if (!sot || sot === 'NO ENCONTRADO') {
        return mostrarToast("⚠️ Verifica el número de SOT antes de generar");
    }

    // Formatear fecha DD/MM
    const partesFecha = fecha.split('-');
    const fechaCorta = partesFecha.length === 3 ? `${partesFecha[2]}/${partesFecha[1]}` : fecha;

    // Construir plantilla oficial estandarizada
    const plantillaTexto = 
`MESA MULTISKILL HITSS - ${categoria}
SOT: ${sot}
DÍA Y FRANJA: ${fechaCorta} ${franja}
CLIENTE: ${cliente}
NÚMERO: ${telefono}
CONTRATA: ${contrata}
MOTIVO: ${submotivo}
ID DE LLAMADA: ${idLlamada}
ASESOR: ${usuarioActivo.nombre_completo} (${usuarioActivo.codigo_e})`;

    document.getElementById('plantilla-resultado').value = plantillaTexto;

    // 1. Copiar al portapapeles de inmediato (Prioridad operativa)
    try {
        await navigator.clipboard.writeText(plantillaTexto);
    } catch (e) {
        console.warn("No se pudo copiar automáticamente:", e);
    }

    // 2. Validar duplicidad en el turno actual (RF-08)
    const yaExiste = gestionesDelDiaLocal.some(g => g.numero_sot === sot && g.categoria_gestion === categoria);
    if (yaExiste) {
        const confirmar = confirm(`⚠️ La SOT ${sot} ya tiene una gestión de tipo ${categoria} registrada hoy. ¿Deseas guardarla nuevamente?`);
        if (!confirmar) return;
    }

    // 3. Guardar de forma asíncrona en Supabase (PostgreSQL)
    const abrirForms = document.getElementById('check-abrir-forms').checked;
    const { error } = await supabaseClient.from('gestiones_sot').insert([{
        codigo_e: usuarioActivo.codigo_e,
        numero_sot: sot,
        tipo_servicio: contrata,
        categoria_gestion: categoria,
        submotivo: submotivo,
        id_llamada: idLlamada,
        enviado_forms: abrirForms
    }]);

    if (error) {
        mostrarToast("⚠️ Copiada al portapapeles, pero falló sincronización en nube: " + error.message);
    } else {
        mostrarToast("✅ Plantilla copiada y registrada en Base de Datos");
        cargarDatosPersonalesADP(); // Refresca KPIs y bloc
    }

    // 4. Abrir Microsoft Forms corporativo si está marcado
    if (abrirForms) {
        abrirMicrosoftForms(sot);
    }
}

function abrirMicrosoftForms(sot = '') {
    // Abre el formulario oficial en nueva pestaña (si se configuran parámetros pre-llenados en Forms se anexan aquí)
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
    const hoy = new Date().toISOString().split('T')[0];

    // Consultar todas las gestiones de hoy para calcular el ranking del turno
    const { data: todasHoy, error } = await supabaseClient
        .from('gestiones_sot')
        .select('*')
        .eq('fecha_gestion', hoy)
        .order('created_at', { ascending: true });

    if (error) return console.error(error);

    // Filtrar las del asesor actual
    gestionesDelDiaLocal = todasHoy.filter(g => g.codigo_e === usuarioActivo.codigo_e);
    const totalMio = gestionesDelDiaLocal.length;
    const meta = METAS_DIARIAS[usuarioActivo.modalidad] || 45;
    const porcentaje = Math.round((totalMio / meta) * 100);

    // Calcular cadencia (cada cuántos minutos registra una SOT)
    let cadenciaTxt = "Sin registros";
    if (totalMio > 1) {
        const t1 = new Date(gestionesDelDiaLocal[0].created_at);
        const t2 = new Date(gestionesDelDiaLocal[totalMio - 1].created_at);
        const promMin = (((t2 - t1) / 60000) / (totalMio - 1)).toFixed(1);
        cadenciaTxt = `1 SOT cada ${promMin} min`;
    } else if (totalMio === 1) {
        cadenciaTxt = "1er registro del turno";
    }

    // Calcular posición en ranking del día
    const conteoPorAsesor = {};
    todasHoy.forEach(g => {
        conteoPorAsesor[g.codigo_e] = (conteoPorAsesor[g.codigo_e] || 0) + 1;
    });
    const rankingOrdenado = Object.entries(conteoPorAsesor).sort((a, b) => b[1] - a[1]);
    const miPosicion = rankingOrdenado.findIndex(item => item[0] === usuarioActivo.codigo_e) + 1;

    // Pintar KPIs en barra superior
    document.getElementById('adp-avance-hoy').innerText = `${totalMio} / ${meta} SOTs`;
    document.getElementById('adp-porcentaje').innerText = `${porcentaje}%`;
    document.getElementById('adp-cadencia').innerText = cadenciaTxt;
    document.getElementById('adp-ranking').innerText = miPosicion > 0 ? `Puesto #${miPosicion} de ${rankingOrdenado.length}` : 'Sin ranking aún';

    // Pintar Bloc Numerado (Columna 3)
    const contenedorBloc = document.getElementById('lista-bloc');
    document.getElementById('contador-bloc').innerText = `Total: ${totalMio}`;

    if (totalMio === 0) {
        contenedorBloc.innerHTML = `<p class="empty-msg">Aún no hay gestiones registradas hoy.</p>`;
        return;
    }

    contenedorBloc.innerHTML = gestionesDelDiaLocal.map((g, index) => {
        const hora = new Date(g.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        return `<div class="bloc-item"><strong>${index + 1}. SOT: ${g.numero_sot}</strong> [${hora}]\nCategoría: ${g.categoria_gestion} | ID: ${g.id_llamada}\nMotivo: ${g.submotivo}\n************************************</div>`;
    }).join('');
}

function exportarBlocTXT() {
    if (gestionesDelDiaLocal.length === 0) return mostrarToast("⚠️ No hay registros para exportar");
    const hoy = new Date().toISOString().split('T')[0];
    let contenido = `REPORTE DIARIO MESA MULTISKILL HITSS\nASESOR: ${usuarioActivo.nombre_completo} (${usuarioActivo.codigo_e})\nFECHA: ${hoy}\n====================================\n\n`;
    
    gestionesDelDiaLocal.forEach((g, idx) => {
        contenido += `${idx + 1}.\nNumero SOT: ${g.numero_sot}\nCategoria: ${g.categoria_gestion}\nSubmotivo: ${g.submotivo}\nID Llamada: ${g.id_llamada}\n************************************\n`;
    });

    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Registro_Gestiones_${usuarioActivo.codigo_e}_${hoy}.txt`;
    link.click();
}

// ============================================================================
// 6. DASHBOARD GERENCIAL DEL ADMINISTRADOR (MATRIZ HORARIA + KPIS + CADENCIA)
// ============================================================================
function cambiarModoFiltroAdmin() {
    const modo = document.getElementById('admin-modo-filtro').value;
    document.getElementById('admin-filtro-fecha').style.display = modo === 'dia' ? 'inline-block' : 'none';
    document.getElementById('admin-filtro-mes').style.display = modo === 'mes' ? 'inline-block' : 'none';
    cargarDashboardSupervisor();
}

async function cargarDashboardSupervisor() {
    const modo = document.getElementById('admin-modo-filtro').value;
    const { data: asesores } = await supabaseClient.from('usuarios').select('*').eq('rol', 'ADP').eq('activo', true);

    let queryGestiones = supabaseClient.from('gestiones_sot').select('*');
    let multiplicadorDias = 1;

    if (modo === 'dia') {
        const fecha = document.getElementById('admin-filtro-fecha').value;
        queryGestiones = queryGestiones.eq('fecha_gestion', fecha);
    } else {
        const mes = document.getElementById('admin-filtro-mes').value; // YYYY-MM
        queryGestiones = queryGestiones.gte('fecha_gestion', `${mes}-01`).lte('fecha_gestion', `${mes}-31`);
        multiplicadorDias = 22; // Días laborables promedio al mes
    }

    const { data: gestiones, error } = await queryGestiones;
    if (error) return console.error(error);

    // Procesar métricas por cada ADP y ordenar por productividad (Ranking)
    const filasProcesadas = (asesores || []).map(adp => {
        const susGestiones = gestiones
            .filter(g => g.codigo_e === adp.codigo_e)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const total = susGestiones.length;
        const meta = (METAS_DIARIAS[adp.modalidad] || 45) * multiplicadorDias;
        const cumple = total >= meta;

        // Calcular cadencia promedio en minutos
        let cadenciaMin = null;
        if (total > 1) {
            const diffMin = (new Date(susGestiones[total - 1].created_at) - new Date(susGestiones[0].created_at)) / 60000;
            cadenciaMin = (diffMin / (total - 1)).toFixed(1);
        }

        // Intervalos horarios (6 a 14+)
        const horas = [6, 7, 8, 9, 10, 11, 12, 13].map(h => susGestiones.filter(g => g.hora_intervalo === h).length);
        const hora14Mas = susGestiones.filter(g => g.hora_intervalo >= 14).length;
        horas.push(hora14Mas);

        const enForms = susGestiones.filter(g => g.enviado_forms).length;

        return { adp, total, meta, cumple, cadenciaMin, horas, enForms };
    }).sort((a, b) => b.total - a.total);

    // Actualizar tarjetas globales
    const totalMesa = filasProcesadas.reduce((acc, f) => acc + f.total, 0);
    const totalCumplen = filasProcesadas.filter(f => f.cumple).length;
    const totalFormsMesa = filasProcesadas.reduce((acc, f) => acc + f.enForms, 0);
    const cadenciasValidas = filasProcesadas.filter(f => f.cadenciaMin !== null).map(f => parseFloat(f.cadenciaMin));
    const promCadenciaMesa = cadenciasValidas.length > 0 
        ? (cadenciasValidas.reduce((a, b) => a + b, 0) / cadenciasValidas.length).toFixed(1) + ' min'
        : '-- min';

    document.getElementById('kpi-global-sots').innerText = totalMesa;
    document.getElementById('kpi-global-cumplen').innerText = `${totalCumplen} / ${filasProcesadas.length}`;
    document.getElementById('kpi-global-cadencia').innerText = promCadenciaMesa;
    document.getElementById('kpi-global-forms').innerText = totalMesa > 0 ? `${Math.round((totalFormsMesa / totalMesa) * 100)}%` : '0%';

    // Renderizar filas de la matriz
    const tbody = document.getElementById('tabla-admin-body');
    tbody.innerHTML = filasProcesadas.map((f, idx) => `
        <tr>
            <td><strong>#${idx + 1}</strong></td>
            <td>${f.adp.nombre_completo}</td>
            <td>${f.adp.fecha_ingreso || '-'}</td>
            <td>${f.adp.modalidad}</td>
            ${f.horas.map(c => `<td>${c > 0 ? c : ''}</td>`).join('')}
            <td><strong>${f.total}</strong> / ${f.meta}</td>
            <td><span class="${f.cumple ? 'badge-ok' : 'badge-warn'}">${f.cumple ? 'CUMPLE' : 'BAJO META'}</span></td>
            <td>${f.cadenciaMin ? `Cada ${f.cadenciaMin} min` : 'Sin datos'}</td>
            <td>${f.enForms} / ${f.total}</td>
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
    link.download = `Reporte_Productividad_HITSS_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// ============================================================================
// 7. UTILIDADES DE INTERFAZ
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
