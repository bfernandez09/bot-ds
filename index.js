require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const db = require('better-sqlite3')('datos_voz.db');
const cron = require('node-cron');

// --- BASE DE DATOS ---
db.prepare(`
    CREATE TABLE IF NOT EXISTS actividad (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        last_seen INTEGER
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS sesiones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        username TEXT,
        fecha TEXT,
        duracion_ms INTEGER
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS apodos (
        user_id TEXT PRIMARY KEY,
        apodo TEXT
    )
`).run();

// --- CONFIGURACIÓN ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const ID_CANAL = process.env.ID_CANAL || '1466527970033406311';

// Trackea entradas a voz en memoria: user_id -> { username, timestamp }
const enVoz = new Map();

// --- FRASES ---
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

const frasesRecord = [
    "🏆 NUEVO RÉCORD HISTÓRICO DE AUSENCIA. Inscrito en el Libro Guinness.",
    "🦕 Los dinosaurios se extinguieron en menos tiempo que tú tardas en conectarte.",
    "🌌 Las estrellas nacen y mueren más rápido que tú apareces.",
    "📜 Los arqueólogos ya están excavando tu silla.",
    "🧊 Mandamos una expedición al Ártico, pensamos que estabas congelado ahí."
];

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function formatMs(ms) {
    const dias = Math.floor(ms / (1000 * 60 * 60 * 24));
    const horas = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const minutos = Math.floor((ms / (1000 * 60)) % 60);
    if (dias > 0) return `${dias}d ${horas}h`;
    if (horas > 0) return `${horas}h ${minutos}m`;
    return `${minutos}m`;
}

function hoy() {
    return new Date().toISOString().split('T')[0];
}

// --- RASTREO DE VOZ ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = oldState.member?.id || newState.member?.id;
    const username = oldState.member?.user.username || newState.member?.user.username;
    if (!userId) return;

    const entro = !oldState.channelId && newState.channelId;
    const salio = oldState.channelId && !newState.channelId;

    if (entro) {
        enVoz.set(userId, { username, timestamp: Date.now() });

        const nombre = encodeURIComponent(username.replace(/-/g, '--'));
        const memes = [
            `https://api.memegen.link/images/buzz/Hola,_${nombre}!/Por_fin_apareces.png`,
            `https://api.memegen.link/images/doge/wow._${nombre}_existe/much_online._very_here.png`,
            `https://api.memegen.link/images/aag/${nombre}_se_conectó/llamen_a_los_medios.png`,
            `https://api.memegen.link/images/oprah/tú_existes,_${nombre}?/TODOS_RECIBEN_UN_SUSTO.png`,
            `https://api.memegen.link/images/fine/Todo_normal/Excepto_que_apareció_${nombre}.png`,
        ];
        const url = memes[Math.floor(Math.random() * memes.length)];

        try {
            const canal = await client.channels.fetch(ID_CANAL);
            if (canal) {
                const embed = new EmbedBuilder().setImage(url).setColor(0x5865F2);
                canal.send({ content: `👋 <@${userId}>`, embeds: [embed] });
            }
        } catch (_) {}
    }

    if (salio) {
        const now = Date.now();

        db.prepare(`
            INSERT INTO actividad (user_id, username, last_seen)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen, username = excluded.username
        `).run(userId, username, now);

        if (enVoz.has(userId)) {
            const { timestamp } = enVoz.get(userId);
            const duracion = now - timestamp;
            db.prepare(`
                INSERT INTO sesiones (user_id, username, fecha, duracion_ms)
                VALUES (?, ?, ?, ?)
            `).run(userId, username, hoy(), duracion);
            enVoz.delete(userId);
        }
    }
});

