require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const db = require('better-sqlite3')('datos_voz.db');
const cron = require('node-cron');

// --- 1. BASE DE DATOS ---
db.prepare(`
    CREATE TABLE IF NOT EXISTS actividad (
        user_id TEXT PRIMARY KEY, 
        username TEXT, 
        last_seen INTEGER
    )
`).run();

// --- 2. CONFIGURACIÓN DEL BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- 3. LISTA DE FRASES ALEATORIAS ---
const frasesCortas = [
    "¿Se te olvidó la contraseña o qué?",
    "El canal de voz se siente vacío sin tus gritos.",
    "Tus amigos ya están empezando a olvidar cómo suena tu voz.",
    "¿Te secuestraron o estás jugando a algo que no quieres que veamos?",
    "Incluso los bots te extrañan... un poquito.",
    "Ya ni los pingos te despiertan.",
    "Aparece un rato, no seas así."
];

const frasesLargas = [
    "⚠️ ESTADO: DESAPARECIDO. Hemos contactado a la Interpol.",
    "¿Ya vendiste la PC? Porque no hay otra explicación.",
    "Ni en los libros de historia hay registro de tu última conexión.",
    "Tu silla ya tiene telarañas y el micrófono tiene polvo.",
    "Estamos a un día de poner tu cara en un cartón de leche."
];

// --- 4. RASTREO DE SALIDA DE VOZ ---
client.on('voiceStateUpdate', (oldState, newState) => {
    if (oldState.channelId && !newState.channelId) {
        const userId = oldState.id;
        const username = oldState.member.user.username;
        const now = Date.now();
        
        const upsert = db.prepare(`
            INSERT INTO actividad (user_id, username, last_seen) 
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen, username = excluded.username
        `);
        upsert.run(userId, username, now);
    }
});

// --- 5. TAREA PROGRAMADA (CRON) - 9 PM ---
cron.schedule('0 21 * * *', async () => {
    console.log('Generando reporte con frases...');
    
    // CAMBIA ESTO POR TU ID DE CANAL
    const ID_CANAL = process.env.ID_CANAL || '1466527970033406311'; 
    const canal = await client.channels.fetch(ID_CANAL);
    if (!canal) return;

    const rows = db.prepare('SELECT * FROM actividad').all();
    if (rows.length === 0) return;

    const embed = new EmbedBuilder()
        .setTitle('🕵️ ¿Dónde están mis amigos?')
        .setColor(0x5865F2) // Color Blurple de Discord
        .setTimestamp();

    let lista = "";

    rows.forEach(row => {
        const msPasados = Date.now() - row.last_seen;
        const dias = Math.floor(msPasados / (1000 * 60 * 60 * 24));
        const horas = Math.floor((msPasados / (1000 * 60 * 60)) % 24);

        // Elegir frase según el tiempo
        let frase = "";
        if (dias >= 3) {
            frase = frasesLargas[Math.floor(Math.random() * frasesLargas.length)];
        } else {
            frase = frasesCortas[Math.floor(Math.random() * frasesCortas.length)];
        }

        let tiempo = dias > 0 ? `${dias}d ${horas}h` : `${horas}h`;
        
        lista += `**<@${row.user_id}>** (\`${tiempo}\` fuera)\n> *${frase}*\n\n`;
    });

    embed.setDescription(lista || "¡Increíble! Todos se conectaron hoy.");

    canal.send({ content: '🔔 **REPORTE DE LAS 21:00**', embeds: [embed] });
}, {
    timezone: "America/Santiago" // Ajusta según tu ciudad
});

client.once('ready', () => console.log(`🚀 Bot listo y vigilando.`));
client.login(process.env.TOKEN);