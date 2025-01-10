const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot');
const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MongoAdapter = require('@bot-whatsapp/database/mongo');
const { config } = require('dotenv');
config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

mongoose.connect(process.env.MONGO_DB_URI);

const historySchema = new mongoose.Schema({
    answer: String,
    from: String,
    options: Array,
    date: Date,
    validado: String,
    tipoReg: String,
    nombreCompleto: String,
    valor: String,
    idPregunta: String,
    validacionPreg: String,
    rutadelmapa: String
});
const historyModel = mongoose.model('History', historySchema, 'history');

const requestsSchema = new mongoose.Schema({
    numero: String,
    nombreCompleto: String,
    tipoSolicitud: String,
    Ubicacion: String,
    ci: String,
    expedido: String,
    fecha: Date,
    paterno: String,
    materno: String,
    nombres: String,
    convideo: String,
    ubicacionurl: String,
    rutadelmapa: String
});
const requestsModel = mongoose.model('Requests', requestsSchema, 'requests');

const registrarSolicitudes = async (campos) => {
    const dato = await requestsModel.create(campos);
    return dato;
}

async function saludoInicial() {
    console.log("Demora");
    try {
        const response = await axios.get('https://amun.bo/wp-json/juevesAccion/v1/posts-categoria/100-jueves-accion', {
            timeout: 90000
        });
        return response.data
    } 
    catch (error) {
        console.log(error);
    }
}

async function consultarCI(numero, cedula) {
    try {
        const response = await axios.post(process.env.URL_CUIDADANO + '/wsRCIgob/ciudadano', {
            ci: cedula,
        }, {
            timeout: 90000
        });

        return response.data
    } catch (error) {
    }
}

async function registrarCiudadano(data) {
    try {
        const response = await axios.post(process.env.URL_CUIDADANO + '/wsRCIgob/new_reducido', data, {
            timeout: 90000
        });
        
        const valor = await obtenerRegistro(data.movil_codigo, data.ci, 'CI');
        const no = await obtenerRegistroNombrecompleto(data.movil_codigo, data.ci, `${data.paterno} ${data.materno} ${data.nombres}`);

        return response.data
    } catch (error) {
    }
}

async function enviarCorreo(usuario, ping, correo) {
    try {
        const cuerpo = `Su usuario: ${usuario}<br>Contraseña: ${ping}`;
        const asunto = "REGISTRO EXITOSO IGOB 24/7 GOBIERNO AUTÓNOMO MUNICIPAL DE LA PAZ";
        const para = correo;
        const ciudadano = "ciudadan@";
        const mensaje = "Gracias por registrarse en iGob 24/7, esperamos sugerencias en el PlayStore ANDROID y AppStore IOS para mejorar nuestros servicios.";
        const params = new URLSearchParams({
            cuerpo,
            asunto,
            para,
            ciudadano,
            mensaje,
        }).toString();
        const response = await axios.get(`http://200.105.139.183:9090/smsemail/email/mailgmail.php?${params}`, {
            timeout: 90000,
        });
        return response.data;
    } 
    catch (error) {
        console.error('Error al enviar el correo:', error.message);
        throw error;
    }
}

const obtenerResumen = async (numero) => {
    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));
    const dato = await historyModel.find(
        {
            from: numero,
            date: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        }
    )
    return dato;
}

const obtenerRegistros = async (numero) => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const dato = await historyModel.find(
        {
            validado: "validado",
            from: numero,
            date: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        }
    );
    return dato;
}

const obtenerRegistroNombrecompleto = async (numero, valor, nombre) => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    const total = await historyModel.updateMany(
        {
            from: numero,
            answer: valor,
            date: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        },
        {
            $set: { validado: "validado", nombreCompleto: nombre }
        }
    )
    return total;
}

const registroCantidadOpciones = async (numero, valor, idpreg) => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    const total = await historyModel.updateMany(
        {
            validacionPreg: {
                $nin: [
                    'cantidad',
                ]
            },
            from: numero,
            answer: valor,
            date: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        },
        {
            $set: { validacionPreg: "cantidad", idPregunta: idpreg }
        }
    )
    return total;
}

const obtenerCantidadesErroneas = async (numero, valor, idpreg) => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    const dato = await historyModel.find(
        {
            from: numero,
            idPregunta: idpreg,
            date: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        }
    )
    return dato;
}

const obtenerRegistroRutaMapa = async (numero, valor, tipo, ruta) => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    const total = await historyModel.updateMany(
        {
            from: numero,
            answer: valor,
            date: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        },
        {
            $set: { validado: "validado", tipoReg: tipo, rutadelmapa: ruta }
        }
    )
    return total;
}
const obtenerRegistro = async (numero, valor, tipo) => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    const total = await historyModel.updateMany(
        {
            validado: {
                $nin: [
                    'validado',
                ]
            },
            from: numero,
            answer: valor,
            date: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        },
        {
            $set: { validado: "validado", tipoReg: tipo }
        }
    )
    return total;
}