// --- COMANDOS ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // !hola @usuario
    if (message.content.startsWith('!hola')) {
        const mencionado = message.mentions.users.first();
        if (!mencionado) return message.reply('Usa `!hola @usuario`');

        const nombre = encodeURIComponent(mencionado.username.replace(/-/g, '--'));

        const memes = [
            `https://api.memegen.link/images/buzz/Hola,_${nombre}!/Por_fin_apareces.png`,
            `https://api.memegen.link/images/doge/wow._${nombre}_existe/much_online._very_here.png`,
            `https://api.memegen.link/images/aag/${nombre}_se_conectó/llamen_a_los_medios.png`,
            `https://api.memegen.link/images/oprah/tú_existes,_${nombre}?/TODOS_RECIBEN_UN_SUSTO.png`,
            `https://api.memegen.link/images/fine/Todo_normal/Excepto_que_apareció_${nombre}.png`,
        ];

        const url = memes[Math.floor(Math.random() * memes.length)];

        const embed = new EmbedBuilder()
            .setImage(url)
            .setColor(0x5865F2);

        return message.reply({ content: `👋 <@${mencionado.id}>`, embeds: [embed] });
    }

    // !lastseen @usuario
    if (message.content.startsWith('!lastseen')) {
        const mencionado = message.mentions.users.first();
        if (!mencionado) return message.reply('Usa `!lastseen @usuario`');

        const row = db.prepare('SELECT * FROM actividad WHERE user_id = ?').get(mencionado.id);
        if (!row) return message.reply(`No tengo registros de **${mencionado.username}** en canales de voz.`);

        const msPasados = Date.now() - row.last_seen;
        const dias = Math.floor(msPasados / (1000 * 60 * 60 * 24));

        const embed = new EmbedBuilder()
            .setTitle(`🔍 Last Seen: ${mencionado.username}`)
            .setDescription(`Lleva **${formatMs(msPasados)}** fuera de los canales de voz.`)
            .setColor(dias >= 7 ? 0xFF0000 : dias >= 3 ? 0xFF8800 : 0x5865F2)
            .setTimestamp(row.last_seen);

        return message.reply({ embeds: [embed] });
    }

    // !apodo @usuario NombreAquí
    if (message.content.startsWith('!apodo')) {
        const mencionado = message.mentions.users.first();
        const partes = message.content.split(' ').slice(2);
        const apodo = partes.join(' ').trim();

        if (!mencionado || !apodo) return message.reply('Usa `!apodo @usuario Apodo Aquí`');

        db.prepare(`
            INSERT INTO apodos (user_id, apodo)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET apodo = excluded.apodo
        `).run(mencionado.id, apodo);

        return message.reply(`Listo, ahora **${mencionado.username}** se llama "*${apodo}*" para mí.`);
    }

    // !stats (ranking general de tiempo en voz)
    if (message.content.startsWith('!stats')) {
        const ranking = db.prepare(`
            SELECT user_id, username, SUM(duracion_ms) as total
            FROM sesiones
            GROUP BY user_id ORDER BY total DESC LIMIT 10
        `).all();

        if (ranking.length === 0) return message.reply('Todavía no hay sesiones registradas.');

        const lista = ranking.map((r, i) => {
            const apodoRow = db.prepare('SELECT apodo FROM apodos WHERE user_id = ?').get(r.user_id);
            const nombre = apodoRow ? `${r.username} "*${apodoRow.apodo}*"` : r.username;
            return `${i + 1}. **${nombre}** — ${formatMs(r.total)}`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('📊 Ranking histórico de tiempo en voz')
            .setDescription(lista)
            .setColor(0x5865F2)
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
});

// --- CRON DIARIO 9 PM ---
cron.schedule('0 21 * * *', async () => {
    const canal = await client.channels.fetch(ID_CANAL);
    if (!canal) return;

    const rows = db.prepare('SELECT * FROM actividad').all();
    if (rows.length === 0) return;

    const esLunes = new Date().getDay() === 1;

    const embed = new EmbedBuilder()
        .setTitle(esLunes ? '📅 LUNES: SEMANA NUEVA, MISMOS DESAPARECIDOS' : '🕵️ ¿Dónde están mis amigos?')
        .setColor(esLunes ? 0xFF0000 : 0x5865F2)
        .setTimestamp();

    let lista = '';
    rows.forEach(row => {
        const msPasados = Date.now() - row.last_seen;
        const dias = Math.floor(msPasados / (1000 * 60 * 60 * 24));

        const apodoRow = db.prepare('SELECT apodo FROM apodos WHERE user_id = ?').get(row.user_id);
        const nombre = apodoRow ? `"${apodoRow.apodo}"` : row.username;

        let frase;
        if (dias >= 7) frase = pick(frasesRecord);
        else if (dias >= 3) frase = pick(frasesLargas);
        else frase = pick(frasesCortas);

        lista += `**<@${row.user_id}>** (${nombre}, \`${formatMs(msPasados)}\` fuera)\n> *${frase}*\n\n`;
    });

    embed.setDescription(lista || '¡Increíble! Todos se conectaron hoy.');

    // Más activo del día
    const masActivo = db.prepare(`
        SELECT user_id, username, SUM(duracion_ms) as total
        FROM sesiones WHERE fecha = ?
        GROUP BY user_id ORDER BY total DESC LIMIT 1
    `).get(hoy());

    if (masActivo) {
        embed.setFooter({ text: `🏅 Más activo hoy: ${masActivo.username} (${formatMs(masActivo.total)} en voz)` });
    }

    // Ranking semanal solo los lunes
    if (esLunes) {
        const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const rankSemana = db.prepare(`
            SELECT user_id, username, SUM(duracion_ms) as total
            FROM sesiones WHERE fecha >= ?
            GROUP BY user_id ORDER BY total DESC
        `).all(hace7dias);

        if (rankSemana.length > 0) {
            const rankTexto = rankSemana.map((r, i) =>
                `${i + 1}. **${r.username}** — ${formatMs(r.total)}`
            ).join('\n');
            embed.addFields({ name: '📊 Ranking de la semana', value: rankTexto });
        }
    }

    canal.send({
        content: esLunes ? '🚨 **REPORTE SEMANAL DEL LUNES**' : '🔔 **REPORTE DE LAS 21:00**',
        embeds: [embed]
    });
}, { timezone: 'America/Santiago' });

client.once('ready', () => console.log(`🚀 Bot listo y vigilando.`));
client.login(process.env.TOKEN);
