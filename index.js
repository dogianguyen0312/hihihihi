const { Client } = require('discord.js-selfbot-v13');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    NoSubscriberBehavior 
} = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

function LoadConfig() {
    try {
        const Data = fs.readFileSync('config.json', 'utf8');
        return JSON.parse(Data);
    } catch (Error) {
        console.error("Config Error: File Not Found Or Invalid.");
        process.exit(1);
    }
}

const Config = LoadConfig();
const MusicPath = path.resolve(Config.music_file || 'music.mp3');

class MusicSelfbot extends Client {
    constructor() {
        super({
            checkUpdate: false,
            syncStatus: false,
            ws: { properties: { $browser: 'Discord iOS' } }
        });

        this.IsJoining = false;
        this.Connection = null;
        this.Player = null;
        this.Volume = Config.volume !== undefined ? parseFloat(Config.volume) : 0.5;

        this.on('ready', this.HandleReady.bind(this));
        this.on('voiceStateUpdate', this.HandleVoiceUpdate.bind(this));
    }

    PlayLoop() {
        if (!this.Connection) return;

        try {
            if (!fs.existsSync(MusicPath)) {
                return console.error("Error: Music File Not Found.");
            }

            const Resource = createAudioResource(MusicPath, { inlineVolume: true });
            Resource.volume.setVolume(this.Volume);

            this.Player = createAudioPlayer({
                behaviors: { noSubscriber: NoSubscriberBehavior.Play }
            });

            this.Player.play(Resource);
            this.Connection.subscribe(this.Player);

            this.Player.on(AudioPlayerStatus.Idle, () => this.PlayLoop());

            this.Player.on('error', (Error) => {
                console.error("Player Error: Connection Issue.");
                setTimeout(() => this.PlayLoop(), 2000);
            });

        } catch (E) {
            console.error("Playback Error: Failed To Initialize.");
        }
    }

    async ConnectToVoice() {
        if (this.IsJoining) return;
        this.IsJoining = true;

        try {
            const Guild = this.guilds.cache.get(Config.guild_id);
            const Channel = Guild?.channels.cache.get(Config.channel_id);

            if (!Channel) {
                throw new Error("Target Channel Not Found.");
            }

            this.Connection = joinVoiceChannel({
                channelId: Channel.id,
                guildId: Guild.id,
                adapterCreator: Guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            });

            console.log("Connected To: " + Channel.name);
            this.PlayLoop();

            this.IsJoining = false;
        } catch (E) {
            this.IsJoining = false;
            console.error("Connection Failed: Retrying...");
            setTimeout(() => this.ConnectToVoice(), 5000);
        }
    }

    HandleReady() {
        console.log("Bot Online: " + this.user.tag);
        this.ConnectToVoice();
    }

    HandleVoiceUpdate(OldState, NewState) {
        if (NewState.member.id !== this.user.id) return;

        if (NewState.channelId !== Config.channel_id && !this.IsJoining) {
            console.log("Status: Reconnecting To Correct Channel...");
            setTimeout(() => this.ConnectToVoice(), 2500);
        }
    }
}

const Bot = new MusicSelfbot();
Bot.login(Config.token).catch((Err) => {
    console.error("Login Error: Check Your Token.");
});

process.on('unhandledRejection', (Reason) => {});