const obtenerRegistroExpedido = async (numero, valor, tipo, valorexpedido) => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    const total = await historyModel.updateMany(
        {
            from: numero,
            answer: valor,
            date: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        },
        {
            $set: { validado: "validado", tipoReg: tipo, valor: valorexpedido }
        }
    )
    return total;
}
const obtenerTotalSolicitudes = async () => {
    try {
        let total = await requestsModel.find({});

        return total;
    } 
    catch (error) {
        console.error("Error al obtener solicitudes:", error);
        return [];
    }
};

const exportarExcel = async () => {
    try {
        const solicitudes = await obtenerTotalSolicitudes();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Solicitudes');
        worksheet.columns = [
            { header: 'Numero', key: 'row1', width: 20 },
            { header: 'Nombre Completo', key: 'row2', width: 40 },
            { header: 'Ubicacion', key: 'row3', width: 20 },
            { header: 'CI', key: 'row4', width: 20 },
            { header: 'Fecha', key: 'row5', width: 20 },
            { header: 'Media', key: 'row6', width: 20 },
            { header: 'Ruta del Mapa', key: 'row8', width: 40 },
        ];
        worksheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0070C0' },
        };
        worksheet.getRow(1).eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
        solicitudes.forEach(solicitud => {
            worksheet.addRow({
                row1: solicitud.numero,
                row2: solicitud.nombreCompleto,
                row3: solicitud.Ubicacion,
                row4: solicitud.ci,
                row5: solicitud.fecha,
                row6: solicitud.convideo,
                row8: solicitud.rutadelmapa
            });
        });
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber !== 1) {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            }
        });
        await workbook.xlsx.writeFile('public/SolicitudesSaved.xlsx');
    } 
    catch (error) {
        console.log(error);
    }
};

async function cantidadSolicitudes(numero, valor, idpreg) {
    console.log("Valores----", numero, valor, idpreg);
    let cantidadIntentos = 0;
    const dato = await registroCantidadOpciones(numero, valor, idpreg);
    const resultado = await obtenerCantidadesErroneas(numero, valor, idpreg);
    console.log("Cantidad", idpreg, resultado.length);
    cantidadIntentos = resultado.length;
    return cantidadIntentos;
}

const esStringValido = (mensaje) => {
    if (typeof mensaje !== 'string') {
        return false;
    }
    const mensajeLimpio = mensaje.trim();
    if (mensajeLimpio === '') {
        return false;
    }
    const regexInvalido = /[^a-zA-Z .,!?;:'"()\u00C0-\u017F]/u;
    if (regexInvalido.test(mensajeLimpio)) {
        return false;
    }
    return true;
};

const esCorreoValido = (mensaje) => {
    if (typeof mensaje !== 'string') {
        return false;
    }
    const mensajeLimpio = mensaje.trim();
    if (mensajeLimpio === '') {
        return false;
    }
    const regexEmail = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (regexEmail.test(mensajeLimpio)) {
        return true;
    }
    const regexInvalido = /[^a-zA-Z0-9 .,!?;:'"()]/;
    if (regexInvalido.test(mensajeLimpio)) {
        return false;
    }
};

const esCIValido = (valor) => {
    if (typeof valor !== 'string') {
        return false;
    }
    const valorLimpio = valor.trim();
    const regexNumerico = /^[0-9]{5,}$/;
    return regexNumerico.test(valorLimpio);
};

function formatearFecha(fecha) {
    const opciones = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    };
    const formateador = new Intl.DateTimeFormat('es-ES', opciones);
    return formateador.format(fecha);
}

const tiempoEsperado = addKeyword(EVENTS.ACTION, { sensitive: true, capture: true, idle: 30000 })
    .addAnswer(
        [
            " "
        ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow }) => {
            try {
                const opcion = ctx.body;
                switch (opcion) {
                    case '100jueves':
                        return gotoFlow(flowBuscadorCIServicio);
                    default:
                        return gotoFlow(tiempoEsperado);
                }
            } 
            catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const inicio = addKeyword(EVENTS.WELCOME, { sensitive: true })
    .addAction(async (_, { flowDynamic }) => {
        try {
            const servicio = await saludoInicial();
            const fechaFormateada = formatearFecha(new Date(servicio[0].date));
            await flowDynamic([
                {
                    body: `${servicio[0].title}\n${fechaFormateada}\n${servicio[0].link}`,
                    media: servicio[0].featured_image,
                }
            ])
        } 
        catch (error) {
            console.log(error);
        }
    })
    .addAction(async (ctx, { flowDynamic }) => {
        try {
            const message = [
                {
                    body: `👋¡Hola! Bienvenido/a *${ctx.pushName}* al proyecto *“100 jueves de Acción por el Bien Común”*.`,
                    media: "",
                }
            ];
            await flowDynamic(message);
        } catch (error){
            console.error('Error en la acción:', error);
        }
    })
    .addAnswer(
        [
            `Seleccione una opcion por favor:`,
            '1️⃣. Quiero saber más sobre el programa',
            '2️⃣. Quiero hacer una solicitud',
            '3️⃣. Hacer seguimiento',
            '4️⃣. Cancelar',
            'Para consultas generales, por favor, comunícate con nuestra línea gratuita al 155. ¡Estamos para ayudarte!'
        ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                const opcion = ctx.body;
                switch (opcion) {
                    case '1':
                        await flowDynamic([
                            {
                                body: 'El programa ‘100 Jueves de Acción por el Bien Común’ busca mejorar los espacios públicos a través de acciones como deshierbe, limpieza de aceras y cunetas. ¡Participa haciendo una solicitud!"',
                                media: 'https://lapaz.bo/videos/video-100-jueves.mp4',
                                delay: 200
                            }
                        ])
                        return gotoFlow(flowSobrePrograma);
                    case '2':
                        return gotoFlow(flowBuscadorCIServicio);
                    case '3':
                        return gotoFlow(tiempoEsperado);
                    case '4':
                        return endFlow({
                            body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                        });
                    default:
                        const intentos = await cantidadSolicitudes(ctx.from, opcion, '2');
                        if (intentos > 2) {
                            return endFlow({
                                body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                            });
                        } else {
                            await flowDynamic('Por favor necesito que selecciones una opción válida.');
                            return fallBack();
                        }
                }
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const flowSobrePrograma = addKeyword(EVENTS.ACTION, { sensitive: true })
    .addAnswer([
        `Seleccione una opcion por favor:`,
        '1️⃣. Sí, quiero hacer una solicitud',
        '2️⃣. No, gracias',
        '3️⃣. Tengo otra consulta',
        '4️⃣. Volver al menu principal'
    ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                const opcion = ctx.body;
                switch (opcion) {
                    case '1':
                        return gotoFlow(flowBuscadorCIServicio);
                    case '2':
                        return endFlow({ body: 'Gracias por tu interés en los "100 Jueves de Acción por el Bien Común". ¡Hasta pronto! \n0️⃣. Regresar al Inicio.' });
                    case '3':
                        return endFlow({ body: 'Para consultas generales, por favor, comunícate con nuestra línea gratuita al 155. ¡Estamos para ayudarte! \n0️⃣. Regresar al Inicio.' });
                    case '4':
                        return gotoFlow(inicio);
                    default:
                        const intentos = await cantidadSolicitudes(ctx.from, opcion, '3');
                        if (intentos > 2) {
                            return endFlow({
                                body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                            });
                        } else {
                            await flowDynamic('Por favor necesito que selecciones una opción válida.');
                            return fallBack();
                        }
                }
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const flowBuscadorCIServicio = addKeyword(EVENTS.ACTION, { sensitive: true })
    .addAnswer([
        `Por favor, ingresa tu Cédula de Identidad (C.I.) para continuar.`,
        '0️⃣. Cancelar'
    ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                const opcion = ctx.body;
                const handleMaxAttempts = async () => {
                    const intentos = await cantidadSolicitudes(ctx.from, opcion, '4');
                    if (intentos > 2) {
                        return endFlow({
                            body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                        });
                    } else {
                        await flowDynamic('Verifica que el valor sea numérico y tenga al menos 5 dígitos.');
                        return fallBack();
                    }
                };
                if (opcion === '0') {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                const cedula = ctx.body;
                if (!esCIValido(cedula, cedula.length)) {
                    console.log("esCIValido---", esCIValido);

                    return handleMaxAttempts();
                }
                const datos = await consultarCI(ctx.from, cedula);
                if (datos[0]) {
                    const { dtspsl_paterno, dtspsl_materno, dtspsl_nombres } = datos[0];
                    await flowDynamic(`👋¡Hola, ${dtspsl_paterno} ${dtspsl_materno} ${dtspsl_nombres}!`);
                    const valor = await obtenerRegistro(ctx.from, ctx.body, 'CI');
                    const no = await obtenerRegistroNombrecompleto(ctx.from, ctx.body, `${dtspsl_paterno} ${dtspsl_materno} ${dtspsl_nombres}`);
                    return gotoFlow(flowUbicacion);
                }
                if (datos.error) {
                    if (datos.error.message == 'No se encontro coincidencia con el numero de celular ingresado') {
                        await flowDynamic('Hemos validado tu C.I. y número de celular, y parece que has cambiado de número. Para actualizarlo, por favor visita el siguiente enlace: \nhttps://igob247.lapaz.bo/app/view/autenticacion/partials/login_.html \n Una vez actualizado, vuelve aquí para completar tu solicitud.');
                        return endFlow({
                            body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                        });
                    } 
                    else {
                        const valor = await obtenerRegistro(ctx.from, ctx.body, 'CI');
                        return gotoFlow(flowRegistro);
                    }
                }

            } catch (error) {
                console.error(`Error en flowBuscadorCIServicio: ${error.message}`);
            }
        }
    );

const flowRegistro = addKeyword(EVENTS.ACTION, { sensitive: true })
    .addAnswer([
        `❌ No encontramos tu C.I. en nuestros registros.`,
        `Desea realizar el registro?`,
        'Seleccione una opcion por favor:',
        '1️⃣. Registrar ahora.',
        '0️⃣. Continuar sin registrar.'
    ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                const opcion = ctx.body;
                switch (opcion) {
                    case '1':
                        return gotoFlow(flowExpedido);
                    case '0':
                        const no = await obtenerRegistroNombrecompleto(ctx.from, ctx.body, "Sin nombre.");
                        return gotoFlow(flowUbicacion);
                    default:
                        const intentos = await cantidadSolicitudes(ctx.from, opcion, '5');
                        if (intentos > 2) {
                            return endFlow({
                                body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                            });
                        } else {
                            await flowDynamic('Por favor necesito que selecciones una opción válida.');
                            return fallBack();
                        }

                }
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const flowExpedido = addKeyword(EVENTS.ACTION, { sensitive: true })
    .addAnswer([
        `Por favor, ingresa el departamento en el que fue expedido tu carnet de identidad.`,
        `Selecciona una de las opciones.`,
        `Ejemplo:`,
        `1 -> LPZ - LA PAZ`,
        `2 -> CBB - COCHABAMBA`,
        `3 -> SCZ - SANTA CRUZ`,
        `4 -> CHQ - CHUQUISACA`,
        `5 -> TJA - TARIJA`,
        `6 -> PTS - POTOSI`,
        `7 -> ORU - ORURO`,
        `8 -> BNI - BENI`,
        `9 -> PND - PANDO`,
        `10 -> EXT - EXTRANJERO`,
    ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                const opcion = ctx.body;
                switch (opcion) {
                    case '1':
                        const valor = await obtenerRegistroExpedido(ctx.from, ctx.body, 'EXPEDIDO', 'LPZ');
                        return gotoFlow(flowNombre);
                    case '2':
                        const valor2 = await obtenerRegistroExpedido(ctx.from, ctx.body, 'EXPEDIDO', 'CBB');
                        return gotoFlow(flowNombre);
                    case '3':
                        const valor3 = await obtenerRegistroExpedido(ctx.from, ctx.body, 'EXPEDIDO', 'SCZ');
                        return gotoFlow(flowNombre);
                    case '4':
                        const valor4 = await obtenerRegistroExpedido(ctx.from, ctx.body, 'EXPEDIDO', 'CHQ');
                        return gotoFlow(flowNombre);
                    case '5':
                        const valor5 = await obtenerRegistroExpedido(ctx.from, ctx.body, 'EXPEDIDO', 'TJA');
                        return gotoFlow(flowNombre);
                    case '6':
                        const valor6 = await obtenerRegistroExpedido(ctx.from, ctx.body, 'EXPEDIDO', 'PTS');
                        return gotoFlow(flowNombre);
                    case '7':
                        const valor7 = await obtenerRegistroExpedido(ctx.from, ctx.body, 'EXPEDIDO', 'ORU');
                        return gotoFlow(flowNombre);
                    case '8':
                        const valor8 = await obtenerRegistroExpedido(ctx.from, ctx.body, 'EXPEDIDO', 'BNI');
                        return gotoFlow(flowNombre);
                    case '9':
                        const valor9 = await obtenerRegistroExpedido(ctx.from, ctx.body, 'EXPEDIDO', 'PND');
                        return gotoFlow(flowNombre);
                    case '10':
                        const valor10 = await obtenerRegistroExpedido(ctx.from, ctx.body, 'EXPEDIDO', 'EXT');
                        return gotoFlow(flowNombre);
                    default:
                        const intentos = await cantidadSolicitudes(ctx.from, opcion, '6');
                        if (intentos > 2) {
                            return endFlow({
                                body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                            });
                        } else {
                            await flowDynamic('Por favor necesito que selecciones una opción válida.');
                            return fallBack();
                        }

                }
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const flowNombre = addKeyword(EVENTS.ACTION, { sensitive: true })
    .addAnswer([
        `Por favor, ingresa los siguientes datos para registrarte.\n Nombres`
    ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                if (esStringValido(ctx.body)) {
                    const valor = await obtenerRegistro(ctx.from, ctx.body, 'NOMBRES');
                    return gotoFlow(flowApellidoPaterno);
                } 
                else {
                    const opcion = ctx.body;
                    const intentos = await cantidadSolicitudes(ctx.from, opcion, '7');
                    if (intentos > 2) {
                        return endFlow({
                            body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde!\n0️⃣. Regresar al Inicio.`
                        });
                    } else {
                        await flowDynamic('❌. Por favor, ingresa un nombre válido. Solo se admiten letras.');
                        return fallBack();
                    }
                }
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const flowApellidoPaterno = addKeyword(EVENTS.ACTION, { sensitive: true })
    .addAnswer([
        `Por favor, ingresa los siguientes datos para registrarte.\n Apellido Paterno`
    ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                if (esStringValido(ctx.body)) {
                    const valor = await obtenerRegistro(ctx.from, ctx.body, 'PATERNO');
                    return gotoFlow(flowApellidoMaterno);
                } 
                else {
                    const opcion = ctx.body;
                    const intentos = await cantidadSolicitudes(ctx.from, opcion, '8');
                    if (intentos > 2) {
                        return endFlow({
                            body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                        });
                    } else {
                        await flowDynamic('❌. Por favor, ingresa un apellido paterno válido. Solo se admiten letras.');
                        return fallBack();
                    }
                }
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const flowApellidoMaterno = addKeyword(EVENTS.ACTION, { sensitive: true })
    .addAnswer([
        `Por favor, ingresa los siguientes datos para registrarte.\n Apellido Materno`
    ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                if (esStringValido(ctx.body)) {
                    const valor = await obtenerRegistro(ctx.from, ctx.body, 'MATERNO');
                    return gotoFlow(flowCorreo);
                } 
                else {
                    const opcion = ctx.body;
                    const intentos = await cantidadSolicitudes(ctx.from, opcion, '9');
                    if (intentos > 2) {
                        return endFlow({
                            body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                        });
                    } else {
                        await flowDynamic('❌. Por favor, ingresa un apellido materno válido. Solo se admiten letras.');
                        return fallBack();
                    }
                }
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const flowCorreo = addKeyword(EVENTS.ACTION, { sensitive: true })
    .addAnswer([
        `Por favor, ingresa los siguientes datos para registrarte.\n Correo Electronico`
    ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                if (esCorreoValido(ctx.body)) {
                    const valor = await obtenerRegistro(ctx.from, ctx.body, 'CORREO');
                    var campos = {};
                    let valores = await obtenerRegistros(ctx.from);
                    valores = valores.reverse();
                    for (let x = 0; x < valores.length; x++) {
                        if ((valores[x].tipoReg == 'CI')&&(!campos.ci)) {
                            campos.ci = valores[x].answer;
                        }
                        if ((valores[x].tipoReg == 'EXPEDIDO')&&(!campos.expedido)) {
                            campos.expedido = valores[x].valor;
                        }
                        if ((valores[x].tipoReg == 'NOMBRES')&&(!campos.nombres)) {
                            campos.nombres = valores[x].answer;
                        }
                        if ((valores[x].tipoReg == 'PATERNO')&&(!campos.paterno)) {
                            campos.paterno = valores[x].answer;
                        }
                        if ((valores[x].tipoReg == 'MATERNO')&&(!campos.materno)) {
                            campos.materno = valores[x].answer;
                        }
                        if ((valores[x].tipoReg == 'CORREO')&&(!campos.correo)) {
                            campos.correo = valores[x].answer;
                        }
                    }
                    campos.movil = ctx.from.slice(3);
                    campos.movil_codigo = ctx.from;
                    campos.sistema = "IGOB247";
                    campos.sistema_creado = "IGOB247";
                    campos.tipo_persona = "NATURAL";
                    campos.usr_id = "0";
                    campos.activacionf = "NO";
                    campos.activaciond = "NO";
                    campos.tipo_documento = "carnet";
                    const estado = await registrarCiudadano(campos);
                    if (estado.success) {
                        await flowDynamic(`El registro fue exitoso, enviamos un mensaje a tu correo *${campos.correo}* . \n✅ Ahora, puedes continuar con la solicitud.`);
                        const datosCorreo = await enviarCorreo(estado.success.usuario, estado.success.pin, campos.correo);
                        return gotoFlow(flowUbicacion);
                    } 
                    else {
                        await flowDynamic(`${estado.error.message}`);
                        return endFlow({ body: '¡Gracias, por utilizar nuestros servicios! Si necesitas más información, no dudes en contactarnos. \n0️⃣. Regresar al Inicio.' });
                    }
                } 
                else {
                    const opcion = ctx.body;
                    const intentos = await cantidadSolicitudes(ctx.from, opcion, '10');
                    if (intentos > 2) {
                        return endFlow({
                            body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                        });
                    } else {
                        await flowDynamic('❌. Por favor, ingresa un correo electrónico válido. Asegúrate de que tenga un formato correcto (por ejemplo, usuario@dominio.com).');
                        return fallBack();
                    }
                }
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const flowOtros = addKeyword(EVENTS.ACTION, { sensitive: true })
    .addAnswer(
        [
            '👍🏻¡Excelente elección! Por favor, escribe la acción de servicio que te gustaría proponer.'
        ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                otros = ctx.body;
                if (esStringValido(otros)) {
                    return gotoFlow(flowUbicacion);
                } 
                else {
                    const opcion = ctx.body;
                    const intentos = await cantidadSolicitudes(ctx.from, opcion, '12');
                    if (intentos > 2) {
                        return endFlow({
                            body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                        });
                    } else {
                        await flowDynamic(' Por favor necesito valores reales');
                        return fallBack();
                    }
                }
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const flowMenuUbicacion = addKeyword(EVENTS.ACTION, { sensitive: true })
    .addAnswer(
        [
            '📍 Para ayudarnos a identificar el lugar exacto, ¿podrías compartirnos la ubicación del lugar?',
            'Seleccione una opcion por favor:',
            '1️⃣. Enviar ubicación del lugar.',
            '0️⃣. No tengo la ubicación lugar.'
        ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                const opcion = ctx.body;
                switch (opcion) {
                    case '1':
                        const valo = await obtenerRegistro(ctx.from, ctx.body, 'UBICACIONURL');
                        return gotoFlow(flowUbicacionGeoreferenciada);
                    case '0':
                        const valo2 = await obtenerRegistro(ctx.from, ctx.body, 'UBICACIONURL');
                        const valo3 = await obtenerRegistroRutaMapa(ctx.from, ctx.body, 'RUTAMAPA', `Sin ubicacion`);
                        await flowDynamic('¡No hay problema! Agradecemos igual tu contribución.');
                        return gotoFlow(flowFotos);
                    default:
                        const opcion = ctx.body;
                        const intentos = await cantidadSolicitudes(ctx.from, opcion, '13');
                        if (intentos > 2) {
                            return endFlow({
                                body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                            });
                        } else {
                            await flowDynamic('Por favor selecciona una opción válida.');
                            return fallBack();
                        }
                }
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const flowUbicacionGeoreferenciada = addKeyword(EVENTS.LOCATION, { sensitive: true })
    .addAnswer(
        [
            'Por favor, Envie la ubicacion del lugar.'
        ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                if (ctx.message.locationMessage) {
                    const valo = await obtenerRegistroRutaMapa(ctx.from, ctx.body, 'RUTAMAPA', `https://www.google.com/maps/search/?api=1&query=${ctx.message.locationMessage.degreesLatitude},${ctx.message.locationMessage.degreesLongitude}`);
                    await flowDynamic(`📍 Hemos registrado la ubicacion: ${ctx.message.locationMessage.degreesLatitude} / ${ctx.message.locationMessage.degreesLongitude}`);
                    return gotoFlow(flowFotos);
                } 
                else {
                    const opcion = ctx.body;
                    const intentos = await cantidadSolicitudes(ctx.from, opcion, '14');
                    if (intentos > 2) {
                        return endFlow({
                            body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                        });
                    } 
                    else {
                        await flowDynamic('Por favor, envíame una ubicación válida.');
                        return fallBack();
                    }
                }
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const flowUbicacion = addKeyword(EVENTS.ACTION, { sensitive: true })
    .addAnswer(
        [
            '📍¿Dónde te gustaría que realizáramos esta acción? \nDescribe la dirección del lugar con la mayor precisión posible (Ej: Zona, calle/avenida, al lado de, frente a).'
        ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                if (esStringValido(ctx.body)) {
                    const valo = await obtenerRegistro(ctx.from, ctx.body, 'UBICACIONDESC');
                    return gotoFlow(flowMenuUbicacion);
                } 
                else {
                    const intentos = await cantidadSolicitudes(ctx.from, opcion, '15');
                    if (intentos > 2) {
                        return endFlow({
                            body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                        });
                    } 
                    else {
                        await flowDynamic(' Por favor necesito valores reales');
                        return fallBack();
                    }
                }
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const flowFotos = addKeyword(EVENTS.ACTION, { sensitive: true })
    .addAnswer(
        [
            '📷 Ahora, si tienes alguna fotografía o video del lugar, sería genial que nos compartas para entender mejor la situación.',
            'Seleccione una opcion por favor:',
            '1️⃣. Enviar fotografías o videos',
            '0️⃣. No dispongo de fotos o videos'
        ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                const opcion = ctx.body;
                switch (opcion) {
                    case '1':
                        const valo = await obtenerRegistro(ctx.from, ctx.body, 'SUBIOFOTO');
                        return gotoFlow(flowAdjuntos);
                    case '0':
                        const valo2 = await obtenerRegistro(ctx.from, ctx.body, 'SUBIOFOTO');
                        await flowDynamic('¡No hay problema! Agradecemos igual tu contribución.');
                        try {
                            let resumeToSend = await getResumen(ctx);
                            await flowDynamic([{
                                body: resumeToSend,
                                delay: 200
                            }]);
                        } 
                        catch (error) {
                            console.error('Error en el flujo:', error);
                        }
                        return gotoFlow(flowResumen);
                    default:
                        const intentos = await cantidadSolicitudes(ctx.from, opcion, '16');
                        if (intentos > 2) {
                            return endFlow({
                                body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                            });
                        } else {
                            await flowDynamic('Por favor selecciona una opción válida.');
                            return fallBack();
                        }
                }
            } 
            catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const flowAdjuntos = addKeyword(EVENTS.ACTION, { sensitive: true })
    .addAnswer(
        [
            'Por favor, suba una imagen o video para continuar.'
        ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }

                await flowDynamic('Gracias');
                try {
                    let resumeToSend = await getResumen(ctx);
                    await flowDynamic([{
                        body: resumeToSend,
                        delay: 200
                    }]);
                } 
                catch (error) {
                    console.error('Error en el flujo:', error);
                }
                return gotoFlow(flowResumen);
            } 
            catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

async function getResumen(ctx){
    try {
        const fechaActual = new Date();
        var campos = {};
        let valores = await obtenerResumen(ctx.from);
        valores = valores.reverse();
        for (let x = 0; x < valores.length; x++) {
            if((valores[x].tipoReg == 'CI')&&(!campos.ci)) {
                campos.ci = valores[x].answer;
            }
            if((valores[x].tipoReg == 'EXPEDIDO')&&(!campos.expedido)) {
                campos.expedido = valores[x].valor;
            }
            if((valores[x].nombreCompleto)&&(!campos.nombreCompleto)) {
                campos.nombreCompleto = valores[x].nombreCompleto;
            }
            if((valores[x].tipoReg == 'PATERNO')&&(!campos.paterno)) {
                campos.paterno = valores[x].answer;
            }
            if((valores[x].tipoReg == 'MATERNO')&&(!campos.materno)) {
                campos.materno = valores[x].answer;
            }
            if((valores[x].tipoReg == 'NOMBRES')&&(!campos.nombres)) {
                campos.nombres = valores[x].answer;
            }
            if((valores[x].tipoReg == 'UBICACIONDESC')&&(!campos.Ubicacion)) {
                campos.Ubicacion = valores[x].answer;
            }
            if((valores[x].tipoReg == 'UBICACIONURL')&&(!campos.ubicacionurl)) {
                if (valores[x].answer == '1') {
                    campos.ubicacionurl = 'SI';
                }
                if (valores[x].answer == '0') {
                    campos.ubicacionurl = 'NO';
                }
            }
            if((valores[x].tipoReg == 'RUTAMAPA')&&(!campos.rutadelmapa)) {
                campos.rutadelmapa = valores[x].rutadelmapa;
            }
            if((valores[x].tipoReg == 'SUBIOFOTO')&&(!campos.convideo)) {
                if (valores[x].answer == '1') {
                    campos.convideo = 'SI';
                }
                if (valores[x].answer == '0') {
                    campos.convideo = 'NO';
                }
            }
        }
        campos.numero = ctx.from.slice(3);
        if (!campos.nombreCompleto) {
            campos.nombreCompleto = campos.paterno + " " + campos.materno + " " + campos.nombres;
        }
        campos.fecha = fechaActual;
        var rutacompuesta = "";
        if (campos.rutadelmapa) {
            rutacompuesta = campos.rutadelmapa;
        }
        let resumenToSend = `¡Gracias, continuación, te muestro un resumen de la informacion que enviaras:\n` +
            `✅ Nombre completo: ${campos.nombreCompleto} \n` +
            `✅ Dirección: ${campos.Ubicacion}.\n` +
            `✅ Ubicacion: ${rutacompuesta}.\n` +
            `✅ Foto/video: ${campos.convideo}.\n` +
            `✅ Fecha de solicitud: ${formatearFecha(campos.fecha)} \n` +
            `---------------\n` +
            `Tu solicitud ha sido registrada y será sometida a una inspección previa para asegurar que podamos realizar la acción de la mejor manera posible. ¡Gracias por tu contribución!`;

        return resumenToSend;
    } 
    catch (error) {
        console.error('Error en el flujo:', error);
    }
}

const flowResumen = addKeyword(EVENTS.ACTION, { sensitive: true })
    .addAnswer(
        [
            '¿Estas de acuerdo con esta informacion?',
            '1️⃣. Si, enviar solicitud',
            '2️⃣. No, nueva solicitud',
            '0️⃣. Cancelar y volver al inicio'
        ],
        { capture: true, idle: 300000 },
        async (ctx, { gotoFlow, fallBack, flowDynamic, endFlow }) => {
            try {
                if (ctx?.idleFallBack) {
                    return endFlow({
                        body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                    });
                }
                const opcion = ctx.body;
                switch (opcion) {
                    case '1':
                        try {
                            const fechaActual = new Date();
                            var campos = {};
                            let valores = await obtenerResumen(ctx.from);
                            valores = valores.reverse();
                            for (let x = 0; x < valores.length; x++) {
                                if((valores[x].tipoReg == 'CI')&&(!campos.ci)) {
                                    campos.ci = valores[x].answer;
                                }
                                if((valores[x].tipoReg == 'EXPEDIDO')&&(!campos.expedido)) {
                                    campos.expedido = valores[x].valor;
                                }
                                if((valores[x].nombreCompleto)&&(!campos.nombreCompleto)) {
                                    campos.nombreCompleto = valores[x].nombreCompleto;
                                }
                                if((valores[x].tipoReg == 'PATERNO')&&(!campos.paterno)) {
                                    campos.paterno = valores[x].answer;
                                }
                                if((valores[x].tipoReg == 'MATERNO')&&(!campos.materno)) {
                                    campos.materno = valores[x].answer;
                                }
                                if((valores[x].tipoReg == 'NOMBRES')&&(!campos.nombres)) {
                                    campos.nombres = valores[x].answer;
                                }
                                if((valores[x].tipoReg == 'UBICACIONDESC')&&(!campos.Ubicacion)) {
                                    campos.Ubicacion = valores[x].answer;
                                }
                                if((valores[x].tipoReg == 'UBICACIONURL')&&(!campos.ubicacionurl)) {
                                    if (valores[x].answer == '1') {
                                        campos.ubicacionurl = 'SI';
                                    }
                                    if (valores[x].answer == '0') {
                                        campos.ubicacionurl = 'NO';
                                    }
                                }
                                if((valores[x].tipoReg == 'RUTAMAPA')&&(!campos.rutadelmapa)) {
                                    campos.rutadelmapa = valores[x].rutadelmapa;
                                }
                                if((valores[x].tipoReg == 'SUBIOFOTO')&&(!campos.convideo)) {
                                    if (valores[x].answer == '1') {
                                        campos.convideo = 'SI';
                                    }
                                    if (valores[x].answer == '0') {
                                        campos.convideo = 'NO';
                                    }
                                }
                            }
                            campos.numero = ctx.from.slice(3);
                            if (!campos.nombreCompleto) {
                                campos.nombreCompleto = campos.paterno + " " + campos.materno + " " + campos.nombres;
                            }
                            campos.fecha = fechaActual;
                            var rutacompuesta = "";
                            if (campos.rutadelmapa) {
                                rutacompuesta = campos.rutadelmapa;
                            }
                            const valor = await registrarSolicitudes(campos);
                        } 
                        catch (error) {
                            console.error('Error en el flujo:', error);
                        }
                        return endFlow({ 
                            body: 'Tu solicitud ha sido registrada, será sometida a una inspección previa para asegurar que podamos realizar la acción de la mejor manera posible. \n0️⃣. Regresar al Inicio.'
                        });
                    case '2':
                        await flowDynamic('❌. Operacion cancelada, volviendo al menu.');
                        return gotoFlow(flowUbicacion);
                    case '0':
                        await flowDynamic('❌. Operacion cancelada, volviendo al menu.');
                        return gotoFlow(inicio);
                    default:
                        const intentos = await cantidadSolicitudes(ctx.from, opcion, '16');
                        if (intentos > 2) {
                            return endFlow({
                                body: `¡Gracias, por utilizar nuestros servicios, vemos que estas ocupad@ vuelve a intentarlo más tarde! \n0️⃣. Regresar al Inicio.`
                            });
                        } 
                        else {
                            await flowDynamic('Por favor selecciona una opción válida.');
                            return fallBack();
                        }
                }
            } 
            catch (error) {
                console.error(`Error: ${error.message}`);
            }
        }
    );

const flowReporte = addKeyword('GENER@REPORTE@741', { sensitive: true })
    .addAnswer([
        'Procesando...',
    ]).
    addAction(async (_, { flowDynamic }) => {
        try {
            await exportarExcel();
            await flowDynamic([
                {
                    body: "REPORTE",
                    media: process.env.APP_CURRENT_URL+'/descargar-reporte',
                    delay: 200
                }
            ]);
        } 
        catch (error) {
        }
    })

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/descargar-reporte', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'SolicitudesSaved.xlsx');
    res.download(filePath, 'SolicitudesSaved.xlsx', (err) => {
        if (err) {
            console.error('Error al descargar el archivo:', err);
            res.status(500).send('Hubo un problema al descargar el archivo.');
        }
    });
});
/*
app.get('/reporte-json', (req, res) => {
    try {
        const solicitudes = await obtenerTotalSolicitudes();
        return solicitudes;
    } 
    catch (error) {
        console.log(error);
    }
});
*/
const main = async () => {
    const adapterFlow = createFlow([
        inicio,
        flowReporte,
        tiempoEsperado,
        flowUbicacion,
        flowFotos,
        flowAdjuntos,
        flowOtros,
        flowSobrePrograma,
        flowBuscadorCIServicio,
        flowRegistro,
        flowExpedido,
        flowNombre,
        flowApellidoPaterno,
        flowApellidoMaterno,
        flowCorreo,
        flowMenuUbicacion,
        flowUbicacionGeoreferenciada,
        flowResumen
    ]);
    const adapterProvider = createProvider(BaileysProvider);
    createBot(
        {
            flow: adapterFlow,
            provider: adapterProvider,
            database: new MongoAdapter({
                dbUri: process.env.MONGO_DB_URI,
                dbName: process.env.MONGO_DB_NAME
            }),
        },
        {
            globalState: {
                encendido: true,
            }
        }
    );
    const BOTNAME = 'bot';
    QRPortalWeb({ name: BOTNAME, port: 8083 });

    const PORT = 4002
    app.listen(PORT, () => console.log(`http://localhost:${PORT}`))
};
main();
